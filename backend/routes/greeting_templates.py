from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, UploadFile, File, Request
from fastapi.responses import Response
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import uuid
import json
import os

from deps import db, logger, get_current_user, hash_password, verify_password, create_token, security
from models.schemas import GreetingTemplateCreate, GreetingTemplateUpdate

router = APIRouter(prefix="/api")

# ============== GREETING TEMPLATE ROUTES ==============

@router.get("/greeting-templates")
async def get_greeting_templates(type: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Get all greeting templates, optionally filter by type"""
    query = {}
    if type:
        query['type'] = type
    templates = await db.greeting_templates.find(query, {'_id': 0}).sort('created_at', -1).to_list(100)
    return templates


@router.post("/greeting-templates")
async def create_greeting_template(template: GreetingTemplateCreate, current_user: dict = Depends(get_current_user)):
    """Create a new greeting template"""
    doc = {
        'id': str(uuid.uuid4()),
        'type': template.type,
        'message': template.message,
        'image_url': template.image_url or '',
        'is_active': template.is_active,
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.greeting_templates.insert_one(doc)
    doc.pop('_id', None)
    return doc


@router.put("/greeting-templates/{template_id}")
async def update_greeting_template(template_id: str, template: GreetingTemplateUpdate, current_user: dict = Depends(get_current_user)):
    """Update a greeting template"""
    update_data = {k: v for k, v in template.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    result = await db.greeting_templates.update_one({'id': template_id}, {'$set': update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    updated = await db.greeting_templates.find_one({'id': template_id}, {'_id': 0})
    return updated


@router.delete("/greeting-templates/{template_id}")
async def delete_greeting_template(template_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a greeting template"""
    result = await db.greeting_templates.delete_one({'id': template_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"message": "Template deleted"}


@router.post("/greeting-templates/test-send")
async def test_send_greeting(entity_type: str = "doctor", entity_id: str = "", template_id: str = "", current_user: dict = Depends(get_current_user)):
    """Test send a greeting to a specific contact"""
    company = await db.company_settings.find_one({}, {'_id': 0})
    company_name = company.get('name', 'Our Company') if company else 'Our Company'

    # Get template
    template = await db.greeting_templates.find_one({'id': template_id}, {'_id': 0})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    # Get entity
    collection_map = {'doctor': 'doctors', 'medical': 'medicals', 'agency': 'agencies'}
    if entity_type not in collection_map:
        raise HTTPException(status_code=400, detail="Invalid entity type")
    entity = await db[collection_map[entity_type]].find_one({'id': entity_id}, {'_id': 0})
    if not entity:
        raise HTTPException(status_code=404, detail="Contact not found")

    name = entity.get('proprietor_name') or entity.get('name', '')
    message = template['message'].replace('{customer_name}', name).replace('{company_name}', company_name)

    return {"message": message, "image_url": template.get('image_url', ''), "contact_name": name}


@router.get("/greeting-logs")
async def get_greeting_logs(limit: int = 50, current_user: dict = Depends(get_current_user)):
    """Get recent greeting logs"""
    logs = await db.greeting_logs.find({}, {'_id': 0}).sort('sent_at', -1).to_list(limit)
    return logs



