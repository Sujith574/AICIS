"""
Risk prediction endpoints
- POST /risk/predict         → predict risk for one student
- GET  /risk/all             → risk levels for all students
- POST /risk/compute-all     → background-compute risk for all students
"""
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Query

from db.mongo import get_db
from models.schemas import RiskRequest, RiskResult
from services.risk_service import predict_risk
from services.auth_service import get_current_user

router = APIRouter(prefix="/risk", tags=["Risk"])


async def _compute_student_metrics(db, student_id: str) -> dict:
    """Compute attendance %, avg attention, engagement trend for a student."""
    # Attendance %
    total_sessions = await db.sessions.count_documents({})
    attended = await db.attendance.count_documents(
        {"student_id": student_id, "status": "present"}
    )
    attendance_pct = (attended / total_sessions * 100) if total_sessions > 0 else 0.0

    # Average attention
    pipeline = [
        {"$match": {"student_id": student_id}},
        {"$group": {"_id": None, "avg": {"$avg": "$attention_score"}}},
    ]
    agg = await db.engagement_logs.aggregate(pipeline).to_list(1)
    avg_attention = agg[0]["avg"] if agg else 50.0

    # Engagement trend (recent vs older)
    logs = (
        await db.engagement_logs.find({"student_id": student_id})
        .sort("timestamp", 1)
        .to_list(200)
    )
    if len(logs) >= 10:
        mid = len(logs) // 2
        old_avg = sum(l["attention_score"] for l in logs[:mid]) / mid
        new_avg = sum(l["attention_score"] for l in logs[mid:]) / (len(logs) - mid)
        trend = (new_avg - old_avg) / 100.0  # normalised to -1..1
    else:
        trend = 0.0

    return {
        "attendance_pct":  round(attendance_pct, 2),
        "avg_attention":   round(avg_attention, 2),
        "engagement_trend": round(trend, 4),
    }


@router.post("/predict", response_model=RiskResult)
async def predict_student_risk(
    payload: RiskRequest,
    current_user: dict = Depends(get_current_user),
):
    risk_level, probability = predict_risk(
        payload.attendance_pct,
        payload.avg_attention,
        payload.engagement_trend,
    )
    doc = {
        "student_id":        payload.student_id,
        "computed_at":       datetime.utcnow(),
        "attendance_pct":    payload.attendance_pct,
        "avg_attention_score": payload.avg_attention,
        "engagement_trend":  payload.engagement_trend,
        "risk_level":        risk_level,
        "risk_probability":  probability,
    }
    db = get_db()
    await db.risk_predictions.replace_one(
        {"student_id": payload.student_id}, doc, upsert=True
    )
    return RiskResult(
        student_id=payload.student_id,
        risk_level=risk_level,
        risk_probability=probability,
        computed_at=doc["computed_at"],
    )


@router.get("/all")
async def get_all_risk(current_user: dict = Depends(get_current_user)):
    db = get_db()
    risks = await db.risk_predictions.find({}).to_list(500)
    enriched = []
    for r in risks:
        student = await db.students.find_one({"student_id": r["student_id"]})
        enriched.append({
            "student_id":      r["student_id"],
            "student_name":    student["name"] if student else "Unknown",
            "risk_level":      r["risk_level"],
            "risk_probability": r["risk_probability"],
            "attendance_pct":  r.get("attendance_pct", 0),
            "avg_attention":   r.get("avg_attention_score", 0),
            "computed_at":     r["computed_at"].isoformat(),
        })
    return enriched


@router.post("/compute-all")
async def compute_all_risk(current_user: dict = Depends(get_current_user)):
    """Re-compute risk for every registered student."""
    db = get_db()
    students = await db.students.find({}).to_list(500)
    updated = []

    for student in students:
        sid = student["student_id"]
        metrics = await _compute_student_metrics(db, sid)
        risk_level, probability = predict_risk(**metrics)

        doc = {
            "student_id":        sid,
            "computed_at":       datetime.utcnow(),
            "attendance_pct":    metrics["attendance_pct"],
            "avg_attention_score": metrics["avg_attention"],
            "engagement_trend":  metrics["engagement_trend"],
            "risk_level":        risk_level,
            "risk_probability":  probability,
        }
        await db.risk_predictions.replace_one({"student_id": sid}, doc, upsert=True)
        updated.append({"student_id": sid, "risk_level": risk_level})

    return {"updated": len(updated), "results": updated}
