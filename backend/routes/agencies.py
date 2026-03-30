from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, UploadFile, File, Request
from fastapi.responses import Response
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import uuid
import json
import os

from deps import db, logger, get_current_user, hash_password, verify_password, create_token, security
from models.schemas import AgencyCreate, AgencyUpdate, AgencyResponse, AgencyNoteCreate, AgencyNoteResponse
from utils.code_gen import generate_agency_code

router = APIRouter(prefix="/api")

# ============== AGENCY ROUTES ==============

@router.post("/agencies", response_model=AgencyResponse)
async def create_agency(agency_data: AgencyCreate, current_user: dict = Depends(get_current_user)):
    agency_id = str(uuid.uuid4())
    customer_code = await generate_agency_code()
    now = datetime.now(timezone.utc)
    
    agency_doc = {
        'id': agency_id,
        'customer_code': customer_code,
        'name': agency_data.name,
        'proprietor_name': agency_data.proprietor_name,
        'gst_number': agency_data.gst_number,
        'drug_license': agency_data.drug_license,
        'address': agency_data.address,
        'address_line_1': agency_data.address_line_1,
        'address_line_2': agency_data.address_line_2,
        'state': agency_data.state,
        'district': agency_data.district,
        'pincode': agency_data.pincode,
        'delivery_station': agency_data.delivery_station,
        'transport_id': agency_data.transport_id,
        'email': agency_data.email,
        'phone': agency_data.phone,
        'alternate_phone': agency_data.alternate_phone,
        'lead_status': agency_data.lead_status,
        'birthday': agency_data.birthday,
        'anniversary': agency_data.anniversary,
        'created_at': now.isoformat(),
        'updated_at': now.isoformat(),
        'created_by': current_user['id']
    }
    
    await db.agencies.insert_one(agency_doc)
    
    # Get transport name if transport_id is provided
    transport_name = None
    if agency_data.transport_id:
        transport = await db.transports.find_one({'id': agency_data.transport_id})
        transport_name = transport['name'] if transport else None
    
    return AgencyResponse(
        id=agency_id,
        customer_code=customer_code,
        name=agency_data.name,
        proprietor_name=agency_data.proprietor_name,
        gst_number=agency_data.gst_number,
        drug_license=agency_data.drug_license,
        address=agency_data.address,
        address_line_1=agency_data.address_line_1,
        address_line_2=agency_data.address_line_2,
        state=agency_data.state,
        district=agency_data.district,
        pincode=agency_data.pincode,
        delivery_station=agency_data.delivery_station,
        transport_id=agency_data.transport_id,
        transport_name=transport_name,
        email=agency_data.email,
        phone=agency_data.phone,
        alternate_phone=agency_data.alternate_phone,
        lead_status=agency_data.lead_status,
        birthday=agency_data.birthday,
        anniversary=agency_data.anniversary,
        created_at=now,
        updated_at=now
    )

@router.get("/agencies", response_model=List[AgencyResponse])
async def get_agencies(
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
    
    agencies = await db.agencies.find(query, {'_id': 0}).sort('created_at', -1).to_list(1000)
    
    # Get all transport ids to lookup names
    transport_ids = list(set([doc.get('transport_id') for doc in agencies if doc.get('transport_id')]))
    transports_map = {}
    if transport_ids:
        transports = await db.transports.find({'id': {'$in': transport_ids}}).to_list(100)
        transports_map = {t['id']: t['name'] for t in transports}
    
    result = []
    for doc in agencies:
        created_at = doc.get('created_at')
        updated_at = doc.get('updated_at') or doc.get('created_at')
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
        if isinstance(updated_at, str):
            updated_at = datetime.fromisoformat(updated_at.replace('Z', '+00:00'))
        
        result.append(AgencyResponse(
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
            transport_name=transports_map.get(doc.get('transport_id')),
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

@router.get("/agencies/{agency_id}", response_model=AgencyResponse)
async def get_agency(agency_id: str, current_user: dict = Depends(get_current_user)):
    agency = await db.agencies.find_one({'id': agency_id}, {'_id': 0})
    if not agency:
        raise HTTPException(status_code=404, detail="Agency not found")
    
    created_at = agency.get('created_at')
    updated_at = agency.get('updated_at') or agency.get('created_at')
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
    if isinstance(updated_at, str):
        updated_at = datetime.fromisoformat(updated_at.replace('Z', '+00:00'))
    
    # Get transport name if transport_id exists
    transport_name = None
    if agency.get('transport_id'):
        transport = await db.transports.find_one({'id': agency['transport_id']})
        transport_name = transport['name'] if transport else None
    
    return AgencyResponse(
        id=agency['id'],
        customer_code=agency['customer_code'],
        name=agency['name'],
        proprietor_name=agency.get('proprietor_name'),
        gst_number=agency.get('gst_number'),
        drug_license=agency.get('drug_license'),
        address=agency.get('address'),
        address_line_1=agency.get('address_line_1'),
        address_line_2=agency.get('address_line_2'),
        state=agency.get('state'),
        district=agency.get('district'),
        pincode=agency.get('pincode'),
        delivery_station=agency.get('delivery_station'),
        transport_id=agency.get('transport_id'),
        transport_name=transport_name,
        email=agency.get('email'),
        phone=agency['phone'],
        alternate_phone=agency.get('alternate_phone'),
        lead_status=agency.get('lead_status', 'Pipeline'),
        priority=agency.get('priority'),
        last_contact_date=agency.get('last_contact_date'),
        follow_up_date=agency.get('follow_up_date'),
        birthday=agency.get('birthday'),
        anniversary=agency.get('anniversary'),
        is_portal_customer=agency.get('is_portal_customer', False),
        portal_customer_id=agency.get('portal_customer_id'),
        created_at=created_at,
        updated_at=updated_at
    )

@router.put("/agencies/{agency_id}", response_model=AgencyResponse)
async def update_agency(agency_id: str, agency_data: AgencyUpdate, current_user: dict = Depends(get_current_user)):
    agency = await db.agencies.find_one({'id': agency_id}, {'_id': 0})
    if not agency:
        raise HTTPException(status_code=404, detail="Agency not found")
    
    update_data = {k: v for k, v in agency_data.model_dump().items() if v is not None}
    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.agencies.update_one({'id': agency_id}, {'$set': update_data})
    
    updated = await db.agencies.find_one({'id': agency_id}, {'_id': 0})
    created_at = updated.get('created_at')
    updated_at = updated.get('updated_at')
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
    if isinstance(updated_at, str):
        updated_at = datetime.fromisoformat(updated_at.replace('Z', '+00:00'))
    
    # Get transport name if transport_id exists
    transport_name = None
    if updated.get('transport_id'):
        transport = await db.transports.find_one({'id': updated['transport_id']})
        transport_name = transport['name'] if transport else None
    
    return AgencyResponse(
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
        transport_name=transport_name,
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

@router.delete("/agencies/{agency_id}")
async def delete_agency(agency_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.agencies.delete_one({'id': agency_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Agency not found")
    # Also delete related notes
    await db.agency_notes.delete_many({'agency_id': agency_id})
    return {"message": "Agency deleted successfully"}

@router.post("/agencies/bulk-delete")
async def bulk_delete_agencies(ids: List[str], current_user: dict = Depends(get_current_user)):
    """Bulk delete multiple agencies"""
    if not ids:
        raise HTTPException(status_code=400, detail="No IDs provided")
    
    # Delete agencies
    result = await db.agencies.delete_many({'id': {'$in': ids}})
    
    # Also delete related notes
    await db.agency_notes.delete_many({'agency_id': {'$in': ids}})
    
    return {"message": f"{result.deleted_count} agency(ies) deleted successfully", "deleted_count": result.deleted_count}

@router.put("/agencies/{agency_id}/contact")
async def update_agency_last_contact(agency_id: str, current_user: dict = Depends(get_current_user)):
    """Update last contact date and set follow-up to 25 days from now"""
    agency = await db.agencies.find_one({'id': agency_id}, {'_id': 0})
    if not agency:
        raise HTTPException(status_code=404, detail="Agency not found")
    
    now = datetime.now(timezone.utc)
    follow_up = now + timedelta(days=25)
    
    await db.agencies.update_one(
        {'id': agency_id},
        {'$set': {
            'last_contact_date': now.strftime('%Y-%m-%d'),
            'follow_up_date': follow_up.strftime('%Y-%m-%d'),
            'updated_at': now.isoformat()
        }}
    )
    
    return {"message": "Contact updated successfully", "follow_up_date": follow_up.strftime('%Y-%m-%d')}

# Agency Notes
@router.get("/agencies/{agency_id}/notes", response_model=List[AgencyNoteResponse])
async def get_agency_notes(agency_id: str, current_user: dict = Depends(get_current_user)):
    notes = await db.agency_notes.find({'agency_id': agency_id}, {'_id': 0}).sort('created_at', -1).to_list(100)
    
    result = []
    for note in notes:
        created_at = note['created_at']
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
        
        result.append(AgencyNoteResponse(
            id=note['id'],
            agency_id=note['agency_id'],
            note=note['note'],
            created_by=note['created_by'],
            created_at=created_at
        ))
    
    return result

@router.post("/agencies/{agency_id}/notes", response_model=AgencyNoteResponse)
async def add_agency_note(agency_id: str, note_data: AgencyNoteCreate, current_user: dict = Depends(get_current_user)):
    agency = await db.agencies.find_one({'id': agency_id}, {'_id': 0})
    if not agency:
        raise HTTPException(status_code=404, detail="Agency not found")
    
    now = datetime.now(timezone.utc)
    note_doc = {
        'id': str(uuid.uuid4()),
        'agency_id': agency_id,
        'note': note_data.note,
        'created_by': current_user['name'],
        'created_at': now.isoformat()
    }
    
    await db.agency_notes.insert_one(note_doc)
    
    return AgencyNoteResponse(
        id=note_doc['id'],
        agency_id=agency_id,
        note=note_doc['note'],
        created_by=note_doc['created_by'],
        created_at=now
    )

@router.delete("/agencies/{agency_id}/notes/{note_id}")
async def delete_agency_note(agency_id: str, note_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.agency_notes.delete_one({'id': note_id, 'agency_id': agency_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Note not found")
    return {"message": "Note deleted successfully"}


