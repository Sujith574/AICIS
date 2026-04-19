"""Pydantic v2 schemas for the AICIS backend."""
from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List
from datetime import datetime
from enum import Enum


# ── Enums ─────────────────────────────────────────────────────────────────────
class RiskLevel(str, Enum):
    LOW    = "Low"
    MEDIUM = "Medium"
    HIGH   = "High"


class AttendanceStatus(str, Enum):
    PRESENT = "present"
    ABSENT  = "absent"


class SessionStatus(str, Enum):
    ACTIVE = "active"
    ENDED  = "ended"


# ── Auth ──────────────────────────────────────────────────────────────────────
class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    role: str = "teacher"


class UserOut(BaseModel):
    username: str
    email: str
    role: str
    created_at: datetime


class LoginRequest(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str
    role: str


# ── Students ──────────────────────────────────────────────────────────────────
class StudentCreate(BaseModel):
    student_id: str = Field(..., example="STU001")
    name:       str = Field(..., example="Alice Johnson")
    email:      EmailStr


class StudentOut(BaseModel):
    student_id: str
    name:       str
    email:      str
    registered_at: datetime
    registered_by: str


# ── Sessions ──────────────────────────────────────────────────────────────────
class SessionCreate(BaseModel):
    subject: str


class SessionOut(BaseModel):
    session_id: str
    subject:    str
    teacher:    str
    started_at: datetime
    ended_at:   Optional[datetime] = None
    status:     str


# ── Attendance ────────────────────────────────────────────────────────────────
class AttendanceRecord(BaseModel):
    student_id:  str
    session_id:  str
    timestamp:   datetime
    status:      AttendanceStatus
    confidence:  float


class AttendanceMarkRequest(BaseModel):
    session_id: str
    frame_b64:  str   # base64-encoded JPEG frame from webcam


# ── Engagement ────────────────────────────────────────────────────────────────
class EngagementRequest(BaseModel):
    student_id: str
    session_id: str
    frame_b64:  str


class EngagementResult(BaseModel):
    student_id:       str
    session_id:       str
    timestamp:        datetime
    attention_score:  float
    eye_aspect_ratio: float
    head_pitch:       float
    head_yaw:         float
    head_roll:        float
    gaze_score:       float
    blink_detected:   bool


# ── Risk ──────────────────────────────────────────────────────────────────────
class RiskRequest(BaseModel):
    student_id:      str
    attendance_pct:  float = Field(..., ge=0, le=100)
    avg_attention:   float = Field(..., ge=0, le=100)
    engagement_trend: float = Field(..., ge=-1, le=1)


class RiskResult(BaseModel):
    student_id:       str
    risk_level:       RiskLevel
    risk_probability: float
    computed_at:      datetime


# ── Dashboard ─────────────────────────────────────────────────────────────────
class StudentSummary(BaseModel):
    student_id:      str
    name:            str
    attendance_pct:  float
    avg_attention:   float
    risk_level:      str
    sessions_count:  int


class DashboardData(BaseModel):
    total_students:        int
    total_sessions:        int
    class_avg_attention:   float
    class_avg_attendance:  float
    at_risk_count:         int
    students:              List[StudentSummary]
    insights:              List[str]
    engagement_timeline:   List[dict]
