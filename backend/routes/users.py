from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, UploadFile, File, Request
from fastapi.responses import Response
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import uuid
import json
import os

from deps import db, logger, get_current_user, hash_password, verify_password, create_token, security
from models.schemas import UserCreateByAdmin, UserUpdateByAdmin, UserWithPermissions, UserPermissions

router = APIRouter(prefix="/api")

# ============== USER MANAGEMENT ROUTES ==============

@router.get("/users")
async def get_users(current_user: dict = Depends(get_current_user)):
    """Get all users (admin only)"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can view users")
    
    users = await db.users.find({}, {'_id': 0, 'password': 0}).to_list(100)
    
    # Parse dates
    for user in users:
        if isinstance(user.get('created_at'), str):
            user['created_at'] = datetime.fromisoformat(user['created_at'].replace('Z', '+00:00'))
    
    return users

@router.post("/users")
async def create_user(user_data: UserCreateByAdmin, current_user: dict = Depends(get_current_user)):
    """Create a new user (admin only)"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can create users")
    
    # Check if email already exists
    existing = await db.users.find_one({'email': user_data.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    # Default permissions for staff
    default_permissions = UserPermissions()
    permissions = user_data.permissions or default_permissions
    
    # Admin gets all permissions by default
    if user_data.role == 'admin':
        permissions = UserPermissions(
            doctors=True, medicals=True, agencies=True, items=True, orders=True,
            expenses=True, reminders=True, pending_items=True, email_logs=True,
            whatsapp_logs=True, users=True, smtp_settings=True, company_settings=True,
            whatsapp_settings=True
        )
    
    user_doc = {
        'id': user_id,
        'email': user_data.email.lower(),
        'password': hash_password(user_data.password),
        'name': user_data.name,
        'role': user_data.role,
        'permissions': permissions.model_dump(),
        'created_at': now.isoformat()
    }
    
    await db.users.insert_one(user_doc)
    
    return {
        'id': user_id,
        'email': user_data.email.lower(),
        'name': user_data.name,
        'role': user_data.role,
        'permissions': permissions.model_dump(),
        'created_at': now
    }

@router.put("/users/{user_id}")
async def update_user(user_id: str, user_data: UserUpdateByAdmin, current_user: dict = Depends(get_current_user)):
    """Update a user (admin only)"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can update users")
    
    # Get existing user
    existing = await db.users.find_one({'id': user_id})
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")
    
    update_doc = {}
    
    if user_data.email:
        # Check if new email already exists for another user
        email_exists = await db.users.find_one({'email': user_data.email.lower(), 'id': {'$ne': user_id}})
        if email_exists:
            raise HTTPException(status_code=400, detail="Email already in use")
        update_doc['email'] = user_data.email.lower()
    
    if user_data.name:
        update_doc['name'] = user_data.name
    
    if user_data.role:
        update_doc['role'] = user_data.role
    
    if user_data.password:
        update_doc['password'] = hash_password(user_data.password)
    
    if user_data.permissions:
        update_doc['permissions'] = user_data.permissions.model_dump()
    
    if update_doc:
        await db.users.update_one({'id': user_id}, {'$set': update_doc})
    
    # Return updated user
    updated = await db.users.find_one({'id': user_id}, {'_id': 0, 'password': 0})
    if isinstance(updated.get('created_at'), str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'].replace('Z', '+00:00'))
    
    return updated

@router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a user (admin only)"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can delete users")
    
    # Prevent deleting yourself
    if user_id == current_user['id']:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    result = await db.users.delete_one({'id': user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "User deleted successfully"}

@router.get("/users/{user_id}")
async def get_user(user_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific user (admin only)"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can view user details")
    
    user = await db.users.find_one({'id': user_id}, {'_id': 0, 'password': 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if isinstance(user.get('created_at'), str):
        user['created_at'] = datetime.fromisoformat(user['created_at'].replace('Z', '+00:00'))
    
    return user


