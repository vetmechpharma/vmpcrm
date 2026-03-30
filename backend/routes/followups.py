from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, UploadFile, File, Request
from fastapi.responses import Response
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import uuid
import json
import os

from deps import db, logger, get_current_user, hash_password, verify_password, create_token, security
from models.schemas import FollowUpCreate, FollowUpResponse

router = APIRouter(prefix="/api")

# ============== FOLLOWUP ROUTES ==============

@router.post("/followups")
async def create_followup(followup: FollowUpCreate, current_user: dict = Depends(get_current_user)):
    """Add a follow-up entry for a lead. Auto-closes previous open follow-up and updates entity."""
    entity_type = followup.entity_type
    entity_id = followup.entity_id

    # Validate entity type
    collection_map = {'doctor': 'doctors', 'medical': 'medicals', 'agency': 'agencies'}
    if entity_type not in collection_map:
        raise HTTPException(status_code=400, detail="Invalid entity type")

    collection = db[collection_map[entity_type]]
    entity = await collection.find_one({'id': entity_id}, {'_id': 0})
    if not entity:
        raise HTTPException(status_code=404, detail=f"{entity_type.title()} not found")

    now = datetime.now(timezone.utc)
    followup_id = str(uuid.uuid4())

    # Close all previous open follow-ups for this entity
    await db.followups.update_many(
        {'entity_type': entity_type, 'entity_id': entity_id, 'status': 'open'},
        {'$set': {'status': 'closed', 'closed_at': now.isoformat()}}
    )

    # Create new follow-up entry
    followup_doc = {
        'id': followup_id,
        'entity_type': entity_type,
        'entity_id': entity_id,
        'entity_name': entity.get('name', ''),
        'notes': followup.notes,
        'new_status': followup.new_status,
        'next_follow_up_date': followup.next_follow_up_date,
        'next_follow_up_time': followup.next_follow_up_time,
        'status': 'open' if followup.next_follow_up_date else 'closed',
        'created_by': current_user.get('name', current_user.get('email', '')),
        'created_at': now.isoformat()
    }
    await db.followups.insert_one(followup_doc)

    # Update the entity: last_contact_date, follow_up_date, lead_status
    update_data = {
        'last_contact_date': now.strftime('%Y-%m-%d'),
        'updated_at': now.isoformat()
    }
    if followup.next_follow_up_date:
        update_data['follow_up_date'] = followup.next_follow_up_date
    else:
        update_data['follow_up_date'] = None
    if followup.new_status:
        update_data['lead_status'] = followup.new_status

    await collection.update_one({'id': entity_id}, {'$set': update_data})

    followup_doc.pop('_id', None)
    return followup_doc


@router.get("/followups/{entity_type}/{entity_id}")
async def get_followup_history(entity_type: str, entity_id: str, current_user: dict = Depends(get_current_user)):
    """Get all follow-up history for a specific entity, newest first."""
    followups = await db.followups.find(
        {'entity_type': entity_type, 'entity_id': entity_id},
        {'_id': 0}
    ).sort('created_at', -1).to_list(100)
    return followups



