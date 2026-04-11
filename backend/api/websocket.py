"""
WebSocket endpoint for live session streaming.
Clients connect to ws://localhost:8000/ws/live-session/{session_id}
and send base64 frames. The server responds with face recognition
+ engagement data in real time.
"""
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from datetime import datetime

from db.mongo import get_db
from services.face_service import recognize_face
from services.engagement_service import analyze_frame

router = APIRouter(tags=["WebSocket"])


class ConnectionManager:
    def __init__(self):
        # session_id → set of connected WebSockets
        self.active: dict[str, set[WebSocket]] = {}

    async def connect(self, ws: WebSocket, session_id: str):
        await ws.accept()
        self.active.setdefault(session_id, set()).add(ws)

    def disconnect(self, ws: WebSocket, session_id: str):
        if session_id in self.active:
            self.active[session_id].discard(ws)

    async def broadcast(self, session_id: str, data: dict):
        dead = []
        for ws in list(self.active.get(session_id, set())):
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.active[session_id].discard(ws)


manager = ConnectionManager()


@router.websocket("/ws/live-session/{session_id}")
async def live_session(ws: WebSocket, session_id: str):
    """
    Expects JSON messages: { "frame_b64": "data:image/jpeg;base64,..." }
    Responds with recognition + engagement JSON per frame.
    """
    await manager.connect(ws, session_id)
    db = get_db()
    try:
        while True:
            raw = await ws.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await ws.send_json({"error": "Invalid JSON"})
                continue

            frame_b64 = msg.get("frame_b64", "")
            if not frame_b64:
                continue

            # Face recognition
            student_id, confidence = recognize_face(frame_b64)

            # Mark attendance if recognised
            if student_id:
                existing = await db.attendance.find_one(
                    {"student_id": student_id, "session_id": session_id}
                )
                if not existing:
                    await db.attendance.insert_one({
                        "student_id": student_id,
                        "session_id": session_id,
                        "timestamp":  datetime.utcnow(),
                        "status":     "present",
                        "confidence": confidence,
                    })

            # Engagement analysis
            engagement = analyze_frame(frame_b64)
            if engagement and student_id:
                doc = {
                    "student_id": student_id,
                    "session_id": session_id,
                    **engagement,
                }
                await db.engagement_logs.insert_one(doc)

            response = {
                "student_id":  student_id,
                "confidence":  confidence,
                "engagement":  {
                    k: v.isoformat() if isinstance(v, datetime) else v
                    for k, v in (engagement or {}).items()
                },
                "timestamp": datetime.utcnow().isoformat(),
            }
            await ws.send_json(response)

    except WebSocketDisconnect:
        manager.disconnect(ws, session_id)
