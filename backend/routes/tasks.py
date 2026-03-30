from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, UploadFile, File, Request
from fastapi.responses import Response
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import uuid
import json
import os

from deps import db, logger, get_current_user, hash_password, verify_password, create_token, security
from models.schemas import TaskCreate, TaskUpdate, TaskResponse

router = APIRouter(prefix="/api")

# ============== TASKS ROUTES ==============

@router.get("/tasks", response_model=List[TaskResponse])
async def get_all_tasks(
    status: Optional[str] = None, 
    doctor_id: Optional[str] = None, 
    medical_id: Optional[str] = None,
    agency_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all tasks with optional filters"""
    query = {}
    if status:
        query['status'] = status
    if doctor_id:
        query['doctor_id'] = doctor_id
    if medical_id:
        query['medical_id'] = medical_id
    if agency_id:
        query['agency_id'] = agency_id
    
    tasks = await db.tasks.find(query, {'_id': 0}).sort('due_date', 1).to_list(1000)
    
    result = []
    for task in tasks:
        created_at = task['created_at']
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
        
        # Get entity name (doctor, medical, or agency)
        entity_name = None
        if task.get('doctor_id'):
            entity = await db.doctors.find_one({'id': task['doctor_id']}, {'_id': 0, 'name': 1})
            entity_name = entity['name'] if entity else None
        elif task.get('medical_id'):
            entity = await db.medicals.find_one({'id': task['medical_id']}, {'_id': 0, 'name': 1})
            entity_name = entity['name'] if entity else None
        elif task.get('agency_id'):
            entity = await db.agencies.find_one({'id': task['agency_id']}, {'_id': 0, 'name': 1})
            entity_name = entity['name'] if entity else None
        
        result.append(TaskResponse(
            id=task['id'],
            doctor_id=task.get('doctor_id', ''),
            doctor_name=entity_name,
            title=task['title'],
            description=task.get('description'),
            due_date=task.get('due_date'),
            priority=task.get('priority', 'moderate'),
            status=task.get('status', 'pending'),
            created_at=created_at
        ))
    
    return result

@router.post("/tasks", response_model=TaskResponse)
async def create_task(task_data: TaskCreate, current_user: dict = Depends(get_current_user)):
    """Create a new task"""
    entity_name = None
    entity_id = None
    entity_type = None
    
    if task_data.doctor_id:
        entity = await db.doctors.find_one({'id': task_data.doctor_id}, {'_id': 0})
        if not entity:
            raise HTTPException(status_code=404, detail="Doctor not found")
        entity_name = entity['name']
        entity_id = task_data.doctor_id
        entity_type = 'doctor_id'
    elif task_data.medical_id:
        entity = await db.medicals.find_one({'id': task_data.medical_id}, {'_id': 0})
        if not entity:
            raise HTTPException(status_code=404, detail="Medical not found")
        entity_name = entity['name']
        entity_id = task_data.medical_id
        entity_type = 'medical_id'
    elif task_data.agency_id:
        entity = await db.agencies.find_one({'id': task_data.agency_id}, {'_id': 0})
        if not entity:
            raise HTTPException(status_code=404, detail="Agency not found")
        entity_name = entity['name']
        entity_id = task_data.agency_id
        entity_type = 'agency_id'
    else:
        raise HTTPException(status_code=400, detail="Either doctor_id, medical_id, or agency_id is required")
    
    now = datetime.now(timezone.utc)
    task_doc = {
        'id': str(uuid.uuid4()),
        entity_type: entity_id,
        'title': task_data.title,
        'description': task_data.description,
        'due_date': task_data.due_date,
        'priority': task_data.priority or 'moderate',
        'status': 'pending',
        'created_at': now.isoformat()
    }
    
    await db.tasks.insert_one(task_doc)
    
    return TaskResponse(
        id=task_doc['id'],
        doctor_id=task_doc.get('doctor_id', ''),
        doctor_name=entity_name,
        title=task_doc['title'],
        description=task_doc['description'],
        due_date=task_doc['due_date'],
        priority=task_doc['priority'],
        status=task_doc['status'],
        created_at=now
    )

@router.put("/tasks/{task_id}", response_model=TaskResponse)
async def update_task(task_id: str, task_data: TaskUpdate, current_user: dict = Depends(get_current_user)):
    """Update a task"""
    task = await db.tasks.find_one({'id': task_id}, {'_id': 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    update_data = {k: v for k, v in task_data.model_dump().items() if v is not None}
    
    if update_data:
        await db.tasks.update_one({'id': task_id}, {'$set': update_data})
    
    updated_task = await db.tasks.find_one({'id': task_id}, {'_id': 0})
    
    # Find entity name - check doctor_id, medical_id, or agency_id
    entity_name = None
    entity_id = updated_task.get('doctor_id') or updated_task.get('medical_id') or updated_task.get('agency_id') or ''
    if updated_task.get('doctor_id'):
        entity = await db.doctors.find_one({'id': updated_task['doctor_id']}, {'_id': 0, 'name': 1})
        entity_name = entity['name'] if entity else None
    elif updated_task.get('medical_id'):
        entity = await db.medicals.find_one({'id': updated_task['medical_id']}, {'_id': 0, 'name': 1})
        entity_name = entity['name'] if entity else None
    elif updated_task.get('agency_id'):
        entity = await db.agencies.find_one({'id': updated_task['agency_id']}, {'_id': 0, 'name': 1})
        entity_name = entity['name'] if entity else None
    
    created_at = updated_task['created_at']
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
    
    return TaskResponse(
        id=updated_task['id'],
        doctor_id=entity_id,
        doctor_name=entity_name,
        title=updated_task['title'],
        description=updated_task.get('description'),
        due_date=updated_task.get('due_date'),
        priority=updated_task.get('priority', 'moderate'),
        status=updated_task.get('status', 'pending'),
        created_at=created_at
    )

@router.delete("/tasks/{task_id}")
async def delete_task(task_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a task"""
    result = await db.tasks.delete_one({'id': task_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"message": "Task deleted successfully"}

# ============== FOLLOW-UP REMINDERS ==============

@router.get("/reminders/follow-up-leads")
async def get_follow_up_reminders(current_user: dict = Depends(get_current_user)):
    """Get leads that need follow-up (based on 25 days rule or set follow-up date)"""
    today = datetime.now(timezone.utc).date()
    today_str = today.isoformat()
    
    # Calculate 25 days ago
    days_25_ago = (today - timedelta(days=25)).isoformat()
    
    # Get all doctors except "Not Interested" and "Closed"
    doctors = await db.doctors.find(
        {'lead_status': {'$nin': ['Not Interested', 'Closed']}},
        {'_id': 0}
    ).to_list(1000)
    
    reminders = []
    
    for doc in doctors:
        needs_follow_up = False
        follow_up_reason = ""
        days_overdue = 0
        
        follow_up_date = doc.get('follow_up_date')
        last_contact = doc.get('last_contact_date')
        
        # Check if follow-up date is set and due
        if follow_up_date:
            if follow_up_date <= today_str:
                needs_follow_up = True
                follow_up_reason = "Scheduled follow-up"
                try:
                    fu_date = datetime.fromisoformat(follow_up_date).date()
                    days_overdue = (today - fu_date).days
                except:
                    days_overdue = 0
        # If no follow-up date, check 25 days rule from last contact
        elif last_contact:
            if last_contact <= days_25_ago:
                needs_follow_up = True
                follow_up_reason = "25 days since last contact"
                try:
                    lc_date = datetime.fromisoformat(last_contact).date()
                    days_overdue = (today - lc_date).days - 25
                except:
                    days_overdue = 0
        # If no last contact and no follow-up, use created_at
        else:
            created_at = doc.get('created_at', '')
            if isinstance(created_at, str) and created_at:
                try:
                    created_date = datetime.fromisoformat(created_at.replace('Z', '+00:00')).date()
                    if created_date <= datetime.fromisoformat(days_25_ago).date():
                        needs_follow_up = True
                        follow_up_reason = "25 days since added (no contact)"
                        days_overdue = (today - created_date).days - 25
                except:
                    pass
        
        if needs_follow_up:
            reminders.append({
                'doctor_id': doc['id'],
                'doctor_name': doc['name'],
                'customer_code': doc['customer_code'],
                'phone': doc['phone'],
                'lead_status': doc['lead_status'],
                'priority': doc.get('priority', 'moderate'),
                'last_contact_date': last_contact,
                'follow_up_date': follow_up_date,
                'reason': follow_up_reason,
                'days_overdue': max(0, days_overdue)
            })
    
    # Sort by priority (high first) then by days overdue
    priority_order = {'high': 0, 'moderate': 1, 'low': 2}
    reminders.sort(key=lambda x: (priority_order.get(x['priority'], 1), -x['days_overdue']))
    
    return reminders

@router.put("/doctors/{doctor_id}/contact")
async def update_last_contact(doctor_id: str, current_user: dict = Depends(get_current_user)):
    """Update last contact date to today and auto-set follow-up to 25 days"""
    doctor = await db.doctors.find_one({'id': doctor_id}, {'_id': 0})
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    
    today = datetime.now(timezone.utc).date()
    follow_up = today + timedelta(days=25)
    
    # Only auto-set follow-up if status is not "Not Interested"
    update_data = {
        'last_contact_date': today.isoformat(),
        'updated_at': datetime.now(timezone.utc).isoformat()
    }
    
    if doctor.get('lead_status') != 'Not Interested':
        update_data['follow_up_date'] = follow_up.isoformat()
    
    await db.doctors.update_one({'id': doctor_id}, {'$set': update_data})
    
    return {
        "message": "Last contact updated",
        "last_contact_date": today.isoformat(),
        "follow_up_date": update_data.get('follow_up_date')
    }


