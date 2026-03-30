from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, UploadFile, File, Request
from fastapi.responses import Response
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import uuid
import json
import os

from deps import db, logger, get_current_user, hash_password, verify_password, create_token, security
from models.schemas import MedicalCreate, MedicalUpdate, MedicalResponse, MedicalNoteCreate, MedicalNoteResponse
from utils.code_gen import generate_medical_code

router = APIRouter(prefix="/api")

# ============== MEDICAL ROUTES ==============

@router.post("/medicals", response_model=MedicalResponse)
async def create_medical(medical_data: MedicalCreate, current_user: dict = Depends(get_current_user)):
    medical_id = str(uuid.uuid4())
    customer_code = await generate_medical_code()
    now = datetime.now(timezone.utc)
    
    # Get transport name if transport_id provided
    transport_name = None
    if medical_data.transport_id:
        transport = await db.transports.find_one({'id': medical_data.transport_id}, {'_id': 0, 'name': 1})
        transport_name = transport.get('name') if transport else None
    
    medical_doc = {
        'id': medical_id,
        'customer_code': customer_code,
        'name': medical_data.name,
        'proprietor_name': medical_data.proprietor_name,
        'gst_number': medical_data.gst_number,
        'drug_license': medical_data.drug_license,
        'address': medical_data.address,
        'address_line_1': medical_data.address_line_1,
        'address_line_2': medical_data.address_line_2,
        'state': medical_data.state,
        'district': medical_data.district,
        'pincode': medical_data.pincode,
        'delivery_station': medical_data.delivery_station,
        'transport_id': medical_data.transport_id,
        'email': medical_data.email,
        'phone': medical_data.phone,
        'alternate_phone': medical_data.alternate_phone,
        'lead_status': medical_data.lead_status,
        'birthday': medical_data.birthday,
        'anniversary': medical_data.anniversary,
        'created_at': now.isoformat(),
        'updated_at': now.isoformat(),
        'created_by': current_user['id']
    }
    
    await db.medicals.insert_one(medical_doc)
    
    return MedicalResponse(
        id=medical_id,
        customer_code=customer_code,
        name=medical_data.name,
        proprietor_name=medical_data.proprietor_name,
        gst_number=medical_data.gst_number,
        drug_license=medical_data.drug_license,
        address=medical_data.address,
        address_line_1=medical_data.address_line_1,
        address_line_2=medical_data.address_line_2,
        state=medical_data.state,
        district=medical_data.district,
        pincode=medical_data.pincode,
        delivery_station=medical_data.delivery_station,
        transport_id=medical_data.transport_id,
        transport_name=transport_name,
        email=medical_data.email,
        phone=medical_data.phone,
        alternate_phone=medical_data.alternate_phone,
        lead_status=medical_data.lead_status,
        birthday=medical_data.birthday,
        anniversary=medical_data.anniversary,
        created_at=now,
        updated_at=now
    )

@router.get("/medicals", response_model=List[MedicalResponse])
async def get_medicals(
    search: Optional[str] = None,
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    
    if search:
        query['$or'] = [
            {'name': {'$regex': search, '$options': 'i'}},
            {'customer_code': {'$regex': search, '$options': 'i'}},
            {'proprietor_name': {'$regex': search, '$options': 'i'}},
            {'email': {'$regex': search, '$options': 'i'}},
            {'phone': {'$regex': search, '$options': 'i'}},
            {'gst_number': {'$regex': search, '$options': 'i'}}
        ]
    
    if status and status != 'all':
        query['lead_status'] = status
    
    medicals = await db.medicals.find(query, {'_id': 0}).sort('created_at', -1).to_list(1000)
    
    # Get all transport IDs to fetch names in one query
    transport_ids = [doc.get('transport_id') for doc in medicals if doc.get('transport_id')]
    transport_map = {}
    if transport_ids:
        transports = await db.transports.find({'id': {'$in': transport_ids}}, {'_id': 0, 'id': 1, 'name': 1}).to_list(100)
        transport_map = {t['id']: t['name'] for t in transports}
    
    result = []
    for doc in medicals:
        created_at = doc.get('created_at')
        updated_at = doc.get('updated_at') or doc.get('created_at')
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
        if isinstance(updated_at, str):
            updated_at = datetime.fromisoformat(updated_at.replace('Z', '+00:00'))
        
        result.append(MedicalResponse(
            id=doc['id'],
            customer_code=doc['customer_code'],
            name=doc['name'],
            proprietor_name=doc.get('proprietor_name'),
            gst_number=doc.get('gst_number'),
            drug_license=doc.get('drug_license'),
            address=doc.get('address'),
            address_line_1=doc.get('address_line_1'),
            address_line_2=doc.get('address_line_2'),
            state=doc.get('state'),
            district=doc.get('district'),
            pincode=doc.get('pincode'),
            delivery_station=doc.get('delivery_station'),
            transport_id=doc.get('transport_id'),
            transport_name=transport_map.get(doc.get('transport_id')),
            email=doc.get('email'),
            phone=doc['phone'],
            alternate_phone=doc.get('alternate_phone'),
            lead_status=doc.get('lead_status', 'Pipeline'),
            priority=doc.get('priority'),
            last_contact_date=doc.get('last_contact_date'),
            follow_up_date=doc.get('follow_up_date'),
            birthday=doc.get('birthday'),
            anniversary=doc.get('anniversary'),
            is_portal_customer=doc.get('is_portal_customer', False),
            portal_customer_id=doc.get('portal_customer_id'),
            created_at=created_at,
            updated_at=updated_at
        ))
    
    return result

@router.get("/medicals/{medical_id}", response_model=MedicalResponse)
async def get_medical(medical_id: str, current_user: dict = Depends(get_current_user)):
    medical = await db.medicals.find_one({'id': medical_id}, {'_id': 0})
    if not medical:
        raise HTTPException(status_code=404, detail="Medical not found")
    
    created_at = medical.get('created_at')
    updated_at = medical.get('updated_at') or medical.get('created_at')
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
    if isinstance(updated_at, str):
        updated_at = datetime.fromisoformat(updated_at.replace('Z', '+00:00'))
    
    return MedicalResponse(
        id=medical['id'],
        customer_code=medical['customer_code'],
        name=medical['name'],
        proprietor_name=medical.get('proprietor_name'),
        gst_number=medical.get('gst_number'),
        drug_license=medical.get('drug_license'),
        address=medical.get('address'),
        address_line_1=medical.get('address_line_1'),
        address_line_2=medical.get('address_line_2'),
        state=medical.get('state'),
        district=medical.get('district'),
        pincode=medical.get('pincode'),
        delivery_station=medical.get('delivery_station'),
        transport_id=medical.get('transport_id'),
        transport_name=None,
        email=medical.get('email'),
        phone=medical['phone'],
        alternate_phone=medical.get('alternate_phone'),
        lead_status=medical.get('lead_status', 'Pipeline'),
        priority=medical.get('priority'),
        last_contact_date=medical.get('last_contact_date'),
        follow_up_date=medical.get('follow_up_date'),
        birthday=medical.get('birthday'),
        anniversary=medical.get('anniversary'),
        is_portal_customer=medical.get('is_portal_customer', False),
        portal_customer_id=medical.get('portal_customer_id'),
        created_at=created_at,
        updated_at=updated_at
    )

@router.put("/medicals/{medical_id}", response_model=MedicalResponse)
async def update_medical(medical_id: str, medical_data: MedicalUpdate, current_user: dict = Depends(get_current_user)):
    medical = await db.medicals.find_one({'id': medical_id}, {'_id': 0})
    if not medical:
        raise HTTPException(status_code=404, detail="Medical not found")
    
    update_data = {k: v for k, v in medical_data.model_dump().items() if v is not None}
    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.medicals.update_one({'id': medical_id}, {'$set': update_data})
    
    updated = await db.medicals.find_one({'id': medical_id}, {'_id': 0})
    created_at = updated.get('created_at')
    updated_at = updated.get('updated_at')
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
    if isinstance(updated_at, str):
        updated_at = datetime.fromisoformat(updated_at.replace('Z', '+00:00'))
    
    return MedicalResponse(
        id=updated['id'],
        customer_code=updated['customer_code'],
        name=updated['name'],
        proprietor_name=updated.get('proprietor_name'),
        gst_number=updated.get('gst_number'),
        drug_license=updated.get('drug_license'),
        address=updated.get('address'),
        address_line_1=updated.get('address_line_1'),
        address_line_2=updated.get('address_line_2'),
        state=updated.get('state'),
        district=updated.get('district'),
        pincode=updated.get('pincode'),
        delivery_station=updated.get('delivery_station'),
        transport_id=updated.get('transport_id'),
        transport_name=None,
        email=updated.get('email'),
        phone=updated['phone'],
        alternate_phone=updated.get('alternate_phone'),
        lead_status=updated.get('lead_status', 'Pipeline'),
        priority=updated.get('priority'),
        last_contact_date=updated.get('last_contact_date'),
        follow_up_date=updated.get('follow_up_date'),
        birthday=updated.get('birthday'),
        anniversary=updated.get('anniversary'),
        is_portal_customer=updated.get('is_portal_customer', False),
        portal_customer_id=updated.get('portal_customer_id'),
        created_at=created_at,
        updated_at=updated_at
    )

@router.delete("/medicals/{medical_id}")
async def delete_medical(medical_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.medicals.delete_one({'id': medical_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Medical not found")
    # Also delete related notes
    await db.medical_notes.delete_many({'medical_id': medical_id})
    return {"message": "Medical deleted successfully"}

@router.post("/medicals/bulk-delete")
async def bulk_delete_medicals(ids: List[str], current_user: dict = Depends(get_current_user)):
    """Bulk delete multiple medicals"""
    if not ids:
        raise HTTPException(status_code=400, detail="No IDs provided")
    
    # Delete medicals
    result = await db.medicals.delete_many({'id': {'$in': ids}})
    
    # Also delete related notes
    await db.medical_notes.delete_many({'medical_id': {'$in': ids}})
    
    return {"message": f"{result.deleted_count} medical(s) deleted successfully", "deleted_count": result.deleted_count}

@router.put("/medicals/{medical_id}/contact")
async def update_medical_last_contact(medical_id: str, current_user: dict = Depends(get_current_user)):
    """Update last contact date and set follow-up to 25 days from now"""
    medical = await db.medicals.find_one({'id': medical_id}, {'_id': 0})
    if not medical:
        raise HTTPException(status_code=404, detail="Medical not found")
    
    now = datetime.now(timezone.utc)
    follow_up = now + timedelta(days=25)
    
    await db.medicals.update_one(
        {'id': medical_id},
        {'$set': {
            'last_contact_date': now.strftime('%Y-%m-%d'),
            'follow_up_date': follow_up.strftime('%Y-%m-%d'),
            'updated_at': now.isoformat()
        }}
    )
    
    return {"message": "Contact updated successfully", "follow_up_date": follow_up.strftime('%Y-%m-%d')}

# Medical Notes
@router.get("/medicals/{medical_id}/notes", response_model=List[MedicalNoteResponse])
async def get_medical_notes(medical_id: str, current_user: dict = Depends(get_current_user)):
    notes = await db.medical_notes.find({'medical_id': medical_id}, {'_id': 0}).sort('created_at', -1).to_list(100)
    
    result = []
    for note in notes:
        created_at = note['created_at']
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
        
        result.append(MedicalNoteResponse(
            id=note['id'],
            medical_id=note['medical_id'],
            note=note['note'],
            created_by=note['created_by'],
            created_at=created_at
        ))
    
    return result

@router.post("/medicals/{medical_id}/notes", response_model=MedicalNoteResponse)
async def add_medical_note(medical_id: str, note_data: MedicalNoteCreate, current_user: dict = Depends(get_current_user)):
    medical = await db.medicals.find_one({'id': medical_id}, {'_id': 0})
    if not medical:
        raise HTTPException(status_code=404, detail="Medical not found")
    
    now = datetime.now(timezone.utc)
    note_doc = {
        'id': str(uuid.uuid4()),
        'medical_id': medical_id,
        'note': note_data.note,
        'created_by': current_user['name'],
        'created_at': now.isoformat()
    }
    
    await db.medical_notes.insert_one(note_doc)
    
    return MedicalNoteResponse(
        id=note_doc['id'],
        medical_id=medical_id,
        note=note_doc['note'],
        created_by=note_doc['created_by'],
        created_at=now
    )

@router.delete("/medicals/{medical_id}/notes/{note_id}")
async def delete_medical_note(medical_id: str, note_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.medical_notes.delete_one({'id': note_id, 'medical_id': medical_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Note not found")
    return {"message": "Note deleted successfully"}


