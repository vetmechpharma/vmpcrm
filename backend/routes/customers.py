from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, UploadFile, File, Request
from fastapi.responses import Response
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import uuid
import json
import os

from deps import db, logger, get_current_user, hash_password, verify_password, create_token, security
from models.schemas import (CustomerRegister, CustomerLogin, CustomerOTPRequest, CustomerOTPVerify,
    CustomerResetPassword, CustomerProfileUpdate, CustomerResponse, CustomerApproval,
    TicketCreate, TicketReply, TicketResponse, OrderItem)
from pydantic import BaseModel, EmailStr
from deps import create_customer_token, get_current_customer
from utils.whatsapp import get_whatsapp_config, send_wa_msg, log_whatsapp_message, send_whatsapp_otp
from utils.email_utils import send_notification_email
from utils.templates import render_wa_template, get_company_short_name, get_wa_template
from utils.push import send_push_to_admins
from utils.notifications import send_whatsapp_order, send_order_confirmation_email
from utils.ledger import get_customer_ledger, generate_ledger_pdf_bytes
import base64
import bcrypt
import asyncio
from fpdf import FPDF
import random
import string
from fastapi.security import HTTPBearer

router = APIRouter(prefix="/api")

DEFAULT_SUBCATEGORY_ORDER = [
    'Injection', 'Dry Injections', 'Hormones', 'Schedule X Drugs',
    'Liquids', 'Bolus', 'Powder', 'Feed Supplements',
    'Shampoo / Soap', 'Spray / Ointments', 'Tablets', 'Syrups', 'Vaccines'
]

# ============== CUSTOMER PORTAL ROUTES ==============

# Store OTPs in memory (in production, use Redis)
customer_otp_store = {}

# Use utility functions from shared modules
from utils.code_gen import generate_portal_customer_code as generate_customer_code, generate_ticket_number

@router.post("/customer/send-otp")
async def customer_send_otp(request: CustomerOTPRequest):
    """Send OTP to customer for registration or password reset"""
    clean_phone = ''.join(filter(str.isdigit, request.phone))
    if len(clean_phone) < 10:
        raise HTTPException(status_code=400, detail="Invalid phone number")
    
    # Check if customer exists for password reset
    if request.purpose == "reset_password":
        customer = await db.portal_customers.find_one({'phone': clean_phone}, {'_id': 0})
        if not customer:
            raise HTTPException(status_code=404, detail="No account found with this phone number")
    
    # Check for duplicate registration - prevent if phone already registered
    if request.purpose == "register":
        # Check portal_customers first
        existing_portal = await db.portal_customers.find_one({'phone': clean_phone}, {'_id': 0})
        if existing_portal:
            status = existing_portal.get('status', '')
            if status == 'pending_approval':
                raise HTTPException(status_code=400, detail="This phone number has a pending registration. Please wait for approval or contact support.")
            elif status == 'approved':
                raise HTTPException(status_code=400, detail="This phone number is already registered. Please login instead.")
            elif status == 'rejected':
                raise HTTPException(status_code=400, detail="Registration was rejected. Please contact support for assistance.")
            elif status == 'suspended':
                raise HTTPException(status_code=400, detail="This account is suspended. Please contact support.")
            else:
                raise HTTPException(status_code=400, detail="This phone number is already registered.")
        
        # Check doctors, medicals, agencies collections (admin-created customers)
        existing_doctor = await db.doctors.find_one({'phone': clean_phone}, {'_id': 0})
        if existing_doctor:
            raise HTTPException(status_code=400, detail="This phone number is already registered as a Doctor. Please contact admin for portal access.")
        
        existing_medical = await db.medicals.find_one({'phone': clean_phone}, {'_id': 0})
        if existing_medical:
            raise HTTPException(status_code=400, detail="This phone number is already registered as a Medical Store. Please contact admin for portal access.")
        
        existing_agency = await db.agencies.find_one({'phone': clean_phone}, {'_id': 0})
        if existing_agency:
            raise HTTPException(status_code=400, detail="This phone number is already registered as an Agency. Please contact admin for portal access.")
    
    # Generate 4-digit OTP
    otp = str(random.randint(1000, 9999))
    
    # Store OTP with expiry (5 minutes)
    customer_otp_store[f"{clean_phone}_{request.purpose}"] = {
        'otp': otp,
        'expires': datetime.now(timezone.utc) + timedelta(minutes=5)
    }
    
    # Send OTP via WhatsApp using BotMasterSender API
    config = await get_whatsapp_config()
    if config.get('api_url') and config.get('auth_token'):
        try:
            purpose_text = "registration" if request.purpose == "register" else "password reset"
            message = f"Your VMP CRM verification code for {purpose_text} is: *{otp}*\n\nThis code expires in 5 minutes. Do not share this code with anyone."
            tmpl = await get_wa_template('otp')
            if tmpl:
                short_name, _ = await get_company_short_name()
                try:
                    message = tmpl.format(otp=otp, company_short_name=short_name)
                except Exception:
                    pass
            
            # Ensure mobile has 91 prefix for India
            wa_mobile = clean_phone if clean_phone.startswith('91') else f"91{clean_phone[-10:]}"
            
            response = await send_wa_msg(wa_mobile, message, config=config)
            if response and response.status_code == 200:
                await log_whatsapp_message(wa_mobile, 'otp', message, 'success')
                logger.info(f"OTP sent successfully to {wa_mobile}")
            else:
                await log_whatsapp_message(wa_mobile, 'otp', message, 'failed', error_message=f"Status: {response.status_code if response else 'no_response'}")
                logger.error(f"WhatsApp OTP failed: {response.status_code if response else 'no_response'}")
        except Exception as e:
            logger.error(f"WhatsApp OTP error: {str(e)}")
            await log_whatsapp_message(clean_phone, 'otp', f"OTP: {otp}", 'failed', error_message=str(e))
    
    return {"message": "OTP sent successfully", "phone": clean_phone}

@router.post("/customer/verify-otp")
async def customer_verify_otp(request: CustomerOTPVerify):
    """Verify OTP for customer"""
    clean_phone = ''.join(filter(str.isdigit, request.phone))
    otp_key = f"{clean_phone}_{request.purpose}"
    
    stored = customer_otp_store.get(otp_key)
    
    # First check if it's a fallback OTP (admin-managed)
    fallback_otp = await db.fallback_otps.find_one({'otp': request.otp, 'is_active': True}, {'_id': 0})
    if fallback_otp:
        # Increment usage count
        await db.fallback_otps.update_one(
            {'id': fallback_otp['id']},
            {'$inc': {'used_count': 1}}
        )
        logger.info(f"Fallback OTP used for phone {clean_phone}")
        
        # Store as verified for registration flow
        customer_otp_store[otp_key] = {
            'otp': request.otp,
            'expires': datetime.now(timezone.utc) + timedelta(minutes=30),
            'verified': True,
            'is_fallback': True
        }
        return {"message": "OTP verified successfully", "verified": True}
    
    # Check regular OTP
    if not stored:
        raise HTTPException(status_code=400, detail="OTP not found or expired. Please request a new OTP.")
    
    if datetime.now(timezone.utc) > stored['expires']:
        del customer_otp_store[otp_key]
        raise HTTPException(status_code=400, detail="OTP expired. Please request a new OTP.")
    
    if stored['otp'] != request.otp:
        raise HTTPException(status_code=400, detail="Invalid OTP")
    
    # Mark OTP as verified
    customer_otp_store[otp_key]['verified'] = True
    
    return {"message": "OTP verified successfully", "verified": True}

@router.post("/customer/register", response_model=CustomerResponse)
async def customer_register(request: CustomerRegister):
    """Register new customer (requires OTP verification)"""
    clean_phone = ''.join(filter(str.isdigit, request.phone))
    
    # Verify OTP was verified
    otp_key = f"{clean_phone}_register"
    stored = customer_otp_store.get(otp_key)
    if not stored or not stored.get('verified'):
        raise HTTPException(status_code=400, detail="Please verify OTP first")
    
    # Check if phone already exists
    existing = await db.portal_customers.find_one({'phone': clean_phone}, {'_id': 0})
    if existing:
        raise HTTPException(status_code=400, detail="Phone number already registered")
    
    # Validate role
    if request.role not in ['doctor', 'medical', 'agency']:
        raise HTTPException(status_code=400, detail="Invalid role. Must be doctor, medical, or agency")
    
    customer_id = str(uuid.uuid4())
    customer_code = await generate_customer_code(request.role)
    now = datetime.now(timezone.utc)
    
    # Hash password
    password_hash = bcrypt.hashpw(request.password.encode(), bcrypt.gensalt()).decode()
    
    customer_doc = {
        'id': customer_id,
        'customer_code': customer_code,
        'name': request.name,
        'phone': clean_phone,
        'email': request.email,
        'password_hash': password_hash,
        'role': request.role,
        'status': 'pending_approval',
        'reg_no': request.reg_no,
        'dob': request.dob,
        'proprietor_name': request.proprietor_name,
        'gst_number': request.gst_number,
        'drug_license': request.drug_license,
        'alternate_phone': request.alternate_phone,
        'birthday': request.birthday,
        'anniversary': request.anniversary,
        'address_line_1': request.address_line_1,
        'address_line_2': request.address_line_2,
        'state': request.state,
        'district': request.district,
        'pincode': request.pincode,
        'delivery_station': request.delivery_station,
        'transport_id': request.transport_id,
        'created_at': now.isoformat(),
        'approved_at': None,
        'approved_by': None
    }
    
    await db.portal_customers.insert_one(customer_doc)
    
    # Notify admins of new registration
    try:
        asyncio.create_task(_notify_admin_new_registration(request.name, request.role))
    except Exception:
        pass
    
    # Clear OTP
    del customer_otp_store[otp_key]
    
    # Get transport name if exists
    transport_name = None
    if request.transport_id:
        transport = await db.transports.find_one({'id': request.transport_id}, {'_id': 0, 'name': 1})
        transport_name = transport.get('name') if transport else None
    
    return CustomerResponse(
        id=customer_id,
        customer_code=customer_code,
        name=request.name,
        phone=clean_phone,
        email=request.email,
        role=request.role,
        status='pending_approval',
        reg_no=request.reg_no,
        dob=request.dob,
        proprietor_name=request.proprietor_name,
        gst_number=request.gst_number,
        drug_license=request.drug_license,
        alternate_phone=request.alternate_phone,
        birthday=request.birthday,
        anniversary=request.anniversary,
        address_line_1=request.address_line_1,
        address_line_2=request.address_line_2,
        state=request.state,
        district=request.district,
        pincode=request.pincode,
        delivery_station=request.delivery_station,
        transport_id=request.transport_id,
        transport_name=transport_name,
        created_at=now
    )

# Push notification to admins for new registration - run in background
async def _notify_admin_new_registration(name, role):
    await send_push_to_admins('New Customer Registration', f'{name} ({role}) registered - pending approval', '/admin/customers', 'new-registration')

@router.post("/customer/login")
async def customer_login(request: CustomerLogin):
    """Customer login"""
    clean_phone = ''.join(filter(str.isdigit, request.phone))
    
    customer = await db.portal_customers.find_one({'phone': clean_phone}, {'_id': 0})
    if not customer:
        raise HTTPException(status_code=401, detail="Invalid phone or password")
    
    if not bcrypt.checkpw(request.password.encode(), customer['password_hash'].encode()):
        raise HTTPException(status_code=401, detail="Invalid phone or password")
    
    if customer['status'] == 'pending_approval':
        raise HTTPException(status_code=403, detail="Your account is pending approval. Please wait for admin approval.")
    
    if customer['status'] == 'rejected':
        raise HTTPException(status_code=403, detail="Your registration was rejected. Please contact support.")
    
    if customer['status'] == 'suspended':
        raise HTTPException(status_code=403, detail="Your account has been suspended. Please contact support.")
    
    token = create_customer_token(customer['id'], customer['role'])
    
    return {
        "access_token": token,
        "customer": {
            "id": customer['id'],
            "name": customer['name'],
            "phone": customer['phone'],
            "role": customer['role'],
            "customer_code": customer['customer_code']
        }
    }

@router.post("/customer/login-otp-send")
async def customer_login_otp_send(request: CustomerOTPRequest):
    """Send OTP for customer login (passwordless)"""
    clean_phone = ''.join(filter(str.isdigit, request.phone))
    if len(clean_phone) < 10:
        raise HTTPException(status_code=400, detail="Invalid phone number")
    
    customer = await db.portal_customers.find_one({'phone': clean_phone}, {'_id': 0})
    if not customer:
        raise HTTPException(status_code=404, detail="No account found with this phone number. Please register first.")
    
    if customer['status'] == 'pending_approval':
        raise HTTPException(status_code=403, detail="Your account is pending approval.")
    if customer['status'] in ('rejected', 'suspended'):
        raise HTTPException(status_code=403, detail="Your account is not active. Please contact support.")
    
    otp = str(random.randint(1000, 9999))
    customer_otp_store[f"{clean_phone}_login"] = {
        'otp': otp,
        'expires': datetime.now(timezone.utc) + timedelta(minutes=5)
    }
    
    config = await get_whatsapp_config()
    if config.get('api_url') and config.get('auth_token'):
        try:
            await send_whatsapp_otp(clean_phone, otp)
        except Exception as e:
            logger.error(f"Failed to send login OTP via WhatsApp: {e}")
    
    return {"message": "OTP sent to your WhatsApp", "phone": clean_phone}

@router.post("/customer/login-otp-verify")
async def customer_login_otp_verify(request: CustomerOTPVerify):
    """Verify OTP and login customer (passwordless)"""
    clean_phone = ''.join(filter(str.isdigit, request.phone))
    otp_key = f"{clean_phone}_login"
    
    stored = customer_otp_store.get(otp_key)
    
    # Check fallback OTP
    if not stored:
        fallback_otp = await db.fallback_otps.find_one({'otp': request.otp, 'is_active': True}, {'_id': 0})
        if fallback_otp:
            customer_otp_store[otp_key] = {'otp': request.otp, 'expires': datetime.now(timezone.utc) + timedelta(minutes=5)}
            stored = customer_otp_store[otp_key]
    
    if not stored:
        raise HTTPException(status_code=400, detail="OTP not found or expired. Please request a new one.")
    
    if datetime.now(timezone.utc) > stored['expires']:
        del customer_otp_store[otp_key]
        raise HTTPException(status_code=400, detail="OTP expired. Please request a new one.")
    
    if stored['otp'] != request.otp:
        raise HTTPException(status_code=400, detail="Invalid OTP")
    
    del customer_otp_store[otp_key]
    
    customer = await db.portal_customers.find_one({'phone': clean_phone}, {'_id': 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    if customer['status'] != 'approved':
        raise HTTPException(status_code=403, detail="Your account is not active.")
    
    token = create_customer_token(customer['id'], customer['role'])
    
    return {
        "access_token": token,
        "customer": {
            "id": customer['id'],
            "name": customer['name'],
            "phone": customer['phone'],
            "role": customer['role'],
            "customer_code": customer['customer_code']
        }
    }

@router.post("/customer/reset-password")
async def customer_reset_password(request: CustomerResetPassword):
    """Reset customer password"""
    clean_phone = ''.join(filter(str.isdigit, request.phone))
    
    # Verify OTP
    otp_key = f"{clean_phone}_reset_password"
    stored = customer_otp_store.get(otp_key)
    if not stored:
        raise HTTPException(status_code=400, detail="OTP not found or expired")
    
    if stored['otp'] != request.otp:
        raise HTTPException(status_code=400, detail="Invalid OTP")
    
    # Update password
    password_hash = bcrypt.hashpw(request.new_password.encode(), bcrypt.gensalt()).decode()
    result = await db.portal_customers.update_one(
        {'phone': clean_phone},
        {'$set': {'password_hash': password_hash, 'updated_at': datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    # Clear OTP
    del customer_otp_store[otp_key]
    
    return {"message": "Password reset successfully"}


@router.post("/customer/change-password")
async def customer_change_password(data: dict, customer: dict = Depends(get_current_customer)):
    """Change password using old password (for logged-in customers)"""
    old_password = data.get('old_password', '')
    new_password = data.get('new_password', '')
    
    if not old_password or not new_password:
        raise HTTPException(status_code=400, detail="Old password and new password are required")
    
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")
    
    # Verify old password
    if not bcrypt.checkpw(old_password.encode(), customer['password_hash'].encode()):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    # Hash new password
    password_hash = bcrypt.hashpw(new_password.encode(), bcrypt.gensalt()).decode()
    await db.portal_customers.update_one(
        {'id': customer['id']},
        {'$set': {'password_hash': password_hash, 'updated_at': datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Password changed successfully"}


@router.get("/customer/profile", response_model=CustomerResponse)
async def get_customer_profile(customer: dict = Depends(get_current_customer)):
    """Get current customer profile"""
    transport_name = None
    if customer.get('transport_id'):
        transport = await db.transports.find_one({'id': customer['transport_id']}, {'_id': 0, 'name': 1})
        transport_name = transport.get('name') if transport else None
    
    created_at = customer.get('created_at')
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
    
    approved_at = customer.get('approved_at')
    if approved_at and isinstance(approved_at, str):
        approved_at = datetime.fromisoformat(approved_at.replace('Z', '+00:00'))
    
    return CustomerResponse(
        id=customer['id'],
        customer_code=customer['customer_code'],
        name=customer['name'],
        phone=customer['phone'],
        email=customer.get('email'),
        role=customer['role'],
        status=customer['status'],
        reg_no=customer.get('reg_no'),
        proprietor_name=customer.get('proprietor_name'),
        gst_number=customer.get('gst_number'),
        drug_license=customer.get('drug_license'),
        address_line_1=customer.get('address_line_1'),
        address_line_2=customer.get('address_line_2'),
        state=customer.get('state'),
        district=customer.get('district'),
        pincode=customer.get('pincode'),
        delivery_station=customer.get('delivery_station'),
        transport_id=customer.get('transport_id'),
        transport_name=transport_name,
        created_at=created_at,
        approved_at=approved_at,
        approved_by=customer.get('approved_by')
    )

@router.put("/customer/profile", response_model=CustomerResponse)
async def update_customer_profile(update_data: CustomerProfileUpdate, customer: dict = Depends(get_current_customer)):
    """Update customer profile"""
    update_dict = {k: v for k, v in update_data.model_dump().items() if v is not None}
    update_dict['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.portal_customers.update_one({'id': customer['id']}, {'$set': update_dict})
    
    # Get updated customer
    updated_customer = await db.portal_customers.find_one({'id': customer['id']}, {'_id': 0})
    return await get_customer_profile(updated_customer)

@router.get("/customer/items")
async def get_customer_items(
    main_category: Optional[str] = None,
    subcategory: Optional[str] = None,
    customer: dict = Depends(get_current_customer)
):
    """Get items with role-based pricing for logged-in customer"""
    query = {'out_of_stock': {'$ne': True}, 'is_hidden': {'$ne': True}}
    if main_category:
        query['main_categories'] = main_category
    if subcategory:
        query['subcategories'] = subcategory
    
    items = await db.items.find(query, {'_id': 0, 'image_webp': 0, 'created_by': 0}).sort('item_name', 1).to_list(1000)
    
    role = customer['role']
    result = []
    
    for item in items:
        # Get role-specific pricing
        if role == 'doctor':
            rate = item.get('rate_doctors') or item.get('rate', 0)
            offer = item.get('offer_doctors') or item.get('offer')
            special_offer = item.get('special_offer_doctors') or item.get('special_offer')
        elif role == 'medical':
            rate = item.get('rate_medicals') or item.get('rate', 0)
            offer = item.get('offer_medicals') or item.get('offer')
            special_offer = item.get('special_offer_medicals') or item.get('special_offer')
        else:  # agency
            rate = item.get('rate_agencies') or item.get('rate', 0)
            offer = item.get('offer_agencies') or item.get('offer')
            special_offer = item.get('special_offer_agencies') or item.get('special_offer')
        
        result.append({
            'id': item['id'],
            'item_code': item['item_code'],
            'item_name': item['item_name'],
            'main_categories': item.get('main_categories', []),
            'subcategories': item.get('subcategories', []),
            'composition': item.get('composition'),
            'mrp': item['mrp'],
            'rate': rate,
            'offer': offer,
            'special_offer': special_offer,
            'gst': item.get('gst', 0),
            'image_url': f"/api/items/{item['id']}/image" if item.get('has_image') else None
        })
    
    return result

# Customer price list download
@router.get("/customer/pricelist/pdf")
async def customer_pricelist_pdf(
    main_category: Optional[str] = None,
    customer: dict = Depends(get_current_customer)
):
    """Download role-based price list as PDF for customer"""
    role = customer['role']
    role_labels = {'doctor': 'Doctors', 'medical': 'Medicals', 'agency': 'Agencies'}
    role_label = role_labels.get(role, 'Doctor')
    
    query = {}
    if main_category:
        query['main_categories'] = main_category
    
    items = await db.items.find(query, {'_id': 0, 'image_webp': 0}).sort('item_name', 1).to_list(5000)
    
    order_doc = await db.subcategory_order.find_one({}, {'_id': 0})
    sub_order = order_doc.get('order', DEFAULT_SUBCATEGORY_ORDER) if order_doc else DEFAULT_SUBCATEGORY_ORDER
    
    company = await db.company_settings.find_one({}, {'_id': 0})
    company_name = company.get('company_name', 'VMP CRM') if company else 'VMP CRM'
    
    grouped = {}
    for item in items:
        subs = item.get('subcategories', []) or ['Uncategorized']
        for sub in subs:
            grouped.setdefault(sub, []).append(item)
    
    def sort_key(s):
        try: return sub_order.index(s)
        except ValueError: return len(sub_order)
    sorted_subs = sorted(grouped.keys(), key=sort_key)
    
    pdf = FPDF(orientation='L', format='A4')
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()
    
    pdf.set_font('Helvetica', 'B', 14)
    pdf.cell(0, 10, f"{company_name} - Price List", ln=True, align='C')
    pdf.set_font('Helvetica', '', 10)
    subtitle = f"{main_category or 'All Categories'} | {role_label} Pricing"
    pdf.cell(0, 6, subtitle, ln=True, align='C')
    pdf.ln(3)
    
    col_widths = [10, 22, 55, 85, 18, 22, 35, 35]
    headers = ['S.No', 'Item Code', 'Item Name', 'Composition', 'MRP', 'Rate', 'Offer', 'Special Offer']
    serial = 0
    
    for sub_name in sorted_subs:
        sub_items = grouped[sub_name]
        pdf.set_font('Helvetica', 'B', 9)
        pdf.set_fill_color(41, 128, 185)
        pdf.set_text_color(255, 255, 255)
        pdf.cell(sum(col_widths), 7, f"  {sub_name}", 1, 1, 'L', True)
        
        pdf.set_font('Helvetica', 'B', 8)
        pdf.set_fill_color(52, 73, 94)
        for i, h in enumerate(headers):
            pdf.cell(col_widths[i], 7, h, 1, 0, 'C', True)
        pdf.ln()
        pdf.set_text_color(0, 0, 0)
        
        pdf.set_font('Helvetica', '', 7)
        for item in sub_items:
            serial += 1
            row_h = 6
            pdf.set_fill_color(245, 245, 245) if serial % 2 == 0 else pdf.set_fill_color(255, 255, 255)
            fill = serial % 2 == 0
            
            if role == 'doctor':
                rate = item.get('rate_doctors') or item.get('rate', 0) or 0
                offer = item.get('offer_doctors') or item.get('offer', '') or ''
                sp_offer = item.get('special_offer_doctors') or item.get('special_offer', '') or ''
            elif role == 'medical':
                rate = item.get('rate_medicals') or item.get('rate', 0) or 0
                offer = item.get('offer_medicals') or item.get('offer', '') or ''
                sp_offer = item.get('special_offer_medicals') or item.get('special_offer', '') or ''
            else:
                rate = item.get('rate_agencies') or item.get('rate', 0) or 0
                offer = item.get('offer_agencies') or item.get('offer', '') or ''
                sp_offer = item.get('special_offer_agencies') or item.get('special_offer', '') or ''
            
            pdf.cell(col_widths[0], row_h, str(serial), 1, 0, 'C', fill)
            pdf.cell(col_widths[1], row_h, str(item.get('item_code', ''))[:12], 1, 0, 'C', fill)
            pdf.cell(col_widths[2], row_h, str(item.get('item_name', ''))[:32], 1, 0, 'L', fill)
            pdf.cell(col_widths[3], row_h, str(item.get('composition', '') or '')[:55], 1, 0, 'L', fill)
            pdf.cell(col_widths[4], row_h, f"{item.get('mrp', 0):.0f}", 1, 0, 'R', fill)
            pdf.cell(col_widths[5], row_h, f"{rate:.0f}" if rate else '', 1, 0, 'R', fill)
            pdf.cell(col_widths[6], row_h, str(offer)[:20], 1, 0, 'L', fill)
            pdf.cell(col_widths[7], row_h, str(sp_offer)[:20], 1, 0, 'L', fill)
            pdf.ln()
    
    pdf.set_font('Helvetica', 'I', 8)
    pdf.cell(0, 8, f"Total items: {serial}", ln=True, align='R')
    
    pdf_output = pdf.output()
    filename = f"pricelist_{main_category or 'all'}_{role}.pdf".replace(' ', '_').lower()
    return Response(
        content=bytes(pdf_output),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

# Catalogue settings endpoints
@router.get("/catalogue-settings")
async def get_catalogue_settings():
    """Get catalogue download links"""
    doc = await db.catalogue_settings.find_one({}, {'_id': 0})
    if not doc:
        return {"catalogues": []}
    return {"catalogues": doc.get('catalogues', [])}

@router.put("/catalogue-settings")
async def update_catalogue_settings(data: dict, current_user: dict = Depends(get_current_user)):
    """Update catalogue download links (admin only)"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")
    catalogues = data.get('catalogues', [])
    await db.catalogue_settings.update_one({}, {'$set': {'catalogues': catalogues}}, upsert=True)
    return {"message": "Catalogue settings updated", "catalogues": catalogues}

@router.get("/customer/ledger")
async def get_customer_own_ledger(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    customer: dict = Depends(get_current_customer)
):
    """Get ledger for the logged-in customer (portal)"""
    cust_type = customer.get('role', 'doctor')
    collection = {'doctor': 'doctors', 'medical': 'medicals', 'agency': 'agencies'}.get(cust_type)
    if not collection:
        raise HTTPException(status_code=400, detail="Invalid customer role")
    
    # Find linked entity: by linked_record_id, portal_customer_id, or phone match
    cust_doc = None
    linked_id = customer.get('linked_record_id')
    if linked_id:
        cust_doc = await db[collection].find_one({'id': linked_id}, {'_id': 0, 'image_webp': 0})
    if not cust_doc:
        cust_doc = await db[collection].find_one({'portal_customer_id': customer['id']}, {'_id': 0, 'image_webp': 0})
    if not cust_doc:
        clean_phone = ''.join(filter(str.isdigit, customer.get('phone', '')))[-10:]
        if clean_phone:
            cust_doc = await db[collection].find_one({'phone': {'$regex': clean_phone + '$'}}, {'_id': 0, 'image_webp': 0})
    if not cust_doc:
        raise HTTPException(status_code=404, detail="Customer entity not found")
    
    entity_id = cust_doc['id']
    
    # Update linked_record_id if missing (self-heal)
    if not linked_id:
        await db.portal_customers.update_one({'id': customer['id']}, {'$set': {'linked_record_id': entity_id}})
    
    opening_balance = cust_doc.get('opening_balance', 0) or 0
    
    order_query = {'doctor_id': entity_id}
    if from_date or to_date:
        date_q = {}
        if from_date: date_q['$gte'] = from_date
        if to_date: date_q['$lte'] = to_date + 'T23:59:59'
        order_query['created_at'] = date_q
    
    orders = await db.orders.find(order_query, {'_id': 0, 'items': 0}).sort('created_at', 1).to_list(5000)
    
    pay_query = {'customer_id': entity_id}
    if from_date or to_date:
        date_q = {}
        if from_date: date_q['$gte'] = from_date
        if to_date: date_q['$lte'] = to_date
        pay_query['date'] = date_q
    payments = await db.payments.find(pay_query, {'_id': 0}).sort('date', 1).to_list(5000)
    
    entries = [{'type': 'opening_balance', 'date': '', 'description': 'Opening Balance',
                'debit': opening_balance if opening_balance > 0 else 0,
                'credit': abs(opening_balance) if opening_balance < 0 else 0}]
    
    for order in orders:
        inv_value = order.get('invoice_value')
        if inv_value and float(inv_value) > 0:
            entries.append({'type': 'invoice',
                'date': order.get('invoice_date') or str(order.get('created_at', ''))[:10],
                'description': f"Inv# {order.get('invoice_number', 'N/A')} (Order: {order.get('order_number', '')})",
                'debit': float(inv_value), 'credit': 0})
    
    for pay in payments:
        entries.append({'type': 'payment',
            'date': pay.get('date', ''),
            'description': f"Payment ({pay.get('mode', 'Cash')})",
            'debit': 0, 'credit': float(pay.get('amount', 0))})
    
    entries.sort(key=lambda x: x.get('date', '') or '')
    balance = 0
    for entry in entries:
        balance += entry['debit'] - entry['credit']
        entry['balance'] = balance
    
    return {
        'entries': entries,
        'total_debit': sum(e['debit'] for e in entries),
        'total_credit': sum(e['credit'] for e in entries),
        'closing_balance': balance,
    }

@router.get("/customer/orders")
async def get_customer_orders(customer: dict = Depends(get_current_customer)):
    """Get order history for logged-in customer"""
    # Find orders linked to this customer's phone
    orders = await db.orders.find(
        {'doctor_phone': customer['phone']},
        {'_id': 0}
    ).sort('created_at', -1).to_list(100)
    
    result = []
    for order in orders:
        created_at = order.get('created_at')
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
        
        result.append({
            'id': order['id'],
            'order_number': order['order_number'],
            'items': order.get('items', []),
            'status': order['status'],
            'transport_name': order.get('transport_name'),
            'tracking_number': order.get('tracking_number'),
            'tracking_url': order.get('tracking_url'),
            'delivery_station': order.get('delivery_station'),
            'payment_mode': order.get('payment_mode'),
            'boxes_count': order.get('boxes_count'),
            'cans_count': order.get('cans_count'),
            'bags_count': order.get('bags_count'),
            'invoice_number': order.get('invoice_number'),
            'invoice_date': order.get('invoice_date'),
            'invoice_value': order.get('invoice_value'),
            'notes': order.get('notes'),
            'created_at': created_at
        })
    
    return result

@router.get("/customer/pending-items")
async def get_customer_pending_items(customer: dict = Depends(get_current_customer)):
    """Get pending (out-of-stock) items from previous orders for the logged-in customer"""
    phone = customer.get('phone', '')
    if not phone:
        return []
    pending_items = await db.pending_items.find({'doctor_phone': phone}, {'_id': 0}).sort('created_at', -1).to_list(100)
    result = []
    for item in pending_items:
        created_at = item.get('created_at')
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
        order_date = item.get('original_order_date') or item.get('created_at')
        if isinstance(order_date, str):
            order_date = datetime.fromisoformat(order_date.replace('Z', '+00:00'))
        result.append({
            'id': item['id'],
            'item_id': item['item_id'],
            'item_code': item['item_code'],
            'item_name': item['item_name'],
            'quantity': item['quantity'],
            'original_order_number': item.get('original_order_number', ''),
            'original_order_date': str(order_date) if order_date else '',
        })
    return result



@router.post("/customer/orders")
async def create_customer_order(request: Request, background_tasks: BackgroundTasks, customer: dict = Depends(get_current_customer)):
    """Create a new order from the customer portal cart"""
    body = await request.json()
    items = body.get('items', [])
    notes = body.get('notes', '')
    
    if not items:
        raise HTTPException(status_code=400, detail="Cart is empty")
    
    # Generate order number
    today_str = datetime.now(timezone.utc).strftime('%Y%m%d')
    today_orders = await db.orders.count_documents({
        'order_number': {'$regex': f'^ORD-{today_str}'}
    })
    order_number = f"ORD-{today_str}-{(today_orders + 1):04d}"
    
    order_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    clean_phone = customer.get('phone', '')
    customer_name = customer.get('name', '')
    customer_role = customer.get('role', 'doctor')
    
    # Try to find linked entity
    entity_id = None
    collection_map = {
        'doctor': db.doctors,
        'medical': db.medicals,
        'agency': db.agencies
    }
    collection = collection_map.get(customer_role, db.doctors)
    linked = await collection.find_one({'phone': clean_phone}, {'_id': 0, 'id': 1})
    if linked:
        entity_id = linked['id']
    
    # Build order items
    order_items = []
    for item in items:
        order_items.append({
            'item_id': item.get('item_id', ''),
            'item_code': item.get('item_code', ''),
            'item_name': item.get('item_name', ''),
            'quantity': str(item.get('quantity', '1')),
            'rate': float(item.get('rate', 0)),
            'mrp': float(item.get('rate', 0)),
        })
    
    order_doc = {
        'id': order_id,
        'order_number': order_number,
        'doctor_id': entity_id or customer.get('id', ''),
        'customer_type': customer_role,
        'doctor_name': customer_name,
        'doctor_phone': clean_phone,
        'doctor_email': customer.get('email', ''),
        'doctor_address': customer.get('address', ''),
        'items': order_items,
        'status': 'pending',
        'notes': notes,
        'created_by': customer_name,
        'created_by_id': customer.get('id', ''),
        'source': 'customer_portal',
        'created_at': now.isoformat()
    }
    
    await db.orders.insert_one(order_doc)
    
    # Send WhatsApp confirmation in background
    try:
        order_item_models = [OrderItem(**oi) for oi in order_items]
        background_tasks.add_task(
            send_whatsapp_order,
            clean_phone,
            order_item_models,
            order_number,
            customer_name
        )
    except Exception as e:
        logger.error(f"Failed to queue WhatsApp for customer order: {e}")
    
    # Send email confirmation in background
    try:
        background_tasks.add_task(
            send_order_confirmation_email,
            order_doc,
            order_items
        )
    except Exception as e:
        logger.error(f"Failed to queue email for customer order: {e}")
    
    return {
        "message": "Order placed successfully",
        "order_number": order_number,
        "order_id": order_id
    }

@router.get("/customer/tasks")
async def get_customer_tasks(customer: dict = Depends(get_current_customer)):
    """Get tasks assigned to customer (created by admin/staff for them)"""
    tasks = []
    
    # Strategy 1: Find linked entity by phone
    collection_map = {
        'doctor': ('doctors', 'doctor_id'),
        'medical': ('medicals', 'medical_id'),
        'agency': ('agencies', 'agency_id')
    }
    
    role = customer.get('role', 'doctor')
    coll_name, id_field = collection_map.get(role, ('doctors', 'doctor_id'))
    collection = db[coll_name]
    
    # Try finding by phone first
    linked = await collection.find_one({'phone': customer['phone']}, {'_id': 0, 'id': 1})
    
    # Fallback: try finding by portal_customer_id
    if not linked:
        linked = await collection.find_one({'portal_customer_id': customer['id']}, {'_id': 0, 'id': 1})
    
    if linked:
        tasks = await db.tasks.find({id_field: linked['id']}, {'_id': 0}).sort('created_at', -1).to_list(50)
    
    result = []
    for task in tasks:
        created_at = task.get('created_at')
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
        
        result.append({
            'id': task['id'],
            'title': task['title'],
            'description': task.get('description'),
            'due_date': task.get('due_date'),
            'priority': task.get('priority', 'moderate'),
            'status': task.get('status', 'pending'),
            'created_at': created_at
        })
    
    return result

# Support Ticket Routes for Customers

@router.post("/customer/tickets", response_model=TicketResponse)
async def create_ticket(ticket_data: TicketCreate, customer: dict = Depends(get_current_customer)):
    """Create support ticket"""
    ticket_id = str(uuid.uuid4())
    ticket_number = await generate_ticket_number()
    now = datetime.now(timezone.utc)
    
    # Get order details if linked
    order_number = None
    if ticket_data.order_id:
        order = await db.orders.find_one({'id': ticket_data.order_id}, {'_id': 0, 'order_number': 1})
        order_number = order.get('order_number') if order else None
    
    ticket_doc = {
        'id': ticket_id,
        'ticket_number': ticket_number,
        'customer_id': customer['id'],
        'customer_name': customer['name'],
        'customer_phone': customer['phone'],
        'customer_role': customer['role'],
        'subject': ticket_data.subject,
        'description': ticket_data.description,
        'order_id': ticket_data.order_id,
        'order_number': order_number,
        'priority': ticket_data.priority,
        'status': 'open',
        'replies': [],
        'created_at': now.isoformat(),
        'updated_at': now.isoformat(),
        'resolved_at': None
    }
    
    await db.support_tickets.insert_one(ticket_doc)
    
    return TicketResponse(
        id=ticket_id,
        ticket_number=ticket_number,
        customer_id=customer['id'],
        customer_name=customer['name'],
        customer_phone=customer['phone'],
        customer_role=customer['role'],
        subject=ticket_data.subject,
        description=ticket_data.description,
        order_id=ticket_data.order_id,
        order_number=order_number,
        priority=ticket_data.priority,
        status='open',
        replies=[],
        created_at=now,
        updated_at=now
    )

@router.get("/customer/tickets")
async def get_customer_tickets(customer: dict = Depends(get_current_customer)):
    """Get customer's support tickets"""
    tickets = await db.support_tickets.find(
        {'customer_id': customer['id']},
        {'_id': 0}
    ).sort('created_at', -1).to_list(100)
    
    result = []
    for ticket in tickets:
        created_at = ticket.get('created_at')
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
        
        updated_at = ticket.get('updated_at')
        if isinstance(updated_at, str):
            updated_at = datetime.fromisoformat(updated_at.replace('Z', '+00:00'))
        
        result.append({
            'id': ticket['id'],
            'ticket_number': ticket['ticket_number'],
            'subject': ticket['subject'],
            'description': ticket['description'],
            'order_id': ticket.get('order_id'),
            'order_number': ticket.get('order_number'),
            'priority': ticket['priority'],
            'status': ticket['status'],
            'replies': ticket.get('replies', []),
            'created_at': created_at,
            'updated_at': updated_at
        })
    
    return result

@router.post("/customer/tickets/{ticket_id}/reply")
async def add_customer_ticket_reply(ticket_id: str, reply: TicketReply, customer: dict = Depends(get_current_customer)):
    """Add reply to ticket from customer"""
    ticket = await db.support_tickets.find_one({'id': ticket_id, 'customer_id': customer['id']}, {'_id': 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    now = datetime.now(timezone.utc)
    reply_doc = {
        'id': str(uuid.uuid4()),
        'message': reply.message,
        'sender_type': 'customer',
        'sender_name': customer['name'],
        'created_at': now.isoformat()
    }
    
    await db.support_tickets.update_one(
        {'id': ticket_id},
        {
            '$push': {'replies': reply_doc},
            '$set': {'updated_at': now.isoformat()}
        }
    )
    
    return {"message": "Reply added successfully", "reply": reply_doc}

# Admin routes for customer management

@router.get("/customers")
async def get_all_customers(
    status: Optional[str] = None,
    role: Optional[str] = None,
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all portal customers (admin only)"""
    query = {}
    if status:
        query['status'] = status
    if role:
        query['role'] = role
    if search:
        query['$or'] = [
            {'name': {'$regex': search, '$options': 'i'}},
            {'phone': {'$regex': search, '$options': 'i'}},
            {'customer_code': {'$regex': search, '$options': 'i'}},
            {'email': {'$regex': search, '$options': 'i'}}
        ]
    
    customers = await db.portal_customers.find(query, {'_id': 0, 'password_hash': 0}).sort('created_at', -1).to_list(500)
    
    # Get transport names
    transport_ids = [c.get('transport_id') for c in customers if c.get('transport_id')]
    transport_map = {}
    if transport_ids:
        transports = await db.transports.find({'id': {'$in': transport_ids}}, {'_id': 0, 'id': 1, 'name': 1}).to_list(100)
        transport_map = {t['id']: t['name'] for t in transports}
    
    result = []
    for c in customers:
        created_at = c.get('created_at')
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
        
        result.append({
            **c,
            'transport_name': transport_map.get(c.get('transport_id')),
            'created_at': created_at
        })
    
    return result

@router.put("/customers/{customer_id}/approve")
async def approve_customer(customer_id: str, approval: CustomerApproval, current_user: dict = Depends(get_current_user)):
    """Approve or reject customer registration"""
    customer = await db.portal_customers.find_one({'id': customer_id}, {'_id': 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    now = datetime.now(timezone.utc)
    update_data = {
        'status': approval.status,
        'updated_at': now.isoformat()
    }
    
    if approval.status == 'approved':
        update_data['approved_at'] = now.isoformat()
        update_data['approved_by'] = current_user['name']
        
        # Create record in respective collection (doctors/medicals/agencies)
        linked_record_id = await create_linked_customer_record(customer, current_user['name'])
        if linked_record_id:
            update_data['linked_record_id'] = linked_record_id
            
    elif approval.status == 'rejected':
        update_data['rejection_reason'] = approval.rejection_reason
    
    await db.portal_customers.update_one({'id': customer_id}, {'$set': update_data})
    
    # Send WhatsApp notification using BotMasterSender API
    config = await get_whatsapp_config()
    if config.get('api_url') and config.get('auth_token'):
        try:
            if approval.status == 'approved':
                message = await render_wa_template('account_approved', customer_name=customer['name'], customer_code=customer['customer_code'])
                if not message:
                    message = f"Great news, {customer['name']}!\n\nYour account has been *APPROVED*!\n\nYou can now login to view products and place orders.\n\nCustomer Code: {customer['customer_code']}"
            else:
                reason = approval.rejection_reason or "Please contact support for more details."
                message = await render_wa_template('account_declined', customer_name=customer['name'], reason=reason)
                if not message:
                    message = f"Hello {customer['name']},\n\nUnfortunately, your registration has been declined.\n\nReason: {reason}\n\nPlease contact support for assistance."
            
            # Ensure mobile has 91 prefix for India
            wa_mobile = customer['phone'] if customer['phone'].startswith('91') else f"91{customer['phone'][-10:]}"
            
            response = await send_wa_msg(wa_mobile, message, config=config)
            if response and response.status_code == 200:
                await log_whatsapp_message(wa_mobile, 'account_status', message, 'success', recipient_name=customer['name'])
            else:
                logger.error(f"WhatsApp notification failed: {response.status_code if response else 'no_response'}")
        except Exception as e:
            logger.error(f"WhatsApp notification error: {str(e)}")
    
    # Send email notification for approval/rejection
    if customer.get('email'):
        try:
            if approval.status == 'approved':
                email_body = f"""<p>Dear <strong>{customer['name']}</strong>,</p>
<div style="background:#ecfdf5;padding:16px;border-radius:6px;border-left:4px solid #10b981;margin:16px 0;">
<p style="color:#065f46;font-weight:bold;margin:0;">Your account has been APPROVED!</p></div>
<p>You can now login to view products and place orders.</p>
<p><strong>Customer Code:</strong> {customer['customer_code']}</p>"""
                await send_notification_email(customer['email'], customer['name'], "Account Approved!", email_body, customer_id, 'account_approved')
            else:
                reason = approval.rejection_reason or "Please contact support for more details."
                email_body = f"""<p>Dear <strong>{customer['name']}</strong>,</p>
<div style="background:#fef2f2;padding:16px;border-radius:6px;border-left:4px solid #ef4444;margin:16px 0;">
<p style="color:#991b1b;font-weight:bold;margin:0;">Registration Declined</p></div>
<p><strong>Reason:</strong> {reason}</p>
<p>Please contact support for assistance.</p>"""
                await send_notification_email(customer['email'], customer['name'], "Registration Update", email_body, customer_id, 'account_declined')
        except Exception as e:
            logger.error(f"Account status email error: {e}")

    return {"message": f"Customer {approval.status} successfully"}


@router.put("/customers/{customer_id}")
async def update_portal_customer(customer_id: str, request: Request, current_user: dict = Depends(get_current_user)):
    """Update portal customer details (admin only)"""
    body = await request.json()
    customer = await db.portal_customers.find_one({'id': customer_id}, {'_id': 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    # Fields that can be updated
    allowed_fields = ['name', 'email', 'phone', 'role', 'address', 'address_line_1',
                      'address_line_2', 'state', 'district', 'pincode', 'delivery_station',
                      'transport_id', 'gst_number', 'drug_license', 'proprietor_name']
    update_data = {k: v for k, v in body.items() if k in allowed_fields}

    if not update_data:
        raise HTTPException(status_code=400, detail="No valid fields to update")

    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    await db.portal_customers.update_one({'id': customer_id}, {'$set': update_data})

    # Also update linked record in doctors/medicals/agencies if exists
    linked_id = customer.get('linked_record_id')
    if linked_id:
        for coll_name in ['doctors', 'medicals', 'agencies']:
            result = await db[coll_name].update_one({'id': linked_id}, {'$set': {k: v for k, v in update_data.items() if k in ['name', 'phone', 'email', 'address', 'address_line_1', 'address_line_2', 'state', 'district', 'pincode', 'delivery_station', 'transport_id']}})
            if result.matched_count > 0:
                break

    updated = await db.portal_customers.find_one({'id': customer_id}, {'_id': 0, 'password_hash': 0})
    return updated


@router.delete("/customers/{customer_id}")
async def delete_portal_customer(customer_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a portal customer (admin only)"""
    customer = await db.portal_customers.find_one({'id': customer_id}, {'_id': 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    # Delete the portal customer
    await db.portal_customers.delete_one({'id': customer_id})

    # Also unlink from doctors/medicals/agencies
    linked_id = customer.get('linked_record_id')
    if linked_id:
        for coll_name in ['doctors', 'medicals', 'agencies']:
            await db[coll_name].update_one(
                {'id': linked_id},
                {'$set': {'is_portal_customer': False, 'portal_customer_id': None}}
            )

    return {"message": f"Customer {customer['name']} deleted successfully"}


@router.post("/customers/{customer_id}/send-new-password")
async def send_new_password_to_customer(customer_id: str, current_user: dict = Depends(get_current_user)):
    """Generate and send new password to customer via WhatsApp (admin only)"""
    # Check if it's a portal customer first
    customer = await db.portal_customers.find_one({'id': customer_id}, {'_id': 0})
    customer_type = 'portal'
    
    # If not found in portal_customers, check doctors/medicals/agencies
    if not customer:
        customer = await db.doctors.find_one({'id': customer_id}, {'_id': 0})
        customer_type = 'doctor'
    if not customer:
        customer = await db.medicals.find_one({'id': customer_id}, {'_id': 0})
        customer_type = 'medical'
    if not customer:
        customer = await db.agencies.find_one({'id': customer_id}, {'_id': 0})
        customer_type = 'agency'
    
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    # Generate new random password (8 chars alphanumeric)
    new_password = ''.join(random.choices(string.ascii_letters + string.digits, k=8))
    password_hash = bcrypt.hashpw(new_password.encode(), bcrypt.gensalt()).decode()
    
    phone = customer.get('phone', '')
    clean_phone = ''.join(filter(str.isdigit, phone))
    
    if len(clean_phone) < 10:
        raise HTTPException(status_code=400, detail="Customer has no valid phone number")
    
    # Update password based on customer type
    if customer_type == 'portal':
        await db.portal_customers.update_one(
            {'id': customer_id},
            {'$set': {'password_hash': password_hash, 'password_sent_at': datetime.now(timezone.utc).isoformat()}}
        )
    else:
        # For admin-created customers, we need to create or update portal access
        existing_portal = await db.portal_customers.find_one({'phone': clean_phone}, {'_id': 0})
        if existing_portal:
            # Update existing portal account
            await db.portal_customers.update_one(
                {'phone': clean_phone},
                {'$set': {'password_hash': password_hash, 'password_sent_at': datetime.now(timezone.utc).isoformat()}}
            )
        else:
            # Create new portal account for admin-created customer
            now = datetime.now(timezone.utc)
            role_map = {'doctor': 'doctor', 'medical': 'medical', 'agency': 'agency'}
            portal_customer = {
                'id': str(uuid.uuid4()),
                'customer_code': customer.get('customer_code', await generate_customer_code(role_map.get(customer_type, 'doctor'))),
                'name': customer.get('name', ''),
                'phone': clean_phone,
                'email': customer.get('email'),
                'password_hash': password_hash,
                'role': role_map.get(customer_type, 'doctor'),
                'status': 'approved',  # Auto-approved since created by admin
                'reg_no': customer.get('reg_no'),
                'dob': customer.get('dob'),
                'proprietor_name': customer.get('proprietor_name'),
                'gst_number': customer.get('gst_number'),
                'drug_license': customer.get('drug_license'),
                'alternate_phone': customer.get('alternate_phone'),
                'birthday': customer.get('birthday'),
                'anniversary': customer.get('anniversary'),
                'address_line_1': customer.get('address_line_1'),
                'address_line_2': customer.get('address_line_2'),
                'state': customer.get('state'),
                'district': customer.get('district'),
                'pincode': customer.get('pincode'),
                'delivery_station': customer.get('delivery_station'),
                'transport_id': customer.get('transport_id'),
                'created_at': now.isoformat(),
                'approved_at': now.isoformat(),
                'approved_by': current_user.get('name', 'Admin'),
                'linked_record_id': customer_id,
                'password_sent_at': now.isoformat()
            }
            await db.portal_customers.insert_one(portal_customer)
            logger.info(f"Created portal account for admin customer: {customer.get('name')}")
    
    # Send new password via WhatsApp
    config = await get_whatsapp_config()
    if config.get('api_url') and config.get('auth_token'):
        try:
            rendered = await render_wa_template('password_reset', customer_name=customer.get('name', 'Customer'), new_password=new_password)
            if rendered:
                message = rendered
            else:
                message = f"Hello {customer.get('name', 'Customer')}!\n\n" \
                          f"Your portal login credentials:\n\n" \
                          f"*Phone:* {clean_phone}\n" \
                          f"*Password:* {new_password}\n\n" \
                          f"Login at the customer portal to view products and place orders.\n\n" \
                          f"Please change your password after first login for security."
            
            wa_mobile = clean_phone if clean_phone.startswith('91') else f"91{clean_phone[-10:]}"
            
            response = await send_wa_msg(wa_mobile, message, config=config)
            if response and response.status_code == 200:
                await log_whatsapp_message(wa_mobile, 'password_reset', message, 'success', recipient_name=customer.get('name'))
                return {"message": "New password sent via WhatsApp successfully", "password_sent": True}
            else:
                logger.error(f"WhatsApp password send failed: {response.status_code if response else 'no_response'}")
                return {"message": "Password updated but WhatsApp delivery failed. Please share password manually.", "password": new_password, "password_sent": False}
        except Exception as e:
            logger.error(f"WhatsApp password send error: {str(e)}")
            return {"message": "Password updated but WhatsApp delivery failed. Please share password manually.", "password": new_password, "password_sent": False}
    else:
        # No WhatsApp configured - return password for manual sharing
        return {"message": "Password updated. WhatsApp not configured - please share password manually.", "password": new_password, "password_sent": False}


async def create_linked_customer_record(customer: dict, approved_by: str) -> Optional[str]:
    """Create a record in doctors/medicals/agencies when portal customer is approved"""
    now = datetime.now(timezone.utc)
    role = customer.get('role', '').lower()
    
    # Base record data
    record_id = str(uuid.uuid4())
    base_data = {
        'id': record_id,
        'customer_code': customer['customer_code'],
        'name': customer['name'],
        'phone': customer['phone'],
        'email': customer.get('email') or '',
        'address': customer.get('address') or '',
        'address_line_1': customer.get('address_line_1') or '',
        'address_line_2': customer.get('address_line_2') or '',
        'district': customer.get('district') or '',
        'state': customer.get('state') or '',
        'pincode': customer.get('pincode') or '',
        'delivery_station': customer.get('delivery_station') or '',
        'transport_id': customer.get('transport_id'),
        'lead_status': 'Customer',  # Mark as Customer (converted from portal)
        'is_portal_customer': True,  # Flag to identify portal customers
        'portal_customer_id': customer['id'],  # Link back to portal_customers
        'created_at': now.isoformat(),
        'updated_at': now.isoformat(),
        'created_by': approved_by
    }
    
    try:
        if role == 'doctor':
            # Add doctor-specific fields
            base_data['reg_no'] = customer.get('reg_no') or ''
            base_data['dob'] = customer.get('dob')
            base_data['priority'] = 'moderate'
            await db.doctors.insert_one(base_data)
            logger.info(f"Created doctor record for portal customer: {customer['name']}")
            
        elif role == 'medical':
            # Add medical-specific fields
            base_data['proprietor_name'] = customer.get('proprietor_name') or ''
            base_data['gst_number'] = customer.get('gst_number') or ''
            base_data['drug_license'] = customer.get('drug_license') or ''
            base_data['priority'] = 'moderate'
            await db.medicals.insert_one(base_data)
            logger.info(f"Created medical record for portal customer: {customer['name']}")
            
        elif role == 'agency':
            # Add agency-specific fields
            base_data['proprietor_name'] = customer.get('proprietor_name') or ''
            base_data['gst_number'] = customer.get('gst_number') or ''
            base_data['drug_license'] = customer.get('drug_license') or ''
            base_data['priority'] = 'moderate'
            await db.agencies.insert_one(base_data)
            logger.info(f"Created agency record for portal customer: {customer['name']}")
        else:
            logger.warning(f"Unknown role '{role}' for portal customer: {customer['name']}")
            return None
            
        return record_id
    except Exception as e:
        logger.error(f"Failed to create linked record for portal customer: {str(e)}")
        return None

# Admin routes for support tickets

@router.get("/support/tickets")
async def get_all_tickets(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all support tickets (admin/staff)"""
    query = {}
    if status:
        query['status'] = status
    if priority:
        query['priority'] = priority
    
    tickets = await db.support_tickets.find(query, {'_id': 0}).sort('created_at', -1).to_list(500)
    
    result = []
    for ticket in tickets:
        created_at = ticket.get('created_at')
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
        
        updated_at = ticket.get('updated_at')
        if isinstance(updated_at, str):
            updated_at = datetime.fromisoformat(updated_at.replace('Z', '+00:00'))
        
        result.append({
            **ticket,
            'created_at': created_at,
            'updated_at': updated_at
        })
    
    return result

@router.put("/support/tickets/{ticket_id}/status")
async def update_ticket_status(ticket_id: str, status: str, current_user: dict = Depends(get_current_user)):
    """Update ticket status and notify customer via WhatsApp"""
    if status not in ['open', 'in_progress', 'resolved', 'closed']:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    # Get ticket details first
    ticket = await db.support_tickets.find_one({'id': ticket_id}, {'_id': 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    old_status = ticket.get('status')
    
    now = datetime.now(timezone.utc)
    update_data = {'status': status, 'updated_at': now.isoformat()}
    
    if status == 'resolved':
        update_data['resolved_at'] = now.isoformat()
        update_data['resolved_by'] = current_user['name']
    
    result = await db.support_tickets.update_one({'id': ticket_id}, {'$set': update_data})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    # Send WhatsApp notification if status actually changed
    if old_status != status and ticket.get('customer_phone'):
        config = await get_whatsapp_config()
        if config.get('api_url') and config.get('auth_token'):
            try:
                # Get company name
                company = await db.company_settings.find_one({}, {'_id': 0})
                company_name = company.get('company_name', 'VETMECH PHARMA') if company else 'VETMECH PHARMA'
                
                # Status-specific messages
                ticket_num = ticket.get('ticket_number', ticket_id[:8])
                customer_name = ticket.get('customer_name', 'Customer')
                
                status_messages = {
                    'open': f"Dear {customer_name},\n\nYour support ticket #{ticket_num} has been *REOPENED*.\n\nSubject: {ticket.get('subject')}\n\nOur team will look into your issue shortly.\n\nRegards,\n{company_name}",
                    
                    'in_progress': f"Dear {customer_name},\n\nGood news! Your support ticket #{ticket_num} is now *IN PROGRESS*.\n\nSubject: {ticket.get('subject')}\n\nOur team is actively working on resolving your issue. We'll update you soon.\n\nRegards,\n{company_name}",
                    
                    'resolved': f"Dear {customer_name},\n\nGreat news! Your support ticket #{ticket_num} has been *RESOLVED*.\n\nSubject: {ticket.get('subject')}\n\nWe hope this resolves your concern. If you have any further questions, please don't hesitate to reach out.\n\nThank you for your patience!\n\nRegards,\n{company_name}",
                    
                    'closed': f"Dear {customer_name},\n\nYour support ticket #{ticket_num} has been *CLOSED*.\n\nSubject: {ticket.get('subject')}\n\nIf you need any further assistance, please create a new ticket or contact us directly.\n\nThank you for choosing {company_name}!\n\nRegards,\n{company_name}"
                }
                
                message = status_messages.get(status, f"Your ticket #{ticket_num} status has been updated to: {status.upper()}")
                
                # Send WhatsApp
                wa_mobile = ticket['customer_phone'] if ticket['customer_phone'].startswith('91') else f"91{ticket['customer_phone'][-10:]}"
                
                response = await send_wa_msg(wa_mobile, message, config=config)
                if response and response.status_code == 200:
                    await log_whatsapp_message(wa_mobile, 'ticket_status', message, 'success', recipient_name=customer_name)
                    logger.info(f"Ticket status notification sent to {wa_mobile}")
                else:
                    logger.error(f"WhatsApp notification failed: {response.status_code if response else 'no_response'}")
                        
            except Exception as e:
                logger.error(f"WhatsApp notification error: {str(e)}")
    
    # Send email notification for ticket status change
    if old_status != status and ticket.get('customer_email'):
        try:
            ticket_num = ticket.get('ticket_number', ticket_id[:8])
            customer_name = ticket.get('customer_name', 'Customer')
            status_colors = {'open': '#3b82f6', 'in_progress': '#f59e0b', 'resolved': '#10b981', 'closed': '#6b7280'}
            color = status_colors.get(status, '#6b7280')
            email_body = f"""<p>Dear <strong>{customer_name}</strong>,</p>
<div style="background:#f8fafc;padding:16px;border-radius:6px;border-left:4px solid {color};margin:16px 0;">
<p style="margin:0;"><strong>Ticket #{ticket_num}</strong> - <span style="color:{color};font-weight:bold;">{status.upper().replace('_', ' ')}</span></p>
<p style="margin:8px 0 0 0;color:#666;">Subject: {ticket.get('subject', '')}</p></div>"""
            await send_notification_email(ticket['customer_email'], customer_name, f"Ticket #{ticket_num} - {status.upper().replace('_', ' ')}", email_body, None, 'ticket_status')
        except Exception as e:
            logger.error(f"Ticket status email error: {e}")

    return {"message": "Ticket status updated"}

@router.post("/support/tickets/{ticket_id}/reply")
async def add_admin_ticket_reply(ticket_id: str, reply: TicketReply, current_user: dict = Depends(get_current_user)):
    """Add reply to ticket from admin/staff"""
    ticket = await db.support_tickets.find_one({'id': ticket_id}, {'_id': 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    now = datetime.now(timezone.utc)
    reply_doc = {
        'id': str(uuid.uuid4()),
        'message': reply.message,
        'sender_type': 'admin',
        'sender_name': current_user['name'],
        'created_at': now.isoformat()
    }
    
    await db.support_tickets.update_one(
        {'id': ticket_id},
        {
            '$push': {'replies': reply_doc},
            '$set': {'updated_at': now.isoformat(), 'status': 'in_progress'}
        }
    )
    
    # Notify customer via WhatsApp using BotMasterSender API
    config = await get_whatsapp_config()
    if config.get('api_url') and config.get('auth_token'):
        try:
            # Get company name
            company = await db.company_settings.find_one({}, {'_id': 0})
            company_name = company.get('company_name', 'VETMECH PHARMA') if company else 'VETMECH PHARMA'
            
            customer_name = ticket.get('customer_name', 'Customer')
            ticket_num = ticket.get('ticket_number', ticket_id[:8])
            
            message = f"Dear {customer_name},\n\nYou have received a new reply on your support ticket #{ticket_num}:\n\n\"{reply.message[:300]}{'...' if len(reply.message) > 300 else ''}\"\n\n- {current_user['name']}\n\nRegards,\n{company_name}"
            
            # Ensure mobile has 91 prefix for India
            wa_mobile = ticket['customer_phone'] if ticket['customer_phone'].startswith('91') else f"91{ticket['customer_phone'][-10:]}"
            
            response = await send_wa_msg(wa_mobile, message, config=config)
            if response and response.status_code == 200:
                await log_whatsapp_message(wa_mobile, 'ticket_reply', message, 'success', recipient_name=customer_name)
                logger.info(f"Ticket reply notification sent to {wa_mobile}")
        except Exception as e:
            logger.error(f"WhatsApp notification error: {str(e)}")
    
    # Send email notification for ticket reply
    if ticket.get('customer_email'):
        try:
            ticket_num = ticket.get('ticket_number', ticket_id[:8])
            customer_name = ticket.get('customer_name', 'Customer')
            email_body = f"""<p>Dear <strong>{customer_name}</strong>,</p>
<p>You have a new reply on your support ticket <strong>#{ticket_num}</strong>:</p>
<div style="background:#f8fafc;padding:16px;border-radius:6px;border-left:4px solid #3b82f6;margin:16px 0;">
<p style="margin:0;white-space:pre-line;">{reply.message[:500]}</p>
<p style="margin:8px 0 0 0;color:#666;font-size:12px;">- {current_user['name']}</p></div>"""
            await send_notification_email(ticket['customer_email'], customer_name, f"New Reply - Ticket #{ticket_num}", email_body, None, 'ticket_reply')
        except Exception as e:
            logger.error(f"Ticket reply email error: {e}")

    return {"message": "Reply added successfully", "reply": reply_doc}

# Admin ticket creation model
class AdminTicketCreate(BaseModel):
    subject: str
    description: str
    category: str = "general"
    priority: str = "medium"
    customer_name: str
    customer_phone: str
    customer_email: Optional[str] = None

class TicketUpdate(BaseModel):
    subject: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    priority: Optional[str] = None

@router.post("/support/tickets/admin")
async def create_admin_ticket(ticket_data: AdminTicketCreate, current_user: dict = Depends(get_current_user)):
    """Create a support ticket from admin panel (for walk-in/phone customers)"""
    now = datetime.now(timezone.utc)
    
    # Generate ticket number
    count = await db.support_tickets.count_documents({})
    ticket_number = f"TKT-{count + 1:05d}"
    
    ticket_doc = {
        'id': str(uuid.uuid4()),
        'ticket_number': ticket_number,
        'subject': ticket_data.subject,
        'description': ticket_data.description,
        'category': ticket_data.category,
        'priority': ticket_data.priority,
        'status': 'open',
        'customer_id': None,  # No portal customer linked
        'customer_name': ticket_data.customer_name,
        'customer_phone': ticket_data.customer_phone,
        'customer_email': ticket_data.customer_email,
        'replies': [],
        'created_at': now.isoformat(),
        'updated_at': now.isoformat(),
        'created_by': current_user['name']
    }
    
    await db.support_tickets.insert_one(ticket_doc)
    del ticket_doc['_id']
    return ticket_doc

@router.put("/support/tickets/{ticket_id}")
async def update_ticket(ticket_id: str, ticket_data: TicketUpdate, current_user: dict = Depends(get_current_user)):
    """Update ticket details"""
    update_fields = {'updated_at': datetime.now(timezone.utc).isoformat()}
    
    if ticket_data.subject:
        update_fields['subject'] = ticket_data.subject
    if ticket_data.description:
        update_fields['description'] = ticket_data.description
    if ticket_data.category:
        update_fields['category'] = ticket_data.category
    if ticket_data.priority:
        update_fields['priority'] = ticket_data.priority
    
    result = await db.support_tickets.update_one(
        {'id': ticket_id},
        {'$set': update_fields}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    return {"message": "Ticket updated successfully"}

@router.delete("/support/tickets/{ticket_id}")
async def delete_ticket(ticket_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a support ticket"""
    result = await db.support_tickets.delete_one({'id': ticket_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    return {"message": "Ticket deleted successfully"}


