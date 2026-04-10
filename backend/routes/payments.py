from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, UploadFile, File, Request
from fastapi.responses import Response
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import uuid
import json
import os

from deps import db, logger, get_current_user, hash_password, verify_password, create_token, security
from utils.ledger import get_customer_ledger, generate_ledger_pdf_bytes
from utils.whatsapp import get_whatsapp_config, send_wa_msg, log_whatsapp_message
from utils.email_utils import send_notification_email
from utils.templates import render_wa_template, get_company_short_name
import base64
from fpdf import FPDF

router = APIRouter(prefix="/api")

# ============== PAYMENT TRACKING ==============

# ============== CUSTOMER OPENING BALANCE ==============

@router.put("/customer-opening-balance/{customer_type}/{customer_id}")
async def update_customer_opening_balance(
    customer_type: str, customer_id: str,
    data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Update opening balance for a customer"""
    if current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Only admin can update opening balance")
    collection = {'doctor': 'doctors', 'medical': 'medicals', 'agency': 'agencies'}.get(customer_type)
    if not collection:
        raise HTTPException(status_code=400, detail="Invalid customer type")
    amount = float(data.get('opening_balance', 0))
    result = await db[collection].update_one(
        {'id': customer_id},
        {'$set': {'opening_balance': amount, 'updated_at': datetime.now(timezone.utc).isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Customer not found")
    return {"message": "Opening balance updated", "opening_balance": amount}



@router.post("/payments")
async def create_payment(data: dict, current_user: dict = Depends(get_current_user)):
    """Record a payment receipt"""
    now = datetime.now(timezone.utc)
    payment = {
        'id': str(uuid.uuid4()),
        'customer_id': data['customer_id'],
        'customer_name': data.get('customer_name', ''),
        'customer_type': data.get('customer_type', 'doctor'),
        'customer_phone': data.get('customer_phone', ''),
        'amount': float(data['amount']),
        'mode': data.get('mode', 'Cash'),
        'date': data.get('date', now.strftime('%Y-%m-%d')),
        'notes': data.get('notes', ''),
        'order_id': data.get('order_id'),
        'invoice_number': data.get('invoice_number'),
        'created_by': current_user.get('name', current_user.get('email', '')),
        'created_at': now.isoformat()
    }
    await db.payments.insert_one(payment)
    payment.pop('_id', None)
    return payment

@router.get("/payments")
async def get_payments(
    customer_id: Optional[str] = None,
    customer_type: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all payments with optional filters"""
    query = {}
    if customer_id:
        query['customer_id'] = customer_id
    if customer_type:
        query['customer_type'] = customer_type
    if from_date or to_date:
        date_q = {}
        if from_date:
            date_q['$gte'] = from_date
        if to_date:
            date_q['$lte'] = to_date
        query['date'] = date_q
    
    payments = await db.payments.find(query, {'_id': 0}).sort('date', -1).to_list(5000)
    return payments

@router.delete("/payments/{payment_id}")
async def delete_payment(payment_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.payments.delete_one({'id': payment_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Payment not found")
    return {"message": "Payment deleted"}

@router.put("/payments/{payment_id}")
async def update_payment(payment_id: str, data: dict, current_user: dict = Depends(get_current_user)):
    """Update a payment record"""
    update_fields = {}
    for key in ['amount', 'mode', 'date', 'notes', 'invoice_number']:
        if key in data:
            update_fields[key] = float(data[key]) if key == 'amount' else data[key]
    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = await db.payments.update_one({'id': payment_id}, {'$set': update_fields})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Payment not found")
    payment = await db.payments.find_one({'id': payment_id}, {'_id': 0})
    return payment

@router.post("/payments/{payment_id}/whatsapp")
async def send_payment_receipt_whatsapp(payment_id: str, current_user: dict = Depends(get_current_user)):
    """Send payment receipt via WhatsApp with ledger balance"""
    payment = await db.payments.find_one({'id': payment_id}, {'_id': 0})
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    cust_id = payment['customer_id']
    cust_type = payment.get('customer_type', 'doctor')
    cust_phone = payment.get('customer_phone', '')
    
    # Get ledger balance
    collection = {'doctor': 'doctors', 'medical': 'medicals', 'agency': 'agencies'}.get(cust_type, 'doctors')
    cust_doc = await db[collection].find_one({'id': cust_id}, {'_id': 0, 'opening_balance': 1, 'name': 1})
    opening_bal = (cust_doc or {}).get('opening_balance', 0) or 0
    
    # Total invoiced
    inv_pipeline = [{'$match': {'doctor_id': cust_id, 'invoice_value': {'$ne': None}}}, {'$group': {'_id': None, 'total': {'$sum': {'$toDouble': '$invoice_value'}}}}]
    inv_result = await db.orders.aggregate(inv_pipeline).to_list(1)
    total_invoiced = inv_result[0]['total'] if inv_result else 0
    
    # Total paid
    pay_pipeline = [{'$match': {'customer_id': cust_id}}, {'$group': {'_id': None, 'total': {'$sum': '$amount'}}}]
    pay_result = await db.payments.aggregate(pay_pipeline).to_list(1)
    total_paid = pay_result[0]['total'] if pay_result else 0
    
    balance = opening_bal + total_invoiced - total_paid
    
    company = await db.company_settings.find_one({}, {'_id': 0})
    company_name = (company or {}).get('company_name', 'VMP CRM')
    
    message = (
        f"*{company_name}*\n"
        f"*PAYMENT RECEIPT*\n"
        f"{'─' * 25}\n"
        f"Customer: {payment.get('customer_name', '')}\n"
        f"Date: {payment.get('date', '')}\n"
        f"Amount: Rs.{payment['amount']:,.2f}\n"
        f"Mode: {payment.get('mode', 'Cash')}\n"
    )
    if payment.get('notes'):
        message += f"Notes: {payment['notes']}\n"
    message += (
        f"{'─' * 25}\n"
        f"*Ledger Balance: Rs.{balance:,.2f}*\n"
        f"{'─' * 25}\n"
        f"Thank you for your payment!"
    )
    
    # Send WhatsApp
    config = await get_whatsapp_config()
    if not (config.get('api_url') and config.get('auth_token')):
        raise HTTPException(status_code=400, detail="WhatsApp not configured")
    
    if not cust_phone:
        raise HTTPException(status_code=400, detail="Customer phone not available")
    
    wa_mobile = cust_phone if cust_phone.startswith('91') else f"91{cust_phone[-10:]}"
    
    try:
        response = await send_wa_msg(wa_mobile, message, config=config)
        if response and response.status_code == 200:
            await log_whatsapp_message(wa_mobile, 'payment_receipt', message, 'success', recipient_name=payment.get('customer_name', ''))
            # Also send email receipt
            cust_email = (cust_doc or {}).get('email')
            if cust_email:
                email_body = f"""<p>Dear <strong>{payment.get('customer_name', 'Customer')}</strong>,</p>
<div style="background:#f8fafc;padding:16px;border-radius:6px;margin:16px 0;">
<h3 style="margin:0 0 12px 0;color:#1e3a5f;">Payment Receipt</h3>
<table style="width:100%;font-size:14px;">
<tr><td style="padding:6px 0;"><strong>Date:</strong></td><td>{payment.get('date', '')}</td></tr>
<tr><td style="padding:6px 0;"><strong>Amount:</strong></td><td style="color:#10b981;font-weight:bold;">Rs.{payment['amount']:,.2f}</td></tr>
<tr><td style="padding:6px 0;"><strong>Mode:</strong></td><td>{payment.get('mode', 'Cash')}</td></tr>
{f"<tr><td style='padding:6px 0;'><strong>Notes:</strong></td><td>{payment.get('notes')}</td></tr>" if payment.get('notes') else ""}
<tr><td style="padding:6px 0;border-top:2px solid #1e3a5f;"><strong>Ledger Balance:</strong></td><td style="border-top:2px solid #1e3a5f;font-weight:bold;">Rs.{balance:,.2f}</td></tr>
</table></div><p>Thank you for your payment!</p>"""
                await send_notification_email(cust_email, payment.get('customer_name', ''), f"Payment Receipt - Rs.{payment['amount']:,.2f}", email_body, cust_id, 'payment_receipt')
            return {"message": "Receipt sent via WhatsApp", "balance": balance}
        else:
            logger.error(f"WhatsApp receipt failed: {response.status_code if response else 'no_response'}")
            raise HTTPException(status_code=500, detail=f"WhatsApp API error: {response.status_code if response else 'no_response'}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"WhatsApp receipt error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"WhatsApp error: {str(e)}")


@router.post("/payments/send-reminder")
async def send_payment_reminder(data: dict, current_user: dict = Depends(get_current_user)):
    """Send payment reminder via WhatsApp (template-based) and optionally Email"""
    customer_phone = data.get('customer_phone', '')
    customer_name = data.get('customer_name', 'Customer')
    customer_email = data.get('customer_email', '')
    outstanding = float(data.get('outstanding', 0))

    if not customer_phone:
        raise HTTPException(status_code=400, detail="Customer phone is required")

    config = await get_whatsapp_config()
    if not (config.get('api_url') and config.get('auth_token')):
        raise HTTPException(status_code=400, detail="WhatsApp not configured")

    amount_str = f"{outstanding:,.2f}"

    # Send WhatsApp using template
    message = await render_wa_template('payment_reminder',
        customer_name=customer_name,
        outstanding_amount=amount_str
    )
    if not message:
        short_name, phone = await get_company_short_name()
        message = f"Hello {customer_name},\n\nThis is a friendly reminder regarding your outstanding balance of *Rs. {amount_str}*.\n\nPlease arrange the payment at your earliest convenience.\n\nRegards,\n*{short_name}*"
        if phone:
            message += f"\n+{phone}"

    wa_phone = customer_phone if customer_phone.startswith('91') else f"91{customer_phone[-10:]}"
    try:
        response = await send_wa_msg(wa_phone, message, config=config)
        if response and response.status_code == 200:
            await log_whatsapp_message(wa_phone, 'payment_reminder', message, 'success', recipient_name=customer_name)

            # Also send email if available
            if customer_email:
                short_name, phone = await get_company_short_name()
                email_body = f"<p>Dear <strong>{customer_name}</strong>,</p><p>This is a friendly reminder regarding your outstanding balance of <strong>Rs. {amount_str}</strong>.</p><p>Please arrange the payment at your earliest convenience.</p><p>Regards,<br><strong>{short_name}</strong></p>"
                await send_notification_email(customer_email, f"Payment Reminder - {short_name}", email_body, customer_name)

            return {"message": "Payment reminder sent via WhatsApp", "wa_status": "success"}
        else:
            await log_whatsapp_message(wa_phone, 'payment_reminder', message, 'failed')
            raise HTTPException(status_code=500, detail="WhatsApp send failed")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Payment reminder error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/ledger/{customer_type}/{customer_id}")
async def get_customer_ledger_route(
    customer_type: str,
    customer_id: str,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get ledger for a customer - opening balance + invoices + payments + sales returns"""
    result = await get_customer_ledger(customer_type, customer_id, from_date, to_date)
    if result is None:
        raise HTTPException(status_code=404, detail="Customer not found")
    return result

@router.get("/outstanding")
async def get_outstanding(
    customer_type: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get outstanding amounts for all customers"""
    types_to_check = [customer_type] if customer_type else ['doctor', 'medical', 'agency']
    collection_map = {'doctor': 'doctors', 'medical': 'medicals', 'agency': 'agencies'}
    
    results = []
    for ctype in types_to_check:
        collection = collection_map[ctype]
        customers = await db[collection].find({}, {'_id': 0, 'id': 1, 'name': 1, 'phone': 1, 'opening_balance': 1, 'customer_code': 1}).to_list(5000)
        
        for cust in customers:
            cust_id = cust['id']
            opening_bal = cust.get('opening_balance', 0) or 0
            
            # Total invoices
            pipeline = [
                {'$match': {'doctor_id': cust_id, 'invoice_value': {'$ne': None}}},
                {'$group': {'_id': None, 'total': {'$sum': {'$toDouble': '$invoice_value'}}}}
            ]
            inv_result = await db.orders.aggregate(pipeline).to_list(1)
            total_invoiced = inv_result[0]['total'] if inv_result else 0
            
            # Total payments
            pipeline2 = [
                {'$match': {'customer_id': cust_id}},
                {'$group': {'_id': None, 'total': {'$sum': '$amount'}}}
            ]
            pay_result = await db.payments.aggregate(pipeline2).to_list(1)
            total_paid = pay_result[0]['total'] if pay_result else 0
            
            outstanding = opening_bal + total_invoiced - total_paid
            
            if outstanding != 0:
                results.append({
                    'customer_id': cust_id,
                    'customer_code': cust.get('customer_code', ''),
                    'customer_name': cust['name'],
                    'customer_phone': cust.get('phone', ''),
                    'customer_email': cust.get('email', ''),
                    'city': cust.get('city', ''),
                    'customer_type': ctype,
                    'opening_balance': opening_bal,
                    'total_invoiced': total_invoiced,
                    'total_paid': total_paid,
                    'outstanding': outstanding,
                })
    
    results.sort(key=lambda x: x['outstanding'], reverse=True)
    return results

@router.post("/ledger/{customer_type}/{customer_id}/whatsapp")
async def send_ledger_whatsapp(
    customer_type: str,
    customer_id: str,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Send ledger statement via WhatsApp (summary text + PDF link) and also via email"""
    ledger = await get_customer_ledger(customer_type, customer_id, from_date, to_date, current_user)
    
    company = await db.company_settings.find_one({}, {'_id': 0})
    company_name = (company or {}).get('company_name', 'VMP CRM')
    
    cust = ledger['customer']
    cust_phone = cust.get('phone', '')
    if not cust_phone:
        raise HTTPException(status_code=400, detail="Customer phone not available")
    
    # Build summary WhatsApp message (concise)
    message = (
        f"*{company_name}*\n"
        f"*LEDGER STATEMENT SUMMARY*\n"
        f"{'─' * 28}\n"
        f"Customer: {cust['name']}\n"
        f"Type: {cust['type'].title()}\n"
    )
    if from_date or to_date:
        message += f"Period: {from_date or 'Start'} to {to_date or 'Present'}\n"
    
    num_entries = len(ledger['entries'])
    message += (
        f"{'─' * 28}\n"
        f"Total Entries: {num_entries}\n"
        f"*Total Debit: Rs.{ledger['total_debit']:,.2f}*\n"
        f"*Total Credit: Rs.{ledger['total_credit']:,.2f}*\n"
        f"*Closing Balance: Rs.{ledger['closing_balance']:,.2f}*\n"
        f"{'─' * 28}\n"
        f"\nPlease find the detailed PDF statement attached.\n"
        f"For any discrepancies, please contact us.\n"
    )
    
    # Generate PDF bytes for attachment
    pdf_bytes = generate_ledger_pdf_bytes(ledger, company_name, from_date, to_date)
    
    # Generate a temporary PDF access token and store the PDF in DB
    pdf_token = str(uuid.uuid4())
    await db.temp_ledger_pdfs.insert_one({
        'token': pdf_token,
        'pdf_data': base64.b64encode(pdf_bytes).decode('utf-8'),
        'customer_name': cust['name'],
        'created_at': datetime.now(timezone.utc).isoformat(),
        'expires_at': (datetime.now(timezone.utc) + timedelta(hours=48)).isoformat()
    })
    
    app_base_url = os.environ.get('APP_BASE_URL', '').rstrip('/')
    pdf_url = f"{app_base_url}/api/ledger-pdf/{pdf_token}.pdf" if app_base_url else None
    
    # Send WhatsApp with PDF attachment
    config = await get_whatsapp_config()
    if not (config.get('api_url') and config.get('auth_token')):
        raise HTTPException(status_code=400, detail="WhatsApp not configured")
    
    wa_mobile = cust_phone if cust_phone.startswith('91') else f"91{cust_phone[-10:]}"
    
    try:
        if pdf_url:
            response = await send_wa_msg(wa_mobile, message, file_url=pdf_url, file_caption=message, config=config)
        else:
            response = await send_wa_msg(wa_mobile, message, config=config)
        
        if response and response.status_code == 200:
            await log_whatsapp_message(wa_mobile, 'ledger_statement', message, 'success', recipient_name=cust['name'])
        else:
            logger.error(f"WhatsApp ledger failed: {response.status_code if response else 'no_response'}")
    except Exception as e:
        logger.error(f"WhatsApp ledger error: {str(e)}")
    
    # Also send via email with PDF attachment
    cust_email = cust.get('email')
    if cust_email:
        try:
            email_body = f"""<p>Dear <strong>{cust['name']}</strong>,</p>
<p>Please find your ledger statement attached as PDF.</p>
<div style="background:#f8fafc;padding:16px;border-radius:6px;margin:16px 0;">
<table style="font-size:14px;width:100%;">
<tr><td style="padding:6px 0;"><strong>Total Entries:</strong></td><td>{num_entries}</td></tr>
<tr><td style="padding:6px 0;"><strong>Total Debit:</strong></td><td>Rs.{ledger['total_debit']:,.2f}</td></tr>
<tr><td style="padding:6px 0;"><strong>Total Credit:</strong></td><td>Rs.{ledger['total_credit']:,.2f}</td></tr>
<tr><td style="padding:6px 0;border-top:2px solid #1e3a5f;"><strong>Closing Balance:</strong></td>
<td style="border-top:2px solid #1e3a5f;font-weight:bold;color:#1e3a5f;">Rs.{ledger['closing_balance']:,.2f}</td></tr>
</table></div>
<p>For any discrepancies, please contact us.</p>"""
            filename = f"Ledger_{cust['name'].replace(' ', '_')}_{datetime.now(timezone.utc).strftime('%Y%m%d')}.pdf"
            await send_notification_email(cust_email, cust['name'], f"Ledger Statement - {company_name}", email_body, customer_id, 'ledger_statement', attachment_data=pdf_bytes, attachment_filename=filename)
        except Exception as e:
            logger.error(f"Ledger email error: {e}")
    
    return {"message": "Ledger sent via WhatsApp and Email", "balance": ledger['closing_balance']}

@router.get("/ledger-pdf/{token}")
async def get_ledger_pdf_by_token(token: str):
    """Public endpoint to serve temporary ledger PDFs (for WhatsApp file URL)"""
    doc = await db.temp_ledger_pdfs.find_one({'token': token}, {'_id': 0})
    if not doc:
        raise HTTPException(status_code=404, detail="PDF not found or expired")
    
    # Check expiry
    expires_at = datetime.fromisoformat(doc['expires_at'].replace('Z', '+00:00'))
    if datetime.now(timezone.utc) > expires_at:
        await db.temp_ledger_pdfs.delete_one({'token': token})
        raise HTTPException(status_code=410, detail="PDF link has expired")
    
    pdf_data = base64.b64decode(doc['pdf_data'])
    filename = f"Ledger_{doc.get('customer_name', 'Statement').replace(' ', '_')}.pdf"
    return Response(content=pdf_data, media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'})


@router.get("/ledger-pdf/{token}.pdf")
async def get_ledger_pdf_by_token_ext(token: str):
    """Alias with .pdf extension for WhatsApp compatibility"""
    return await get_ledger_pdf_by_token(token)




@router.get("/ledger/export/pdf/{customer_type}/{customer_id}")
async def export_ledger_pdf(
    customer_type: str,
    customer_id: str,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Export customer ledger as PDF"""
    ledger = await get_customer_ledger(customer_type, customer_id, from_date, to_date, current_user)
    
    company = await db.company_settings.find_one({}, {'_id': 0})
    company_name = company.get('company_name', 'VMP CRM') if company else 'VMP CRM'
    
    cust = ledger['customer']
    pdf_bytes = generate_ledger_pdf_bytes(ledger, company_name, from_date, to_date)
    return Response(content=pdf_bytes, media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=ledger_{cust['name'].replace(' ','_')}.pdf"})


