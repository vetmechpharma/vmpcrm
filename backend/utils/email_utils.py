"""Email utility functions."""
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication
from datetime import datetime, timezone
import uuid

from deps import db, logger


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
    """Reusable email sender for all notification types."""
    try:
        smtp_config = await db.smtp_config.find_one({}, {'_id': 0})
        if not smtp_config:
            logger.warning(f"SMTP not configured, skipping {email_type} email to {to_email}")
            return False

        company = await db.company_settings.find_one({}, {'_id': 0})
        company_name = company.get('company_name', 'VMP CRM') if company else 'VMP CRM'

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
