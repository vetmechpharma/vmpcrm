from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, UploadFile, File, Request
from fastapi.responses import Response
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import uuid
import json
import os
import bcrypt

from deps import db, logger, get_current_user, hash_password, verify_password, create_token, security
from pydantic import BaseModel
from models.schemas import AdminProfileUpdate, AdminPasswordChange

router = APIRouter(prefix="/api")

# ============== ADMIN PROFILE ROUTES ==============

class AdminProfileUpdate(BaseModel):
    name: str
    email: str

class AdminPasswordChange(BaseModel):
    current_password: str
    new_password: str

@router.put("/admin/profile")
async def update_admin_profile(profile_data: AdminProfileUpdate, current_user: dict = Depends(get_current_user)):
    """Update admin profile (name and email)"""
    # Check if email is already taken by another user
    existing = await db.users.find_one({
        'email': profile_data.email.lower(),
        'id': {'$ne': current_user['id']}
    })
    if existing:
        raise HTTPException(status_code=400, detail="Email already in use by another user")
    
    await db.users.update_one(
        {'id': current_user['id']},
        {'$set': {
            'name': profile_data.name.strip(),
            'email': profile_data.email.lower().strip(),
            'updated_at': datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Profile updated successfully"}

@router.put("/admin/change-password")
async def change_admin_password(password_data: AdminPasswordChange, current_user: dict = Depends(get_current_user)):
    """Change admin password"""
    # Get current user with password
    user = await db.users.find_one({'id': current_user['id']})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Verify current password
    if not bcrypt.checkpw(password_data.current_password.encode(), user['password'].encode()):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    # Hash new password
    new_password_hash = bcrypt.hashpw(password_data.new_password.encode(), bcrypt.gensalt()).decode()
    
    await db.users.update_one(
        {'id': current_user['id']},
        {'$set': {
            'password': new_password_hash,
            'password_changed_at': datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Password changed successfully"}



