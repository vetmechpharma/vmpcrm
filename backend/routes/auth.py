from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, UploadFile, File, Request
from fastapi.responses import Response
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import uuid
import json
import os

from deps import db, logger, get_current_user, hash_password, verify_password, create_token, security
from models.schemas import UserCreate, UserLogin, UserResponse, TokenResponse

router = APIRouter(prefix="/api")

# ============== AUTH ROUTES ==============

@router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    existing = await db.users.find_one({'email': user_data.email}, {'_id': 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    user_doc = {
        'id': user_id,
        'email': user_data.email,
        'password': hash_password(user_data.password),
        'name': user_data.name,
        'role': user_data.role,
        'created_at': now.isoformat(),
        'updated_at': now.isoformat()
    }
    
    await db.users.insert_one(user_doc)
    
    token = create_token(user_id, user_data.email, user_data.role)
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user_id,
            email=user_data.email,
            name=user_data.name,
            role=user_data.role,
            created_at=now
        )
    )

from slowapi import Limiter
from slowapi.util import get_remote_address

def _get_real_ip(request):
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.headers.get("x-real-ip") or get_remote_address(request)

_limiter = Limiter(key_func=_get_real_ip)

# Brute force protection for admin login
_admin_login_attempts = {}

@router.post("/auth/login", response_model=TokenResponse)
@_limiter.limit("10/minute")
async def login(credentials: UserLogin, request: Request):
    lockout_key = f"{_get_real_ip(request)}:{credentials.email}"
    
    # Check lockout
    entry = _admin_login_attempts.get(lockout_key)
    if entry and entry.get('locked_until') and datetime.now(timezone.utc) < entry['locked_until']:
        remaining = int((entry['locked_until'] - datetime.now(timezone.utc)).total_seconds() / 60) + 1
        raise HTTPException(status_code=429, detail=f"Too many failed attempts. Try again in {remaining} minutes.")
    
    user = await db.users.find_one({'email': credentials.email}, {'_id': 0})
    if not user or not verify_password(credentials.password, user['password']):
        entry = _admin_login_attempts.get(lockout_key, {'count': 0})
        entry['count'] += 1
        if entry['count'] >= 5:
            entry['locked_until'] = datetime.now(timezone.utc) + timedelta(minutes=15)
            logger.warning(f"Admin login locked for {lockout_key}")
        _admin_login_attempts[lockout_key] = entry
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    _admin_login_attempts.pop(lockout_key, None)
    token = create_token(user['id'], user['email'], user['role'])
    
    created_at = user['created_at']
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user['id'],
            email=user['email'],
            name=user['name'],
            role=user['role'],
            created_at=created_at
        )
    )

@router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    created_at = current_user['created_at']
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
    
    return UserResponse(
        id=current_user['id'],
        email=current_user['email'],
        name=current_user['name'],
        role=current_user['role'],
        permissions=current_user.get('permissions'),
        created_at=created_at
    )


