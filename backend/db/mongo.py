"""
MongoDB async client using Motor.
All database access goes through this module.
"""
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING, DESCENDING
from typing import Optional
import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB  = os.getenv("MONGO_DB", "aicis_db")

# ── Singleton client ──────────────────────────────────────────────────────────
class Database:
    client: Optional[AsyncIOMotorClient] = None
    db = None

db_instance = Database()


def get_db():
    return db_instance.db


async def connect_db():
    """Called once at FastAPI startup."""
    db_instance.client = AsyncIOMotorClient(MONGO_URI)
    db_instance.db = db_instance.client[MONGO_DB]
    await _create_indexes()
    print(f"✅  Connected to MongoDB: {MONGO_URI} / {MONGO_DB}")


async def close_db():
    """Called at FastAPI shutdown."""
    if db_instance.client:
        db_instance.client.close()
        print("🔌  MongoDB connection closed.")


async def _create_indexes():
    db = db_instance.db

    # users
    await db.users.create_index("username", unique=True)
    await db.users.create_index("email",    unique=True)

    # students
    await db.students.create_index("student_id", unique=True)

    # sessions
    await db.sessions.create_index("session_id", unique=True)
    await db.sessions.create_index("status")

    # attendance  (one record per student per session)
    await db.attendance.create_index(
        [("student_id", ASCENDING), ("session_id", ASCENDING)], unique=True
    )
    await db.attendance.create_index("session_id")
    await db.attendance.create_index("student_id")

    # engagement_logs
    await db.engagement_logs.create_index("session_id")
    await db.engagement_logs.create_index("student_id")
    await db.engagement_logs.create_index("timestamp")

    # risk_predictions
    await db.risk_predictions.create_index("student_id", unique=True)
