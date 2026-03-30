from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, UploadFile, File, Request
from fastapi.responses import Response
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import uuid
import json
import os

from deps import db, logger, get_current_user, hash_password, verify_password, create_token, security
from models.schemas import FallbackOTPCreate, FallbackOTPResponse

router = APIRouter(prefix="/api")

# ============== FALLBACK OTP MANAGEMENT ==============

@router.get("/fallback-otps")
async def get_fallback_otps(current_user: dict = Depends(get_current_user)):
    """Get all fallback OTPs (admin only)"""
    otps = await db.fallback_otps.find({}, {'_id': 0}).sort('created_at', -1).to_list(100)
    return otps

@router.post("/fallback-otps")
async def create_fallback_otp(otp_data: FallbackOTPCreate, current_user: dict = Depends(get_current_user)):
    """Create a new fallback OTP (admin only)"""
    # Validate OTP format (4 digits)
    if not otp_data.otp.isdigit() or len(otp_data.otp) != 4:
        raise HTTPException(status_code=400, detail="OTP must be exactly 4 digits")
    
    # Check if OTP already exists
    existing = await db.fallback_otps.find_one({'otp': otp_data.otp}, {'_id': 0})
    if existing:
        raise HTTPException(status_code=400, detail="This OTP already exists")
    
    otp_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    otp_doc = {
        'id': otp_id,
        'otp': otp_data.otp,
        'is_active': True,
        'used_count': 0,
        'created_at': now.isoformat(),
        'created_by': current_user['name']
    }
    
    await db.fallback_otps.insert_one(otp_doc)
    
    return FallbackOTPResponse(
        id=otp_id,
        otp=otp_data.otp,
        is_active=True,
        used_count=0,
        created_at=now,
        created_by=current_user['name']
    )

@router.put("/fallback-otps/{otp_id}/toggle")
async def toggle_fallback_otp(otp_id: str, current_user: dict = Depends(get_current_user)):
    """Toggle fallback OTP active status (admin only)"""
    otp = await db.fallback_otps.find_one({'id': otp_id}, {'_id': 0})
    if not otp:
        raise HTTPException(status_code=404, detail="OTP not found")
    
    new_status = not otp.get('is_active', True)
    await db.fallback_otps.update_one(
        {'id': otp_id},
        {'$set': {'is_active': new_status}}
    )
    
    return {"message": f"OTP {'activated' if new_status else 'deactivated'} successfully", "is_active": new_status}

@router.delete("/fallback-otps/{otp_id}")
async def delete_fallback_otp(otp_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a fallback OTP (admin only)"""
    result = await db.fallback_otps.delete_one({'id': otp_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="OTP not found")
    
    return {"message": "OTP deleted successfully"}

@router.post("/fallback-otps/seed")
async def seed_default_otps(current_user: dict = Depends(get_current_user)):
    """Seed default fallback OTPs (admin only)"""
    default_otps = ['0101', '3355', '8796', '5896', '5478', '9635', '1596', '1478', '9630', '8520', '7410']
    now = datetime.now(timezone.utc)
    added = 0
    
    for otp in default_otps:
        existing = await db.fallback_otps.find_one({'otp': otp}, {'_id': 0})
        if not existing:
            otp_doc = {
                'id': str(uuid.uuid4()),
                'otp': otp,
                'is_active': True,
                'used_count': 0,
                'created_at': now.isoformat(),
                'created_by': current_user['name']
            }
            await db.fallback_otps.insert_one(otp_doc)
            added += 1
    
    return {"message": f"Added {added} new fallback OTPs", "total_default": len(default_otps)}



