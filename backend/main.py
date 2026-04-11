"""
AICIS FastAPI Application Entry Point
"""
import os
import sys
import io

if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from db.mongo import connect_db, close_db
from api.auth       import router as auth_router
from api.students   import router as students_router
from api.attendance import router as attendance_router
from api.engagement import router as engagement_router
from api.risk       import router as risk_router
from api.dashboard  import router as dashboard_router
from api.websocket  import router as ws_router

load_dotenv()

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="AI Classroom Intelligence System",
    description="Attendance + Engagement + Risk Prediction API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
origins = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Lifecycle ─────────────────────────────────────────────────────────────────
@app.on_event("startup")
async def on_startup():
    await connect_db()
    # Ensure default teacher account exists
    from db.mongo import get_db
    from services.auth_service import hash_password
    from datetime import datetime
    db = get_db()
    if not await db.users.find_one({"username": "teacher"}):
        await db.users.insert_one({
            "username":        "teacher",
            "email":           "teacher@aicis.edu",
            "hashed_password": hash_password("teacher123"),
            "role":            "teacher",
            "created_at":      datetime.utcnow(),
        })
        print("✅  Default teacher account created (teacher / teacher123)")


@app.on_event("shutdown")
async def on_shutdown():
    await close_db()

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(students_router)
app.include_router(attendance_router)
app.include_router(engagement_router)
app.include_router(risk_router)
app.include_router(dashboard_router)
app.include_router(ws_router)


@app.get("/", tags=["Health"])
async def root():
    return {
        "project": "AI Classroom Intelligence System",
        "version": "1.0.0",
        "status":  "running",
        "docs":    "/docs",
    }


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok"}
