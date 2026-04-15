from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, UploadFile, File, Request
from fastapi.responses import Response
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import uuid
import json
import os

from deps import db, logger, get_current_user, hash_password, verify_password, create_token, security
from models.schemas import ReminderCreate, ReminderUpdate, ReminderResponse
from utils.whatsapp import send_wa_msg, get_whatsapp_config, log_whatsapp_message

router = APIRouter(prefix="/api")

# ============== REMINDER ROUTES ==============

@router.post("/reminders", response_model=ReminderResponse)
async def create_reminder(reminder: ReminderCreate, current_user: dict = Depends(get_current_user)):
    """Create a new reminder"""
    reminder_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    reminder_doc = {
        'id': reminder_id,
        'title': reminder.title,
        'description': reminder.description,
        'reminder_type': reminder.reminder_type,
        'reminder_date': reminder.reminder_date,
        'reminder_time': reminder.reminder_time,
        'entity_type': reminder.entity_type,
        'entity_id': reminder.entity_id,
        'entity_name': reminder.entity_name,
        'priority': reminder.priority,
        'is_completed': False,
        'is_auto_generated': False,
        'created_at': now.isoformat(),
        'created_by': current_user['id']
    }
    
    await db.reminders.insert_one(reminder_doc)
    
    return ReminderResponse(
        id=reminder_id,
        title=reminder.title,
        description=reminder.description,
        reminder_type=reminder.reminder_type,
        reminder_date=reminder.reminder_date,
        reminder_time=reminder.reminder_time,
        entity_type=reminder.entity_type,
        entity_id=reminder.entity_id,
        entity_name=reminder.entity_name,
        priority=reminder.priority,
        is_completed=False,
        is_auto_generated=False,
        created_at=now
    )

@router.get("/reminders", response_model=List[ReminderResponse])
async def get_reminders(
    date: Optional[str] = None,
    reminder_type: Optional[str] = None,
    is_completed: Optional[bool] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all reminders with optional filters"""
    query = {}
    
    if date:
        query['reminder_date'] = date
    if reminder_type:
        query['reminder_type'] = reminder_type
    if is_completed is not None:
        query['is_completed'] = is_completed
    
    reminders = await db.reminders.find(query, {'_id': 0}).sort('reminder_date', 1).to_list(1000)
    
    result = []
    for rem in reminders:
        created_at = rem.get('created_at')
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
        
        result.append(ReminderResponse(
            id=rem['id'],
            title=rem['title'],
            description=rem.get('description'),
            reminder_type=rem['reminder_type'],
            reminder_date=rem['reminder_date'],
            reminder_time=rem.get('reminder_time'),
            entity_type=rem.get('entity_type'),
            entity_id=rem.get('entity_id'),
            entity_name=rem.get('entity_name'),
            priority=rem.get('priority', 'moderate'),
            is_completed=rem.get('is_completed', False),
            is_auto_generated=rem.get('is_auto_generated', False),
            created_at=created_at
        ))
    
    return result

@router.get("/reminders/today")
async def get_today_reminders(current_user: dict = Depends(get_current_user)):
    """Get all reminders for today including auto-generated ones"""
    today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    today_md = datetime.now(timezone.utc).strftime('%m-%d')  # For birthday/anniversary matching
    
    reminders = []
    
    # 1. Get manual reminders for today + overdue ones (past date, not completed)
    # Exclude birthday/anniversary from overdue
    manual_reminders = await db.reminders.find({
        'reminder_date': {'$lte': today},
        'is_completed': False
    }, {'_id': 0}).to_list(500)
    
    for rem in manual_reminders:
        created_at = rem.get('created_at')
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
        rem_date = rem.get('reminder_date', today)
        rem_type = rem.get('reminder_type', 'custom')
        # Birthday/anniversary: only show on the actual day, never overdue
        if rem_type in ('birthday', 'anniversary') and rem_date != today:
            continue
        is_overdue = rem_date < today and rem_type not in ('birthday', 'anniversary')
        reminders.append({
            'id': rem['id'],
            'title': f"{'OVERDUE: ' if is_overdue else ''}{rem['title']}",
            'description': rem.get('description'),
            'reminder_type': rem_type,
            'reminder_date': rem_date,
            'reminder_time': rem.get('reminder_time'),
            'entity_type': rem.get('entity_type'),
            'entity_id': rem.get('entity_id'),
            'entity_name': rem.get('entity_name'),
            'priority': 'high' if is_overdue else rem.get('priority', 'moderate'),
            'is_completed': rem.get('is_completed', False),
            'is_auto_generated': rem.get('is_auto_generated', False),
            'is_overdue': is_overdue,
            'phone': None
        })
    
    # 2. Get doctors with follow-up due today or overdue
    doctors_followup = await db.doctors.find({
        'follow_up_date': {'$lte': today, '$ne': None},
        'lead_status': {'$nin': ['Not Interested', 'Closed', 'Converted', 'Lost']}
    }, {'_id': 0}).to_list(200)
    
    for doc in doctors_followup:
        is_overdue = doc.get('follow_up_date', '') < today
        # Get last follow-up notes
        last_fu = await db.followups.find_one(
            {'entity_type': 'doctor', 'entity_id': doc['id']},
            {'_id': 0, 'notes': 1, 'created_at': 1}
        )
        reminders.append({
            'id': f"auto_followup_doctor_{doc['id']}",
            'title': f"{'OVERDUE: ' if is_overdue else ''}Follow-up: {doc['name']}",
            'description': last_fu.get('notes', f"Follow-up due for {doc['name']}") if last_fu else f"Follow-up due for {doc['name']} ({doc.get('customer_code', '')})",
            'reminder_type': 'follow_up',
            'reminder_date': doc.get('follow_up_date', today),
            'reminder_time': None,
            'entity_type': 'doctor',
            'entity_id': doc['id'],
            'entity_name': doc['name'],
            'priority': 'high' if is_overdue else doc.get('priority', 'moderate'),
            'is_completed': False,
            'is_auto_generated': True,
            'is_overdue': is_overdue,
            'lead_status': doc.get('lead_status'),
            'phone': doc.get('phone')
        })
    
    # 3. Get medicals with follow-up due today or overdue
    medicals_followup = await db.medicals.find({
        'follow_up_date': {'$lte': today, '$ne': None},
        'lead_status': {'$nin': ['Not Interested', 'Closed', 'Converted', 'Lost']}
    }, {'_id': 0}).to_list(200)
    
    for med in medicals_followup:
        is_overdue = med.get('follow_up_date', '') < today
        last_fu = await db.followups.find_one(
            {'entity_type': 'medical', 'entity_id': med['id']},
            {'_id': 0, 'notes': 1}
        )
        reminders.append({
            'id': f"auto_followup_medical_{med['id']}",
            'title': f"{'OVERDUE: ' if is_overdue else ''}Follow-up: {med['name']}",
            'description': last_fu.get('notes', f"Follow-up due for {med['name']}") if last_fu else f"Follow-up due for {med['name']} ({med.get('customer_code', '')})",
            'reminder_type': 'follow_up',
            'reminder_date': med.get('follow_up_date', today),
            'reminder_time': None,
            'entity_type': 'medical',
            'entity_id': med['id'],
            'entity_name': med['name'],
            'priority': 'high' if is_overdue else med.get('priority', 'moderate'),
            'is_completed': False,
            'is_auto_generated': True,
            'is_overdue': is_overdue,
            'lead_status': med.get('lead_status'),
            'phone': med.get('phone')
        })
    
    # 4. Get agencies with follow-up due today or overdue
    agencies_followup = await db.agencies.find({
        'follow_up_date': {'$lte': today, '$ne': None},
        'lead_status': {'$nin': ['Not Interested', 'Closed', 'Converted', 'Lost']}
    }, {'_id': 0}).to_list(200)
    
    for agy in agencies_followup:
        is_overdue = agy.get('follow_up_date', '') < today
        last_fu = await db.followups.find_one(
            {'entity_type': 'agency', 'entity_id': agy['id']},
            {'_id': 0, 'notes': 1}
        )
        reminders.append({
            'id': f"auto_followup_agency_{agy['id']}",
            'title': f"{'OVERDUE: ' if is_overdue else ''}Follow-up: {agy['name']}",
            'description': last_fu.get('notes', f"Follow-up due for {agy['name']}") if last_fu else f"Follow-up due for {agy['name']} ({agy.get('customer_code', '')})",
            'reminder_type': 'follow_up',
            'reminder_date': agy.get('follow_up_date', today),
            'reminder_time': None,
            'entity_type': 'agency',
            'entity_id': agy['id'],
            'entity_name': agy['name'],
            'priority': 'high' if is_overdue else agy.get('priority', 'moderate'),
            'is_completed': False,
            'is_auto_generated': True,
            'is_overdue': is_overdue,
            'lead_status': agy.get('lead_status'),
            'phone': agy.get('phone')
        })
    
    # 5. Get birthdays today (doctors)
    doctors_all = await db.doctors.find({'dob': {'$exists': True, '$ne': None}}, {'_id': 0}).to_list(1000)
    for doc in doctors_all:
        if doc.get('dob') and doc['dob'][5:] == today_md:  # Match MM-DD
            reminders.append({
                'id': f"auto_birthday_doctor_{doc['id']}",
                'title': f"Birthday: {doc['name']}",
                'description': f"Today is {doc['name']}'s birthday!",
                'reminder_type': 'birthday',
                'reminder_date': today,
                'reminder_time': None,
                'entity_type': 'doctor',
                'entity_id': doc['id'],
                'entity_name': doc['name'],
                'priority': 'high',
                'is_completed': False,
                'is_auto_generated': True,
                'phone': doc.get('phone')
            })
    
    # 6. Get birthdays today (medicals)
    medicals_all = await db.medicals.find({'birthday': {'$exists': True, '$ne': None}}, {'_id': 0}).to_list(1000)
    for med in medicals_all:
        if med.get('birthday') and med['birthday'][5:] == today_md:
            reminders.append({
                'id': f"auto_birthday_medical_{med['id']}",
                'title': f"Birthday: {med['name']} (Prop: {med.get('proprietor_name', '')})",
                'description': f"Today is {med.get('proprietor_name', med['name'])}'s birthday!",
                'reminder_type': 'birthday',
                'reminder_date': today,
                'reminder_time': None,
                'entity_type': 'medical',
                'entity_id': med['id'],
                'entity_name': med['name'],
                'priority': 'high',
                'is_completed': False,
                'is_auto_generated': True,
                'phone': med.get('phone')
            })
    
    # 7. Get birthdays today (agencies)
    agencies_all = await db.agencies.find({'birthday': {'$exists': True, '$ne': None}}, {'_id': 0}).to_list(1000)
    for agy in agencies_all:
        if agy.get('birthday') and agy['birthday'][5:] == today_md:
            reminders.append({
                'id': f"auto_birthday_agency_{agy['id']}",
                'title': f"Birthday: {agy['name']} (Prop: {agy.get('proprietor_name', '')})",
                'description': f"Today is {agy.get('proprietor_name', agy['name'])}'s birthday!",
                'reminder_type': 'birthday',
                'reminder_date': today,
                'reminder_time': None,
                'entity_type': 'agency',
                'entity_id': agy['id'],
                'entity_name': agy['name'],
                'priority': 'high',
                'is_completed': False,
                'is_auto_generated': True,
                'phone': agy.get('phone')
            })
    
    # 8. Get anniversaries today (medicals)
    for med in medicals_all:
        if med.get('anniversary') and med['anniversary'][5:] == today_md:
            reminders.append({
                'id': f"auto_anniversary_medical_{med['id']}",
                'title': f"Anniversary: {med['name']}",
                'description': f"Today is {med['name']}'s business anniversary!",
                'reminder_type': 'anniversary',
                'reminder_date': today,
                'reminder_time': None,
                'entity_type': 'medical',
                'entity_id': med['id'],
                'entity_name': med['name'],
                'priority': 'moderate',
                'is_completed': False,
                'is_auto_generated': True,
                'phone': med.get('phone')
            })
    
    # 9. Get anniversaries today (agencies)
    for agy in agencies_all:
        if agy.get('anniversary') and agy['anniversary'][5:] == today_md:
            reminders.append({
                'id': f"auto_anniversary_agency_{agy['id']}",
                'title': f"Anniversary: {agy['name']}",
                'description': f"Today is {agy['name']}'s business anniversary!",
                'reminder_type': 'anniversary',
                'reminder_date': today,
                'reminder_time': None,
                'entity_type': 'agency',
                'entity_id': agy['id'],
                'entity_name': agy['name'],
                'priority': 'moderate',
                'is_completed': False,
                'is_auto_generated': True,
                'phone': agy.get('phone')
            })
    
    # Sort by priority (high first) then by type
    priority_order = {'high': 0, 'moderate': 1, 'low': 2}
    reminders.sort(key=lambda x: (priority_order.get(x['priority'], 1), x['reminder_type']))
    
    return {
        'date': today,
        'total_count': len(reminders),
        'reminders': reminders
    }

@router.put("/reminders/{reminder_id}", response_model=ReminderResponse)
async def update_reminder(reminder_id: str, reminder_data: ReminderUpdate, current_user: dict = Depends(get_current_user)):
    """Update a reminder"""
    reminder = await db.reminders.find_one({'id': reminder_id}, {'_id': 0})
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")
    
    update_data = {k: v for k, v in reminder_data.model_dump().items() if v is not None}
    
    await db.reminders.update_one({'id': reminder_id}, {'$set': update_data})
    
    updated = await db.reminders.find_one({'id': reminder_id}, {'_id': 0})
    created_at = updated.get('created_at')
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
    
    return ReminderResponse(
        id=updated['id'],
        title=updated['title'],
        description=updated.get('description'),
        reminder_type=updated['reminder_type'],
        reminder_date=updated['reminder_date'],
        reminder_time=updated.get('reminder_time'),
        entity_type=updated.get('entity_type'),
        entity_id=updated.get('entity_id'),
        entity_name=updated.get('entity_name'),
        priority=updated.get('priority', 'moderate'),
        is_completed=updated.get('is_completed', False),
        is_auto_generated=updated.get('is_auto_generated', False),
        created_at=created_at
    )

@router.delete("/reminders/{reminder_id}")
async def delete_reminder(reminder_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a reminder"""
    result = await db.reminders.delete_one({'id': reminder_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Reminder not found")
    return {"message": "Reminder deleted successfully"}

@router.post("/reminders/{reminder_id}/complete")
async def mark_reminder_complete(reminder_id: str, current_user: dict = Depends(get_current_user)):
    """Mark a reminder as completed"""
    # Check if it's an auto-generated reminder (starts with 'auto_')
    if reminder_id.startswith('auto_'):
        # For auto-generated, we need to create a completed record
        await db.completed_reminders.insert_one({
            'id': str(uuid.uuid4()),
            'original_reminder_id': reminder_id,
            'completed_at': datetime.now(timezone.utc).isoformat(),
            'completed_by': current_user['id']
        })
        return {"message": "Reminder marked as completed"}
    
    # For manual reminders
    result = await db.reminders.update_one(
        {'id': reminder_id},
        {'$set': {'is_completed': True}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Reminder not found")
    
    return {"message": "Reminder marked as completed"}

@router.post("/reminders/send-whatsapp-summary")
async def send_whatsapp_reminder_summary(current_user: dict = Depends(get_current_user)):
    """Send today's reminders summary to admin via WhatsApp"""
    # Get WhatsApp config
    wa_config = await db.whatsapp_config.find_one({}, {'_id': 0})
    if not wa_config:
        raise HTTPException(status_code=400, detail="WhatsApp not configured")
    
    # Get company settings for admin number
    company = await db.company_settings.find_one({}, {'_id': 0})
    admin_phone = company.get('phone') if company else None
    
    if not admin_phone:
        raise HTTPException(status_code=400, detail="Admin phone number not configured in company settings")
    
    # Get today's reminders
    today_data = await get_today_reminders(current_user)
    reminders = today_data['reminders']
    
    if not reminders:
        return {"message": "No reminders for today", "sent": False}
    
    # Build detailed message
    message_lines = [
        f"🌅 *Good Morning!*",
        f"📅 *Today's Reminders ({today_data['date']})*",
        f"Total: {today_data['total_count']} reminder(s)",
        ""
    ]
    
    # Group by type
    followups = [r for r in reminders if r['reminder_type'] == 'follow_up']
    birthdays = [r for r in reminders if r['reminder_type'] == 'birthday']
    anniversaries = [r for r in reminders if r['reminder_type'] == 'anniversary']
    custom = [r for r in reminders if r['reminder_type'] == 'custom']
    
    if followups:
        overdue = [r for r in followups if r.get('is_overdue')]
        today_fu = [r for r in followups if not r.get('is_overdue')]
        if overdue:
            message_lines.append(f"🚨 *Overdue Follow-ups ({len(overdue)}):*")
            for r in overdue[:10]:
                status_tag = f" [{r.get('lead_status', '')}]" if r.get('lead_status') else ''
                message_lines.append(f"  • {r['entity_name']} - {r.get('phone', 'N/A')}{status_tag}")
            if len(overdue) > 10:
                message_lines.append(f"  +{len(overdue) - 10} more...")
            message_lines.append("")
        if today_fu:
            message_lines.append(f"📞 *Follow-ups Today ({len(today_fu)}):*")
            for r in today_fu[:10]:
                status_tag = f" [{r.get('lead_status', '')}]" if r.get('lead_status') else ''
                message_lines.append(f"  • {r['entity_name']} - {r.get('phone', 'N/A')}{status_tag}")
            if len(today_fu) > 10:
                message_lines.append(f"  +{len(today_fu) - 10} more...")
            message_lines.append("")
    
    if birthdays:
        message_lines.append(f"🎂 *Birthdays ({len(birthdays)}):*")
        for r in birthdays:
            message_lines.append(f"  • {r['entity_name']} - {r.get('phone', 'N/A')} ({r.get('entity_type', '').title()})")
        message_lines.append("")
    
    if anniversaries:
        message_lines.append(f"🎉 *Anniversaries ({len(anniversaries)}):*")
        for r in anniversaries:
            message_lines.append(f"  • {r['entity_name']} - {r.get('phone', 'N/A')} ({r.get('entity_type', '').title()})")
        message_lines.append("")
    
    if custom:
        message_lines.append(f"📝 *Custom ({len(custom)}):*")
        for r in custom[:5]:
            name_part = f" - {r['entity_name']}" if r.get('entity_name') else ''
            message_lines.append(f"  • {r['title']}{name_part}")
        if len(custom) > 5:
            message_lines.append(f"  +{len(custom) - 5} more...")
    
    message_lines.append("")
    message_lines.append("Login to CRM to view details.")
    
    message = "\n".join(message_lines)
    
    # Send WhatsApp
    try:
        response = await send_wa_msg(admin_phone, message, config=wa_config)
        if response and response.status_code == 200:
            logger.info(f"Reminder summary sent to admin: {admin_phone}")
            return {"message": "Reminder summary sent successfully", "sent": True, "phone": admin_phone}
        else:
            logger.error(f"Failed to send reminder summary: {response.text if response else 'no_response'}")
            raise HTTPException(status_code=500, detail="Failed to send WhatsApp message")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending reminder summary: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


