from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, UploadFile, File, Request
from fastapi.responses import Response
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import uuid
import json
import os

from deps import db, logger, get_current_user, hash_password, verify_password, create_token, security
from models.schemas import VisualAidDeckCreate, VisualAidDeckUpdate
from utils.image import process_slide_image
import base64
from io import BytesIO
from PIL import Image

router = APIRouter(prefix="/api")

# ============== VISUAL AID ROUTES ==============

def process_slide_image(image_data: bytes) -> str:
    """Process slide image: convert to WebP, optimize for presentation"""
    img = Image.open(BytesIO(image_data))
    if img.mode in ('RGBA', 'P'):
        img = img.convert('RGB')
    
    # For slides, keep higher quality and larger size
    max_width, max_height = 1200, 900
    img.thumbnail((max_width, max_height), Image.LANCZOS)
    
    buffer = BytesIO()
    img.save(buffer, format='WebP', quality=80)
    buffer.seek(0)
    return base64.b64encode(buffer.read()).decode('utf-8')

@router.post("/visual-aids")
async def create_visual_aid_deck(data: VisualAidDeckCreate, current_user: dict = Depends(get_current_user)):
    """Create a visual aid deck"""
    deck_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    deck_doc = {
        'id': deck_id,
        'name': data.name,
        'deck_type': data.deck_type,
        'category': data.category or '',
        'subcategory': data.subcategory or '',
        'description': data.description or '',
        'status': data.status,
        'slide_count': 0,
        'created_at': now,
        'updated_at': now,
    }
    await db.visual_aid_decks.insert_one(deck_doc)
    deck_doc.pop('_id', None)
    return deck_doc

@router.get("/visual-aids")
async def get_visual_aid_decks(deck_type: Optional[str] = None, category: Optional[str] = None, status: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """List all visual aid decks (without slide image data)"""
    query = {}
    if deck_type:
        query['deck_type'] = deck_type
    if category:
        query['category'] = category
    if status:
        query['status'] = status
    
    decks = await db.visual_aid_decks.find(query, {'_id': 0}).sort('created_at', -1).to_list(200)
    return decks

@router.get("/visual-aids/{deck_id}")
async def get_visual_aid_deck(deck_id: str, current_user: dict = Depends(get_current_user)):
    """Get a deck with its slides"""
    deck = await db.visual_aid_decks.find_one({'id': deck_id}, {'_id': 0})
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")
    
    slides = await db.visual_aid_slides.find({'deck_id': deck_id}, {'_id': 0}).sort('order', 1).to_list(100)
    deck['slides'] = slides
    return deck

@router.put("/visual-aids/{deck_id}")
async def update_visual_aid_deck(deck_id: str, data: VisualAidDeckUpdate, current_user: dict = Depends(get_current_user)):
    """Update deck metadata"""
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    result = await db.visual_aid_decks.update_one({'id': deck_id}, {'$set': update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Deck not found")
    
    deck = await db.visual_aid_decks.find_one({'id': deck_id}, {'_id': 0})
    return deck

@router.delete("/visual-aids/{deck_id}")
async def delete_visual_aid_deck(deck_id: str, current_user: dict = Depends(get_current_user)):
    """Delete deck and all its slides"""
    result = await db.visual_aid_decks.delete_one({'id': deck_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Deck not found")
    await db.visual_aid_slides.delete_many({'deck_id': deck_id})
    return {"message": "Deck and slides deleted"}

@router.post("/visual-aids/{deck_id}/slides")
async def add_slide_to_deck(deck_id: str, data: dict, current_user: dict = Depends(get_current_user)):
    """Add a slide to a deck"""
    deck = await db.visual_aid_decks.find_one({'id': deck_id}, {'_id': 0, 'id': 1})
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")
    
    slide_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    # Get current max order
    last_slide = await db.visual_aid_slides.find_one({'deck_id': deck_id}, {'_id': 0, 'order': 1}, sort=[('order', -1)])
    next_order = (last_slide['order'] + 1) if last_slide else 1
    
    # Process image
    image_webp = ''
    if data.get('image_base64'):
        try:
            image_bytes = base64.b64decode(data['image_base64'])
            image_webp = process_slide_image(image_bytes)
        except Exception as e:
            logger.error(f"Slide image processing error: {e}")
            raise HTTPException(status_code=400, detail="Invalid image data")
    
    slide_doc = {
        'id': slide_id,
        'deck_id': deck_id,
        'title': data.get('title', ''),
        'image_webp': image_webp,
        'order': data.get('order', next_order),
        'created_at': now,
    }
    await db.visual_aid_slides.insert_one(slide_doc)
    
    # Update deck slide count
    count = await db.visual_aid_slides.count_documents({'deck_id': deck_id})
    await db.visual_aid_decks.update_one({'id': deck_id}, {'$set': {'slide_count': count, 'updated_at': now}})
    
    slide_doc.pop('_id', None)
    return slide_doc

@router.put("/visual-aids/{deck_id}/slides/{slide_id}")
async def update_slide(deck_id: str, slide_id: str, data: dict, current_user: dict = Depends(get_current_user)):
    """Update a slide"""
    update_data = {}
    if 'title' in data:
        update_data['title'] = data['title']
    if 'order' in data:
        update_data['order'] = data['order']
    if 'image_base64' in data and data['image_base64']:
        try:
            image_bytes = base64.b64decode(data['image_base64'])
            update_data['image_webp'] = process_slide_image(image_bytes)
        except Exception as e:
            raise HTTPException(status_code=400, detail="Invalid image data")
    
    result = await db.visual_aid_slides.update_one({'id': slide_id, 'deck_id': deck_id}, {'$set': update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Slide not found")
    
    slide = await db.visual_aid_slides.find_one({'id': slide_id}, {'_id': 0})
    return slide

@router.delete("/visual-aids/{deck_id}/slides/{slide_id}")
async def delete_slide(deck_id: str, slide_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a slide"""
    result = await db.visual_aid_slides.delete_one({'id': slide_id, 'deck_id': deck_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Slide not found")
    
    now = datetime.now(timezone.utc).isoformat()
    count = await db.visual_aid_slides.count_documents({'deck_id': deck_id})
    await db.visual_aid_decks.update_one({'id': deck_id}, {'$set': {'slide_count': count, 'updated_at': now}})
    return {"message": "Slide deleted"}

@router.put("/visual-aids/{deck_id}/slides/reorder")
async def reorder_slides(deck_id: str, data: dict, current_user: dict = Depends(get_current_user)):
    """Reorder slides. data = { slide_ids: [id1, id2, ...] }"""
    slide_ids = data.get('slide_ids', [])
    for idx, sid in enumerate(slide_ids):
        await db.visual_aid_slides.update_one({'id': sid, 'deck_id': deck_id}, {'$set': {'order': idx + 1}})
    return {"message": "Slides reordered"}

@router.get("/mr-reports")
async def get_mr_reports(mr_id: Optional[str] = None, from_date: Optional[str] = None, to_date: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Get comprehensive MR activity reports"""
    today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    
    # Build visit query
    visit_q = {}
    order_q = {'source': 'mr'}
    if mr_id:
        visit_q['mr_id'] = mr_id
        order_q['mr_id'] = mr_id
    if from_date or to_date:
        date_q = {}
        if from_date:
            date_q['$gte'] = from_date
        if to_date:
            date_q['$lte'] = to_date
        visit_q['visit_date'] = date_q
        order_date_q = {}
        if from_date:
            order_date_q['$gte'] = from_date + 'T00:00:00'
        if to_date:
            order_date_q['$lte'] = to_date + 'T23:59:59'
        order_q['created_at'] = order_date_q
    
    # Fetch all data concurrently
    mrs = await db.mrs.find({}, {'_id': 0, 'password_hash': 0}).to_list(100)
    visits = await db.mr_visits.find(visit_q, {'_id': 0}).sort('created_at', -1).to_list(500)
    orders = await db.orders.find(order_q, {'_id': 0}).sort('created_at', -1).to_list(500)
    
    mr_map = {m['id']: m for m in mrs}
    
    # Fill MR name in visits
    for v in visits:
        v['mr_name'] = mr_map.get(v.get('mr_id'), {}).get('name', 'Unknown')
    
    # Build per-MR performance stats
    mr_stats = []
    for m in mrs:
        mid = m['id']
        m_visits = [v for v in visits if v.get('mr_id') == mid]
        m_orders = [o for o in orders if o.get('mr_id') == mid]
        today_visits = [v for v in m_visits if v.get('visit_date') == today]
        pending_followups = [v for v in m_visits if v.get('outcome') == 'follow_up_required' and not v.get('follow_up_done')]
        
        # Outcome breakdown
        outcomes = {}
        for v in m_visits:
            oc = v.get('outcome', 'unknown')
            outcomes[oc] = outcomes.get(oc, 0) + 1
        
        mr_stats.append({
            'id': mid,
            'name': m['name'],
            'phone': m.get('phone', ''),
            'state': m.get('state', ''),
            'districts': m.get('districts', []),
            'status': m.get('status', ''),
            'total_visits': len(m_visits),
            'today_visits': len(today_visits),
            'pending_followups': len(pending_followups),
            'total_orders': len(m_orders),
            'pending_orders': len([o for o in m_orders if o.get('status') == 'pending']),
            'cancelled_orders': len([o for o in m_orders if o.get('status') == 'cancelled']),
            'outcomes': outcomes,
        })
    
    # Overall summary
    summary = {
        'total_mrs': len(mrs),
        'active_mrs': len([m for m in mrs if m.get('status') == 'active']),
        'total_visits': len(visits),
        'today_visits': len([v for v in visits if v.get('visit_date') == today]),
        'total_orders': len(orders),
        'pending_orders': len([o for o in orders if o.get('status') == 'pending']),
        'states_covered': len(set(m.get('state', '') for m in mrs)),
    }
    
    return {
        'summary': summary,
        'mr_stats': mr_stats,
        'visits': visits[:100],
        'orders': orders[:100],
        'total': len(visits),
    }


