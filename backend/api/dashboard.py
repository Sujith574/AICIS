"""
Dashboard endpoint — aggregated data for the React frontend.
GET /dashboard/data
"""
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from db.mongo import get_db
from models.schemas import DashboardData, StudentSummary
from services.auth_service import get_current_user

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


def _generate_insights(students_summary: list, timeline: list) -> list[str]:
    """Generate human-readable teacher insights from the data."""
    insights = []

    if not students_summary:
        return ["No data yet. Start a session to see insights."]

    # 1. Class average attention
    avg_att = sum(s["avg_attention"] for s in students_summary) / len(students_summary)
    insights.append(f"Class average attention score is {avg_att:.1f}/100.")

    # 2. High-risk count
    high_risk = [s for s in students_summary if s.get("risk_level") == "High"]
    if high_risk:
        names = ", ".join(s["name"] for s in high_risk[:3])
        insights.append(f"⚠️  {len(high_risk)} student(s) at HIGH risk: {names}.")

    # 3. Engagement drop-off
    if len(timeline) >= 4:
        first_half = [t["avg_attention"] for t in timeline[: len(timeline) // 2]]
        second_half = [t["avg_attention"] for t in timeline[len(timeline) // 2 :]]
        fh_avg = sum(first_half) / len(first_half)
        sh_avg = sum(second_half) / len(second_half)
        diff = fh_avg - sh_avg
        if diff > 10:
            insights.append(
                f"📉 Engagement drops by {diff:.1f} pts in the second half of sessions."
            )
        elif sh_avg - fh_avg > 10:
            insights.append(
                f"📈 Engagement improves by {sh_avg - fh_avg:.1f} pts over time — great momentum!"
            )

    # 4. Consistently distracted students
    distracted = [
        s for s in students_summary if s.get("avg_attention", 100) < 40
    ]
    if distracted:
        for d in distracted[:2]:
            insights.append(
                f"🔴 {d['name']} is consistently distracted (avg attention: {d['avg_attention']:.0f})."
            )

    # 5. Perfect attendance
    perfect = [s for s in students_summary if s.get("attendance_pct", 0) == 100]
    if perfect:
        insights.append(
            f"✅  {len(perfect)} student(s) have perfect attendance this term."
        )

    return insights[:8]  # cap at 8


@router.get("/data")
async def get_dashboard_data(current_user: dict = Depends(get_current_user)):
    db = get_db()

    total_students = await db.students.count_documents({})
    total_sessions = await db.sessions.count_documents({})

    # Per-student summary
    students_raw = await db.students.find({}).to_list(500)
    students_summary = []

    for s in students_raw:
        sid = s["student_id"]

        # Attendance %
        attended = await db.attendance.count_documents(
            {"student_id": sid, "status": "present"}
        )
        att_pct = (attended / total_sessions * 100) if total_sessions > 0 else 0.0

        # Avg attention
        pipeline = [
            {"$match": {"student_id": sid}},
            {"$group": {"_id": None, "avg": {"$avg": "$attention_score"}}},
        ]
        agg = await db.engagement_logs.aggregate(pipeline).to_list(1)
        avg_attention = agg[0]["avg"] if agg else 0.0

        # Risk from cache
        risk_doc = await db.risk_predictions.find_one({"student_id": sid})
        risk_level = risk_doc["risk_level"] if risk_doc else "Unknown"

        sessions_count = attended

        students_summary.append({
            "student_id":     sid,
            "name":           s["name"],
            "attendance_pct": round(att_pct, 1),
            "avg_attention":  round(avg_attention, 1),
            "risk_level":     risk_level,
            "sessions_count": sessions_count,
        })

    # Class averages
    class_avg_attention = (
        sum(s["avg_attention"] for s in students_summary) / len(students_summary)
        if students_summary else 0.0
    )
    class_avg_attendance = (
        sum(s["attendance_pct"] for s in students_summary) / len(students_summary)
        if students_summary else 0.0
    )
    at_risk_count = sum(1 for s in students_summary if s["risk_level"] == "High")

    # Engagement timeline (last 30 min buckets across all sessions)
    timeline_pipeline = [
        {
            "$group": {
                "_id": {
                    "$dateToString": {"format": "%Y-%m-%dT%H:%M", "date": "$timestamp"}
                },
                "avg_attention": {"$avg": "$attention_score"},
            }
        },
        {"$sort": {"_id": 1}},
        {"$limit": 60},
    ]
    timeline_raw = await db.engagement_logs.aggregate(timeline_pipeline).to_list(60)
    timeline = [
        {"time": r["_id"], "avg_attention": round(r["avg_attention"], 2)}
        for r in timeline_raw
    ]

    insights = _generate_insights(students_summary, timeline)

    return {
        "total_students":       total_students,
        "total_sessions":       total_sessions,
        "class_avg_attention":  round(class_avg_attention, 1),
        "class_avg_attendance": round(class_avg_attendance, 1),
        "at_risk_count":        at_risk_count,
        "students":             students_summary,
        "insights":             insights,
        "engagement_timeline":  timeline,
    }
