from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, UploadFile, File, Request
from fastapi.responses import Response
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import uuid
import json
import os

from deps import db, logger, get_current_user, hash_password, verify_password, create_token, security
from pydantic import BaseModel
from models.schemas import WhatsAppConfigCreate, WhatsAppConfigResponse
from utils.whatsapp import get_whatsapp_config, send_wa_msg, log_whatsapp_message
from utils.templates import get_wa_template
import httpx

router = APIRouter(prefix="/api")

# ============== WHATSAPP CONFIG ROUTES ==============

@router.post("/whatsapp-config")
async def save_whatsapp_config_route(config: WhatsAppConfigCreate, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can configure WhatsApp settings")
    
    config_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    # If this config should be active, deactivate all others
    if config.is_active:
        await db.whatsapp_config.update_many({}, {'$set': {'is_active': False}})
    
    config_doc = {
        'id': config_id,
        'name': config.name,
        'api_url': config.api_url,
        'auth_token': config.auth_token,
        'sender_id': config.sender_id,
        'http_method': config.http_method,
        'api_type': config.api_type,
        'instance_id': config.instance_id,
        'field_action': config.field_action,
        'field_sender_id': config.field_sender_id,
        'field_auth_token': config.field_auth_token,
        'field_message': config.field_message,
        'field_receiver': config.field_receiver,
        'field_file_url': config.field_file_url,
        'field_file_caption': config.field_file_caption,
        'action_send': config.action_send,
        'action_send_file': config.action_send_file,
        'is_active': config.is_active,
        'updated_at': now.isoformat()
    }
    
    await db.whatsapp_config.insert_one(config_doc)
    config_doc.pop('_id', None)
    config_doc.pop('auth_token', None)
    config_doc['updated_at'] = now
    return config_doc

@router.get("/whatsapp-configs")
async def get_all_whatsapp_configs(current_user: dict = Depends(get_current_user)):
    """Get all WhatsApp configs (without auth tokens)"""
    configs = await db.whatsapp_config.find({}, {'_id': 0, 'auth_token': 0}).sort('updated_at', -1).to_list(50)
    for c in configs:
        if isinstance(c.get('updated_at'), str):
            c['updated_at'] = datetime.fromisoformat(c['updated_at'].replace('Z', '+00:00')).isoformat()
    return configs

@router.get("/whatsapp-config")
async def get_whatsapp_config_route(current_user: dict = Depends(get_current_user)):
    """Get active WhatsApp config (backward compatible)"""
    config = await db.whatsapp_config.find_one({'is_active': True}, {'_id': 0, 'auth_token': 0})
    if not config:
        config = await db.whatsapp_config.find_one({}, {'_id': 0, 'auth_token': 0})
    if not config:
        return {
            'id': 'default',
            'name': 'Default Config',
            'api_url': 'https://api.botmastersender.com/api/v1/',
            'sender_id': '919944472488',
            'http_method': 'GET',
            'field_action': 'action',
            'field_sender_id': 'senderId',
            'field_auth_token': 'authToken',
            'field_message': 'messageText',
            'field_receiver': 'receiverId',
            'field_file_url': 'fileUrl',
            'field_file_caption': 'fileCaption',
            'action_send': 'send',
            'action_send_file': 'sendFile',
            'is_active': True,
            'updated_at': datetime.now(timezone.utc).isoformat()
        }
    if isinstance(config.get('updated_at'), str):
        config['updated_at'] = datetime.fromisoformat(config['updated_at'].replace('Z', '+00:00')).isoformat()
    return config

@router.put("/whatsapp-config/{config_id}")
async def update_whatsapp_config_route(config_id: str, config: WhatsAppConfigCreate, current_user: dict = Depends(get_current_user)):
    """Update an existing WhatsApp config"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can configure WhatsApp settings")
    
    existing = await db.whatsapp_config.find_one({'id': config_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Config not found")
    
    now = datetime.now(timezone.utc)
    
    if config.is_active:
        await db.whatsapp_config.update_many({'id': {'$ne': config_id}}, {'$set': {'is_active': False}})
    
    update_data = {
        'name': config.name,
        'api_url': config.api_url,
        'sender_id': config.sender_id,
        'http_method': config.http_method,
        'api_type': config.api_type,
        'instance_id': config.instance_id,
        'field_action': config.field_action,
        'field_sender_id': config.field_sender_id,
        'field_auth_token': config.field_auth_token,
        'field_message': config.field_message,
        'field_receiver': config.field_receiver,
        'field_file_url': config.field_file_url,
        'field_file_caption': config.field_file_caption,
        'action_send': config.action_send,
        'action_send_file': config.action_send_file,
        'is_active': config.is_active,
        'updated_at': now.isoformat()
    }
    if config.auth_token:
        update_data['auth_token'] = config.auth_token
    
    await db.whatsapp_config.update_one({'id': config_id}, {'$set': update_data})
    return {"message": "Config updated successfully"}

@router.delete("/whatsapp-config/{config_id}")
async def delete_whatsapp_config_route(config_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a WhatsApp config"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can configure WhatsApp settings")
    result = await db.whatsapp_config.delete_one({'id': config_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Config not found")
    return {"message": "Config deleted successfully"}

@router.put("/whatsapp-config/{config_id}/activate")
async def activate_whatsapp_config(config_id: str, current_user: dict = Depends(get_current_user)):
    """Set a config as active"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can configure WhatsApp settings")
    existing = await db.whatsapp_config.find_one({'id': config_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Config not found")
    await db.whatsapp_config.update_many({}, {'$set': {'is_active': False}})
    await db.whatsapp_config.update_one({'id': config_id}, {'$set': {'is_active': True}})
    return {"message": "Config activated successfully"}


class WhatsAppDirectMessage(BaseModel):
    phone: str
    message: str
    name: Optional[str] = None
    message_type: Optional[str] = "text"  # text, image, pdf, product
    file_url: Optional[str] = None
    item_id: Optional[str] = None
    recipient_role: Optional[str] = "doctors"  # doctors, medicals, agencies

@router.post("/whatsapp/send-direct")
async def send_direct_whatsapp(data: WhatsAppDirectMessage, current_user: dict = Depends(get_current_user)):
    """Send a direct WhatsApp message to an individual contact. Supports text, image, PDF, and product messages."""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can send messages")
    config = await get_whatsapp_config()
    if not config:
        raise HTTPException(status_code=400, detail="WhatsApp not configured")
    try:
        file_url = None
        file_caption = data.message or ''
        msg_type = data.message_type or 'text'
        app_base_url = os.environ.get('APP_BASE_URL', '').rstrip('/')

        if msg_type == 'product' and data.item_id:
            item = await db.items.find_one({'id': data.item_id}, {'_id': 0, 'image_webp': 0})
            if not item:
                raise HTTPException(status_code=404, detail="Item not found")
            has_image = await db.items.find_one({'id': data.item_id, 'image_webp': {'$ne': None}}, {'_id': 1})
            if has_image and app_base_url:
                file_url = f"{app_base_url}/api/items/{data.item_id}/image.jpg"
            if not file_caption.strip():
                role = data.recipient_role or 'doctors'
                rate = item.get(f'rate_{role}') or item.get('rate', '')
                offer = item.get(f'offer_{role}') or item.get('offer', '')
                special_offer = item.get(f'special_offer_{role}') or item.get('special_offer', '')
                parts = [f"{item.get('item_name', '')}"]
                parts.append(f"MRP: Rs.{item.get('mrp', 0)}")
                if rate:
                    parts.append(f"Rate: Rs.{rate}")
                if offer:
                    parts.append(f"Offer: {offer}")
                if special_offer:
                    parts.append(f"Special Offer: {special_offer}")
                file_caption = '\n'.join(parts)
        elif msg_type == 'image' and data.file_url:
            file_url = data.file_url
        elif msg_type == 'pdf' and data.file_url:
            file_url = data.file_url

        if file_url:
            response = await send_wa_msg(data.phone, file_caption, file_url=file_url, file_caption=file_caption, config=config)
        else:
            response = await send_wa_msg(data.phone, data.message, config=config)

        if response and response.status_code == 200:
            body = response.text.strip()
            is_success = ('Page not found' not in body)
            if is_success:
                log_preview = f"[{msg_type}] {file_caption[:150]}" if file_url else data.message[:200]
                await log_whatsapp_message(data.phone, 'direct', log_preview, 'success', recipient_name=data.name)
                return {"message": f"WhatsApp sent to {data.name or data.phone}", "status": "success"}
            else:
                return {"message": f"Failed: {body[:200]}", "status": "failed"}
        return {"message": "Failed to send", "status": "failed"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/whatsapp-config/test")
async def test_whatsapp_config_route(mobile: str, current_user: dict = Depends(get_current_user)):
    """Send a test message to verify WhatsApp configuration"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can test WhatsApp")
    
    config = await get_whatsapp_config()
    message = "Test message from VMP CRM. WhatsApp integration is working!"
    tmpl = await get_wa_template('test_message')
    if tmpl:
        short_name, _ = await get_company_short_name()
        message = tmpl.format(company_short_name=short_name)
    
    try:
        response = await send_wa_msg(mobile, message, config=config)
        if response and response.status_code == 200:
            body = response.text.strip()
            is_success = ('"success":true' in body or '"success": true' in body or '"status":"success"' in body or '"status": "success"' in body) and ('Page not found' not in body)
            if is_success:
                return {"message": "Test message sent successfully", "status": "success", "response": body[:300]}
            else:
                return {"message": f"API returned 200 but body: {body[:200]}", "status": "failed", "response": body[:300]}
        else:
            return {"message": f"API returned status {response.status_code if response else 'no_response'}", "status": "failed", "response": response.text if response else ''}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send test message: {str(e)}")


@router.post("/whatsapp-config/{config_id}/test")
async def test_specific_whatsapp_config(config_id: str, mobile: str, current_user: dict = Depends(get_current_user)):
    """Send a test message using a SPECIFIC WhatsApp config (not just active)"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can test WhatsApp")
    config_doc = await db.whatsapp_config.find_one({'id': config_id}, {'_id': 0})
    if not config_doc:
        raise HTTPException(status_code=404, detail="Config not found")
    # Apply defaults
    defaults = {
        'http_method': 'GET', 'field_action': 'action', 'field_sender_id': 'senderId',
        'field_auth_token': 'authToken', 'field_message': 'messageText', 'field_receiver': 'receiverId',
        'field_file_url': 'fileUrl', 'field_file_caption': 'fileCaption',
        'action_send': 'send', 'action_send_file': 'sendFile',
    }
    for k, v in defaults.items():
        if k not in config_doc or not config_doc[k]:
            config_doc[k] = v
    message = f"Test message from VMP CRM via [{config_doc.get('name', 'Config')}]. WhatsApp integration is working!"
    try:
        response = await send_wa_msg(mobile, message, config=config_doc)
        body = response.text.strip() if response else ''
        is_success = response and response.status_code == 200 and ('Page not found' not in body)
        if is_success:
            return {"message": f"Test sent via {config_doc.get('name', 'Config')}!", "status": "success", "response": body[:300]}
        else:
            return {"message": f"API response: {body[:200]}", "status": "failed", "response": body[:300]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed: {str(e)}")



