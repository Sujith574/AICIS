"""
Attendance endpoints
- POST /attendance/mark        → face-recognize and mark attendance
- POST /attendance/sessions    → create a new session
- GET  /attendance/sessions    → list sessions
- PUT  /attendance/sessions/{id}/end → end session
- GET  /attendance             → get attendance records (with filters)
- GET  /attendance/export-csv  → download CSV
"""
import io
import csv
import uuid
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import StreamingResponse

from db.mongo import get_db
from models.schemas import AttendanceMarkRequest, SessionCreate, SessionOut
from services.face_service import recognize_face
from services.auth_service import get_current_user

router = APIRouter(prefix="/attendance", tags=["Attendance"])


# ── Sessions ──────────────────────────────────────────────────────────────────
@router.post("/sessions", response_model=SessionOut)
async def create_session(
    payload: SessionCreate,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    doc = {
        "session_id": str(uuid.uuid4()),
        "subject":    payload.subject,
        "teacher":    current_user["username"],
        "started_at": datetime.utcnow(),
        "ended_at":   None,
        "status":     "active",
    }
    await db.sessions.insert_one(doc)
    return SessionOut(**{k: v for k, v in doc.items() if k != "_id"})


@router.get("/sessions", response_model=list[SessionOut])
async def list_sessions(
    status: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    query = {}
    if status:
        query["status"] = status
    docs = await db.sessions.find(query).sort("started_at", -1).to_list(100)
    return [SessionOut(**{k: v for k, v in d.items() if k != "_id"}) for d in docs]


@router.put("/sessions/{session_id}/end")
async def end_session(session_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    result = await db.sessions.update_one(
        {"session_id": session_id, "status": "active"},
        {"$set": {"status": "ended", "ended_at": datetime.utcnow()}},
    )
    if result.modified_count == 0:
        raise HTTPException(404, "Active session not found")
    return {"message": "Session ended"}


# ── Mark Attendance ───────────────────────────────────────────────────────────
@router.post("/mark")
async def mark_attendance(
    payload: AttendanceMarkRequest,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()

    # Validate session
    session = await db.sessions.find_one(
        {"session_id": payload.session_id, "status": "active"}
    )
    if not session:
        raise HTTPException(404, "Active session not found")

    # Recognize face
    student_id, confidence = recognize_face(payload.frame_b64)
    if not student_id:
        return {"status": "no_face_detected", "confidence": 0.0}

    # Upsert attendance (one record per student per session)
    existing = await db.attendance.find_one(
        {"student_id": student_id, "session_id": payload.session_id}
    )
    if existing:
        return {
            "status":     "already_marked",
            "student_id": student_id,
            "confidence": confidence,
        }

    doc = {
        "student_id": student_id,
        "session_id": payload.session_id,
        "timestamp":  datetime.utcnow(),
        "status":     "present",
        "confidence": confidence,
    }
    await db.attendance.insert_one(doc)
    return {"status": "marked", "student_id": student_id, "confidence": confidence}


# ── Query Attendance ──────────────────────────────────────────────────────────
@router.get("/")
async def get_attendance(
    session_id: Optional[str] = Query(None),
    student_id: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    query = {}
    if session_id:
        query["session_id"] = session_id
    if student_id:
        query["student_id"] = student_id

    records = await db.attendance.find(query).sort("timestamp", -1).to_list(1000)
    # enrich with student name
    result = []
    for r in records:
        student = await db.students.find_one({"student_id": r["student_id"]})
        result.append({
            "student_id":  r["student_id"],
            "student_name": student["name"] if student else "Unknown",
            "session_id":  r["session_id"],
            "timestamp":   r["timestamp"].isoformat(),
            "status":      r["status"],
            "confidence":  r["confidence"],
        })
    return result


# ── CSV Export ────────────────────────────────────────────────────────────────
@router.get("/export-csv")
async def export_attendance_csv(
    session_id: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    query = {}
    if session_id:
        query["session_id"] = session_id

    records = await db.attendance.find(query).sort("timestamp", -1).to_list(5000)

    output = io.StringIO()
    writer = csv.DictWriter(
        output,
        fieldnames=["student_id", "student_name", "session_id", "timestamp", "status", "confidence"],
    )
    writer.writeheader()

    for r in records:
        student = await db.students.find_one({"student_id": r["student_id"]})
        writer.writerow({
            "student_id":   r["student_id"],
            "student_name": student["name"] if student else "Unknown",
            "session_id":   r["session_id"],
            "timestamp":    r["timestamp"].isoformat(),
            "status":       r["status"],
            "confidence":   r["confidence"],
        })

    output.seek(0)
    filename = f"attendance_{session_id or 'all'}_{datetime.utcnow().strftime('%Y%m%d')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
