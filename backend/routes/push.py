from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, UploadFile, File, Request
from fastapi.responses import Response
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import uuid
import json
import os

from deps import db, logger, get_current_user, hash_password, verify_password, create_token, security
from utils.push import send_push_notification, send_push_to_user, send_push_to_role, send_push_to_all_customers, send_push_to_admins
from deps import VAPID_PUBLIC_KEY
from fastapi.security import HTTPBearer
from deps import get_current_customer

router = APIRouter(prefix="/api")

# ============== WEB PUSH NOTIFICATIONS ==============

@router.get("/push/vapid-key")
async def get_vapid_public_key():
    """Get VAPID public key for push subscription"""
    return {"public_key": VAPID_PUBLIC_KEY}


@router.post("/push/subscribe")
async def subscribe_push(data: dict, current_user: dict = Depends(get_current_user)):
    """Subscribe to push notifications"""
    subscription = data.get('subscription')
    user_type = data.get('user_type', 'admin')  # admin, customer, mr
    
    if not subscription or not subscription.get('endpoint'):
        raise HTTPException(status_code=400, detail="Invalid subscription")
    
    user_id = current_user.get('user_id') or current_user.get('id') or str(current_user.get('email', ''))
    
    # Upsert subscription
    await db.push_subscriptions.update_one(
        {'endpoint': subscription['endpoint']},
        {'$set': {
            'user_id': user_id,
            'user_type': user_type,
            'subscription': subscription,
            'user_name': current_user.get('name') or current_user.get('email', ''),
            'updated_at': datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    return {"message": "Subscribed to push notifications"}


@router.post("/push/unsubscribe")
async def unsubscribe_push(data: dict, current_user: dict = Depends(get_current_user)):
    """Unsubscribe from push notifications"""
    endpoint = data.get('endpoint')
    if endpoint:
        await db.push_subscriptions.delete_one({'endpoint': endpoint})
    return {"message": "Unsubscribed from push notifications"}


@router.post("/push/send")
async def send_push_admin(data: dict, current_user: dict = Depends(get_current_user)):
    """Admin: Send push notification to specific audience"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can send push notifications")
    
    title = data.get('title', 'Notification')
    body = data.get('body', '')
    url = data.get('url', '/')
    audience = data.get('audience', 'all')  # all, customers, admins, mr
    
    sent = 0
    if audience == 'customers' or audience == 'all':
        sent += await send_push_to_role('customer', title, body, url, tag='admin-push')
    if audience == 'admins' or audience == 'all':
        sent += await send_push_to_role('admin', title, body, url, tag='admin-push')
    if audience == 'mr' or audience == 'all':
        sent += await send_push_to_role('mr', title, body, url, tag='admin-push')
    
    return {"message": f"Push notification sent to {sent} devices", "sent_count": sent}


@router.get("/push/subscriptions")
async def get_push_subscriptions(current_user: dict = Depends(get_current_user)):
    """Get push subscription stats"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Only admins")
    
    pipeline = [
        {'$group': {'_id': '$user_type', 'count': {'$sum': 1}}}
    ]
    stats = await db.push_subscriptions.aggregate(pipeline).to_list(10)
    return {s['_id']: s['count'] for s in stats}


@router.post("/customer/push/subscribe")
async def customer_subscribe_push(data: dict, request: Request):
    """Customer subscribe to push (uses customer token)"""
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = auth_header.split(' ')[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        customer_id = payload.get('customer_id') or payload.get('id', '')
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    subscription = data.get('subscription')
    if not subscription or not subscription.get('endpoint'):
        raise HTTPException(status_code=400, detail="Invalid subscription")
    
    await db.push_subscriptions.update_one(
        {'endpoint': subscription['endpoint']},
        {'$set': {
            'user_id': customer_id,
            'user_type': 'customer',
            'subscription': subscription,
            'user_name': payload.get('name', ''),
            'updated_at': datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    return {"message": "Subscribed to push notifications"}


@router.get("/whatsapp-logs")
async def get_whatsapp_logs(
    skip: int = 0,
    limit: int = 50,
    message_type: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get WhatsApp logs with filtering and pagination"""
    query = {}
    
    if message_type:
        query['message_type'] = message_type
    
    if status:
        query['status'] = status
    
    if search:
        query['$or'] = [
            {'recipient_phone': {'$regex': search, '$options': 'i'}},
            {'recipient_name': {'$regex': search, '$options': 'i'}},
            {'message_preview': {'$regex': search, '$options': 'i'}}
        ]
    
    total = await db.whatsapp_logs.count_documents(query)
    
    logs = await db.whatsapp_logs.find(query, {'_id': 0}).sort('created_at', -1).skip(skip).limit(limit).to_list(limit)
    
    # Parse dates
    for log in logs:
        if isinstance(log.get('created_at'), str):
            log['created_at'] = datetime.fromisoformat(log['created_at'].replace('Z', '+00:00'))
    
    return {
        'logs': logs,
        'total': total,
        'skip': skip,
        'limit': limit
    }

@router.get("/whatsapp-logs/stats")
async def get_whatsapp_logs_stats(current_user: dict = Depends(get_current_user)):
    """Get WhatsApp logs statistics"""
    total = await db.whatsapp_logs.count_documents({})
    success = await db.whatsapp_logs.count_documents({'status': 'success'})
    failed = await db.whatsapp_logs.count_documents({'status': 'failed'})
    
    # Get counts by message type
    pipeline = [
        {'$group': {'_id': '$message_type', 'count': {'$sum': 1}}},
        {'$sort': {'count': -1}}
    ]
    type_counts = await db.whatsapp_logs.aggregate(pipeline).to_list(100)
    
    return {
        'total': total,
        'success': success,
        'failed': failed,
        'by_type': {item['_id']: item['count'] for item in type_counts}
    }

@router.delete("/whatsapp-logs/{log_id}")
async def delete_whatsapp_log(log_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a WhatsApp log entry"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can delete logs")
    
    result = await db.whatsapp_logs.delete_one({'id': log_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Log not found")
    
    return {"message": "Log deleted successfully"}



