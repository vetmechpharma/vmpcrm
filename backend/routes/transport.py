from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, UploadFile, File, Request
from fastapi.responses import Response
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import uuid
import json
import os

from deps import db, logger, get_current_user, hash_password, verify_password, create_token, security
from models.schemas import TransportCreate, TransportResponse

router = APIRouter(prefix="/api")

# ============== TRANSPORT ROUTES ==============

@router.post("/transports", response_model=TransportResponse)
async def create_transport(transport: TransportCreate, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can add transports")
    
    transport_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    transport_doc = {
        'id': transport_id,
        'name': transport.name,
        'tracking_url_template': transport.tracking_url_template if not transport.is_local else None,
        'is_local': transport.is_local,
        'contact_number': transport.contact_number,
        'alternate_number': transport.alternate_number,
        'created_at': now.isoformat()
    }
    
    await db.transports.insert_one(transport_doc)
    
    return TransportResponse(
        id=transport_id,
        name=transport.name,
        tracking_url_template=transport.tracking_url_template if not transport.is_local else None,
        is_local=transport.is_local,
        contact_number=transport.contact_number,
        alternate_number=transport.alternate_number,
        created_at=now
    )

@router.get("/transports", response_model=List[TransportResponse])
async def get_transports(current_user: dict = Depends(get_current_user)):
    transports = await db.transports.find({}, {'_id': 0}).sort('name', 1).to_list(100)
    
    result = []
    for t in transports:
        created_at = t['created_at']
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
        
        result.append(TransportResponse(
            id=t['id'],
            name=t['name'],
            tracking_url_template=t.get('tracking_url_template'),
            is_local=t.get('is_local', False),
            contact_number=t.get('contact_number'),
            alternate_number=t.get('alternate_number'),
            created_at=created_at
        ))
    
    return result

@router.get("/public/transports", response_model=List[TransportResponse])
async def get_public_transports():
    """Public transports list for customer portal selection"""
    transports = await db.transports.find({}, {'_id': 0}).sort('name', 1).to_list(100)
    
    result = []
    for t in transports:
        created_at = t['created_at']
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
        
        result.append(TransportResponse(
            id=t['id'],
            name=t['name'],
            tracking_url_template=t.get('tracking_url_template'),
            is_local=t.get('is_local', False),
            contact_number=t.get('contact_number'),
            alternate_number=t.get('alternate_number'),
            created_at=created_at
        ))
    
    return result

@router.delete("/transports/{transport_id}")
async def delete_transport(transport_id: str, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can delete transports")
    
    result = await db.transports.delete_one({'id': transport_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Transport not found")
    return {"message": "Transport deleted successfully"}


