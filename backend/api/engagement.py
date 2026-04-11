"""
Engagement endpoints
- POST /engagement/analyze    → single-frame engagement analysis
- GET  /engagement/history    → engagement logs for a session/student
- GET  /engagement/timeline   → aggregated 5-min bucket timeline
"""
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Query

from db.mongo import get_db
from models.schemas import EngagementRequest, EngagementResult
from services.engagement_service import analyze_frame
from services.auth_service import get_current_user

router = APIRouter(prefix="/engagement", tags=["Engagement"])


@router.post("/analyze", response_model=EngagementResult)
async def analyze_engagement(
    payload: EngagementRequest,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()

    result = analyze_frame(payload.frame_b64)
    if result is None:
        raise HTTPException(422, "No face detected in the provided frame")

    doc = {
        "student_id": payload.student_id,
        "session_id": payload.session_id,
        **result,
    }
    await db.engagement_logs.insert_one(doc)

    return EngagementResult(
        student_id=payload.student_id,
        session_id=payload.session_id,
        **result,
    )


@router.get("/history")
async def get_engagement_history(
    session_id: Optional[str] = Query(None),
    student_id: Optional[str] = Query(None),
    limit: int = Query(200, le=1000),
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    query = {}
    if session_id:
        query["session_id"] = session_id
    if student_id:
        query["student_id"] = student_id

    logs = await db.engagement_logs.find(query).sort("timestamp", -1).to_list(limit)
    return [
        {
            "student_id":      l["student_id"],
            "session_id":      l["session_id"],
            "timestamp":       l["timestamp"].isoformat(),
            "attention_score": l["attention_score"],
            "eye_aspect_ratio": l.get("eye_aspect_ratio", 0),
            "head_yaw":        l.get("head_yaw", 0),
            "gaze_score":      l.get("gaze_score", 0),
            "blink_detected":  l.get("blink_detected", False),
        }
        for l in logs
    ]


@router.get("/timeline")
async def engagement_timeline(
    session_id: str = Query(...),
    bucket_minutes: int = Query(5),
    current_user: dict = Depends(get_current_user),
):
    """Return avg attention score per time bucket for a session."""
    db = get_db()
    pipeline = [
        {"$match": {"session_id": session_id}},
        {"$sort":  {"timestamp": 1}},
        {
            "$group": {
                "_id": {
                    "$dateToString": {
                        "format": f"%Y-%m-%dT%H:%M",
                        "date":   "$timestamp",
                    }
                },
                "avg_attention": {"$avg": "$attention_score"},
                "count":         {"$sum": 1},
            }
        },
        {"$sort": {"_id": 1}},
    ]
    results = await db.engagement_logs.aggregate(pipeline).to_list(500)
    return [
        {"time": r["_id"], "avg_attention": round(r["avg_attention"], 2), "count": r["count"]}
        for r in results
    ]


@router.get("/student-averages")
async def student_engagement_averages(
    session_id: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    """Return avg attention score per student (optionally filtered by session)."""
    db = get_db()
    match = {}
    if session_id:
        match["session_id"] = session_id

    pipeline = [
        {"$match": match},
        {
            "$group": {
                "_id":           "$student_id",
                "avg_attention": {"$avg": "$attention_score"},
                "count":         {"$sum": 1},
                "min_attention": {"$min": "$attention_score"},
                "max_attention": {"$max": "$attention_score"},
            }
        },
    ]
    results = await db.engagement_logs.aggregate(pipeline).to_list(200)
    enriched = []
    for r in results:
        student = await db.students.find_one({"student_id": r["_id"]})
        enriched.append({
            "student_id":    r["_id"],
            "student_name":  student["name"] if student else "Unknown",
            "avg_attention": round(r["avg_attention"], 2),
            "min_attention": round(r["min_attention"], 2),
            "max_attention": round(r["max_attention"], 2),
            "sample_count":  r["count"],
        })
    return enriched
