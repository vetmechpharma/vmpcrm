from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, UploadFile, File, Request
from fastapi.responses import Response
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import uuid
import json
import os

from deps import db, logger, get_current_user, hash_password, verify_password, create_token, security
from utils.templates import DEFAULT_WA_TEMPLATES, DEFAULT_EMAIL_TEMPLATES, get_company_short_name, get_wa_template, get_email_template, render_wa_template

router = APIRouter(prefix="/api")

# ============== MESSAGE TEMPLATES (WhatsApp & Email) ==============
# Templates are defined in utils/templates.py (single source of truth)
# Imported as DEFAULT_WA_TEMPLATES and DEFAULT_EMAIL_TEMPLATES


@router.get("/message-templates")
async def get_all_templates(category: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Get all message templates"""
    query = {}
    if category:
        query['category'] = category
    templates = await db.message_templates.find(query, {'_id': 0}).to_list(100)
    
    # Merge with defaults for missing templates
    all_defaults = {**DEFAULT_WA_TEMPLATES, **DEFAULT_EMAIL_TEMPLATES}
    existing_keys = {t['key'] for t in templates}
    
    for key, default in all_defaults.items():
        if category and default['category'] != category:
            continue
        if key not in existing_keys:
            templates.append({**default, 'is_default': True})
    
    return templates


@router.put("/message-templates/{template_key}")
async def update_template(template_key: str, data: dict, current_user: dict = Depends(get_current_user)):
    """Update a message template"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can edit templates")
    
    all_defaults = {**DEFAULT_WA_TEMPLATES, **DEFAULT_EMAIL_TEMPLATES}
    default = all_defaults.get(template_key)
    
    update_doc = {
        'key': template_key,
        'name': data.get('name', default['name'] if default else template_key),
        'category': data.get('category', default['category'] if default else 'whatsapp'),
        'variables': data.get('variables', default['variables'] if default else []),
        'template': data.get('template', ''),
        'updated_at': datetime.now(timezone.utc).isoformat()
    }
    if update_doc['category'] == 'email':
        update_doc['subject'] = data.get('subject', '')
    
    await db.message_templates.update_one(
        {'key': template_key},
        {'$set': update_doc},
        upsert=True
    )
    return {"message": "Template updated", "key": template_key}


@router.post("/message-templates/{template_key}/reset")
async def reset_template(template_key: str, current_user: dict = Depends(get_current_user)):
    """Reset a template to default"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can reset templates")
    await db.message_templates.delete_one({'key': template_key})
    return {"message": "Template reset to default"}



