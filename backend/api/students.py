"""Students endpoints — register with face, list, delete."""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime
from typing import List
from pydantic import BaseModel, EmailStr

from db.mongo import get_db
from models.schemas import StudentOut
from services.face_service import register_face
from services.auth_service import get_current_user

router = APIRouter(prefix="/students", tags=["Students"])


class StudentRegisterPayload(BaseModel):
    student_id: str
    name:       str
    email:      EmailStr
    frames_b64: List[str] = []


@router.post("/register", response_model=StudentOut)
async def register_student(
    payload: StudentRegisterPayload,
    current_user: dict = Depends(get_current_user),
):
    """
    Register a new student with face data.
    Body: { "student_id": "...", "name": "...", "email": "...", "frames_b64": [...] }
    """
    db = get_db()
    if await db.students.find_one({"student_id": payload.student_id}):
        raise HTTPException(400, f"Student {payload.student_id} already registered")

    # Face recognition registration
    success, msg, saved_paths = register_face(payload.student_id, payload.frames_b64)
    if not success:
        raise HTTPException(422, f"Face registration failed: {msg}")

    doc = {
        "student_id":           payload.student_id,
        "name":                 payload.name,
        "email":                payload.email,
        "face_encoding_path":   saved_paths[0] if saved_paths else "",
        "training_image_paths": saved_paths,
        "registered_at":        datetime.utcnow(),
        "registered_by":        current_user["username"],
    }
    await db.students.insert_one(doc)
    return StudentOut(
        student_id=doc["student_id"],
        name=doc["name"],
        email=doc["email"],
        registered_at=doc["registered_at"],
        registered_by=doc["registered_by"],
    )


@router.get("/", response_model=List[StudentOut])
async def list_students(current_user: dict = Depends(get_current_user)):
    db = get_db()
    students = await db.students.find({}).to_list(length=500)
    return [
        StudentOut(
            student_id=s["student_id"],
            name=s["name"],
            email=s["email"],
            registered_at=s["registered_at"],
            registered_by=s["registered_by"],
        )
        for s in students
    ]


@router.delete("/{student_id}")
async def delete_student(
    student_id: str,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    result = await db.students.delete_one({"student_id": student_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Student not found")
    return {"message": f"Student {student_id} deleted"}


@router.get("/{student_id}", response_model=StudentOut)
async def get_student(student_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    s = await db.students.find_one({"student_id": student_id})
    if not s:
        raise HTTPException(404, "Student not found")
    return StudentOut(
        student_id=s["student_id"],
        name=s["name"],
        email=s["email"],
        registered_at=s["registered_at"],
        registered_by=s["registered_by"],
    )
