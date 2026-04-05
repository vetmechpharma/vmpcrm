from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, UploadFile, File, Request
from fastapi.responses import Response
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import uuid
import json
import os

from deps import db, logger, get_current_user, hash_password, verify_password, create_token, security
from models.schemas import SMTPConfigCreate, SMTPConfigResponse, SendEmailRequest, EmailLogResponse
from utils.email_utils import send_email_task, send_notification_email
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication

router = APIRouter(prefix="/api")

# ============== SMTP CONFIG ROUTES ==============

@router.post("/smtp-config", response_model=SMTPConfigResponse)
async def create_smtp_config(config_data: SMTPConfigCreate, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can configure SMTP")
    
    config_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    # Delete existing config (only one allowed)
    await db.smtp_config.delete_many({})
    
    config_doc = {
        'id': config_id,
        'smtp_server': config_data.smtp_server,
        'smtp_port': config_data.smtp_port,
        'smtp_username': config_data.smtp_username,
        'smtp_password': config_data.smtp_password,
        'from_email': config_data.from_email,
        'from_name': config_data.from_name,
        'created_at': now.isoformat(),
        'updated_at': now.isoformat()
    }
    
    await db.smtp_config.insert_one(config_doc)
    
    return SMTPConfigResponse(
        id=config_id,
        smtp_server=config_data.smtp_server,
        smtp_port=config_data.smtp_port,
        smtp_username=config_data.smtp_username,
        from_email=config_data.from_email,
        from_name=config_data.from_name,
        created_at=now,
        updated_at=now
    )

@router.get("/smtp-config", response_model=Optional[SMTPConfigResponse])
async def get_smtp_config(current_user: dict = Depends(get_current_user)):
    config = await db.smtp_config.find_one({}, {'_id': 0, 'smtp_password': 0})
    if not config:
        return None
    
    created_at = config['created_at']
    updated_at = config['updated_at']
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
    if isinstance(updated_at, str):
        updated_at = datetime.fromisoformat(updated_at.replace('Z', '+00:00'))
    
    return SMTPConfigResponse(
        id=config['id'],
        smtp_server=config['smtp_server'],
        smtp_port=config['smtp_port'],
        smtp_username=config['smtp_username'],
        from_email=config['from_email'],
        from_name=config['from_name'],
        created_at=created_at,
        updated_at=updated_at
    )

# ============== EMAIL ROUTES ==============

async def send_email_task(smtp_config: dict, doctor: dict, subject: str, body: str, is_html: bool, log_id: str):
    try:
        msg = MIMEMultipart()
        msg['From'] = f"{smtp_config['from_name']} <{smtp_config['from_email']}>"
        msg['To'] = f"{doctor['name']} <{doctor['email']}>"
        msg['Subject'] = subject
        
        content_type = 'html' if is_html else 'plain'
        msg.attach(MIMEText(body, content_type))
        
        with smtplib.SMTP(smtp_config['smtp_server'], smtp_config['smtp_port'], timeout=30) as server:
            server.starttls()
            server.login(smtp_config['smtp_username'], smtp_config['smtp_password'])
            server.sendmail(smtp_config['from_email'], [doctor['email']], msg.as_string())
        
        await db.email_logs.update_one(
            {'id': log_id},
            {'$set': {'status': 'sent', 'sent_at': datetime.now(timezone.utc).isoformat()}}
        )
        logger.info(f"Email sent to {doctor['email']}")
    except Exception as e:
        await db.email_logs.update_one(
            {'id': log_id},
            {'$set': {'status': 'failed', 'error_message': str(e)}}
        )
        logger.error(f"Failed to send email: {str(e)}")


async def send_notification_email(
    to_email: str,
    to_name: str,
    subject: str,
    body_html: str,
    customer_id: str = None,
    email_type: str = 'notification',
    attachment_data: bytes = None,
    attachment_filename: str = None
):
    """Reusable email sender for all notification types. Handles SMTP config, logging, and optional attachments."""
    try:
        smtp_config = await db.smtp_config.find_one({}, {'_id': 0})
        if not smtp_config:
            logger.warning(f"SMTP not configured, skipping {email_type} email to {to_email}")
            return False

        company = await db.company_settings.find_one({}, {'_id': 0})
        company_name = company.get('company_name', 'VMP CRM') if company else 'VMP CRM'

        # Wrap body in styled HTML template
        full_html = f"""<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background-color:#f5f5f5;">
<div style="max-width:600px;margin:0 auto;background-color:#ffffff;">
<div style="background:linear-gradient(135deg,#1e3a5f 0%,#2d5a87 100%);padding:24px;text-align:center;">
<h1 style="color:#fff;margin:0;font-size:22px;">{company_name}</h1></div>
<div style="padding:24px;">{body_html}</div>
<div style="background-color:#1e3a5f;padding:18px;text-align:center;">
<p style="color:#b8d4e8;margin:0;font-size:11px;">This is an automated notification from {company_name}</p></div>
</div></body></html>"""

        msg = MIMEMultipart()
        msg['From'] = f"{smtp_config['from_name']} <{smtp_config['from_email']}>"
        msg['To'] = f"{to_name} <{to_email}>"
        msg['Subject'] = subject
        msg.attach(MIMEText(full_html, 'html'))

        if attachment_data and attachment_filename:
            attachment = MIMEApplication(attachment_data, Name=attachment_filename)
            attachment['Content-Disposition'] = f'attachment; filename="{attachment_filename}"'
            msg.attach(attachment)

        log_id = str(uuid.uuid4())
        await db.email_logs.insert_one({
            'id': log_id,
            'doctor_id': customer_id,
            'doctor_name': to_name,
            'doctor_email': to_email,
            'subject': subject,
            'body': f'{email_type} email',
            'status': 'pending',
            'created_at': datetime.now(timezone.utc).isoformat(),
            'sent_by': 'system'
        })

        with smtplib.SMTP(smtp_config['smtp_server'], smtp_config['smtp_port'], timeout=30) as server:
            server.starttls()
            server.login(smtp_config['smtp_username'], smtp_config['smtp_password'])
            server.sendmail(smtp_config['from_email'], [to_email], msg.as_string())

        await db.email_logs.update_one({'id': log_id}, {'$set': {'status': 'sent', 'sent_at': datetime.now(timezone.utc).isoformat()}})
        logger.info(f"{email_type} email sent to {to_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send {email_type} email to {to_email}: {e}")
        return False


@router.post("/send-email")
async def send_email(
    email_data: SendEmailRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    smtp_config = await db.smtp_config.find_one({}, {'_id': 0})
    if not smtp_config:
        raise HTTPException(status_code=400, detail="SMTP not configured. Please configure SMTP settings first.")
    
    doctor = await db.doctors.find_one({'id': email_data.doctor_id}, {'_id': 0})
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    
    log_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    email_log = {
        'id': log_id,
        'doctor_id': doctor['id'],
        'doctor_name': doctor['name'],
        'doctor_email': doctor['email'],
        'subject': email_data.subject,
        'body': email_data.body,
        'status': 'pending',
        'created_at': now.isoformat(),
        'sent_by': current_user['id']
    }
    
    await db.email_logs.insert_one(email_log)
    
    background_tasks.add_task(
        send_email_task,
        smtp_config,
        doctor,
        email_data.subject,
        email_data.body,
        email_data.is_html,
        log_id
    )
    
    return {"message": "Email queued for sending", "log_id": log_id}

@router.get("/email-logs", response_model=List[EmailLogResponse])
async def get_email_logs(current_user: dict = Depends(get_current_user)):
    logs = await db.email_logs.find({}, {'_id': 0}).sort('created_at', -1).to_list(100)
    
    result = []
    for log in logs:
        sent_at = log.get('sent_at')
        if sent_at and isinstance(sent_at, str):
            sent_at = datetime.fromisoformat(sent_at.replace('Z', '+00:00'))
        
        result.append(EmailLogResponse(
            id=log['id'],
            doctor_id=log['doctor_id'],
            doctor_name=log['doctor_name'],
            doctor_email=log['doctor_email'],
            subject=log['subject'],
            status=log['status'],
            sent_at=sent_at,
            error_message=log.get('error_message')
        ))
    
    return result


