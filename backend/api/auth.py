"""Auth endpoints — register teacher, login, get current user."""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime

from db.mongo import get_db
from models.schemas import UserCreate, LoginRequest, Token, UserOut
from services.auth_service import hash_password, verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register", response_model=UserOut)
async def register_teacher(payload: UserCreate):
    db = get_db()
    if await db.users.find_one({"username": payload.username}):
        raise HTTPException(400, "Username already exists")
    if await db.users.find_one({"email": payload.email}):
        raise HTTPException(400, "Email already exists")

    doc = {
        "username":        payload.username,
        "email":           payload.email,
        "hashed_password": hash_password(payload.password),
        "role":            payload.role,
        "created_at":      datetime.utcnow(),
    }
    await db.users.insert_one(doc)
    return UserOut(**{k: v for k, v in doc.items() if k != "hashed_password"})


@router.post("/login", response_model=Token)
async def login(payload: LoginRequest):
    db = get_db()
    user = await db.users.find_one({"username": payload.username})
    if not user or not verify_password(payload.password, user["hashed_password"]):
        raise HTTPException(401, "Invalid credentials")

    token = create_access_token({"sub": user["username"], "role": user["role"]})
    return Token(access_token=token, username=user["username"], role=user["role"])


@router.get("/me")
async def me(current_user: dict = Depends(get_current_user)):
    return current_user
