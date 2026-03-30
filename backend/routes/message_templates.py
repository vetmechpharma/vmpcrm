from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, UploadFile, File, Request
from fastapi.responses import Response
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import uuid
import json
import os

from deps import db, logger, get_current_user, hash_password, verify_password, create_token, security
from utils.templates import DEFAULT_WA_TEMPLATES, DEFAULT_EMAIL_TEMPLATES, get_company_short_name, get_wa_template, get_email_template, render_wa_template

router = APIRouter(prefix="/api")

# ============== MESSAGE TEMPLATES (WhatsApp & Email) ==============

DEFAULT_WA_TEMPLATES = {
    'otp': {
        'key': 'otp',
        'name': 'OTP Verification',
        'category': 'whatsapp',
        'variables': ['otp', 'company_short_name'],
        'template': 'Your {company_short_name} verification code is: *{otp}*\n\nThis code expires in 5 minutes. Do not share this code with anyone.',
    },
    'order_confirmation': {
        'key': 'order_confirmation',
        'name': 'Order Confirmation',
        'category': 'whatsapp',
        'variables': ['customer_name', 'order_number', 'item_count', 'items_text', 'company_short_name', 'company_phone'],
        'template': 'Hello {customer_name},\n\nYour order *{order_number}* has been received!\n\n*Items:*\n{items_text}\n\nWe will process your order shortly.\n\nRegards,\n*{company_short_name}*\n+{company_phone}',
    },
    'status_confirmed': {
        'key': 'status_confirmed',
        'name': 'Order Confirmed',
        'category': 'whatsapp',
        'variables': ['customer_name', 'order_number', 'company_short_name', 'company_phone'],
        'template': 'Hello {customer_name},\n\nYour order *{order_number}* has been *CONFIRMED*!\n\nWe are preparing your order for dispatch.\n\nRegards,\n*{company_short_name}*\n+{company_phone}',
    },
    'status_processing': {
        'key': 'status_processing',
        'name': 'Order Processing',
        'category': 'whatsapp',
        'variables': ['customer_name', 'order_number', 'company_short_name', 'company_phone'],
        'template': 'Hello {customer_name},\n\nYour order *{order_number}* is now being *PROCESSED*!\n\nRegards,\n*{company_short_name}*\n+{company_phone}',
    },
    'status_ready': {
        'key': 'status_ready',
        'name': 'Ready to Dispatch',
        'category': 'whatsapp',
        'variables': ['customer_name', 'order_number', 'items_text', 'transport_name', 'company_short_name', 'company_phone'],
        'template': 'Hello {customer_name},\n\nYour order *{order_number}* is *READY TO DISPATCH*!\n\n*Items:*\n{items_text}\n\n*Transport:* {transport_name}\n\nRegards,\n*{company_short_name}*\n+{company_phone}',
    },
    'status_dispatched': {
        'key': 'status_dispatched',
        'name': 'Order Dispatched',
        'category': 'whatsapp',
        'variables': ['customer_name', 'order_number', 'company_short_name', 'company_phone'],
        'template': 'Hello {customer_name},\n\nYour order *{order_number}* has been *DISPATCHED*!\n\nRegards,\n*{company_short_name}*\n+{company_phone}',
    },
    'status_delivered': {
        'key': 'status_delivered',
        'name': 'Order Delivered',
        'category': 'whatsapp',
        'variables': ['customer_name', 'order_number', 'company_short_name', 'company_phone'],
        'template': 'Hello {customer_name},\n\nYour order *{order_number}* has been *DELIVERED*!\n\nThank you for your business.\n\nRegards,\n*{company_short_name}*\n+{company_phone}',
    },
    'payment_receipt': {
        'key': 'payment_receipt',
        'name': 'Payment Receipt',
        'category': 'whatsapp',
        'variables': ['customer_name', 'amount', 'payment_mode', 'balance', 'company_short_name', 'company_phone'],
        'template': 'Hello {customer_name},\n\nPayment of Rs. {amount} received via {payment_mode}.\n\nOutstanding balance: Rs. {balance}\n\nThank you!\n\n*{company_short_name}*\n+{company_phone}',
    },
    'out_of_stock': {
        'key': 'out_of_stock',
        'name': 'Out of Stock Notice',
        'category': 'whatsapp',
        'variables': ['customer_name', 'order_number', 'items_text', 'company_short_name', 'company_phone'],
        'template': 'Hello {customer_name},\n\nSome items in your order *{order_number}* are currently *OUT OF STOCK*:\n\n{items_text}\n\nWe will notify you when they are available.\n\nRegards,\n*{company_short_name}*\n+{company_phone}',
    },
    'stock_arrived': {
        'key': 'stock_arrived',
        'name': 'Stock Arrived',
        'category': 'whatsapp',
        'variables': ['customer_name', 'item_name', 'item_code', 'company_short_name', 'company_phone'],
        'template': 'Hello {customer_name},\n\n*{item_name}* ({item_code}) is now back in stock!\n\nYou can place your order now.\n\nRegards,\n*{company_short_name}*\n+{company_phone}',
    },
    'account_approved': {
        'key': 'account_approved',
        'name': 'Account Approved',
        'category': 'whatsapp',
        'variables': ['customer_name', 'customer_code', 'company_short_name'],
        'template': 'Great news, {customer_name}!\n\nYour {company_short_name} account has been *APPROVED*!\n\nYou can now login to view products and place orders.\n\nCustomer Code: {customer_code}',
    },
    'account_declined': {
        'key': 'account_declined',
        'name': 'Account Declined',
        'category': 'whatsapp',
        'variables': ['customer_name', 'reason', 'company_short_name'],
        'template': 'Hello {customer_name},\n\nUnfortunately, your {company_short_name} registration has been declined.\n\nReason: {reason}\n\nPlease contact support for assistance.',
    },
    'password_reset': {
        'key': 'password_reset',
        'name': 'Password Reset',
        'category': 'whatsapp',
        'variables': ['customer_name', 'new_password', 'company_short_name'],
        'template': 'Hello {customer_name},\n\nYour {company_short_name} portal login credentials:\n\nPassword: {new_password}\n\nPlease change your password after logging in.',
    },
    'test_message': {
        'key': 'test_message',
        'name': 'Test Message',
        'category': 'whatsapp',
        'variables': ['company_short_name'],
        'template': 'Test message from {company_short_name}. WhatsApp integration is working!',
    },
    'daily_reminder': {
        'key': 'daily_reminder',
        'name': 'Daily Order Reminder',
        'category': 'whatsapp',
        'variables': ['customer_name', 'summary', 'company_short_name', 'company_phone'],
        'template': 'Hello {customer_name},\n\nHere is your daily order summary:\n\n{summary}\n\nRegards,\n*{company_short_name}*\n+{company_phone}',
    },
    'ledger_statement': {
        'key': 'ledger_statement',
        'name': 'Ledger Statement',
        'category': 'whatsapp',
        'variables': ['customer_name', 'period', 'total_balance', 'company_short_name', 'company_phone'],
        'template': 'Hello {customer_name},\n\nYour ledger statement for *{period}* is attached.\n\nCurrent Balance: *Rs. {total_balance}*\n\nRegards,\n*{company_short_name}*\n+{company_phone}',
    },
    'birthday_greeting': {
        'key': 'birthday_greeting',
        'name': 'Birthday Greeting',
        'category': 'whatsapp',
        'variables': ['customer_name', 'company_short_name'],
        'template': 'Happy Birthday, {customer_name}! 🎂\n\nWishing you a wonderful year ahead.\n\nWarm regards,\n*{company_short_name}*',
    },
    'anniversary_greeting': {
        'key': 'anniversary_greeting',
        'name': 'Anniversary Greeting',
        'category': 'whatsapp',
        'variables': ['customer_name', 'company_short_name'],
        'template': 'Happy Anniversary, {customer_name}!\n\nWishing you many more happy years ahead.\n\nWarm regards,\n*{company_short_name}*',
    },
}

DEFAULT_EMAIL_TEMPLATES = {
    'order_confirmation_email': {
        'key': 'order_confirmation_email',
        'name': 'Order Confirmation Email',
        'category': 'email',
        'variables': ['customer_name', 'order_number', 'items_html', 'company_name', 'company_short_name'],
        'subject': 'Order {order_number} - Confirmation | {company_short_name}',
        'template': '<h2>Hello {customer_name},</h2><p>Your order <strong>{order_number}</strong> has been received.</p>{items_html}<p>We will process your order shortly.</p><p>Regards,<br/><strong>{company_name}</strong></p>',
    },
    'order_confirmed_email': {
        'key': 'order_confirmed_email',
        'name': 'Order Confirmed Email',
        'category': 'email',
        'variables': ['customer_name', 'order_number', 'items_html', 'company_name', 'company_short_name'],
        'subject': 'Order {order_number} - Confirmed | {company_short_name}',
        'template': '<h2>Hello {customer_name},</h2><p>Your order <strong>{order_number}</strong> has been <strong style="color:#10b981;">CONFIRMED</strong>!</p><p>We are preparing your order for dispatch.</p>{items_html}<p>Regards,<br/><strong>{company_name}</strong></p>',
    },
    'order_dispatched_email': {
        'key': 'order_dispatched_email',
        'name': 'Order Dispatched Email',
        'category': 'email',
        'variables': ['customer_name', 'order_number', 'items_html', 'transport_name', 'tracking_number', 'company_name', 'company_short_name'],
        'subject': 'Order {order_number} - Dispatched | {company_short_name}',
        'template': '<h2>Hello {customer_name},</h2><p>Your order <strong>{order_number}</strong> has been <strong style="color:#3b82f6;">DISPATCHED</strong>!</p>{items_html}<p><strong>Transport:</strong> {transport_name}<br/><strong>Tracking:</strong> {tracking_number}</p><p>Regards,<br/><strong>{company_name}</strong></p>',
    },
    'order_delivered_email': {
        'key': 'order_delivered_email',
        'name': 'Order Delivered Email',
        'category': 'email',
        'variables': ['customer_name', 'order_number', 'company_name', 'company_short_name'],
        'subject': 'Order {order_number} - Delivered | {company_short_name}',
        'template': '<h2>Hello {customer_name},</h2><p>Your order <strong>{order_number}</strong> has been <strong style="color:#10b981;">DELIVERED</strong>!</p><p>Thank you for your business.</p><p>Regards,<br/><strong>{company_name}</strong></p>',
    },
    'order_cancelled_email': {
        'key': 'order_cancelled_email',
        'name': 'Order Cancelled Email',
        'category': 'email',
        'variables': ['customer_name', 'order_number', 'reason', 'company_name', 'company_short_name'],
        'subject': 'Order {order_number} - Cancelled | {company_short_name}',
        'template': '<h2>Hello {customer_name},</h2><p>Your order <strong>{order_number}</strong> has been <strong style="color:#ef4444;">CANCELLED</strong>.</p><p><strong>Reason:</strong> {reason}</p><p>For any queries, please contact us.</p><p>Regards,<br/><strong>{company_name}</strong></p>',
    },
    'payment_receipt_email': {
        'key': 'payment_receipt_email',
        'name': 'Payment Receipt Email',
        'category': 'email',
        'variables': ['customer_name', 'amount', 'payment_mode', 'balance', 'company_name', 'company_short_name'],
        'subject': 'Payment Receipt | {company_short_name}',
        'template': '<h2>Hello {customer_name},</h2><p>Payment of <strong>Rs. {amount}</strong> received via {payment_mode}.</p><p>Outstanding balance: Rs. {balance}</p><p>Thank you!</p><p>Regards,<br/><strong>{company_name}</strong></p>',
    },
    'account_approved_email': {
        'key': 'account_approved_email',
        'name': 'Account Approved Email',
        'category': 'email',
        'variables': ['customer_name', 'customer_code', 'company_name', 'company_short_name'],
        'subject': 'Account Approved | {company_short_name}',
        'template': '<h2>Welcome, {customer_name}!</h2><p>Your account has been <strong>approved</strong>.</p><p>Customer Code: <strong>{customer_code}</strong></p><p>You can now login to view products and place orders.</p><p>Regards,<br/><strong>{company_name}</strong></p>',
    },
    'account_declined_email': {
        'key': 'account_declined_email',
        'name': 'Account Declined Email',
        'category': 'email',
        'variables': ['customer_name', 'reason', 'company_name', 'company_short_name'],
        'subject': 'Registration Update | {company_short_name}',
        'template': '<h2>Hello {customer_name},</h2><p>Unfortunately, your registration has been <strong style="color:#ef4444;">declined</strong>.</p><p><strong>Reason:</strong> {reason}</p><p>Please contact support for assistance.</p><p>Regards,<br/><strong>{company_name}</strong></p>',
    },
    'ledger_statement_email': {
        'key': 'ledger_statement_email',
        'name': 'Ledger Statement Email',
        'category': 'email',
        'variables': ['customer_name', 'period', 'total_balance', 'company_name', 'company_short_name'],
        'subject': 'Ledger Statement - {period} | {company_short_name}',
        'template': '<h2>Hello {customer_name},</h2><p>Please find your ledger statement for <strong>{period}</strong> attached.</p><p>Current Balance: <strong>Rs. {total_balance}</strong></p><p>Regards,<br/><strong>{company_name}</strong></p>',
    },
    'ticket_status_email': {
        'key': 'ticket_status_email',
        'name': 'Support Ticket Status Email',
        'category': 'email',
        'variables': ['customer_name', 'ticket_number', 'status', 'company_name', 'company_short_name'],
        'subject': 'Ticket #{ticket_number} - {status} | {company_short_name}',
        'template': '<h2>Hello {customer_name},</h2><p>Your support ticket <strong>#{ticket_number}</strong> has been updated to: <strong>{status}</strong>.</p><p>You can view the latest updates in your portal.</p><p>Regards,<br/><strong>{company_name}</strong></p>',
    },
    'ticket_reply_email': {
        'key': 'ticket_reply_email',
        'name': 'Support Ticket Reply Email',
        'category': 'email',
        'variables': ['customer_name', 'ticket_number', 'company_name', 'company_short_name'],
        'subject': 'New Reply - Ticket #{ticket_number} | {company_short_name}',
        'template': '<h2>Hello {customer_name},</h2><p>A new reply has been added to your support ticket <strong>#{ticket_number}</strong>.</p><p>Please login to your portal to view the response.</p><p>Regards,<br/><strong>{company_name}</strong></p>',
    },
    'out_of_stock_email': {
        'key': 'out_of_stock_email',
        'name': 'Out of Stock Notice Email',
        'category': 'email',
        'variables': ['customer_name', 'order_number', 'items_html', 'company_name', 'company_short_name'],
        'subject': 'Out of Stock Items - Order {order_number} | {company_short_name}',
        'template': '<h2>Hello {customer_name},</h2><p>Some items in your order <strong>{order_number}</strong> are currently <strong style="color:#ef4444;">out of stock</strong>:</p>{items_html}<p>We will notify you when they become available.</p><p>Regards,<br/><strong>{company_name}</strong></p>',
    },
    'daily_reminder_email': {
        'key': 'daily_reminder_email',
        'name': 'Daily Order Reminder Email',
        'category': 'email',
        'variables': ['customer_name', 'summary', 'company_name', 'company_short_name'],
        'subject': 'Daily Order Summary | {company_short_name}',
        'template': '<h2>Hello {customer_name},</h2><p>Here is your daily order summary:</p>{summary}<p>Regards,<br/><strong>{company_name}</strong></p>',
    },
}


async def get_company_short_name():
    """Get company short name from settings, fallback to company name"""
    company = await db.company_settings.find_one({}, {'_id': 0, 'company_short_name': 1, 'company_name': 1, 'phone': 1})
    if not company:
        return 'CRM', ''
    short = company.get('company_short_name') or company.get('company_name', 'CRM')
    phone = company.get('phone', '')
    return short, phone


async def get_wa_template(key: str):
    """Get WhatsApp template from DB, fallback to default"""
    tmpl = await db.message_templates.find_one({'key': key, 'category': 'whatsapp'}, {'_id': 0})
    if tmpl:
        return tmpl.get('template', '')
    default = DEFAULT_WA_TEMPLATES.get(key)
    if default:
        return default['template']
    return ''


async def get_email_template(key: str):
    """Get email template from DB, fallback to default"""
    tmpl = await db.message_templates.find_one({'key': key, 'category': 'email'}, {'_id': 0})
    if tmpl:
        return tmpl.get('template', ''), tmpl.get('subject', '')
    default = DEFAULT_EMAIL_TEMPLATES.get(key)
    if default:
        return default['template'], default.get('subject', '')
    return '', ''


async def render_wa_template(key: str, **kwargs):
    """Render a WhatsApp template with variables"""
    tmpl = await get_wa_template(key)
    if not tmpl:
        return ''
    short_name, phone = await get_company_short_name()
    kwargs.setdefault('company_short_name', short_name)
    kwargs.setdefault('company_phone', phone)
    try:
        return tmpl.format(**kwargs)
    except KeyError:
        # If template has variables not in kwargs, do partial format
        for k, v in kwargs.items():
            tmpl = tmpl.replace('{' + k + '}', str(v))
        return tmpl


@router.get("/message-templates")
async def get_all_templates(category: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Get all message templates"""
    query = {}
    if category:
        query['category'] = category
    templates = await db.message_templates.find(query, {'_id': 0}).to_list(100)
    
    # Merge with defaults for missing templates
    all_defaults = {**DEFAULT_WA_TEMPLATES, **DEFAULT_EMAIL_TEMPLATES}
    existing_keys = {t['key'] for t in templates}
    
    for key, default in all_defaults.items():
        if category and default['category'] != category:
            continue
        if key not in existing_keys:
            templates.append({**default, 'is_default': True})
    
    return templates


@router.put("/message-templates/{template_key}")
async def update_template(template_key: str, data: dict, current_user: dict = Depends(get_current_user)):
    """Update a message template"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can edit templates")
    
    all_defaults = {**DEFAULT_WA_TEMPLATES, **DEFAULT_EMAIL_TEMPLATES}
    default = all_defaults.get(template_key)
    
    update_doc = {
        'key': template_key,
        'name': data.get('name', default['name'] if default else template_key),
        'category': data.get('category', default['category'] if default else 'whatsapp'),
        'variables': data.get('variables', default['variables'] if default else []),
        'template': data.get('template', ''),
        'updated_at': datetime.now(timezone.utc).isoformat()
    }
    if update_doc['category'] == 'email':
        update_doc['subject'] = data.get('subject', '')
    
    await db.message_templates.update_one(
        {'key': template_key},
        {'$set': update_doc},
        upsert=True
    )
    return {"message": "Template updated", "key": template_key}


@router.post("/message-templates/{template_key}/reset")
async def reset_template(template_key: str, current_user: dict = Depends(get_current_user)):
    """Reset a template to default"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can reset templates")
    await db.message_templates.delete_one({'key': template_key})
    return {"message": "Template reset to default"}



