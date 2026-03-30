from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, UploadFile, File, Request
from fastapi.responses import Response
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import uuid
import json
import os

from deps import db, logger, get_current_user, hash_password, verify_password, create_token, security
from models.schemas import CompanySettingsCreate, CompanySettingsResponse
from india_locations import get_all_states, get_districts_by_state

router = APIRouter(prefix="/api")

# ============== COMPANY SETTINGS ROUTES ==============

@router.post("/company-settings", response_model=CompanySettingsResponse)
async def save_company_settings(settings: CompanySettingsCreate, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can update company settings")
    
    settings_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    # Process logo if provided
    processed_logo = None
    if settings.logo_base64:
        try:
            image_bytes = base64.b64decode(settings.logo_base64)
            processed_logo = process_image_to_webp(image_bytes, max_size_kb=50, target_size=(200, 200))
        except Exception as e:
            logger.error(f"Logo processing error: {str(e)}")
    
    # Process login background image if provided
    processed_bg = None
    if settings.login_background_image:
        try:
            image_bytes = base64.b64decode(settings.login_background_image)
            processed_bg = process_image_to_webp(image_bytes, max_size_kb=200, target_size=(1920, 1080))
        except Exception as e:
            logger.error(f"Background image processing error: {str(e)}")
    
    # Delete existing settings (only one allowed)
    await db.company_settings.delete_many({})
    
    settings_doc = {
        'id': settings_id,
        'company_name': settings.company_name,
        'company_short_name': settings.company_short_name,
        'address': settings.address,
        'email': settings.email,
        'phone': settings.phone,
        'gst_number': settings.gst_number,
        'drug_license': settings.drug_license,
        'logo_webp': processed_logo,
        'terms_conditions': settings.terms_conditions,
        'login_tagline': settings.login_tagline,
        'login_background_color': settings.login_background_color,
        'login_background_webp': processed_bg,
        'updated_at': now.isoformat()
    }
    
    await db.company_settings.insert_one(settings_doc)
    
    return CompanySettingsResponse(
        id=settings_id,
        company_name=settings.company_name,
        company_short_name=settings.company_short_name,
        address=settings.address,
        email=settings.email,
        phone=settings.phone,
        gst_number=settings.gst_number,
        drug_license=settings.drug_license,
        logo_url="/api/company-settings/logo" if processed_logo else None,
        terms_conditions=settings.terms_conditions,
        login_tagline=settings.login_tagline,
        login_background_color=settings.login_background_color,
        login_background_image_url="/api/company-settings/login-background" if processed_bg else None,
        updated_at=now
    )

@router.get("/company-settings", response_model=Optional[CompanySettingsResponse])
async def get_company_settings(current_user: dict = Depends(get_current_user)):
    settings = await db.company_settings.find_one({}, {'_id': 0, 'logo_webp': 0, 'login_background_webp': 0})
    if not settings:
        return None
    
    updated_at = settings['updated_at']
    if isinstance(updated_at, str):
        updated_at = datetime.fromisoformat(updated_at.replace('Z', '+00:00'))
    
    has_logo = await db.company_settings.find_one({'logo_webp': {'$ne': None}}, {'_id': 1})
    has_bg = await db.company_settings.find_one({'login_background_webp': {'$ne': None}}, {'_id': 1})
    
    return CompanySettingsResponse(
        id=settings['id'],
        company_name=settings['company_name'],
        company_short_name=settings.get('company_short_name'),
        address=settings['address'],
        email=settings['email'],
        phone=settings.get('phone'),
        gst_number=settings['gst_number'],
        drug_license=settings['drug_license'],
        logo_url="/api/company-settings/logo" if has_logo else None,
        terms_conditions=settings.get('terms_conditions'),
        login_tagline=settings.get('login_tagline'),
        login_background_color=settings.get('login_background_color'),
        login_background_image_url="/api/company-settings/login-background" if has_bg else None,
        updated_at=updated_at
    )

@router.get("/company-settings/logo")
async def get_company_logo():
    settings = await db.company_settings.find_one({}, {'logo_webp': 1})
    if not settings or not settings.get('logo_webp'):
        raise HTTPException(status_code=404, detail="Logo not found")
    
    image_data = base64.b64decode(settings['logo_webp'])
    return Response(content=image_data, media_type="image/webp")

@router.get("/company-settings/login-background")
async def get_login_background():
    settings = await db.company_settings.find_one({}, {'login_background_webp': 1})
    if not settings or not settings.get('login_background_webp'):
        raise HTTPException(status_code=404, detail="Login background not found")
    
    image_data = base64.b64decode(settings['login_background_webp'])
    return Response(content=image_data, media_type="image/webp")

# ============== PUBLIC SHOWCASE ROUTES (NO AUTH) ==============

@router.get("/public/company-settings")
async def get_public_company_settings():
    settings = await db.company_settings.find_one({}, {'_id': 0, 'logo_webp': 0, 'login_background_webp': 0})
    if not settings:
        return None
    
    has_logo = await db.company_settings.find_one({'logo_webp': {'$ne': None}}, {'_id': 1})
    has_bg = await db.company_settings.find_one({'login_background_webp': {'$ne': None}}, {'_id': 1})
    
    return {
        'company_name': settings['company_name'],
        'company_short_name': settings.get('company_short_name'),
        'address': settings['address'],
        'email': settings['email'],
        'phone': settings.get('phone'),
        'gst_number': settings['gst_number'],
        'drug_license': settings['drug_license'],
        'logo_url': "/api/company-settings/logo" if has_logo else None,
        'terms_conditions': settings.get('terms_conditions'),
        'login_tagline': settings.get('login_tagline'),
        'login_background_color': settings.get('login_background_color'),
        'login_background_image_url': "/api/company-settings/login-background" if has_bg else None
    }

@router.get("/public/items")
async def get_public_items(main_category: Optional[str] = None, subcategory: Optional[str] = None):
    """Get all items with category filters for public showcase"""
    query = {'is_hidden': {'$ne': True}}
    if main_category:
        query['main_categories'] = main_category
    if subcategory:
        query['subcategories'] = subcategory
    
    items = await db.items.find(query, {'_id': 0, 'image_webp': 0, 'created_by': 0}).sort('item_name', 1).to_list(1000)
    
    result = []
    for item in items:
        has_image = await db.items.find_one({'id': item['id'], 'image_webp': {'$ne': None}}, {'_id': 1})
        item_data = {
            'id': item['id'],
            'item_code': item['item_code'],
            'item_name': item['item_name'],
            'main_categories': item.get('main_categories', []) or ([item.get('main_category')] if item.get('main_category') else []),
            'subcategories': item.get('subcategories', []),
            'composition': item.get('composition'),
            'offer': item.get('offer'),
            'special_offer': item.get('special_offer'),
            'mrp': item['mrp'],
            'rate': item['rate'],
            'gst': item.get('gst', 0),
            'image_url': f"/api/items/{item['id']}/image" if has_image else None
        }
        result.append(item_data)
    
    return result

@router.get("/public/categories")
async def get_public_categories():
    """Get all main categories and subcategories for filters"""
    items = await db.items.find({}, {'main_categories': 1, 'main_category': 1, 'subcategories': 1, '_id': 0}).to_list(1000)
    
    main_categories = set()
    subcategories_map = {}
    
    for item in items:
        # Handle both old (main_category) and new (main_categories) field names
        main_cats = item.get('main_categories', [])
        if not main_cats and item.get('main_category'):
            main_cats = [item.get('main_category')]
        
        for main_cat in main_cats:
            if main_cat:
                main_categories.add(main_cat)
                if main_cat not in subcategories_map:
                    subcategories_map[main_cat] = set()
                for sub in item.get('subcategories', []):
                    subcategories_map[main_cat].add(sub)
    
    return {
        'main_categories': sorted(list(main_categories)),
        'subcategories': {k: sorted(list(v)) for k, v in subcategories_map.items()}
    }

# ============== LOCATION DATA ROUTES (PUBLIC) ==============

@router.get("/public/states")
async def get_states():
    """Get list of all Indian states and union territories"""
    return {"states": get_all_states()}

@router.get("/public/districts/{state}")
async def get_districts(state: str):
    """Get list of districts for a given state"""
    districts = get_districts_by_state(state)
    if not districts:
        return {"districts": [], "message": "No districts found for the given state"}
    return {"districts": districts}

@router.get("/public/doctor/{mobile}")
async def get_doctor_by_mobile(mobile: str):
    """Get doctor details by mobile number for auto-fill"""
    # Clean mobile number (remove spaces, dashes, etc.)
    clean_mobile = ''.join(filter(str.isdigit, mobile))
    
    # Search with various formats
    doctor = await db.doctors.find_one(
        {'$or': [
            {'phone': {'$regex': clean_mobile[-10:], '$options': 'i'}},
            {'phone': clean_mobile},
            {'phone': f"+91{clean_mobile[-10:]}"},
            {'phone': f"91{clean_mobile[-10:]}"}
        ]},
        {'_id': 0}
    )
    
    if not doctor:
        return None
    
    return {
        'id': doctor['id'],
        'name': doctor['name'],
        'phone': doctor['phone'],
        'email': doctor['email'],
        'address': doctor['address'],
        'customer_code': doctor['customer_code']
    }


