from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, UploadFile, File, Request
from fastapi.responses import Response
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import uuid
import json
import os

from deps import db, logger, get_current_user, hash_password, verify_password, create_token, security
from models.schemas import PendingItemCreate, PendingItemResponse
from utils.whatsapp import get_whatsapp_config, send_wa_msg, log_whatsapp_message
from utils.templates import render_wa_template, get_company_short_name
from utils.notifications import send_whatsapp_stock_arrived

router = APIRouter(prefix="/api")

# ============== PENDING ITEMS ROUTES ==============

@router.get("/pending-items")
async def get_all_pending_items(current_user: dict = Depends(get_current_user)):
    """Get all pending items"""
    pending_items = await db.pending_items.find({}, {'_id': 0}).sort('created_at', -1).to_list(1000)
    
    result = []
    for item in pending_items:
        created_at = item.get('created_at')
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
        
        # Use original_order_date if available, otherwise use created_at as fallback
        order_date = item.get('original_order_date') or item.get('created_at')
        if isinstance(order_date, str):
            order_date = datetime.fromisoformat(order_date.replace('Z', '+00:00'))
        
        result.append(PendingItemResponse(
            id=item['id'],
            doctor_phone=item['doctor_phone'],
            doctor_name=item.get('doctor_name'),
            item_id=item['item_id'],
            item_code=item['item_code'],
            item_name=item['item_name'],
            quantity=item['quantity'],
            original_order_id=item.get('original_order_id') or item.get('order_id'),
            original_order_number=item['original_order_number'],
            original_order_date=order_date or created_at,
            created_at=created_at
        ))
    
    return result

@router.get("/pending-items/stats")
async def get_pending_items_stats(current_user: dict = Depends(get_current_user)):
    """Get pending items statistics"""
    total_count = await db.pending_items.count_documents({})
    
    # Get unique doctors with pending items
    pipeline = [
        {"$group": {"_id": "$doctor_phone", "count": {"$sum": 1}}},
        {"$count": "unique_doctors"}
    ]
    doctors_result = await db.pending_items.aggregate(pipeline).to_list(1)
    unique_doctors = doctors_result[0]['unique_doctors'] if doctors_result else 0
    
    return {
        "total_pending_items": total_count,
        "doctors_with_pending": unique_doctors
    }

@router.get("/pending-items/doctor/{phone}")
async def get_pending_items_by_doctor(phone: str, current_user: dict = Depends(get_current_user)):
    """Get pending items for a specific doctor by phone"""
    pending_items = await db.pending_items.find({'doctor_phone': phone}, {'_id': 0}).sort('created_at', -1).to_list(100)
    
    result = []
    for item in pending_items:
        created_at = item.get('created_at')
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
        
        order_date = item.get('original_order_date') or item.get('created_at')
        if isinstance(order_date, str):
            order_date = datetime.fromisoformat(order_date.replace('Z', '+00:00'))
        
        result.append(PendingItemResponse(
            id=item['id'],
            doctor_phone=item['doctor_phone'],
            doctor_name=item.get('doctor_name'),
            item_id=item['item_id'],
            item_code=item['item_code'],
            item_name=item['item_name'],
            quantity=item['quantity'],
            original_order_id=item.get('original_order_id') or item.get('order_id'),
            original_order_number=item['original_order_number'],
            original_order_date=order_date,
            created_at=created_at
        ))
    
    return result

@router.delete("/pending-items/{item_id}")
async def delete_pending_item(item_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a pending item after customer contact"""
    result = await db.pending_items.delete_one({'id': item_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Pending item not found")
    return {"message": "Pending item deleted successfully"}

@router.get("/pending-items/by-item")
async def get_pending_items_grouped_by_item(current_user: dict = Depends(get_current_user)):
    """Get pending items grouped by item (for stock arrival notifications)"""
    pipeline = [
        {
            "$group": {
                "_id": {
                    "item_id": "$item_id",
                    "item_code": "$item_code",
                    "item_name": "$item_name"
                },
                "doctors": {
                    "$push": {
                        "pending_id": "$id",
                        "doctor_phone": "$doctor_phone",
                        "doctor_name": "$doctor_name",
                        "quantity": "$quantity",
                        "original_order_number": "$original_order_number",
                        "created_at": "$created_at"
                    }
                },
                "total_quantity": {"$sum": 1},  # Count of pending requests (quantity is text)
                "doctor_count": {"$sum": 1}
            }
        },
        {
            "$project": {
                "_id": 0,
                "item_id": "$_id.item_id",
                "item_code": "$_id.item_code",
                "item_name": "$_id.item_name",
                "doctors": 1,
                "total_quantity": 1,
                "doctor_count": 1
            }
        },
        {"$sort": {"doctor_count": -1}}
    ]
    
    result = await db.pending_items.aggregate(pipeline).to_list(100)
    return result

@router.post("/pending-items/notify-stock-arrived/{item_code}")
async def notify_stock_arrived_by_item(item_code: str, background_tasks: BackgroundTasks, current_user: dict = Depends(get_current_user)):
    """Send stock arrived notification to all doctors waiting for a specific item"""
    # Find all pending items with this item code
    pending_items = await db.pending_items.find({'item_code': item_code}, {'_id': 0}).to_list(100)
    
    if not pending_items:
        raise HTTPException(status_code=404, detail="No pending items found with this item code")
    
    # Get item details from first pending item
    item_name = pending_items[0].get('item_name', item_code)
    
    # Send notifications to all doctors
    notifications_sent = 0
    notifications_failed = 0
    doctors_notified = []
    
    for pending in pending_items:
        doctor_phone = pending.get('doctor_phone')
        doctor_name = pending.get('doctor_name')
        quantity = pending.get('quantity')
        
        # Avoid sending duplicate notifications to same phone
        if doctor_phone in doctors_notified:
            continue
        
        success = await send_whatsapp_stock_arrived(
            doctor_phone=doctor_phone,
            doctor_name=doctor_name,
            item_name=item_name,
            item_code=item_code,
            quantity=quantity
        )
        
        if success:
            notifications_sent += 1
            doctors_notified.append(doctor_phone)
        else:
            notifications_failed += 1
    
    return {
        "message": f"Stock arrived notifications sent for {item_name}",
        "item_code": item_code,
        "item_name": item_name,
        "notifications_sent": notifications_sent,
        "notifications_failed": notifications_failed,
        "doctors_notified": len(doctors_notified)
    }

@router.post("/pending-items/{pending_id}/notify-stock-arrived")
async def notify_stock_arrived_single(pending_id: str, current_user: dict = Depends(get_current_user)):
    """Send stock arrived notification for a single pending item"""
    pending_item = await db.pending_items.find_one({'id': pending_id}, {'_id': 0})
    
    if not pending_item:
        raise HTTPException(status_code=404, detail="Pending item not found")
    
    success = await send_whatsapp_stock_arrived(
        doctor_phone=pending_item.get('doctor_phone'),
        doctor_name=pending_item.get('doctor_name'),
        item_name=pending_item.get('item_name'),
        item_code=pending_item.get('item_code'),
        quantity=pending_item.get('quantity')
    )
    
    if success:
        return {"message": "Stock arrived notification sent successfully"}
    else:
        raise HTTPException(status_code=500, detail="Failed to send notification")


