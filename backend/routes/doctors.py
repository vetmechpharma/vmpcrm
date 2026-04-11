from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, UploadFile, File, Request
from fastapi.responses import Response
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import uuid
import json
import os

from deps import db, logger, get_current_user, hash_password, verify_password, create_token, security
from models.schemas import DoctorCreate, DoctorUpdate, DoctorResponse, DoctorNoteCreate, DoctorNoteResponse
from utils.code_gen import generate_customer_code

router = APIRouter(prefix="/api")

# ============== DOCTOR ROUTES ==============

@router.post("/doctors", response_model=DoctorResponse)
async def create_doctor(doctor_data: DoctorCreate, current_user: dict = Depends(get_current_user)):
    doctor_id = str(uuid.uuid4())
    customer_code = await generate_customer_code()
    now = datetime.now(timezone.utc)
    
    # Get transport name if transport_id provided
    transport_name = None
    if doctor_data.transport_id:
        transport = await db.transports.find_one({'id': doctor_data.transport_id}, {'_id': 0, 'name': 1})
        transport_name = transport.get('name') if transport else None
    
    doctor_doc = {
        'id': doctor_id,
        'customer_code': customer_code,
        'name': doctor_data.name,
        'reg_no': doctor_data.reg_no or '',
        'address': doctor_data.address,
        'address_line_1': doctor_data.address_line_1,
        'address_line_2': doctor_data.address_line_2,
        'district': doctor_data.district,
        'state': doctor_data.state,
        'pincode': doctor_data.pincode,
        'delivery_station': doctor_data.delivery_station,
        'transport_id': doctor_data.transport_id,
        'email': doctor_data.email or '',
        'phone': doctor_data.phone,
        'lead_status': doctor_data.lead_status,
        'dob': doctor_data.dob,
        'opening_balance': doctor_data.opening_balance or 0,
        'created_at': now.isoformat(),
        'updated_at': now.isoformat(),
        'created_by': current_user['id']
    }
    
    await db.doctors.insert_one(doctor_doc)
    
    return DoctorResponse(
        id=doctor_id,
        customer_code=customer_code,
        name=doctor_data.name,
        reg_no=doctor_data.reg_no,
        address=doctor_data.address,
        address_line_1=doctor_data.address_line_1,
        address_line_2=doctor_data.address_line_2,
        district=doctor_data.district,
        state=doctor_data.state,
        pincode=doctor_data.pincode,
        delivery_station=doctor_data.delivery_station,
        transport_id=doctor_data.transport_id,
        transport_name=transport_name,
        email=doctor_data.email,
        phone=doctor_data.phone,
        lead_status=doctor_data.lead_status,
        dob=doctor_data.dob,
        created_at=now,
        updated_at=now
    )

@router.get("/doctors", response_model=List[DoctorResponse])
async def get_doctors(
    search: Optional[str] = None,
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    
    if search:
        query['$or'] = [
            {'name': {'$regex': search, '$options': 'i'}},
            {'customer_code': {'$regex': search, '$options': 'i'}},
            {'email': {'$regex': search, '$options': 'i'}},
            {'phone': {'$regex': search, '$options': 'i'}},
            {'reg_no': {'$regex': search, '$options': 'i'}}
        ]
    
    if status and status != 'all':
        query['lead_status'] = status
    
    doctors = await db.doctors.find(query, {'_id': 0}).sort('created_at', -1).to_list(1000)
    
    # Get all transport IDs to fetch names in one query
    transport_ids = [doc.get('transport_id') for doc in doctors if doc.get('transport_id')]
    transport_map = {}
    if transport_ids:
        transports = await db.transports.find({'id': {'$in': transport_ids}}, {'_id': 0, 'id': 1, 'name': 1}).to_list(100)
        transport_map = {t['id']: t['name'] for t in transports}
    
    result = []
    for doc in doctors:
        created_at = doc.get('created_at')
        updated_at = doc.get('updated_at') or doc.get('created_at')
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
        if isinstance(updated_at, str):
            updated_at = datetime.fromisoformat(updated_at.replace('Z', '+00:00'))
        
        result.append(DoctorResponse(
            id=doc['id'],
            customer_code=doc['customer_code'],
            name=doc['name'],
            reg_no=doc.get('reg_no', ''),
            address=doc.get('address', ''),
            address_line_1=doc.get('address_line_1'),
            address_line_2=doc.get('address_line_2'),
            district=doc.get('district'),
            state=doc.get('state'),
            pincode=doc.get('pincode'),
            delivery_station=doc.get('delivery_station'),
            transport_id=doc.get('transport_id'),
            transport_name=transport_map.get(doc.get('transport_id')),
            email=doc.get('email', ''),
            phone=doc['phone'],
            lead_status=doc.get('lead_status', 'Pipeline'),
            dob=doc.get('dob'),
            priority=doc.get('priority'),
            last_contact_date=doc.get('last_contact_date'),
            follow_up_date=doc.get('follow_up_date'),
            is_portal_customer=doc.get('is_portal_customer', False),
            portal_customer_id=doc.get('portal_customer_id'),
            created_at=created_at,
            updated_at=updated_at
        ))
    
    return result

@router.get("/doctors/{doctor_id}", response_model=DoctorResponse)
async def get_doctor(doctor_id: str, current_user: dict = Depends(get_current_user)):
    doctor = await db.doctors.find_one({'id': doctor_id}, {'_id': 0})
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    
    # Get transport name if transport_id exists
    transport_name = None
    if doctor.get('transport_id'):
        transport = await db.transports.find_one({'id': doctor['transport_id']}, {'_id': 0, 'name': 1})
        transport_name = transport.get('name') if transport else None
    
    created_at = doctor.get('created_at')
    updated_at = doctor.get('updated_at') or doctor.get('created_at')
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
    if isinstance(updated_at, str):
        updated_at = datetime.fromisoformat(updated_at.replace('Z', '+00:00'))
    
    return DoctorResponse(
        id=doctor['id'],
        customer_code=doctor['customer_code'],
        name=doctor['name'],
        reg_no=doctor.get('reg_no', ''),
        address=doctor.get('address', ''),
        address_line_1=doctor.get('address_line_1'),
        address_line_2=doctor.get('address_line_2'),
        district=doctor.get('district'),
        state=doctor.get('state'),
        pincode=doctor.get('pincode'),
        delivery_station=doctor.get('delivery_station'),
        transport_id=doctor.get('transport_id'),
        transport_name=transport_name,
        email=doctor.get('email', ''),
        phone=doctor['phone'],
        lead_status=doctor.get('lead_status', 'Pipeline'),
        dob=doctor.get('dob'),
        priority=doctor.get('priority'),
        last_contact_date=doctor.get('last_contact_date'),
        follow_up_date=doctor.get('follow_up_date'),
        is_portal_customer=doctor.get('is_portal_customer', False),
        portal_customer_id=doctor.get('portal_customer_id'),
        created_at=created_at,
        updated_at=updated_at
    )

@router.put("/doctors/{doctor_id}", response_model=DoctorResponse)
async def update_doctor(doctor_id: str, doctor_data: DoctorUpdate, current_user: dict = Depends(get_current_user)):
    doctor = await db.doctors.find_one({'id': doctor_id}, {'_id': 0})
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    
    update_data = {k: v for k, v in doctor_data.model_dump().items() if v is not None}
    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.doctors.update_one({'id': doctor_id}, {'$set': update_data})
    
    updated_doctor = await db.doctors.find_one({'id': doctor_id}, {'_id': 0})
    
    # Get transport name if transport_id exists
    transport_name = None
    if updated_doctor.get('transport_id'):
        transport = await db.transports.find_one({'id': updated_doctor['transport_id']}, {'_id': 0, 'name': 1})
        transport_name = transport.get('name') if transport else None
    
    created_at = updated_doctor.get('created_at')
    updated_at = updated_doctor.get('updated_at') or updated_doctor.get('created_at')
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
    if isinstance(updated_at, str):
        updated_at = datetime.fromisoformat(updated_at.replace('Z', '+00:00'))
    
    return DoctorResponse(
        id=updated_doctor['id'],
        customer_code=updated_doctor['customer_code'],
        name=updated_doctor['name'],
        reg_no=updated_doctor.get('reg_no', ''),
        address=updated_doctor.get('address', ''),
        address_line_1=updated_doctor.get('address_line_1'),
        address_line_2=updated_doctor.get('address_line_2'),
        district=updated_doctor.get('district'),
        state=updated_doctor.get('state'),
        pincode=updated_doctor.get('pincode'),
        delivery_station=updated_doctor.get('delivery_station'),
        transport_id=updated_doctor.get('transport_id'),
        transport_name=transport_name,
        email=updated_doctor.get('email', ''),
        phone=updated_doctor['phone'],
        lead_status=updated_doctor.get('lead_status', 'Pipeline'),
        dob=updated_doctor.get('dob'),
        priority=updated_doctor.get('priority'),
        last_contact_date=updated_doctor.get('last_contact_date'),
        follow_up_date=updated_doctor.get('follow_up_date'),
        is_portal_customer=updated_doctor.get('is_portal_customer', False),
        portal_customer_id=updated_doctor.get('portal_customer_id'),
        created_at=created_at,
        updated_at=updated_at
    )

@router.delete("/doctors/{doctor_id}")
async def delete_doctor(doctor_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.doctors.delete_one({'id': doctor_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Doctor not found")
    # Also delete related notes and tasks
    await db.doctor_notes.delete_many({'doctor_id': doctor_id})
    await db.tasks.delete_many({'doctor_id': doctor_id})
    return {"message": "Doctor deleted successfully"}

@router.post("/doctors/bulk-delete")
async def bulk_delete_doctors(ids: List[str], current_user: dict = Depends(get_current_user)):
    """Bulk delete multiple doctors"""
    if not ids:
        raise HTTPException(status_code=400, detail="No IDs provided")
    
    # Delete doctors
    result = await db.doctors.delete_many({'id': {'$in': ids}})
    
    # Also delete related notes and tasks
    await db.doctor_notes.delete_many({'doctor_id': {'$in': ids}})
    await db.tasks.delete_many({'doctor_id': {'$in': ids}})
    
    return {"message": f"{result.deleted_count} doctor(s) deleted successfully", "deleted_count": result.deleted_count}

# ============== DOCTOR NOTES ROUTES ==============

@router.get("/doctors/{doctor_id}/notes", response_model=List[DoctorNoteResponse])
async def get_doctor_notes(doctor_id: str, current_user: dict = Depends(get_current_user)):
    """Get all notes for a doctor"""
    notes = await db.doctor_notes.find({'doctor_id': doctor_id}, {'_id': 0}).sort('created_at', -1).to_list(100)
    
    result = []
    for note in notes:
        created_at = note['created_at']
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
        
        result.append(DoctorNoteResponse(
            id=note['id'],
            doctor_id=note['doctor_id'],
            note=note['note'],
            created_by=note['created_by'],
            created_at=created_at
        ))
    
    return result

@router.post("/doctors/{doctor_id}/notes", response_model=DoctorNoteResponse)
async def add_doctor_note(doctor_id: str, note_data: DoctorNoteCreate, current_user: dict = Depends(get_current_user)):
    """Add a note to a doctor"""
    doctor = await db.doctors.find_one({'id': doctor_id}, {'_id': 0})
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    
    now = datetime.now(timezone.utc)
    note_doc = {
        'id': str(uuid.uuid4()),
        'doctor_id': doctor_id,
        'note': note_data.note,
        'created_by': current_user['name'],
        'created_at': now.isoformat()
    }
    
    await db.doctor_notes.insert_one(note_doc)
    
    return DoctorNoteResponse(
        id=note_doc['id'],
        doctor_id=doctor_id,
        note=note_doc['note'],
        created_by=note_doc['created_by'],
        created_at=now
    )

@router.delete("/doctors/{doctor_id}/notes/{note_id}")
async def delete_doctor_note(doctor_id: str, note_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a note"""
    result = await db.doctor_notes.delete_one({'id': note_id, 'doctor_id': doctor_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Note not found")
    return {"message": "Note deleted successfully"}


