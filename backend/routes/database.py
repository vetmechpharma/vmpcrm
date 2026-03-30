from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, UploadFile, File, Request
from fastapi.responses import Response
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import uuid
import json
import os

from deps import db, logger, get_current_user, hash_password, verify_password, create_token, security
from utils.whatsapp import get_whatsapp_config, send_wa_msg, log_whatsapp_message
from utils.email_utils import send_notification_email
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication
import asyncio
import base64

router = APIRouter(prefix="/api")

# ============== DATABASE BACKUP ROUTES ==============

# Global variable for backup scheduler
backup_scheduler_task = None


@router.get("/database/backup-file/{backup_id}/backup.pdf")
async def serve_backup_file(backup_id: str):
    """Serve temporary backup file for WhatsApp download"""
    doc = await db.temp_backup_files.find_one({'id': backup_id}, {'_id': 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Backup file not found")
    return Response(content=doc['data'].encode(), media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename={doc.get('filename', 'backup.json')}"})

@router.delete("/email-logs")
async def delete_email_logs(current_user: dict = Depends(get_current_user)):
    """Delete all email logs"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can delete email logs")
    result = await db.email_logs.delete_many({})
    return {"message": f"Deleted {result.deleted_count} email logs", "deleted_count": result.deleted_count}

@router.delete("/whatsapp-logs")
async def delete_whatsapp_logs(current_user: dict = Depends(get_current_user)):
    """Delete all WhatsApp logs"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can delete WhatsApp logs")
    result = await db.whatsapp_logs.delete_many({})
    return {"message": f"Deleted {result.deleted_count} WhatsApp logs", "deleted_count": result.deleted_count}

@router.post("/database/factory-reset")
async def factory_reset(current_user: dict = Depends(get_current_user)):
    """Factory reset - Delete ALL data except admin user and system settings"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can perform factory reset")
    
    # Collections to preserve
    preserved = {'users', 'system_settings', 'company_settings', 'smtp_settings',
                 'whatsapp_config', 'message_templates', 'greeting_templates', 'backup_history'}
    
    deleted_summary = {}
    all_collections = await db.list_collection_names()
    for coll_name in all_collections:
        if coll_name in preserved:
            continue
        count = await db[coll_name].count_documents({})
        if count > 0:
            await db[coll_name].delete_many({})
            deleted_summary[coll_name] = count
    
    # Log the factory reset
    await db.backup_history.insert_one({
        'id': str(uuid.uuid4()),
        'filename': 'FACTORY_RESET',
        'status': 'success',
        'type': 'factory_reset',
        'created_at': datetime.now(timezone.utc).isoformat(),
        'created_by': current_user['name'],
        'details': deleted_summary
    })
    
    return {"message": "Factory reset completed", "deleted": deleted_summary}

@router.post("/database/send-email-backup")
async def send_email_backup(current_user: dict = Depends(get_current_user)):
    """Manually send database backup via email only"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can send backups")
    
    # Get backup settings
    settings = await db.system_settings.find_one({'type': 'backup_settings'}, {'_id': 0})
    email_address = settings.get('email_address', '') if settings else ''
    if not email_address:
        raise HTTPException(status_code=400, detail="No backup email configured. Set it in Backup Settings.")
    
    smtp_config = await db.smtp_settings.find_one({}, {'_id': 0})
    if not smtp_config or not smtp_config.get('host'):
        raise HTTPException(status_code=400, detail="SMTP not configured")
    
    # Build export
    collections_to_export = [
        'doctors', 'medicals', 'agencies', 'items', 'orders', 'expenses',
        'reminders', 'pending_items', 'portal_customers', 'support_tickets',
        'users', 'company_settings', 'item_categories', 'transports',
        'payments', 'tasks', 'mrs', 'whatsapp_config', 'smtp_config',
        'greeting_templates', 'message_templates', 'system_settings',
        'marketing_campaigns', 'followups',
        'doctor_notes', 'medical_notes', 'agency_notes',
        'doctor_followups', 'medical_followups', 'agency_followups'
    ]
    export_data = {'export_date': datetime.now(timezone.utc).isoformat(), 'exported_by': current_user['name'], 'collections': {}}
    total_records = 0
    for coll_name in collections_to_export:
        docs = await db[coll_name].find({}, {'_id': 0}).to_list(100000)
        export_data['collections'][coll_name] = docs
        total_records += len(docs)
    
    json_str = json.dumps(export_data, default=str)
    timestamp = datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')
    filename = f"crm_backup_{timestamp}.json"
    
    try:
        import smtplib
        from email.mime.multipart import MIMEMultipart
        from email.mime.text import MIMEText
        from email.mime.application import MIMEApplication
        
        msg = MIMEMultipart()
        msg['From'] = smtp_config.get('from_email', smtp_config['username'])
        msg['To'] = email_address
        msg['Subject'] = f"CRM Database Backup - {timestamp}"
        body = f"CRM Database Backup\n\nTimestamp: {timestamp}\nTriggered by: {current_user['name']}\nTotal Records: {total_records}\nFile Size: {len(json_str) / 1024:.1f} KB\n\nBackup file attached."
        msg.attach(MIMEText(body, 'plain'))
        attachment = MIMEApplication(json_str.encode(), _subtype='json')
        attachment.add_header('Content-Disposition', 'attachment', filename=filename)
        msg.attach(attachment)
        
        server = smtplib.SMTP(smtp_config['host'], smtp_config.get('port', 587))
        server.starttls()
        server.login(smtp_config['username'], smtp_config['password'])
        server.send_message(msg)
        server.quit()
        
        await db.backup_history.insert_one({
            'id': str(uuid.uuid4()), 'filename': filename, 'status': 'success',
            'type': 'manual_email', 'created_at': datetime.now(timezone.utc).isoformat(),
            'created_by': current_user['name'], 'size_bytes': len(json_str),
            'total_records': total_records, 'sent_email': True
        })
        return {"message": f"Backup sent to {email_address}", "status": "success"}
    except Exception as e:
        return {"message": f"Failed to send: {str(e)}", "status": "failed"}


@router.get("/database/backup-settings")
async def get_backup_settings(current_user: dict = Depends(get_current_user)):
    """Get database backup settings"""
    settings = await db.system_settings.find_one({'type': 'backup_settings'}, {'_id': 0})
    if not settings:
        # Default settings
        settings = {
            'auto_backup_enabled': True,
            'backup_times': ['09:00', '17:00'],
            'whatsapp_number': '9486544884',
            'email_address': 'vetmech2server@gmail.com'
        }
    return settings

@router.put("/database/backup-settings")
async def update_backup_settings(settings: dict, current_user: dict = Depends(get_current_user)):
    """Update database backup settings"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can modify backup settings")
    
    settings['type'] = 'backup_settings'
    settings['updated_at'] = datetime.now(timezone.utc).isoformat()
    settings['updated_by'] = current_user['name']
    
    await db.system_settings.update_one(
        {'type': 'backup_settings'},
        {'$set': settings},
        upsert=True
    )
    
    return {"message": "Backup settings updated successfully"}

@router.get("/database/backup-history")
async def get_backup_history(current_user: dict = Depends(get_current_user)):
    """Get database backup history"""
    backups = await db.backup_history.find({}, {'_id': 0}).sort('created_at', -1).limit(20).to_list(20)
    return {"backups": backups}

@router.get("/database/export")
async def export_database(current_user: dict = Depends(get_current_user)):
    """Export entire database as JSON"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can export database")
    
    # Get all collections
    collections_to_export = [
        'doctors', 'medicals', 'agencies', 'items', 'orders', 'expenses',
        'reminders', 'pending_items', 'portal_customers', 'support_tickets',
        'users', 'company_settings', 'item_categories', 'transports',
        'email_logs', 'whatsapp_logs', 'marketing_campaigns'
    ]
    
    export_data = {
        'export_date': datetime.now(timezone.utc).isoformat(),
        'exported_by': current_user['name'],
        'collections': {}
    }
    
    for collection_name in collections_to_export:
        collection = db[collection_name]
        documents = await collection.find({}, {'_id': 0}).to_list(100000)
        export_data['collections'][collection_name] = documents
    
    # Create JSON response
    json_str = json.dumps(export_data, default=str, indent=2)
    
    # Log the backup
    await db.backup_history.insert_one({
        'id': str(uuid.uuid4()),
        'filename': f"vmp_crm_backup_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.json",
        'status': 'success',
        'type': 'manual_download',
        'created_at': datetime.now(timezone.utc).isoformat(),
        'created_by': current_user['name'],
        'size_bytes': len(json_str)
    })
    
    return Response(
        content=json_str,
        media_type="application/json",
        headers={
            "Content-Disposition": f"attachment; filename=vmp_crm_backup_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.json"
        }
    )

@router.post("/database/trigger-backup")
async def trigger_backup(background_tasks: BackgroundTasks, current_user: dict = Depends(get_current_user)):
    """Manually trigger a backup and send via WhatsApp and Email"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can trigger backups")
    
    background_tasks.add_task(perform_scheduled_backup, current_user['name'])
    return {"message": "Backup triggered. You will receive it shortly via WhatsApp and Email."}

async def perform_scheduled_backup(triggered_by: str = "System"):
    """Perform database backup and send via WhatsApp and Email"""
    try:
        # Get backup settings
        settings = await db.system_settings.find_one({'type': 'backup_settings'}, {'_id': 0})
        if not settings:
            settings = {
                'whatsapp_number': '9486544884',
                'email_address': 'vetmech2server@gmail.com'
            }
        
        # Export database
        collections_to_export = [
            'doctors', 'medicals', 'agencies', 'items', 'orders', 'expenses',
            'reminders', 'pending_items', 'portal_customers', 'support_tickets',
            'users', 'company_settings', 'item_categories', 'transports',
            'payments', 'tasks', 'mrs', 'whatsapp_config', 'smtp_config',
            'greeting_templates', 'message_templates', 'system_settings',
            'marketing_campaigns', 'expense_categories', 'catalogue_settings',
            'followups', 'doctor_notes', 'medical_notes', 'agency_notes',
            'doctor_followups', 'medical_followups', 'agency_followups'
        ]
        
        export_data = {
            'export_date': datetime.now(timezone.utc).isoformat(),
            'exported_by': triggered_by,
            'collections': {}
        }
        
        total_records = 0
        for collection_name in collections_to_export:
            collection = db[collection_name]
            documents = await collection.find({}, {'_id': 0}).to_list(100000)
            export_data['collections'][collection_name] = documents
            total_records += len(documents)
        
        json_str = json.dumps(export_data, default=str)
        file_size = len(json_str)
        timestamp = datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')
        filename = f"vmp_crm_backup_{timestamp}.json"
        
        sent_whatsapp = False
        sent_email = False
        
        # Save backup file temporarily for WhatsApp file sending
        backup_file_path = f"/tmp/{filename}"
        with open(backup_file_path, 'w') as f:
            f.write(json_str)
        
        # Send WhatsApp notification with JSON backup file
        wa_number = settings.get('whatsapp_number', '9486544884')
        if wa_number:
            config = await get_whatsapp_config()
            if config.get('api_url') and config.get('auth_token'):
                try:
                    app_base_url = os.environ.get('APP_BASE_URL', '').rstrip('/')
                    caption = f"*CRM Database Backup*\n\n" \
                              f"*Timestamp:* {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')} UTC\n" \
                              f"*Triggered by:* {triggered_by}\n" \
                              f"*Total Records:* {total_records}\n" \
                              f"*File Size:* {file_size / 1024:.1f} KB"
                    
                    wa_mobile = wa_number if wa_number.startswith('91') else f"91{wa_number[-10:]}"
                    
                    # Try to send the backup file via WhatsApp
                    if app_base_url:
                        # Store backup temporarily in DB for serving
                        backup_id = str(uuid.uuid4())
                        await db.temp_backup_files.insert_one({
                            'id': backup_id,
                            'data': json_str,
                            'filename': filename,
                            'created_at': datetime.now(timezone.utc).isoformat()
                        })
                        file_url = f"{app_base_url}/api/database/backup-file/{backup_id}/backup.pdf"
                        response = await send_wa_msg(wa_mobile, caption, file_url=file_url, file_caption=caption, config=config)
                        if response and response.status_code == 200:
                            sent_whatsapp = True
                            logger.info(f"Backup file sent via WhatsApp to {wa_mobile}")
                        else:
                            # Fallback: send text notification only
                            response = await send_wa_msg(wa_mobile, caption + "\n\nBackup sent to your email.", config=config)
                            if response and response.status_code == 200:
                                sent_whatsapp = True
                    else:
                        response = await send_wa_msg(wa_mobile, caption + "\n\nBackup sent to your email.", config=config)
                        if response and response.status_code == 200:
                            sent_whatsapp = True
                except Exception as e:
                    logger.error(f"Failed to send WhatsApp backup: {str(e)}")
        
        # Send Email with backup attachment
        email_address = settings.get('email_address', 'vetmech2server@gmail.com')
        if email_address:
            smtp_settings = await db.smtp_settings.find_one({}, {'_id': 0})
            if smtp_settings and smtp_settings.get('host'):
                try:
                    import smtplib
                    from email.mime.multipart import MIMEMultipart
                    from email.mime.text import MIMEText
                    from email.mime.application import MIMEApplication
                    
                    msg = MIMEMultipart()
                    msg['From'] = smtp_settings.get('from_email', smtp_settings['username'])
                    msg['To'] = email_address
                    msg['Subject'] = f"VMP CRM Database Backup - {timestamp}"
                    
                    body = f"""
VMP CRM Database Backup

Backup Details:
- Timestamp: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')} UTC
- Triggered by: {triggered_by}
- Total Records: {total_records}
- File Size: {file_size / 1024:.1f} KB

The backup file is attached to this email.

This is an automated backup from VMP CRM system.
                    """
                    
                    msg.attach(MIMEText(body, 'plain'))
                    
                    # Attach backup file
                    attachment = MIMEApplication(json_str.encode(), _subtype='json')
                    attachment.add_header('Content-Disposition', 'attachment', filename=filename)
                    msg.attach(attachment)
                    
                    # Send email
                    server = smtplib.SMTP(smtp_settings['host'], smtp_settings.get('port', 587))
                    server.starttls()
                    server.login(smtp_settings['username'], smtp_settings['password'])
                    server.send_message(msg)
                    server.quit()
                    
                    sent_email = True
                    logger.info(f"Backup email sent to {email_address}")
                except Exception as e:
                    logger.error(f"Failed to send backup email: {str(e)}")
        
        # Log the backup
        await db.backup_history.insert_one({
            'id': str(uuid.uuid4()),
            'filename': filename,
            'status': 'success',
            'type': 'scheduled' if triggered_by == 'System' else 'manual',
            'created_at': datetime.now(timezone.utc).isoformat(),
            'created_by': triggered_by,
            'size_bytes': file_size,
            'total_records': total_records,
            'sent_whatsapp': sent_whatsapp,
            'sent_email': sent_email
        })
        
        logger.info(f"Database backup completed: {filename}")
        
    except Exception as e:
        logger.error(f"Database backup failed: {str(e)}")
        # Log failure
        await db.backup_history.insert_one({
            'id': str(uuid.uuid4()),
            'filename': f"backup_failed_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}",
            'status': 'failed',
            'error': str(e),
            'created_at': datetime.now(timezone.utc).isoformat(),
            'created_by': triggered_by
        })

async def run_scheduled_backups():
    """Background task to run scheduled backups at 9 AM and 5 PM"""
    while True:
        try:
            # Get settings
            settings = await db.system_settings.find_one({'type': 'backup_settings'}, {'_id': 0})
            if not settings or not settings.get('auto_backup_enabled', True):
                await asyncio.sleep(300)  # Check again in 5 minutes
                continue
            
            backup_times = settings.get('backup_times', ['09:00', '17:00'])
            
            # Get current time in IST (UTC+5:30)
            now_utc = datetime.now(timezone.utc)
            ist_offset = timedelta(hours=5, minutes=30)
            now_ist = now_utc + ist_offset
            current_time = now_ist.strftime('%H:%M')
            
            # Check if current time matches any backup time (within 1 minute window)
            for backup_time in backup_times:
                if current_time == backup_time:
                    logger.info(f"Running scheduled backup at {current_time} IST")
                    await perform_scheduled_backup("System (Scheduled)")
                    await asyncio.sleep(120)  # Wait 2 minutes to avoid duplicate runs
                    break
            
            await asyncio.sleep(60)  # Check every minute
            
        except asyncio.CancelledError:
            logger.info("Backup scheduler task cancelled")
            break
        except Exception as e:
            logger.error(f"Error in backup scheduler: {str(e)}")
            await asyncio.sleep(300)



