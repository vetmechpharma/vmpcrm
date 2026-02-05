from fastapi import FastAPI, APIRouter, HTTPException, Depends, BackgroundTasks, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import base64
from io import BytesIO
from PIL import Image
import random
import httpx
import asyncio
from contextlib import asynccontextmanager

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Settings
JWT_SECRET = os.environ.get('JWT_SECRET', 'vmp-crm-secret-key-2024')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = 24

# Create the main app
app = FastAPI(title="VMP CRM API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Global variable for background task
daily_reminder_task = None

async def send_daily_reminder_summary():
    """Background task to send daily reminder summary to admin via WhatsApp"""
    while True:
        try:
            # Calculate time until next 8 AM
            now = datetime.now(timezone.utc)
            # For IST (UTC+5:30), 8 AM IST = 2:30 AM UTC
            target_hour = 2  # 2 AM UTC = ~7:30 AM IST
            target_minute = 30
            
            next_run = now.replace(hour=target_hour, minute=target_minute, second=0, microsecond=0)
            if now >= next_run:
                # Already past today's run time, schedule for tomorrow
                next_run += timedelta(days=1)
            
            wait_seconds = (next_run - now).total_seconds()
            logger.info(f"Daily reminder task scheduled. Next run in {wait_seconds/3600:.1f} hours")
            
            await asyncio.sleep(wait_seconds)
            
            # Execute reminder summary send
            logger.info("Executing daily reminder summary...")
            
            # Get WhatsApp config
            wa_config = await db.whatsapp_config.find_one({}, {'_id': 0})
            if not wa_config:
                logger.warning("WhatsApp not configured, skipping daily reminder")
                continue
            
            # Get company settings for admin number
            company = await db.company_settings.find_one({}, {'_id': 0})
            admin_phone = company.get('phone') if company else None
            
            if not admin_phone:
                logger.warning("Admin phone not configured, skipping daily reminder")
                continue
            
            # Get today's date for reminders
            today = datetime.now(timezone.utc).date()
            today_str = today.strftime('%Y-%m-%d')
            
            # Get today's reminders count
            reminders = []
            
            # Manual reminders for today
            manual_count = await db.reminders.count_documents({
                'reminder_date': today_str,
                'is_completed': {'$ne': True}
            })
            
            # Get birthday/anniversary counts
            month_day = today.strftime('%m-%d')
            
            # Doctors with birthdays/follow-ups
            doctors = await db.doctors.find({
                'lead_status': {'$nin': ['Not Interested', 'Closed']}
            }, {'_id': 0, 'name': 1, 'dob': 1, 'follow_up_date': 1, 'last_contact_date': 1}).to_list(1000)
            
            birthday_count = 0
            followup_count = 0
            for doc in doctors:
                if doc.get('dob') and doc['dob'][5:] == month_day:
                    birthday_count += 1
                if doc.get('follow_up_date') and doc['follow_up_date'] <= today_str:
                    followup_count += 1
            
            # Medicals and Agencies birthdays/anniversaries
            medicals = await db.medicals.find({}, {'_id': 0, 'name': 1, 'birthday': 1, 'anniversary': 1, 'follow_up_date': 1}).to_list(1000)
            agencies = await db.agencies.find({}, {'_id': 0, 'name': 1, 'birthday': 1, 'anniversary': 1, 'follow_up_date': 1}).to_list(1000)
            
            anniversary_count = 0
            for entity in medicals + agencies:
                if entity.get('birthday') and entity['birthday'][5:] == month_day:
                    birthday_count += 1
                if entity.get('anniversary') and entity['anniversary'][5:] == month_day:
                    anniversary_count += 1
                if entity.get('follow_up_date') and entity['follow_up_date'] <= today_str:
                    followup_count += 1
            
            total_count = manual_count + birthday_count + anniversary_count + followup_count
            
            if total_count == 0:
                logger.info("No reminders today, skipping notification")
                continue
            
            # Build message
            message_lines = [
                f"🌅 *Good Morning!*",
                f"📅 *Today's Reminders ({today_str})*",
                f"Total: {total_count} reminder(s)",
                ""
            ]
            
            if followup_count > 0:
                message_lines.append(f"📞 Follow-ups: {followup_count}")
            if birthday_count > 0:
                message_lines.append(f"🎂 Birthdays: {birthday_count}")
            if anniversary_count > 0:
                message_lines.append(f"🎉 Anniversaries: {anniversary_count}")
            if manual_count > 0:
                message_lines.append(f"📝 Custom: {manual_count}")
            
            message_lines.append("")
            message_lines.append("Login to CRM to view details.")
            
            message = "\n".join(message_lines)
            
            # Send WhatsApp
            try:
                async with httpx.AsyncClient() as http_client:
                    params = {
                        'action': 'send',
                        'senderId': wa_config['sender_id'],
                        'authToken': wa_config['auth_token'],
                        'messageText': message,
                        'receiverId': admin_phone
                    }
                    response = await http_client.get(wa_config['api_url'], params=params, timeout=30)
                    
                    if response.status_code == 200:
                        logger.info(f"Daily reminder sent to admin: {admin_phone}")
                    else:
                        logger.error(f"Failed to send daily reminder: {response.text}")
            except Exception as e:
                logger.error(f"Error sending daily reminder: {str(e)}")
            
        except asyncio.CancelledError:
            logger.info("Daily reminder task cancelled")
            break
        except Exception as e:
            logger.error(f"Error in daily reminder task: {str(e)}")
            # Wait 1 hour before retrying on error
            await asyncio.sleep(3600)

# ============== MODELS ==============

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = "staff"  # admin or staff

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str
    permissions: Optional[dict] = None
    created_at: datetime

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class DoctorCreate(BaseModel):
    name: str
    reg_no: str
    address: str
    email: EmailStr
    phone: str
    lead_status: str = "Pipeline"
    dob: Optional[str] = None

class DoctorUpdate(BaseModel):
    name: Optional[str] = None
    reg_no: Optional[str] = None
    address: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    lead_status: Optional[str] = None
    dob: Optional[str] = None
    priority: Optional[str] = None  # low, moderate, high
    last_contact_date: Optional[str] = None
    follow_up_date: Optional[str] = None

class DoctorResponse(BaseModel):
    id: str
    customer_code: str
    name: str
    reg_no: str
    address: str
    email: str
    phone: str
    lead_status: str
    dob: Optional[str] = None
    priority: Optional[str] = None
    last_contact_date: Optional[str] = None
    follow_up_date: Optional[str] = None
    created_at: datetime
    updated_at: datetime

class DoctorNoteCreate(BaseModel):
    note: str

class DoctorNoteResponse(BaseModel):
    id: str
    doctor_id: str
    note: str
    created_by: str
    created_at: datetime

# ============== MEDICAL MODELS ==============

class MedicalCreate(BaseModel):
    name: str
    proprietor_name: Optional[str] = None
    gst_number: Optional[str] = None
    drug_license: Optional[str] = None
    address: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    pincode: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: str
    alternate_phone: Optional[str] = None
    lead_status: str = "Pipeline"
    birthday: Optional[str] = None  # Format: YYYY-MM-DD
    anniversary: Optional[str] = None  # Format: YYYY-MM-DD

class MedicalUpdate(BaseModel):
    name: Optional[str] = None
    proprietor_name: Optional[str] = None
    gst_number: Optional[str] = None
    drug_license: Optional[str] = None
    address: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    pincode: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    alternate_phone: Optional[str] = None
    lead_status: Optional[str] = None
    priority: Optional[str] = None
    last_contact_date: Optional[str] = None
    follow_up_date: Optional[str] = None
    birthday: Optional[str] = None
    anniversary: Optional[str] = None

class MedicalResponse(BaseModel):
    id: str
    customer_code: str
    name: str
    proprietor_name: Optional[str] = None
    gst_number: Optional[str] = None
    drug_license: Optional[str] = None
    address: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    pincode: Optional[str] = None
    email: Optional[str] = None
    phone: str
    alternate_phone: Optional[str] = None
    lead_status: str
    priority: Optional[str] = None
    last_contact_date: Optional[str] = None
    follow_up_date: Optional[str] = None
    birthday: Optional[str] = None
    anniversary: Optional[str] = None
    created_at: datetime
    updated_at: datetime

class MedicalNoteCreate(BaseModel):
    note: str

class MedicalNoteResponse(BaseModel):
    id: str
    medical_id: str
    note: str
    created_by: str
    created_at: datetime

# ============== AGENCY MODELS ==============

class AgencyCreate(BaseModel):
    name: str
    proprietor_name: Optional[str] = None
    gst_number: Optional[str] = None
    drug_license: Optional[str] = None
    address: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    pincode: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: str
    alternate_phone: Optional[str] = None
    lead_status: str = "Pipeline"
    birthday: Optional[str] = None
    anniversary: Optional[str] = None

class AgencyUpdate(BaseModel):
    name: Optional[str] = None
    proprietor_name: Optional[str] = None
    gst_number: Optional[str] = None
    drug_license: Optional[str] = None
    address: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    pincode: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    alternate_phone: Optional[str] = None
    lead_status: Optional[str] = None
    priority: Optional[str] = None
    last_contact_date: Optional[str] = None
    follow_up_date: Optional[str] = None
    birthday: Optional[str] = None
    anniversary: Optional[str] = None

class AgencyResponse(BaseModel):
    id: str
    customer_code: str
    name: str
    proprietor_name: Optional[str] = None
    gst_number: Optional[str] = None
    drug_license: Optional[str] = None
    address: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    pincode: Optional[str] = None
    email: Optional[str] = None
    phone: str
    alternate_phone: Optional[str] = None
    lead_status: str
    priority: Optional[str] = None
    last_contact_date: Optional[str] = None
    follow_up_date: Optional[str] = None
    birthday: Optional[str] = None
    anniversary: Optional[str] = None
    created_at: datetime
    updated_at: datetime

class AgencyNoteCreate(BaseModel):
    note: str

class AgencyNoteResponse(BaseModel):
    id: str
    agency_id: str
    note: str
    created_by: str
    created_at: datetime

# ============== TASK MODELS ==============

class TaskCreate(BaseModel):
    doctor_id: Optional[str] = None
    medical_id: Optional[str] = None
    agency_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    due_date: Optional[str] = None
    priority: Optional[str] = "moderate"  # low, moderate, high

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    due_date: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None  # pending, completed

class TaskResponse(BaseModel):
    id: str
    doctor_id: str
    doctor_name: Optional[str] = None
    title: str
    description: Optional[str] = None
    due_date: Optional[str] = None
    priority: str
    status: str
    created_at: datetime

class SMTPConfigCreate(BaseModel):
    smtp_server: str
    smtp_port: int
    smtp_username: str
    smtp_password: str
    from_email: EmailStr
    from_name: str = "VMP CRM"

class SMTPConfigResponse(BaseModel):
    id: str
    smtp_server: str
    smtp_port: int
    smtp_username: str
    from_email: str
    from_name: str
    created_at: datetime
    updated_at: datetime

class SendEmailRequest(BaseModel):
    doctor_id: str
    subject: str
    body: str
    is_html: bool = False

class EmailLogResponse(BaseModel):
    id: str
    doctor_id: str
    doctor_name: str
    doctor_email: str
    subject: str
    status: str
    sent_at: Optional[datetime] = None
    error_message: Optional[str] = None

class DashboardStats(BaseModel):
    total_doctors: int
    by_status: dict
    recent_emails: int
    recent_doctors: List[DoctorResponse]

# ============== ITEM MODELS ==============

class CustomField(BaseModel):
    field_name: str
    field_value: str

class ItemCreate(BaseModel):
    item_name: str
    item_code: Optional[str] = None  # Custom item code, auto-generated if not provided
    main_categories: Optional[List[str]] = []  # Main categories: Large Animals, Poultry, Pets (multiple)
    subcategories: Optional[List[str]] = []  # Subcategories: Injection, Liquids, Bolus, Powder
    composition: Optional[str] = None
    offer: Optional[str] = None
    special_offer: Optional[str] = None  # e.g., "Buy 20 pcs at Rs.50/-"
    mrp: float
    rate: float
    gst: float = 0
    custom_fields: Optional[List[CustomField]] = []
    image_base64: Optional[str] = None  # Base64 encoded image

class ItemUpdate(BaseModel):
    item_name: Optional[str] = None
    item_code: Optional[str] = None
    main_categories: Optional[List[str]] = None
    subcategories: Optional[List[str]] = None
    composition: Optional[str] = None
    offer: Optional[str] = None
    special_offer: Optional[str] = None
    mrp: Optional[float] = None
    rate: Optional[float] = None
    gst: Optional[float] = None
    custom_fields: Optional[List[CustomField]] = None
    image_base64: Optional[str] = None

class ItemResponse(BaseModel):
    id: str
    item_code: str
    item_name: str
    main_categories: List[str] = []
    subcategories: List[str] = []
    composition: Optional[str] = None
    offer: Optional[str] = None
    special_offer: Optional[str] = None
    mrp: float
    rate: float
    gst: float
    custom_fields: List[CustomField] = []
    image_url: Optional[str] = None
    created_at: datetime

class CategoryResponse(BaseModel):
    name: str
    count: int

# ============== COMPANY SETTINGS MODELS ==============

class CompanySettingsCreate(BaseModel):
    company_name: str
    address: str
    email: EmailStr
    phone: Optional[str] = None
    gst_number: str
    drug_license: str
    logo_base64: Optional[str] = None
    terms_conditions: Optional[str] = None
    # Login page customization
    login_tagline: Optional[str] = None  # Custom tagline for login page
    login_background_color: Optional[str] = None  # Hex color for background
    login_background_image: Optional[str] = None  # Base64 image for background

class CompanySettingsResponse(BaseModel):
    id: str
    company_name: str
    address: str
    email: str
    phone: Optional[str] = None
    gst_number: str
    drug_license: str
    logo_url: Optional[str] = None
    terms_conditions: Optional[str] = None
    login_tagline: Optional[str] = None
    login_background_color: Optional[str] = None
    login_background_image_url: Optional[str] = None
    updated_at: datetime

# ============== WHATSAPP LOG MODELS ==============

class WhatsAppLogResponse(BaseModel):
    id: str
    recipient_phone: str
    recipient_name: Optional[str] = None
    message_type: str  # otp, order_confirmation, status_update, reminder, stock_arrived, etc.
    message_preview: str
    status: str  # success, failed
    error_message: Optional[str] = None
    created_at: datetime

# ============== USER MANAGEMENT MODELS ==============

class UserPermissions(BaseModel):
    doctors: bool = True
    medicals: bool = True
    agencies: bool = True
    items: bool = True
    orders: bool = True
    expenses: bool = True
    reminders: bool = True
    pending_items: bool = True
    email_logs: bool = False
    whatsapp_logs: bool = False
    users: bool = False
    smtp_settings: bool = False
    company_settings: bool = False
    whatsapp_settings: bool = False

class UserCreateByAdmin(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = "staff"
    permissions: Optional[UserPermissions] = None

class UserUpdateByAdmin(BaseModel):
    email: Optional[EmailStr] = None
    name: Optional[str] = None
    role: Optional[str] = None
    password: Optional[str] = None
    permissions: Optional[UserPermissions] = None

class UserWithPermissions(BaseModel):
    id: str
    email: str
    name: str
    role: str
    permissions: Optional[dict] = None
    created_at: datetime

# ============== ORDER MODELS ==============

class OrderItem(BaseModel):
    item_id: str
    item_code: str
    item_name: str
    quantity: str  # Can be "10" or "10+2" format
    mrp: float
    rate: float

class OrderCreate(BaseModel):
    mobile: str
    items: List[OrderItem]
    terms_accepted: bool = True

class OTPRequest(BaseModel):
    mobile: str

class OTPVerify(BaseModel):
    mobile: str
    otp: str
    items: List[OrderItem]
    doctor_info: Optional[dict] = None
    ip_address: Optional[str] = None
    location: Optional[str] = None
    device_info: Optional[str] = None

class OrderResponse(BaseModel):
    id: str
    order_number: str
    doctor_id: Optional[str] = None
    doctor_name: Optional[str] = None
    doctor_phone: str
    doctor_email: Optional[str] = None
    doctor_address: Optional[str] = None
    items: List[OrderItem]
    status: str
    transport_id: Optional[str] = None
    transport_name: Optional[str] = None
    tracking_number: Optional[str] = None
    tracking_url: Optional[str] = None
    delivery_station: Optional[str] = None
    payment_mode: Optional[str] = None
    # Shipping package details
    boxes_count: Optional[int] = None
    cans_count: Optional[int] = None
    bags_count: Optional[int] = None
    # Invoice details
    invoice_number: Optional[str] = None
    invoice_date: Optional[str] = None
    invoice_value: Optional[float] = None
    # Cancellation
    cancellation_reason: Optional[str] = None
    ip_address: Optional[str] = None
    location: Optional[str] = None
    device_info: Optional[str] = None
    created_at: datetime

# ============== WHATSAPP CONFIG MODELS ==============

class WhatsAppConfigCreate(BaseModel):
    api_url: str
    auth_token: str
    sender_id: str

class WhatsAppConfigResponse(BaseModel):
    id: str
    api_url: str
    sender_id: str
    updated_at: datetime

# ============== TRANSPORT MODELS ==============

class TransportCreate(BaseModel):
    name: str
    tracking_url_template: Optional[str] = None  # Transport website URL
    is_local: bool = False  # Local supply - no tracking needed
    contact_number: Optional[str] = None  # Transport incharge contact number
    alternate_number: Optional[str] = None  # Alternate contact number

class TransportResponse(BaseModel):
    id: str
    name: str
    tracking_url_template: Optional[str] = None
    is_local: bool
    contact_number: Optional[str] = None
    alternate_number: Optional[str] = None
    created_at: datetime

class OrderStatusUpdate(BaseModel):
    status: str
    # Transport details (only for shipped status)
    transport_id: Optional[str] = None
    transport_name: Optional[str] = None
    tracking_number: Optional[str] = None
    tracking_url: Optional[str] = None
    delivery_station: Optional[str] = None
    payment_mode: Optional[str] = None  # "to_pay" or "paid"
    # Package counts (only for shipped status)
    boxes_count: Optional[int] = None
    cans_count: Optional[int] = None
    bags_count: Optional[int] = None
    # Invoice details (only for shipped status)
    invoice_number: Optional[str] = None
    invoice_date: Optional[str] = None
    invoice_value: Optional[float] = None
    # Cancellation reason (only for cancelled status)
    cancellation_reason: Optional[str] = None

# ============== PENDING ITEMS MODELS ==============

class PendingItemCreate(BaseModel):
    doctor_phone: str
    doctor_name: Optional[str] = None
    item_id: str
    item_code: str
    item_name: str
    quantity: str
    original_order_id: str
    original_order_number: str

class PendingItemResponse(BaseModel):
    id: str
    doctor_phone: str
    doctor_name: Optional[str] = None
    item_id: str
    item_code: str
    item_name: str
    quantity: str
    original_order_id: str
    original_order_number: str
    original_order_date: datetime
    created_at: datetime

class OrderItemsUpdate(BaseModel):
    items: List[OrderItem]
    pending_items: Optional[List[dict]] = None  # Items to mark as pending

class OrderCustomerUpdate(BaseModel):
    doctor_name: Optional[str] = None
    doctor_email: Optional[str] = None
    doctor_address: Optional[str] = None
    doctor_phone: Optional[str] = None
    link_to_doctor: Optional[bool] = False  # If true, link/create doctor record

# ============== EXPENSE MODELS ==============

class ExpenseCategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None

class ExpenseCategoryResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    is_default: bool = False
    created_at: datetime

class ExpenseCreate(BaseModel):
    category_id: str
    date: str
    amount: float
    payment_type: str  # cash, card, upi, net_banking
    payment_account: str  # company_account, admin_user, employee_user
    paid_by: Optional[str] = None  # Name of person who paid
    reason: str
    # For transport expenses
    transport_id: Optional[str] = None
    transport_name: Optional[str] = None
    transport_location: Optional[str] = None
    order_id: Optional[str] = None
    order_number: Optional[str] = None

class ExpenseUpdate(BaseModel):
    category_id: Optional[str] = None
    date: Optional[str] = None
    amount: Optional[float] = None
    payment_type: Optional[str] = None
    payment_account: Optional[str] = None
    paid_by: Optional[str] = None
    reason: Optional[str] = None

class ExpenseResponse(BaseModel):
    id: str
    category_id: str
    category_name: Optional[str] = None
    date: str
    amount: float
    payment_type: str
    payment_account: str
    paid_by: Optional[str] = None
    reason: str
    transport_id: Optional[str] = None
    transport_name: Optional[str] = None
    transport_location: Optional[str] = None
    order_id: Optional[str] = None
    order_number: Optional[str] = None
    is_auto_generated: bool = False
    created_at: datetime
    updated_at: datetime

# ============== REMINDER MODELS ==============

class ReminderCreate(BaseModel):
    title: str
    description: Optional[str] = None
    reminder_type: str  # follow_up, birthday, anniversary, custom
    reminder_date: str  # YYYY-MM-DD
    reminder_time: Optional[str] = None  # HH:MM
    entity_type: Optional[str] = None  # doctor, medical, agency
    entity_id: Optional[str] = None
    entity_name: Optional[str] = None
    priority: str = "moderate"  # low, moderate, high

class ReminderUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    reminder_type: Optional[str] = None
    reminder_date: Optional[str] = None
    reminder_time: Optional[str] = None
    priority: Optional[str] = None
    is_completed: Optional[bool] = None

class ReminderResponse(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    reminder_type: str
    reminder_date: str
    reminder_time: Optional[str] = None
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    entity_name: Optional[str] = None
    priority: str
    is_completed: bool = False
    is_auto_generated: bool = False
    created_at: datetime

# ============== AUTH HELPERS ==============

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, email: str, role: str) -> str:
    payload = {
        'user_id': user_id,
        'email': email,
        'role': role,
        'exp': datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({'id': payload['user_id']}, {'_id': 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ============== CUSTOMER CODE GENERATOR ==============

async def generate_customer_code() -> str:
    last_doctor = await db.doctors.find_one(
        {},
        {'customer_code': 1},
        sort=[('customer_code', -1)]
    )
    if last_doctor and 'customer_code' in last_doctor:
        last_num = int(last_doctor['customer_code'].replace('VMP-', ''))
        new_num = last_num + 1
    else:
        new_num = 1
    return f"VMP-{str(new_num).zfill(4)}"

async def generate_medical_code() -> str:
    last_medical = await db.medicals.find_one(
        {'customer_code': {'$regex': '^MED-'}},
        {'customer_code': 1},
        sort=[('customer_code', -1)]
    )
    if last_medical and 'customer_code' in last_medical:
        try:
            last_num = int(last_medical['customer_code'].replace('MED-', ''))
            new_num = last_num + 1
        except ValueError:
            new_num = 1
    else:
        new_num = 1
    return f"MED-{str(new_num).zfill(4)}"

async def generate_agency_code() -> str:
    last_agency = await db.agencies.find_one(
        {'customer_code': {'$regex': '^AGY-'}},
        {'customer_code': 1},
        sort=[('customer_code', -1)]
    )
    if last_agency and 'customer_code' in last_agency:
        try:
            last_num = int(last_agency['customer_code'].replace('AGY-', ''))
            new_num = last_num + 1
        except ValueError:
            new_num = 1
    else:
        new_num = 1
    return f"AGY-{str(new_num).zfill(4)}"

async def generate_item_code() -> str:
    last_item = await db.items.find_one(
        {},
        {'item_code': 1},
        sort=[('item_code', -1)]
    )
    if last_item and 'item_code' in last_item:
        # Try to extract number from existing code
        code = last_item['item_code']
        if code.startswith('ITM-'):
            try:
                last_num = int(code.replace('ITM-', ''))
                new_num = last_num + 1
                return f"ITM-{str(new_num).zfill(4)}"
            except ValueError:
                pass
    return "ITM-0001"

def process_image_to_webp(image_data: bytes, max_size_kb: int = 25, target_size: tuple = (100, 100)) -> str:
    """
    Process image: resize to 100x100, convert to WebP, compress to under 25KB
    Returns base64 encoded WebP image
    """
    try:
        # Open image
        img = Image.open(BytesIO(image_data))
        
        # Convert to RGB if necessary (for PNG with transparency)
        if img.mode in ('RGBA', 'P'):
            img = img.convert('RGB')
        
        # Resize to target size (100x100) maintaining aspect ratio and crop
        img.thumbnail(target_size, Image.Resampling.LANCZOS)
        
        # Create a new image with exact target size and paste resized image centered
        new_img = Image.new('RGB', target_size, (255, 255, 255))
        offset = ((target_size[0] - img.size[0]) // 2, (target_size[1] - img.size[1]) // 2)
        new_img.paste(img, offset)
        
        # Compress to WebP with quality adjustment to meet size requirement
        quality = 85
        while quality > 10:
            buffer = BytesIO()
            new_img.save(buffer, format='WEBP', quality=quality, optimize=True)
            size_kb = buffer.tell() / 1024
            
            if size_kb <= max_size_kb:
                buffer.seek(0)
                return base64.b64encode(buffer.read()).decode('utf-8')
            
            quality -= 10
        
        # Final attempt with lowest quality
        buffer = BytesIO()
        new_img.save(buffer, format='WEBP', quality=10, optimize=True)
        buffer.seek(0)
        return base64.b64encode(buffer.read()).decode('utf-8')
        
    except Exception as e:
        logger.error(f"Image processing error: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Image processing failed: {str(e)}")

# ============== AUTH ROUTES ==============

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    existing = await db.users.find_one({'email': user_data.email}, {'_id': 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    user_doc = {
        'id': user_id,
        'email': user_data.email,
        'password': hash_password(user_data.password),
        'name': user_data.name,
        'role': user_data.role,
        'created_at': now.isoformat(),
        'updated_at': now.isoformat()
    }
    
    await db.users.insert_one(user_doc)
    
    token = create_token(user_id, user_data.email, user_data.role)
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user_id,
            email=user_data.email,
            name=user_data.name,
            role=user_data.role,
            created_at=now
        )
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({'email': credentials.email}, {'_id': 0})
    if not user or not verify_password(credentials.password, user['password']):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    token = create_token(user['id'], user['email'], user['role'])
    
    created_at = user['created_at']
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user['id'],
            email=user['email'],
            name=user['name'],
            role=user['role'],
            created_at=created_at
        )
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    created_at = current_user['created_at']
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
    
    return UserResponse(
        id=current_user['id'],
        email=current_user['email'],
        name=current_user['name'],
        role=current_user['role'],
        permissions=current_user.get('permissions'),
        created_at=created_at
    )

# ============== DOCTOR ROUTES ==============

@api_router.post("/doctors", response_model=DoctorResponse)
async def create_doctor(doctor_data: DoctorCreate, current_user: dict = Depends(get_current_user)):
    doctor_id = str(uuid.uuid4())
    customer_code = await generate_customer_code()
    now = datetime.now(timezone.utc)
    
    doctor_doc = {
        'id': doctor_id,
        'customer_code': customer_code,
        'name': doctor_data.name,
        'reg_no': doctor_data.reg_no,
        'address': doctor_data.address,
        'email': doctor_data.email,
        'phone': doctor_data.phone,
        'lead_status': doctor_data.lead_status,
        'dob': doctor_data.dob,
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
        email=doctor_data.email,
        phone=doctor_data.phone,
        lead_status=doctor_data.lead_status,
        dob=doctor_data.dob,
        created_at=now,
        updated_at=now
    )

@api_router.get("/doctors", response_model=List[DoctorResponse])
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
            email=doc.get('email', ''),
            phone=doc['phone'],
            lead_status=doc.get('lead_status', 'Pipeline'),
            dob=doc.get('dob'),
            priority=doc.get('priority'),
            last_contact_date=doc.get('last_contact_date'),
            follow_up_date=doc.get('follow_up_date'),
            created_at=created_at,
            updated_at=updated_at
        ))
    
    return result

@api_router.get("/doctors/{doctor_id}", response_model=DoctorResponse)
async def get_doctor(doctor_id: str, current_user: dict = Depends(get_current_user)):
    doctor = await db.doctors.find_one({'id': doctor_id}, {'_id': 0})
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    
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
        email=doctor.get('email', ''),
        phone=doctor['phone'],
        lead_status=doctor.get('lead_status', 'Pipeline'),
        dob=doctor.get('dob'),
        priority=doctor.get('priority'),
        last_contact_date=doctor.get('last_contact_date'),
        follow_up_date=doctor.get('follow_up_date'),
        created_at=created_at,
        updated_at=updated_at
    )

@api_router.put("/doctors/{doctor_id}", response_model=DoctorResponse)
async def update_doctor(doctor_id: str, doctor_data: DoctorUpdate, current_user: dict = Depends(get_current_user)):
    doctor = await db.doctors.find_one({'id': doctor_id}, {'_id': 0})
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    
    update_data = {k: v for k, v in doctor_data.model_dump().items() if v is not None}
    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.doctors.update_one({'id': doctor_id}, {'$set': update_data})
    
    updated_doctor = await db.doctors.find_one({'id': doctor_id}, {'_id': 0})
    
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
        email=updated_doctor.get('email', ''),
        phone=updated_doctor['phone'],
        lead_status=updated_doctor.get('lead_status', 'Pipeline'),
        dob=updated_doctor.get('dob'),
        priority=updated_doctor.get('priority'),
        last_contact_date=updated_doctor.get('last_contact_date'),
        follow_up_date=updated_doctor.get('follow_up_date'),
        created_at=created_at,
        updated_at=updated_at
    )

@api_router.delete("/doctors/{doctor_id}")
async def delete_doctor(doctor_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.doctors.delete_one({'id': doctor_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Doctor not found")
    # Also delete related notes and tasks
    await db.doctor_notes.delete_many({'doctor_id': doctor_id})
    await db.tasks.delete_many({'doctor_id': doctor_id})
    return {"message": "Doctor deleted successfully"}

# ============== DOCTOR NOTES ROUTES ==============

@api_router.get("/doctors/{doctor_id}/notes", response_model=List[DoctorNoteResponse])
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

@api_router.post("/doctors/{doctor_id}/notes", response_model=DoctorNoteResponse)
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

@api_router.delete("/doctors/{doctor_id}/notes/{note_id}")
async def delete_doctor_note(doctor_id: str, note_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a note"""
    result = await db.doctor_notes.delete_one({'id': note_id, 'doctor_id': doctor_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Note not found")
    return {"message": "Note deleted successfully"}

# ============== MEDICAL ROUTES ==============

@api_router.post("/medicals", response_model=MedicalResponse)
async def create_medical(medical_data: MedicalCreate, current_user: dict = Depends(get_current_user)):
    medical_id = str(uuid.uuid4())
    customer_code = await generate_medical_code()
    now = datetime.now(timezone.utc)
    
    medical_doc = {
        'id': medical_id,
        'customer_code': customer_code,
        'name': medical_data.name,
        'proprietor_name': medical_data.proprietor_name,
        'gst_number': medical_data.gst_number,
        'drug_license': medical_data.drug_license,
        'address': medical_data.address,
        'state': medical_data.state,
        'district': medical_data.district,
        'pincode': medical_data.pincode,
        'email': medical_data.email,
        'phone': medical_data.phone,
        'alternate_phone': medical_data.alternate_phone,
        'lead_status': medical_data.lead_status,
        'created_at': now.isoformat(),
        'updated_at': now.isoformat(),
        'created_by': current_user['id']
    }
    
    await db.medicals.insert_one(medical_doc)
    
    return MedicalResponse(
        id=medical_id,
        customer_code=customer_code,
        name=medical_data.name,
        proprietor_name=medical_data.proprietor_name,
        gst_number=medical_data.gst_number,
        drug_license=medical_data.drug_license,
        address=medical_data.address,
        state=medical_data.state,
        district=medical_data.district,
        pincode=medical_data.pincode,
        email=medical_data.email,
        phone=medical_data.phone,
        alternate_phone=medical_data.alternate_phone,
        lead_status=medical_data.lead_status,
        created_at=now,
        updated_at=now
    )

@api_router.get("/medicals", response_model=List[MedicalResponse])
async def get_medicals(
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
    
    medicals = await db.medicals.find(query, {'_id': 0}).sort('created_at', -1).to_list(1000)
    
    result = []
    for doc in medicals:
        created_at = doc.get('created_at')
        updated_at = doc.get('updated_at') or doc.get('created_at')
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
        if isinstance(updated_at, str):
            updated_at = datetime.fromisoformat(updated_at.replace('Z', '+00:00'))
        
        result.append(MedicalResponse(
            id=doc['id'],
            customer_code=doc['customer_code'],
            name=doc['name'],
            proprietor_name=doc.get('proprietor_name'),
            gst_number=doc.get('gst_number'),
            drug_license=doc.get('drug_license'),
            address=doc.get('address'),
            state=doc.get('state'),
            district=doc.get('district'),
            pincode=doc.get('pincode'),
            email=doc.get('email'),
            phone=doc['phone'],
            alternate_phone=doc.get('alternate_phone'),
            lead_status=doc.get('lead_status', 'Pipeline'),
            priority=doc.get('priority'),
            last_contact_date=doc.get('last_contact_date'),
            follow_up_date=doc.get('follow_up_date'),
            created_at=created_at,
            updated_at=updated_at
        ))
    
    return result

@api_router.get("/medicals/{medical_id}", response_model=MedicalResponse)
async def get_medical(medical_id: str, current_user: dict = Depends(get_current_user)):
    medical = await db.medicals.find_one({'id': medical_id}, {'_id': 0})
    if not medical:
        raise HTTPException(status_code=404, detail="Medical not found")
    
    created_at = medical.get('created_at')
    updated_at = medical.get('updated_at') or medical.get('created_at')
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
    if isinstance(updated_at, str):
        updated_at = datetime.fromisoformat(updated_at.replace('Z', '+00:00'))
    
    return MedicalResponse(
        id=medical['id'],
        customer_code=medical['customer_code'],
        name=medical['name'],
        proprietor_name=medical.get('proprietor_name'),
        gst_number=medical.get('gst_number'),
        drug_license=medical.get('drug_license'),
        address=medical.get('address'),
        state=medical.get('state'),
        district=medical.get('district'),
        pincode=medical.get('pincode'),
        email=medical.get('email'),
        phone=medical['phone'],
        alternate_phone=medical.get('alternate_phone'),
        lead_status=medical.get('lead_status', 'Pipeline'),
        priority=medical.get('priority'),
        last_contact_date=medical.get('last_contact_date'),
        follow_up_date=medical.get('follow_up_date'),
        created_at=created_at,
        updated_at=updated_at
    )

@api_router.put("/medicals/{medical_id}", response_model=MedicalResponse)
async def update_medical(medical_id: str, medical_data: MedicalUpdate, current_user: dict = Depends(get_current_user)):
    medical = await db.medicals.find_one({'id': medical_id}, {'_id': 0})
    if not medical:
        raise HTTPException(status_code=404, detail="Medical not found")
    
    update_data = {k: v for k, v in medical_data.model_dump().items() if v is not None}
    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.medicals.update_one({'id': medical_id}, {'$set': update_data})
    
    updated = await db.medicals.find_one({'id': medical_id}, {'_id': 0})
    created_at = updated.get('created_at')
    updated_at = updated.get('updated_at')
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
    if isinstance(updated_at, str):
        updated_at = datetime.fromisoformat(updated_at.replace('Z', '+00:00'))
    
    return MedicalResponse(
        id=updated['id'],
        customer_code=updated['customer_code'],
        name=updated['name'],
        proprietor_name=updated.get('proprietor_name'),
        gst_number=updated.get('gst_number'),
        drug_license=updated.get('drug_license'),
        address=updated.get('address'),
        state=updated.get('state'),
        district=updated.get('district'),
        pincode=updated.get('pincode'),
        email=updated.get('email'),
        phone=updated['phone'],
        alternate_phone=updated.get('alternate_phone'),
        lead_status=updated.get('lead_status', 'Pipeline'),
        priority=updated.get('priority'),
        last_contact_date=updated.get('last_contact_date'),
        follow_up_date=updated.get('follow_up_date'),
        created_at=created_at,
        updated_at=updated_at
    )

@api_router.delete("/medicals/{medical_id}")
async def delete_medical(medical_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.medicals.delete_one({'id': medical_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Medical not found")
    # Also delete related notes
    await db.medical_notes.delete_many({'medical_id': medical_id})
    return {"message": "Medical deleted successfully"}

@api_router.put("/medicals/{medical_id}/contact")
async def update_medical_last_contact(medical_id: str, current_user: dict = Depends(get_current_user)):
    """Update last contact date and set follow-up to 25 days from now"""
    medical = await db.medicals.find_one({'id': medical_id}, {'_id': 0})
    if not medical:
        raise HTTPException(status_code=404, detail="Medical not found")
    
    now = datetime.now(timezone.utc)
    follow_up = now + timedelta(days=25)
    
    await db.medicals.update_one(
        {'id': medical_id},
        {'$set': {
            'last_contact_date': now.strftime('%Y-%m-%d'),
            'follow_up_date': follow_up.strftime('%Y-%m-%d'),
            'updated_at': now.isoformat()
        }}
    )
    
    return {"message": "Contact updated successfully", "follow_up_date": follow_up.strftime('%Y-%m-%d')}

# Medical Notes
@api_router.get("/medicals/{medical_id}/notes", response_model=List[MedicalNoteResponse])
async def get_medical_notes(medical_id: str, current_user: dict = Depends(get_current_user)):
    notes = await db.medical_notes.find({'medical_id': medical_id}, {'_id': 0}).sort('created_at', -1).to_list(100)
    
    result = []
    for note in notes:
        created_at = note['created_at']
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
        
        result.append(MedicalNoteResponse(
            id=note['id'],
            medical_id=note['medical_id'],
            note=note['note'],
            created_by=note['created_by'],
            created_at=created_at
        ))
    
    return result

@api_router.post("/medicals/{medical_id}/notes", response_model=MedicalNoteResponse)
async def add_medical_note(medical_id: str, note_data: MedicalNoteCreate, current_user: dict = Depends(get_current_user)):
    medical = await db.medicals.find_one({'id': medical_id}, {'_id': 0})
    if not medical:
        raise HTTPException(status_code=404, detail="Medical not found")
    
    now = datetime.now(timezone.utc)
    note_doc = {
        'id': str(uuid.uuid4()),
        'medical_id': medical_id,
        'note': note_data.note,
        'created_by': current_user['name'],
        'created_at': now.isoformat()
    }
    
    await db.medical_notes.insert_one(note_doc)
    
    return MedicalNoteResponse(
        id=note_doc['id'],
        medical_id=medical_id,
        note=note_doc['note'],
        created_by=note_doc['created_by'],
        created_at=now
    )

@api_router.delete("/medicals/{medical_id}/notes/{note_id}")
async def delete_medical_note(medical_id: str, note_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.medical_notes.delete_one({'id': note_id, 'medical_id': medical_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Note not found")
    return {"message": "Note deleted successfully"}

# ============== AGENCY ROUTES ==============

@api_router.post("/agencies", response_model=AgencyResponse)
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
        'state': agency_data.state,
        'district': agency_data.district,
        'pincode': agency_data.pincode,
        'email': agency_data.email,
        'phone': agency_data.phone,
        'alternate_phone': agency_data.alternate_phone,
        'lead_status': agency_data.lead_status,
        'created_at': now.isoformat(),
        'updated_at': now.isoformat(),
        'created_by': current_user['id']
    }
    
    await db.agencies.insert_one(agency_doc)
    
    return AgencyResponse(
        id=agency_id,
        customer_code=customer_code,
        name=agency_data.name,
        proprietor_name=agency_data.proprietor_name,
        gst_number=agency_data.gst_number,
        drug_license=agency_data.drug_license,
        address=agency_data.address,
        state=agency_data.state,
        district=agency_data.district,
        pincode=agency_data.pincode,
        email=agency_data.email,
        phone=agency_data.phone,
        alternate_phone=agency_data.alternate_phone,
        lead_status=agency_data.lead_status,
        created_at=now,
        updated_at=now
    )

@api_router.get("/agencies", response_model=List[AgencyResponse])
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
            state=doc.get('state'),
            district=doc.get('district'),
            pincode=doc.get('pincode'),
            email=doc.get('email'),
            phone=doc['phone'],
            alternate_phone=doc.get('alternate_phone'),
            lead_status=doc.get('lead_status', 'Pipeline'),
            priority=doc.get('priority'),
            last_contact_date=doc.get('last_contact_date'),
            follow_up_date=doc.get('follow_up_date'),
            created_at=created_at,
            updated_at=updated_at
        ))
    
    return result

@api_router.get("/agencies/{agency_id}", response_model=AgencyResponse)
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
    
    return AgencyResponse(
        id=agency['id'],
        customer_code=agency['customer_code'],
        name=agency['name'],
        proprietor_name=agency.get('proprietor_name'),
        gst_number=agency.get('gst_number'),
        drug_license=agency.get('drug_license'),
        address=agency.get('address'),
        state=agency.get('state'),
        district=agency.get('district'),
        pincode=agency.get('pincode'),
        email=agency.get('email'),
        phone=agency['phone'],
        alternate_phone=agency.get('alternate_phone'),
        lead_status=agency.get('lead_status', 'Pipeline'),
        priority=agency.get('priority'),
        last_contact_date=agency.get('last_contact_date'),
        follow_up_date=agency.get('follow_up_date'),
        created_at=created_at,
        updated_at=updated_at
    )

@api_router.put("/agencies/{agency_id}", response_model=AgencyResponse)
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
    
    return AgencyResponse(
        id=updated['id'],
        customer_code=updated['customer_code'],
        name=updated['name'],
        proprietor_name=updated.get('proprietor_name'),
        gst_number=updated.get('gst_number'),
        drug_license=updated.get('drug_license'),
        address=updated.get('address'),
        state=updated.get('state'),
        district=updated.get('district'),
        pincode=updated.get('pincode'),
        email=updated.get('email'),
        phone=updated['phone'],
        alternate_phone=updated.get('alternate_phone'),
        lead_status=updated.get('lead_status', 'Pipeline'),
        priority=updated.get('priority'),
        last_contact_date=updated.get('last_contact_date'),
        follow_up_date=updated.get('follow_up_date'),
        created_at=created_at,
        updated_at=updated_at
    )

@api_router.delete("/agencies/{agency_id}")
async def delete_agency(agency_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.agencies.delete_one({'id': agency_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Agency not found")
    # Also delete related notes
    await db.agency_notes.delete_many({'agency_id': agency_id})
    return {"message": "Agency deleted successfully"}

@api_router.put("/agencies/{agency_id}/contact")
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
@api_router.get("/agencies/{agency_id}/notes", response_model=List[AgencyNoteResponse])
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

@api_router.post("/agencies/{agency_id}/notes", response_model=AgencyNoteResponse)
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

@api_router.delete("/agencies/{agency_id}/notes/{note_id}")
async def delete_agency_note(agency_id: str, note_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.agency_notes.delete_one({'id': note_id, 'agency_id': agency_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Note not found")
    return {"message": "Note deleted successfully"}

# ============== TASKS ROUTES ==============

@api_router.get("/tasks", response_model=List[TaskResponse])
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

@api_router.post("/tasks", response_model=TaskResponse)
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

@api_router.put("/tasks/{task_id}", response_model=TaskResponse)
async def update_task(task_id: str, task_data: TaskUpdate, current_user: dict = Depends(get_current_user)):
    """Update a task"""
    task = await db.tasks.find_one({'id': task_id}, {'_id': 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    update_data = {k: v for k, v in task_data.model_dump().items() if v is not None}
    
    if update_data:
        await db.tasks.update_one({'id': task_id}, {'$set': update_data})
    
    updated_task = await db.tasks.find_one({'id': task_id}, {'_id': 0})
    doctor = await db.doctors.find_one({'id': updated_task['doctor_id']}, {'_id': 0, 'name': 1})
    
    created_at = updated_task['created_at']
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
    
    return TaskResponse(
        id=updated_task['id'],
        doctor_id=updated_task['doctor_id'],
        doctor_name=doctor['name'] if doctor else None,
        title=updated_task['title'],
        description=updated_task.get('description'),
        due_date=updated_task.get('due_date'),
        priority=updated_task.get('priority', 'moderate'),
        status=updated_task.get('status', 'pending'),
        created_at=created_at
    )

@api_router.delete("/tasks/{task_id}")
async def delete_task(task_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a task"""
    result = await db.tasks.delete_one({'id': task_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"message": "Task deleted successfully"}

# ============== FOLLOW-UP REMINDERS ==============

@api_router.get("/reminders")
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

@api_router.put("/doctors/{doctor_id}/contact")
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

# ============== SMTP CONFIG ROUTES ==============

@api_router.post("/smtp-config", response_model=SMTPConfigResponse)
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

@api_router.get("/smtp-config", response_model=Optional[SMTPConfigResponse])
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

@api_router.post("/send-email")
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

@api_router.get("/email-logs", response_model=List[EmailLogResponse])
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

# ============== DASHBOARD ROUTES ==============

@api_router.get("/dashboard/stats", response_model=DashboardStats)
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    total_doctors = await db.doctors.count_documents({})
    
    pipeline = [
        {'$group': {'_id': '$lead_status', 'count': {'$sum': 1}}}
    ]
    status_counts = await db.doctors.aggregate(pipeline).to_list(100)
    by_status = {item['_id']: item['count'] for item in status_counts}
    
    # Ensure all statuses are represented
    for status in ['Customer', 'Contacted', 'Pipeline', 'Not Interested', 'Closed']:
        if status not in by_status:
            by_status[status] = 0
    
    # Recent emails count (last 7 days)
    seven_days_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    recent_emails = await db.email_logs.count_documents({'created_at': {'$gte': seven_days_ago}})
    
    # Recent doctors
    recent_docs = await db.doctors.find({}, {'_id': 0}).sort('created_at', -1).to_list(5)
    recent_doctors = []
    for doc in recent_docs:
        created_at = doc['created_at']
        updated_at = doc['updated_at']
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
        if isinstance(updated_at, str):
            updated_at = datetime.fromisoformat(updated_at.replace('Z', '+00:00'))
        
        recent_doctors.append(DoctorResponse(
            id=doc['id'],
            customer_code=doc['customer_code'],
            name=doc['name'],
            reg_no=doc['reg_no'],
            address=doc['address'],
            email=doc['email'],
            phone=doc['phone'],
            lead_status=doc['lead_status'],
            dob=doc.get('dob'),
            created_at=created_at,
            updated_at=updated_at
        ))
    
    return DashboardStats(
        total_doctors=total_doctors,
        by_status=by_status,
        recent_emails=recent_emails,
        recent_doctors=recent_doctors
    )

# ============== ITEM ROUTES ==============

@api_router.get("/item-categories", response_model=List[CategoryResponse])
async def get_item_categories(current_user: dict = Depends(get_current_user)):
    """Get all unique item categories with counts"""
    pipeline = [
        {'$match': {'category': {'$ne': None, '$ne': '', '$exists': True}}},
        {'$group': {'_id': '$category', 'count': {'$sum': 1}}},
        {'$match': {'_id': {'$ne': None}}},
        {'$sort': {'_id': 1}}
    ]
    categories = await db.items.aggregate(pipeline).to_list(100)
    return [CategoryResponse(name=cat['_id'], count=cat['count']) for cat in categories if cat['_id']]

@api_router.post("/items", response_model=ItemResponse)
async def create_item(item_data: ItemCreate, current_user: dict = Depends(get_current_user)):
    item_id = str(uuid.uuid4())
    
    # Use custom item_code if provided, otherwise auto-generate
    if item_data.item_code and item_data.item_code.strip():
        item_code = item_data.item_code.strip()
        # Check if code already exists
        existing = await db.items.find_one({'item_code': item_code}, {'_id': 0})
        if existing:
            raise HTTPException(status_code=400, detail="Item code already exists")
    else:
        item_code = await generate_item_code()
    
    now = datetime.now(timezone.utc)
    
    # Process image if provided
    processed_image = None
    if item_data.image_base64:
        try:
            # Decode base64 and process
            image_bytes = base64.b64decode(item_data.image_base64)
            processed_image = process_image_to_webp(image_bytes)
        except Exception as e:
            logger.error(f"Image processing error: {str(e)}")
    
    item_doc = {
        'id': item_id,
        'item_code': item_code,
        'item_name': item_data.item_name,
        'main_categories': item_data.main_categories or [],
        'subcategories': item_data.subcategories or [],
        'composition': item_data.composition,
        'offer': item_data.offer,
        'special_offer': item_data.special_offer,
        'mrp': item_data.mrp,
        'rate': item_data.rate,
        'gst': item_data.gst,
        'custom_fields': [cf.model_dump() for cf in (item_data.custom_fields or [])],
        'image_webp': processed_image,
        'created_at': now.isoformat(),
        'updated_at': now.isoformat(),
        'created_by': current_user['id']
    }
    
    await db.items.insert_one(item_doc)
    
    return ItemResponse(
        id=item_id,
        item_code=item_code,
        item_name=item_data.item_name,
        main_categories=item_data.main_categories or [],
        subcategories=item_data.subcategories or [],
        composition=item_data.composition,
        offer=item_data.offer,
        special_offer=item_data.special_offer,
        mrp=item_data.mrp,
        rate=item_data.rate,
        gst=item_data.gst,
        custom_fields=item_data.custom_fields or [],
        image_url=f"/api/items/{item_id}/image" if processed_image else None,
        created_at=now
    )

@api_router.get("/items/{item_id}/image")
async def get_item_image(item_id: str):
    """Get item image as WebP"""
    item = await db.items.find_one({'id': item_id}, {'image_webp': 1})
    if not item or not item.get('image_webp'):
        raise HTTPException(status_code=404, detail="Image not found")
    
    image_data = base64.b64decode(item['image_webp'])
    return Response(content=image_data, media_type="image/webp")

@api_router.get("/items", response_model=List[ItemResponse])
async def get_items(
    search: Optional[str] = None,
    main_category: Optional[str] = None,
    subcategory: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    
    if search:
        query['$or'] = [
            {'item_name': {'$regex': search, '$options': 'i'}},
            {'item_code': {'$regex': search, '$options': 'i'}},
            {'composition': {'$regex': search, '$options': 'i'}}
        ]
    
    if main_category:
        query['main_categories'] = main_category
    
    if subcategory:
        query['subcategories'] = subcategory
    
    items = await db.items.find(query, {'_id': 0, 'image_webp': 0}).sort('created_at', -1).to_list(1000)
    
    result = []
    for item in items:
        created_at = item['created_at']
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
        
        custom_fields = [CustomField(**cf) for cf in item.get('custom_fields', [])]
        
        # Check if image exists
        has_image = await db.items.find_one({'id': item['id'], 'image_webp': {'$ne': None}}, {'_id': 1})
        
        result.append(ItemResponse(
            id=item['id'],
            item_code=item['item_code'],
            item_name=item['item_name'],
            main_categories=item.get('main_categories', []) or item.get('main_category', []) if isinstance(item.get('main_category'), list) else ([item.get('main_category')] if item.get('main_category') else []),
            subcategories=item.get('subcategories', []),
            composition=item.get('composition'),
            offer=item.get('offer'),
            special_offer=item.get('special_offer'),
            mrp=item['mrp'],
            rate=item['rate'],
            gst=item.get('gst', 0),
            custom_fields=custom_fields,
            image_url=f"/api/items/{item['id']}/image" if has_image else None,
            created_at=created_at
        ))
    
    return result

@api_router.get("/items/{item_id}", response_model=ItemResponse)
async def get_item(item_id: str, current_user: dict = Depends(get_current_user)):
    item = await db.items.find_one({'id': item_id}, {'_id': 0, 'image_webp': 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    created_at = item['created_at']
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
    
    custom_fields = [CustomField(**cf) for cf in item.get('custom_fields', [])]
    
    # Check if image exists
    has_image = await db.items.find_one({'id': item_id, 'image_webp': {'$ne': None}}, {'_id': 1})
    
    return ItemResponse(
        id=item['id'],
        item_code=item['item_code'],
        item_name=item['item_name'],
        main_categories=item.get('main_categories', []) or ([item.get('main_category')] if item.get('main_category') else []),
        subcategories=item.get('subcategories', []),
        composition=item.get('composition'),
        offer=item.get('offer'),
        special_offer=item.get('special_offer'),
        mrp=item['mrp'],
        rate=item['rate'],
        gst=item.get('gst', 0),
        custom_fields=custom_fields,
        image_url=f"/api/items/{item['id']}/image" if has_image else None,
        created_at=created_at
    )

@api_router.put("/items/{item_id}", response_model=ItemResponse)
async def update_item(item_id: str, item_data: ItemUpdate, current_user: dict = Depends(get_current_user)):
    item = await db.items.find_one({'id': item_id}, {'_id': 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    update_data = {}
    for k, v in item_data.model_dump().items():
        if v is not None:
            if k == 'custom_fields':
                update_data[k] = [cf.model_dump() if hasattr(cf, 'model_dump') else cf for cf in v]
            elif k == 'image_base64':
                # Process and update image
                try:
                    image_bytes = base64.b64decode(v)
                    update_data['image_webp'] = process_image_to_webp(image_bytes)
                except Exception as e:
                    logger.error(f"Image processing error: {str(e)}")
            elif k == 'item_code':
                # Check if new code already exists (excluding current item)
                if v != item.get('item_code'):
                    existing = await db.items.find_one({'item_code': v, 'id': {'$ne': item_id}}, {'_id': 0})
                    if existing:
                        raise HTTPException(status_code=400, detail="Item code already exists")
                update_data[k] = v
            else:
                update_data[k] = v
    
    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.items.update_one({'id': item_id}, {'$set': update_data})
    
    updated_item = await db.items.find_one({'id': item_id}, {'_id': 0, 'image_webp': 0})
    
    created_at = updated_item['created_at']
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
    
    custom_fields = [CustomField(**cf) for cf in updated_item.get('custom_fields', [])]
    
    # Check if image exists
    has_image = await db.items.find_one({'id': item_id, 'image_webp': {'$ne': None}}, {'_id': 1})
    
    return ItemResponse(
        id=updated_item['id'],
        item_code=updated_item['item_code'],
        item_name=updated_item['item_name'],
        main_categories=updated_item.get('main_categories', []) or ([updated_item.get('main_category')] if updated_item.get('main_category') else []),
        subcategories=updated_item.get('subcategories', []),
        composition=updated_item.get('composition'),
        offer=updated_item.get('offer'),
        special_offer=updated_item.get('special_offer'),
        mrp=updated_item['mrp'],
        rate=updated_item['rate'],
        gst=updated_item.get('gst', 0),
        custom_fields=custom_fields,
        image_url=f"/api/items/{item_id}/image" if has_image else None,
        created_at=created_at
    )

@api_router.delete("/items/{item_id}/image")
async def delete_item_image(item_id: str, current_user: dict = Depends(get_current_user)):
    """Delete item image"""
    result = await db.items.update_one({'id': item_id}, {'$set': {'image_webp': None}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"message": "Image deleted successfully"}

@api_router.delete("/items/{item_id}")
async def delete_item(item_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.items.delete_one({'id': item_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"message": "Item deleted successfully"}

# ============== COMPANY SETTINGS ROUTES ==============

@api_router.post("/company-settings", response_model=CompanySettingsResponse)
async def save_company_settings(settings: CompanySettingsCreate, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can update company settings")
    
    settings_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    # Process logo if provided
    processed_logo = None
    if settings.logo_base64:
        try:
            image_bytes = base64.b64decode(settings.logo_base64)
            processed_logo = process_image_to_webp(image_bytes, max_size_kb=50, target_size=(200, 200))
        except Exception as e:
            logger.error(f"Logo processing error: {str(e)}")
    
    # Process login background image if provided
    processed_bg = None
    if settings.login_background_image:
        try:
            image_bytes = base64.b64decode(settings.login_background_image)
            processed_bg = process_image_to_webp(image_bytes, max_size_kb=200, target_size=(1920, 1080))
        except Exception as e:
            logger.error(f"Background image processing error: {str(e)}")
    
    # Delete existing settings (only one allowed)
    await db.company_settings.delete_many({})
    
    settings_doc = {
        'id': settings_id,
        'company_name': settings.company_name,
        'address': settings.address,
        'email': settings.email,
        'phone': settings.phone,
        'gst_number': settings.gst_number,
        'drug_license': settings.drug_license,
        'logo_webp': processed_logo,
        'terms_conditions': settings.terms_conditions,
        'login_tagline': settings.login_tagline,
        'login_background_color': settings.login_background_color,
        'login_background_webp': processed_bg,
        'updated_at': now.isoformat()
    }
    
    await db.company_settings.insert_one(settings_doc)
    
    return CompanySettingsResponse(
        id=settings_id,
        company_name=settings.company_name,
        address=settings.address,
        email=settings.email,
        phone=settings.phone,
        gst_number=settings.gst_number,
        drug_license=settings.drug_license,
        logo_url="/api/company-settings/logo" if processed_logo else None,
        terms_conditions=settings.terms_conditions,
        login_tagline=settings.login_tagline,
        login_background_color=settings.login_background_color,
        login_background_image_url="/api/company-settings/login-background" if processed_bg else None,
        updated_at=now
    )

@api_router.get("/company-settings", response_model=Optional[CompanySettingsResponse])
async def get_company_settings(current_user: dict = Depends(get_current_user)):
    settings = await db.company_settings.find_one({}, {'_id': 0, 'logo_webp': 0, 'login_background_webp': 0})
    if not settings:
        return None
    
    updated_at = settings['updated_at']
    if isinstance(updated_at, str):
        updated_at = datetime.fromisoformat(updated_at.replace('Z', '+00:00'))
    
    has_logo = await db.company_settings.find_one({'logo_webp': {'$ne': None}}, {'_id': 1})
    has_bg = await db.company_settings.find_one({'login_background_webp': {'$ne': None}}, {'_id': 1})
    
    return CompanySettingsResponse(
        id=settings['id'],
        company_name=settings['company_name'],
        address=settings['address'],
        email=settings['email'],
        phone=settings.get('phone'),
        gst_number=settings['gst_number'],
        drug_license=settings['drug_license'],
        logo_url="/api/company-settings/logo" if has_logo else None,
        terms_conditions=settings.get('terms_conditions'),
        login_tagline=settings.get('login_tagline'),
        login_background_color=settings.get('login_background_color'),
        login_background_image_url="/api/company-settings/login-background" if has_bg else None,
        updated_at=updated_at
    )

@api_router.get("/company-settings/logo")
async def get_company_logo():
    settings = await db.company_settings.find_one({}, {'logo_webp': 1})
    if not settings or not settings.get('logo_webp'):
        raise HTTPException(status_code=404, detail="Logo not found")
    
    image_data = base64.b64decode(settings['logo_webp'])
    return Response(content=image_data, media_type="image/webp")

@api_router.get("/company-settings/login-background")
async def get_login_background():
    settings = await db.company_settings.find_one({}, {'login_background_webp': 1})
    if not settings or not settings.get('login_background_webp'):
        raise HTTPException(status_code=404, detail="Login background not found")
    
    image_data = base64.b64decode(settings['login_background_webp'])
    return Response(content=image_data, media_type="image/webp")

# ============== PUBLIC SHOWCASE ROUTES (NO AUTH) ==============

@api_router.get("/public/company-settings")
async def get_public_company_settings():
    settings = await db.company_settings.find_one({}, {'_id': 0, 'logo_webp': 0, 'login_background_webp': 0})
    if not settings:
        return None
    
    has_logo = await db.company_settings.find_one({'logo_webp': {'$ne': None}}, {'_id': 1})
    has_bg = await db.company_settings.find_one({'login_background_webp': {'$ne': None}}, {'_id': 1})
    
    return {
        'company_name': settings['company_name'],
        'address': settings['address'],
        'email': settings['email'],
        'phone': settings.get('phone'),
        'gst_number': settings['gst_number'],
        'drug_license': settings['drug_license'],
        'logo_url': "/api/company-settings/logo" if has_logo else None,
        'terms_conditions': settings.get('terms_conditions'),
        'login_tagline': settings.get('login_tagline'),
        'login_background_color': settings.get('login_background_color'),
        'login_background_image_url': "/api/company-settings/login-background" if has_bg else None
    }

@api_router.get("/public/items")
async def get_public_items(main_category: Optional[str] = None, subcategory: Optional[str] = None):
    """Get all items with category filters for public showcase"""
    query = {}
    if main_category:
        query['main_categories'] = main_category
    if subcategory:
        query['subcategories'] = subcategory
    
    items = await db.items.find(query, {'_id': 0, 'image_webp': 0, 'created_by': 0}).sort('item_name', 1).to_list(1000)
    
    result = []
    for item in items:
        has_image = await db.items.find_one({'id': item['id'], 'image_webp': {'$ne': None}}, {'_id': 1})
        item_data = {
            'id': item['id'],
            'item_code': item['item_code'],
            'item_name': item['item_name'],
            'main_categories': item.get('main_categories', []) or ([item.get('main_category')] if item.get('main_category') else []),
            'subcategories': item.get('subcategories', []),
            'composition': item.get('composition'),
            'offer': item.get('offer'),
            'special_offer': item.get('special_offer'),
            'mrp': item['mrp'],
            'rate': item['rate'],
            'gst': item.get('gst', 0),
            'image_url': f"/api/items/{item['id']}/image" if has_image else None
        }
        result.append(item_data)
    
    return result

@api_router.get("/public/categories")
async def get_public_categories():
    """Get all main categories and subcategories for filters"""
    items = await db.items.find({}, {'main_categories': 1, 'main_category': 1, 'subcategories': 1, '_id': 0}).to_list(1000)
    
    main_categories = set()
    subcategories_map = {}
    
    for item in items:
        # Handle both old (main_category) and new (main_categories) field names
        main_cats = item.get('main_categories', [])
        if not main_cats and item.get('main_category'):
            main_cats = [item.get('main_category')]
        
        for main_cat in main_cats:
            if main_cat:
                main_categories.add(main_cat)
                if main_cat not in subcategories_map:
                    subcategories_map[main_cat] = set()
                for sub in item.get('subcategories', []):
                    subcategories_map[main_cat].add(sub)
    
    return {
        'main_categories': sorted(list(main_categories)),
        'subcategories': {k: sorted(list(v)) for k, v in subcategories_map.items()}
    }

@api_router.get("/public/doctor/{mobile}")
async def get_doctor_by_mobile(mobile: str):
    """Get doctor details by mobile number for auto-fill"""
    # Clean mobile number (remove spaces, dashes, etc.)
    clean_mobile = ''.join(filter(str.isdigit, mobile))
    
    # Search with various formats
    doctor = await db.doctors.find_one(
        {'$or': [
            {'phone': {'$regex': clean_mobile[-10:], '$options': 'i'}},
            {'phone': clean_mobile},
            {'phone': f"+91{clean_mobile[-10:]}"},
            {'phone': f"91{clean_mobile[-10:]}"}
        ]},
        {'_id': 0}
    )
    
    if not doctor:
        return None
    
    return {
        'id': doctor['id'],
        'name': doctor['name'],
        'phone': doctor['phone'],
        'email': doctor['email'],
        'address': doctor['address'],
        'customer_code': doctor['customer_code']
    }

# ============== OTP & ORDER ROUTES ==============

async def get_whatsapp_config():
    """Get WhatsApp config from database"""
    config = await db.whatsapp_config.find_one({}, {'_id': 0})
    if not config:
        # Default config
        return {
            'api_url': 'https://api.botmastersender.com/api/v1/',
            'auth_token': '1d97fa5b-b9f8-4b1c-9479-cae962594d5f',
            'sender_id': '919944472488'
        }
    return config

async def log_whatsapp_message(
    recipient_phone: str,
    message_type: str,
    message_preview: str,
    status: str,
    recipient_name: str = None,
    error_message: str = None
):
    """Log WhatsApp message to database"""
    try:
        log_doc = {
            'id': str(uuid.uuid4()),
            'recipient_phone': recipient_phone,
            'recipient_name': recipient_name,
            'message_type': message_type,
            'message_preview': message_preview[:500] if message_preview else '',  # Truncate long messages
            'status': status,
            'error_message': error_message,
            'created_at': datetime.now(timezone.utc).isoformat()
        }
        await db.whatsapp_logs.insert_one(log_doc)
    except Exception as e:
        logger.error(f"Failed to log WhatsApp message: {str(e)}")

async def send_whatsapp_otp(mobile: str, otp: str):
    """Send OTP via WhatsApp API"""
    config = await get_whatsapp_config()
    
    if not config:
        logger.warning("WhatsApp config not found, OTP not sent via WhatsApp")
        await log_whatsapp_message(mobile, 'otp', f"OTP: {otp}", 'failed', error_message='WhatsApp not configured')
        return True  # Return True to allow order flow to continue (OTP is logged)
    
    # Ensure mobile has 91 prefix
    clean_mobile = ''.join(filter(str.isdigit, mobile))
    if not clean_mobile.startswith('91'):
        clean_mobile = f"91{clean_mobile[-10:]}"
    
    message = f"Your VMP CRM verification code is: {otp}. Valid for 5 minutes."
    
    params = {
        'action': 'send',
        'senderId': config['sender_id'],
        'authToken': config['auth_token'],
        'messageText': message,
        'receiverId': clean_mobile
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(config['api_url'], params=params, timeout=30)
            logger.info(f"WhatsApp OTP sent to {clean_mobile}: {response.status_code}")
            status = 'success' if response.status_code == 200 else 'failed'
            await log_whatsapp_message(clean_mobile, 'otp', message, status)
            return response.status_code == 200
    except Exception as e:
        logger.error(f"WhatsApp OTP error: {str(e)}")
        await log_whatsapp_message(clean_mobile, 'otp', message, 'failed', error_message=str(e))
        return True  # Return True to allow flow to continue even if WhatsApp fails

async def send_whatsapp_order(mobile: str, items: List[OrderItem], order_number: str, doctor_name: str = None, ip_address: str = None, location: str = None):
    """Send order confirmation via WhatsApp with full details"""
    config = await get_whatsapp_config()
    
    # Get company settings
    company = await db.company_settings.find_one({}, {'_id': 0})
    company_name = company.get('company_name', 'VMP CRM') if company else 'VMP CRM'
    company_phone = config.get('sender_id', '')
    
    clean_mobile = ''.join(filter(str.isdigit, mobile))
    if not clean_mobile.startswith('91'):
        clean_mobile = f"91{clean_mobile[-10:]}"
    
    # Build personalized order message
    greeting = f"Dear Dr. {doctor_name}" if doctor_name else "Dear Customer"
    
    # Build items list
    items_text = "\n".join([f"• {item.item_name} - Qty: {item.quantity}" for item in items if item.quantity])
    
    # Location info
    location_text = ""
    if ip_address:
        location_text += f"\n📍 IP: {ip_address}"
    if location:
        location_text += f"\n📍 Location: {location}"
    
    message = f"""{greeting},

We have received your order. Kindly check it once again, we will start processing your order.

📋 *Order No:* {order_number}

*Order Details:*
{items_text}
{location_text}

Thank you for your order!

Regards,
*{company_name}*
📞 +{company_phone}"""
    
    params = {
        'action': 'send',
        'senderId': config['sender_id'],
        'authToken': config['auth_token'],
        'messageText': message,
        'receiverId': clean_mobile
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(config['api_url'], params=params, timeout=30)
            logger.info(f"Order confirmation sent to {clean_mobile}")
            status = 'success' if response.status_code == 200 else 'failed'
            await log_whatsapp_message(clean_mobile, 'order_confirmation', message, status, recipient_name=doctor_name)
    except Exception as e:
        logger.error(f"WhatsApp order message error: {str(e)}")
        await log_whatsapp_message(clean_mobile, 'order_confirmation', message, 'failed', recipient_name=doctor_name, error_message=str(e))

async def send_whatsapp_status_update(order: dict, new_status: str, update_data: dict = None):
    """Send WhatsApp notification for order status changes"""
    config = await get_whatsapp_config()
    if not config:
        logger.warning("WhatsApp config not found, skipping notification")
        return
    
    # Get company settings
    company = await db.company_settings.find_one({}, {'_id': 0})
    company_name = company.get('company_name', 'VMP CRM') if company else 'VMP CRM'
    company_phone = config.get('sender_id', '')
    
    mobile = order.get('doctor_phone', '')
    clean_mobile = ''.join(filter(str.isdigit, mobile))
    if not clean_mobile.startswith('91'):
        clean_mobile = f"91{clean_mobile[-10:]}"
    
    doctor_name = order.get('doctor_name')
    greeting = f"Dear Dr. {doctor_name}" if doctor_name else "Dear Customer"
    order_number = order.get('order_number', '')
    
    # Build items list
    items = order.get('items', [])
    items_text = "\n".join([f"• {item.get('item_name', '')} - Qty: {item.get('quantity', '')}" for item in items])
    
    message = ""
    
    if new_status == 'confirmed':
        message = f"""{greeting},

✅ Your order has been *CONFIRMED*!

📋 *Order No:* {order_number}

*Order Details:*
{items_text}

We are processing your order and will ship it soon.

Regards,
*{company_name}*
📞 +{company_phone}"""

    elif new_status == 'shipped':
        # Get tracking number from update_data (new) or order (existing)
        tracking_number = update_data.get('tracking_number') if update_data else None
        if not tracking_number:
            tracking_number = order.get('tracking_number', 'N/A')
        
        # Get transport info from order (set during ready_to_despatch) or update_data
        transport_name = order.get('transport_name') or (update_data.get('transport_name') if update_data else None) or 'N/A'
        delivery_station = order.get('delivery_station') or (update_data.get('delivery_station') if update_data else None) or 'N/A'
        payment_mode = order.get('payment_mode') or (update_data.get('payment_mode') if update_data else None) or ''
        payment_text = "To Pay" if payment_mode == 'to_pay' else "Paid" if payment_mode == 'paid' else 'N/A'
        
        # Get package details from order (set during ready_to_despatch)
        boxes = order.get('boxes_count', 0) or 0
        cans = order.get('cans_count', 0) or 0
        bags = order.get('bags_count', 0) or 0
        
        package_parts = []
        if boxes: package_parts.append(f"{boxes} Box(es)")
        if cans: package_parts.append(f"{cans} Can(s)")
        if bags: package_parts.append(f"{bags} Bag(s)")
        package_text = ", ".join(package_parts) if package_parts else "N/A"
        
        # Get invoice details from order (set during ready_to_despatch)
        invoice_number = order.get('invoice_number', 'N/A') or 'N/A'
        invoice_date = order.get('invoice_date', 'N/A') or 'N/A'
        invoice_value = order.get('invoice_value', 0) or 0
        invoice_value_text = f"₹{invoice_value:,.2f}" if invoice_value else 'N/A'
        
        message = f"""{greeting},

🚚 Your order has been *SHIPPED*!

📋 *Order No:* {order_number}

*Order Details:*
{items_text}

*Shipping Information:*
🚛 Transport: {transport_name}
📦 Tracking No: {tracking_number}
📍 Delivery Station: {delivery_station}
💰 Payment: {payment_text}

*Package Details:*
📦 {package_text}

*Invoice Details:*
🧾 Invoice No: {invoice_number}
📅 Invoice Date: {invoice_date}
💵 Invoice Value: {invoice_value_text}

Your order is on its way! Thank you for your order.

Regards,
*{company_name}*
📞 +{company_phone}"""

    elif new_status == 'delivered':
        message = f"""{greeting},

🎉 Your order has been *DELIVERED*!

📋 *Order No:* {order_number}

*Order Details:*
{items_text}

Thank you for choosing us! We hope you are satisfied with your order.

For any queries, please contact us.

Regards,
*{company_name}*
📞 +{company_phone}"""

    elif new_status == 'cancelled':
        cancellation_reason = update_data.get('cancellation_reason', 'Not specified') if update_data else 'Not specified'
        
        message = f"""{greeting},

❌ Your order has been *CANCELLED*

📋 *Order No:* {order_number}

*Order Details:*
{items_text}

*Reason for Cancellation:*
{cancellation_reason}

If you have any questions, please contact us.

Regards,
*{company_name}*
📞 +{company_phone}"""
    
    if not message:
        return
    
    params = {
        'action': 'send',
        'senderId': config['sender_id'],
        'authToken': config['auth_token'],
        'messageText': message,
        'receiverId': clean_mobile
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(config['api_url'], params=params, timeout=30)
            logger.info(f"Order status update ({new_status}) sent to {clean_mobile}")
            status = 'success' if response.status_code == 200 else 'failed'
            await log_whatsapp_message(clean_mobile, f'status_{new_status}', message, status, recipient_name=doctor_name)
    except Exception as e:
        logger.error(f"WhatsApp status update error: {str(e)}")
        await log_whatsapp_message(clean_mobile, f'status_{new_status}', message, 'failed', recipient_name=doctor_name, error_message=str(e))

async def send_whatsapp_ready_to_despatch(order: dict, update_data: dict):
    """Send WhatsApp notification for Ready to Despatch status - to both transporter and customer"""
    config = await get_whatsapp_config()
    if not config:
        logger.warning("WhatsApp config not found, skipping notification")
        return
    
    # Get company settings
    company = await db.company_settings.find_one({}, {'_id': 0})
    company_name = company.get('company_name', 'VMP CRM') if company else 'VMP CRM'
    company_phone = config.get('sender_id', '')
    
    order_number = order.get('order_number', '')
    doctor_name = order.get('doctor_name', 'Customer')
    doctor_phone = order.get('doctor_phone', '')
    doctor_address = order.get('doctor_address', 'N/A')
    
    # Get transport details
    transport_name = update_data.get('transport_name', 'N/A')
    delivery_station = update_data.get('delivery_station', 'N/A')
    payment_mode = update_data.get('payment_mode', '')
    payment_text = "To Pay" if payment_mode == 'to_pay' else "Paid" if payment_mode == 'paid' else 'N/A'
    
    # Package details
    boxes = update_data.get('boxes_count', 0) or 0
    cans = update_data.get('cans_count', 0) or 0
    bags = update_data.get('bags_count', 0) or 0
    
    package_parts = []
    if boxes: package_parts.append(f"{boxes} Box(es)")
    if cans: package_parts.append(f"{cans} Can(s)")
    if bags: package_parts.append(f"{bags} Bag(s)")
    package_text = ", ".join(package_parts) if package_parts else "N/A"
    
    # Invoice details
    invoice_number = update_data.get('invoice_number', 'N/A') or 'N/A'
    invoice_date = update_data.get('invoice_date', 'N/A') or 'N/A'
    invoice_value = update_data.get('invoice_value', 0) or 0
    invoice_value_text = f"₹{invoice_value:,.2f}" if invoice_value else 'N/A'
    
    # Build items list
    items = order.get('items', [])
    items_text = "\n".join([f"• {item.get('item_name', '')} - Qty: {item.get('quantity', '')}" for item in items])
    
    # 1. Send message to TRANSPORTER
    transport_id = update_data.get('transport_id')
    if transport_id:
        transport = await db.transports.find_one({'id': transport_id}, {'_id': 0})
        if transport and transport.get('contact_number'):
            transporter_mobile = transport.get('contact_number', '')
            clean_transporter_mobile = ''.join(filter(str.isdigit, transporter_mobile))
            if not clean_transporter_mobile.startswith('91'):
                clean_transporter_mobile = f"91{clean_transporter_mobile[-10:]}"
            
            transporter_message = f"""📦 *NEW SHIPMENT READY*

*Delivery Details:*
👤 {doctor_name}
📍 {delivery_station}

*Invoice Details:*
🧾 {invoice_number}
📅 {invoice_date}
💵 {invoice_value_text}

*Package Details:*
📦 {package_text}

*Payment:* {payment_text}"""
            
            params = {
                'action': 'send',
                'senderId': config['sender_id'],
                'authToken': config['auth_token'],
                'messageText': transporter_message,
                'receiverId': clean_transporter_mobile
            }
            
            try:
                async with httpx.AsyncClient() as client:
                    response = await client.get(config['api_url'], params=params, timeout=30)
                    logger.info(f"Ready to despatch notification sent to transporter {clean_transporter_mobile}")
                    status = 'success' if response.status_code == 200 else 'failed'
                    await log_whatsapp_message(clean_transporter_mobile, 'ready_to_despatch_transporter', transporter_message, status, recipient_name=transport_name)
            except Exception as e:
                logger.error(f"WhatsApp transporter notification error: {str(e)}")
                await log_whatsapp_message(clean_transporter_mobile, 'ready_to_despatch_transporter', transporter_message, 'failed', recipient_name=transport_name, error_message=str(e))

async def send_whatsapp_out_of_stock(order: dict, out_of_stock_items: list):
    """Send WhatsApp notification for out of stock items"""
    if not out_of_stock_items:
        return
    
    config = await get_whatsapp_config()
    if not config:
        logger.warning("WhatsApp config not found, skipping out of stock notification")
        return
    
    # Get company settings
    company = await db.company_settings.find_one({}, {'_id': 0})
    company_name = company.get('company_name', 'VMP CRM') if company else 'VMP CRM'
    company_phone = config.get('sender_id', '')
    
    mobile = order.get('doctor_phone', '')
    clean_mobile = ''.join(filter(str.isdigit, mobile))
    if not clean_mobile.startswith('91'):
        clean_mobile = f"91{clean_mobile[-10:]}"
    
    doctor_name = order.get('doctor_name')
    greeting = f"Dear Dr. {doctor_name}" if doctor_name else "Dear Customer"
    order_number = order.get('order_number', '')
    
    # Build out of stock items list
    items_text = "\n".join([f"• {item.get('item_name', '')} - Qty: {item.get('quantity', '')}" for item in out_of_stock_items])
    
    message = f"""{greeting},

⚠️ *STOCK UPDATE* for Order *{order_number}*

We regret to inform you that the following item(s) are currently *OUT OF STOCK*:

{items_text}

We have noted your requirement and will update you as soon as these items are available.

We sincerely apologize for the inconvenience and thank you for your patience and cooperation. 🙏

Your remaining order items are being processed.

For any queries, please contact us.

Regards,
*{company_name}*
📞 +{company_phone}"""
    
    params = {
        'action': 'send',
        'senderId': config['sender_id'],
        'authToken': config['auth_token'],
        'messageText': message,
        'receiverId': clean_mobile
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(config['api_url'], params=params, timeout=30)
            logger.info(f"Out of stock notification sent to {clean_mobile} for order {order_number}")
            status = 'success' if response.status_code == 200 else 'failed'
            await log_whatsapp_message(clean_mobile, 'out_of_stock', message, status, recipient_name=doctor_name)
    except Exception as e:
        logger.error(f"WhatsApp out of stock notification error: {str(e)}")
        await log_whatsapp_message(clean_mobile, 'out_of_stock', message, 'failed', recipient_name=doctor_name, error_message=str(e))

async def send_whatsapp_stock_arrived(doctor_phone: str, doctor_name: str, item_name: str, item_code: str, quantity: str):
    """Send WhatsApp notification when stock arrives for a pending item"""
    config = await get_whatsapp_config()
    if not config:
        logger.warning("WhatsApp config not found, skipping stock arrived notification")
        return False
    
    # Get company settings
    company = await db.company_settings.find_one({}, {'_id': 0})
    company_name = company.get('company_name', 'VMP CRM') if company else 'VMP CRM'
    company_phone = config.get('sender_id', '')
    
    clean_mobile = ''.join(filter(str.isdigit, doctor_phone))
    if not clean_mobile.startswith('91'):
        clean_mobile = f"91{clean_mobile[-10:]}"
    
    greeting = f"Dear Dr. {doctor_name}" if doctor_name else "Dear Customer"
    
    message = f"""{greeting},

🎉 *GOOD NEWS - STOCK ARRIVED!*

We are pleased to inform you that the following item you requested is now *BACK IN STOCK*:

📦 *{item_name}* ({item_code})
   Quantity requested: {quantity}

You can now place your order or contact us to complete your previous pending order.

Thank you for your patience! 🙏

Regards,
*{company_name}*
📞 +{company_phone}"""
    
    params = {
        'action': 'send',
        'senderId': config['sender_id'],
        'authToken': config['auth_token'],
        'messageText': message,
        'receiverId': clean_mobile
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(config['api_url'], params=params, timeout=30)
            logger.info(f"Stock arrived notification sent to {clean_mobile} for item {item_code}")
            status = 'success' if response.status_code == 200 else 'failed'
            await log_whatsapp_message(clean_mobile, 'stock_arrived', message, status, recipient_name=doctor_name)
            return response.status_code == 200
    except Exception as e:
        logger.error(f"WhatsApp stock arrived notification error: {str(e)}")
        await log_whatsapp_message(clean_mobile, 'stock_arrived', message, 'failed', recipient_name=doctor_name, error_message=str(e))
        return False

@api_router.post("/public/send-otp")
async def send_otp(request: OTPRequest):
    """Send OTP to mobile number via WhatsApp"""
    clean_mobile = ''.join(filter(str.isdigit, request.mobile))
    if len(clean_mobile) < 10:
        raise HTTPException(status_code=400, detail="Invalid mobile number")
    
    # Generate 6-digit OTP
    otp = str(random.randint(100000, 999999))
    
    # Store OTP with expiry (5 minutes)
    otp_doc = {
        'mobile': clean_mobile[-10:],
        'otp': otp,
        'created_at': datetime.now(timezone.utc).isoformat(),
        'expires_at': (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat(),
        'verified': False
    }
    
    # Delete old OTPs for this mobile
    await db.otps.delete_many({'mobile': clean_mobile[-10:]})
    await db.otps.insert_one(otp_doc)
    
    # Send OTP via WhatsApp
    sent = await send_whatsapp_otp(request.mobile, otp)
    
    # For development/testing, also log the OTP
    logger.info(f"OTP for {clean_mobile}: {otp}")
    
    return {"message": "OTP sent successfully", "sent": sent}

@api_router.post("/public/verify-otp", response_model=OrderResponse)
async def verify_otp_and_submit_order(request: OTPVerify):
    """Verify OTP and submit order"""
    clean_mobile = ''.join(filter(str.isdigit, request.mobile))[-10:]
    
    # Find OTP
    otp_doc = await db.otps.find_one({
        'mobile': clean_mobile,
        'otp': request.otp,
        'verified': False
    }, {'_id': 0})
    
    if not otp_doc:
        raise HTTPException(status_code=400, detail="Invalid OTP")
    
    # Check expiry
    expires_at = datetime.fromisoformat(otp_doc['expires_at'].replace('Z', '+00:00'))
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=400, detail="OTP expired")
    
    # Mark OTP as verified
    await db.otps.update_one({'mobile': clean_mobile}, {'$set': {'verified': True}})
    
    # Get doctor details if exists
    doctor = await db.doctors.find_one(
        {'$or': [
            {'phone': {'$regex': clean_mobile, '$options': 'i'}},
            {'phone': f"+91{clean_mobile}"},
            {'phone': f"91{clean_mobile}"}
        ]},
        {'_id': 0}
    )
    
    # Generate order number
    order_count = await db.orders.count_documents({})
    order_number = f"ORD-{str(order_count + 1).zfill(6)}"
    
    order_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    # Filter items with quantity
    valid_items = [item for item in request.items if item.quantity and item.quantity.strip()]
    
    order_doc = {
        'id': order_id,
        'order_number': order_number,
        'doctor_id': doctor['id'] if doctor else None,
        'doctor_name': doctor['name'] if doctor else None,
        'doctor_phone': request.mobile,
        'doctor_email': doctor['email'] if doctor else None,
        'doctor_address': doctor['address'] if doctor else None,
        'doctor_customer_code': doctor['customer_code'] if doctor else None,
        'items': [item.model_dump() for item in valid_items],
        'status': 'pending',
        'ip_address': request.ip_address,
        'location': request.location,
        'device_info': request.device_info,
        'created_at': now.isoformat()
    }
    
    await db.orders.insert_one(order_doc)
    
    # Send order confirmation via WhatsApp with full details
    await send_whatsapp_order(
        mobile=request.mobile, 
        items=valid_items, 
        order_number=order_number,
        doctor_name=doctor['name'] if doctor else None,
        ip_address=request.ip_address,
        location=request.location
    )
    
    return OrderResponse(
        id=order_id,
        order_number=order_number,
        doctor_id=doctor['id'] if doctor else None,
        doctor_name=doctor['name'] if doctor else None,
        doctor_phone=request.mobile,
        doctor_email=doctor['email'] if doctor else None,
        doctor_address=doctor['address'] if doctor else None,
        items=valid_items,
        status='pending',
        ip_address=request.ip_address,
        location=request.location,
        device_info=request.device_info,
        created_at=now
    )

# ============== ORDERS ADMIN ROUTES ==============

@api_router.get("/orders", response_model=List[OrderResponse])
async def get_orders(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if status:
        query['status'] = status
    
    orders = await db.orders.find(query, {'_id': 0}).sort('created_at', -1).to_list(1000)
    
    result = []
    for order in orders:
        created_at = order['created_at']
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
        
        items = [OrderItem(**item) for item in order.get('items', [])]
        
        result.append(OrderResponse(
            id=order['id'],
            order_number=order['order_number'],
            doctor_id=order.get('doctor_id'),
            doctor_name=order.get('doctor_name'),
            doctor_phone=order['doctor_phone'],
            doctor_email=order.get('doctor_email'),
            doctor_address=order.get('doctor_address'),
            items=items,
            status=order['status'],
            transport_id=order.get('transport_id'),
            transport_name=order.get('transport_name'),
            tracking_number=order.get('tracking_number'),
            tracking_url=order.get('tracking_url'),
            delivery_station=order.get('delivery_station'),
            payment_mode=order.get('payment_mode'),
            boxes_count=order.get('boxes_count'),
            cans_count=order.get('cans_count'),
            bags_count=order.get('bags_count'),
            invoice_number=order.get('invoice_number'),
            invoice_date=order.get('invoice_date'),
            invoice_value=order.get('invoice_value'),
            cancellation_reason=order.get('cancellation_reason'),
            ip_address=order.get('ip_address'),
            location=order.get('location'),
            device_info=order.get('device_info'),
            created_at=created_at
        ))
    
    return result

async def auto_create_transport_expense(order: dict, update_data: dict, current_user: dict):
    """Auto-create an expense entry when order is shipped with 'paid' payment mode"""
    try:
        # Ensure default categories exist
        await ensure_default_categories()
        
        # Find Transport/Shipping category
        transport_category = await db.expense_categories.find_one({'name': 'Transport/Shipping'}, {'_id': 0})
        if not transport_category:
            return  # Skip if category not found
        
        now = datetime.now(timezone.utc)
        transport_name = order.get('transport_name') or update_data.get('transport_name', 'Unknown Transport')
        delivery_station = order.get('delivery_station') or update_data.get('delivery_station', '')
        order_number = order.get('order_number', 'N/A')
        invoice_value = order.get('invoice_value', 0)
        
        # Check if expense already exists for this order
        existing = await db.expenses.find_one({'order_id': order['id'], 'is_auto_generated': True}, {'_id': 0})
        if existing:
            return  # Don't create duplicate
        
        expense_doc = {
            'id': str(uuid.uuid4()),
            'category_id': transport_category['id'],
            'category_name': transport_category['name'],
            'date': now.strftime('%Y-%m-%d'),
            'amount': invoice_value,
            'payment_type': 'net_banking',  # Default for transport
            'payment_account': 'company_account',
            'paid_by': None,
            'reason': f'Transport for Order #{order_number}',
            'transport_id': order.get('transport_id'),
            'transport_name': transport_name,
            'transport_location': delivery_station,
            'order_id': order['id'],
            'order_number': order_number,
            'is_auto_generated': True,
            'created_at': now.isoformat(),
            'updated_at': now.isoformat(),
            'created_by': current_user['id']
        }
        
        await db.expenses.insert_one(expense_doc)
        logger.info(f"Auto-created transport expense for order {order_number}")
    except Exception as e:
        logger.error(f"Failed to auto-create transport expense: {str(e)}")

@api_router.put("/orders/{order_id}/status")
async def update_order_status(order_id: str, status_data: OrderStatusUpdate, background_tasks: BackgroundTasks, current_user: dict = Depends(get_current_user)):
    """Update order status with optional transport details (for ready_to_despatch/shipped) or cancellation reason"""
    order = await db.orders.find_one({'id': order_id}, {'_id': 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    new_status = status_data.status
    update_data = {
        'status': new_status,
        'updated_at': datetime.now(timezone.utc).isoformat()
    }
    
    # Add transport/shipping details if status is 'ready_to_despatch'
    if new_status == 'ready_to_despatch':
        if status_data.transport_id:
            update_data['transport_id'] = status_data.transport_id
        if status_data.transport_name:
            update_data['transport_name'] = status_data.transport_name
        if status_data.delivery_station:
            update_data['delivery_station'] = status_data.delivery_station
        if status_data.payment_mode:
            update_data['payment_mode'] = status_data.payment_mode
        # Package counts
        if status_data.boxes_count is not None:
            update_data['boxes_count'] = status_data.boxes_count
        if status_data.cans_count is not None:
            update_data['cans_count'] = status_data.cans_count
        if status_data.bags_count is not None:
            update_data['bags_count'] = status_data.bags_count
        # Invoice details
        if status_data.invoice_number:
            update_data['invoice_number'] = status_data.invoice_number
        if status_data.invoice_date:
            update_data['invoice_date'] = status_data.invoice_date
        if status_data.invoice_value is not None:
            update_data['invoice_value'] = status_data.invoice_value
    
    # Only add tracking number if status is 'shipped'
    if new_status == 'shipped':
        if status_data.tracking_number:
            update_data['tracking_number'] = status_data.tracking_number
        if status_data.tracking_url:
            update_data['tracking_url'] = status_data.tracking_url
        # Also update transport if provided (for cases where ready_to_despatch was skipped)
        if status_data.transport_id:
            update_data['transport_id'] = status_data.transport_id
        if status_data.transport_name:
            update_data['transport_name'] = status_data.transport_name
        
        # Auto-create expense for shipped orders with 'paid' payment mode
        payment_mode = order.get('payment_mode') or update_data.get('payment_mode', '')
        if payment_mode == 'paid' and order.get('invoice_value'):
            await auto_create_transport_expense(order, update_data, current_user)
    
    # Only add cancellation reason if status is 'cancelled'
    if new_status == 'cancelled' and status_data.cancellation_reason:
        update_data['cancellation_reason'] = status_data.cancellation_reason
    
    await db.orders.update_one({'id': order_id}, {'$set': update_data})
    
    # Send WhatsApp notification for status change
    if new_status in ['confirmed', 'ready_to_despatch', 'shipped', 'delivered', 'cancelled']:
        # For ready_to_despatch, we need to send to both transporter and customer
        if new_status == 'ready_to_despatch':
            background_tasks.add_task(send_whatsapp_ready_to_despatch, order, update_data)
        else:
            background_tasks.add_task(send_whatsapp_status_update, order, new_status, update_data)
    
    return {"message": f"Order status updated to {new_status}"}

# Keep legacy endpoint for backward compatibility
@api_router.put("/orders/{order_id}/transport")
async def update_order_transport(order_id: str, transport_data: OrderStatusUpdate, background_tasks: BackgroundTasks, current_user: dict = Depends(get_current_user)):
    """Legacy endpoint - redirects to status update"""
    return await update_order_status(order_id, transport_data, background_tasks, current_user)

@api_router.put("/orders/{order_id}/items")
async def update_order_items(order_id: str, update_data: OrderItemsUpdate, background_tasks: BackgroundTasks, current_user: dict = Depends(get_current_user)):
    """Update order items and optionally create pending items for removed items"""
    order = await db.orders.find_one({'id': order_id}, {'_id': 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Update order items
    items_data = [item.dict() for item in update_data.items]
    await db.orders.update_one(
        {'id': order_id},
        {'$set': {
            'items': items_data,
            'updated_at': datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Create pending items if any and send WhatsApp notification
    if update_data.pending_items and len(update_data.pending_items) > 0:
        now = datetime.now(timezone.utc)
        order_date = order.get('created_at')
        if isinstance(order_date, str):
            order_date = datetime.fromisoformat(order_date.replace('Z', '+00:00'))
        
        for pending_item in update_data.pending_items:
            pending_doc = {
                'id': str(uuid.uuid4()),
                'doctor_phone': order.get('doctor_phone'),
                'doctor_name': order.get('doctor_name'),
                'item_id': pending_item.get('item_id'),
                'item_code': pending_item.get('item_code'),
                'item_name': pending_item.get('item_name'),
                'quantity': pending_item.get('quantity'),
                'original_order_id': order_id,
                'original_order_number': order.get('order_number'),
                'original_order_date': order_date.isoformat() if isinstance(order_date, datetime) else order_date,
                'created_at': now.isoformat()
            }
            await db.pending_items.insert_one(pending_doc)
        
        # Send WhatsApp notification for out of stock items
        background_tasks.add_task(send_whatsapp_out_of_stock, order, update_data.pending_items)
    
    return {"message": "Order items updated successfully"}

@api_router.put("/orders/{order_id}/customer")
async def update_order_customer(order_id: str, customer_data: OrderCustomerUpdate, current_user: dict = Depends(get_current_user)):
    """Update customer/doctor information for an order"""
    order = await db.orders.find_one({'id': order_id}, {'_id': 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    update_data = {
        'updated_at': datetime.now(timezone.utc).isoformat()
    }
    
    if customer_data.doctor_name:
        update_data['doctor_name'] = customer_data.doctor_name
    if customer_data.doctor_email:
        update_data['doctor_email'] = customer_data.doctor_email
    if customer_data.doctor_address:
        update_data['doctor_address'] = customer_data.doctor_address
    if customer_data.doctor_phone:
        update_data['doctor_phone'] = customer_data.doctor_phone
    
    # Update the order
    await db.orders.update_one({'id': order_id}, {'$set': update_data})
    
    # Also update pending items for this customer if phone changed
    old_phone = order.get('doctor_phone')
    new_phone = customer_data.doctor_phone or old_phone
    new_name = customer_data.doctor_name or order.get('doctor_name')
    
    if old_phone:
        await db.pending_items.update_many(
            {'doctor_phone': old_phone},
            {'$set': {'doctor_phone': new_phone, 'doctor_name': new_name}}
        )
    
    # If link_to_doctor is true, find or create doctor record
    if customer_data.link_to_doctor:
        phone = new_phone or old_phone
        existing_doctor = await db.doctors.find_one({'phone': phone}, {'_id': 0})
        
        if existing_doctor:
            # Update existing doctor
            doctor_update = {}
            if new_name:
                doctor_update['name'] = new_name
            if customer_data.doctor_email:
                doctor_update['email'] = customer_data.doctor_email
            if customer_data.doctor_address:
                doctor_update['address'] = customer_data.doctor_address
            
            if doctor_update:
                await db.doctors.update_one({'phone': phone}, {'$set': doctor_update})
            
            # Link order to doctor
            await db.orders.update_one({'id': order_id}, {'$set': {'doctor_id': existing_doctor['id']}})
            
            return {"message": "Customer info updated and linked to existing doctor", "doctor_id": existing_doctor['id']}
        else:
            # Create new doctor
            count = await db.doctors.count_documents({})
            customer_code = f"VMP-{str(count + 1).zfill(4)}"
            
            new_doctor = {
                'id': str(uuid.uuid4()),
                'name': new_name or 'Unknown',
                'reg_no': '',
                'address': customer_data.doctor_address or '',
                'email': customer_data.doctor_email or '',
                'phone': phone,
                'dob': None,
                'lead_status': 'Customer',
                'customer_code': customer_code,
                'created_at': datetime.now(timezone.utc).isoformat()
            }
            
            await db.doctors.insert_one(new_doctor)
            await db.orders.update_one({'id': order_id}, {'$set': {'doctor_id': new_doctor['id']}})
            
            return {"message": "Customer info updated and new doctor created", "doctor_id": new_doctor['id'], "customer_code": customer_code}
    
    return {"message": "Customer info updated successfully"}

@api_router.get("/orders/{order_id}/lookup-doctor")
async def lookup_doctor_for_order(order_id: str, current_user: dict = Depends(get_current_user)):
    """Look up existing doctor by order's phone number"""
    order = await db.orders.find_one({'id': order_id}, {'_id': 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    phone = order.get('doctor_phone')
    if not phone:
        return {"found": False, "doctor": None}
    
    # Clean phone number - get last 10 digits
    clean_phone = ''.join(filter(str.isdigit, phone))[-10:]
    
    # Search for doctor with matching phone
    doctor = await db.doctors.find_one(
        {'phone': {'$regex': clean_phone}},
        {'_id': 0}
    )
    
    if doctor:
        return {"found": True, "doctor": doctor}
    
    return {"found": False, "doctor": None}

# ============== PENDING ITEMS ROUTES ==============

@api_router.get("/pending-items")
async def get_all_pending_items(current_user: dict = Depends(get_current_user)):
    """Get all pending items"""
    pending_items = await db.pending_items.find({}, {'_id': 0}).sort('created_at', -1).to_list(1000)
    
    result = []
    for item in pending_items:
        created_at = item.get('created_at')
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
        
        order_date = item.get('original_order_date')
        if isinstance(order_date, str):
            order_date = datetime.fromisoformat(order_date.replace('Z', '+00:00'))
        
        result.append(PendingItemResponse(
            id=item['id'],
            doctor_phone=item['doctor_phone'],
            doctor_name=item.get('doctor_name'),
            item_id=item['item_id'],
            item_code=item['item_code'],
            item_name=item['item_name'],
            quantity=item['quantity'],
            original_order_id=item['original_order_id'],
            original_order_number=item['original_order_number'],
            original_order_date=order_date,
            created_at=created_at
        ))
    
    return result

@api_router.get("/pending-items/stats")
async def get_pending_items_stats(current_user: dict = Depends(get_current_user)):
    """Get pending items statistics"""
    total_count = await db.pending_items.count_documents({})
    
    # Get unique doctors with pending items
    pipeline = [
        {"$group": {"_id": "$doctor_phone", "count": {"$sum": 1}}},
        {"$count": "unique_doctors"}
    ]
    doctors_result = await db.pending_items.aggregate(pipeline).to_list(1)
    unique_doctors = doctors_result[0]['unique_doctors'] if doctors_result else 0
    
    return {
        "total_pending_items": total_count,
        "doctors_with_pending": unique_doctors
    }

@api_router.get("/pending-items/doctor/{phone}")
async def get_pending_items_by_doctor(phone: str, current_user: dict = Depends(get_current_user)):
    """Get pending items for a specific doctor by phone"""
    pending_items = await db.pending_items.find({'doctor_phone': phone}, {'_id': 0}).sort('created_at', -1).to_list(100)
    
    result = []
    for item in pending_items:
        created_at = item.get('created_at')
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
        
        order_date = item.get('original_order_date')
        if isinstance(order_date, str):
            order_date = datetime.fromisoformat(order_date.replace('Z', '+00:00'))
        
        result.append(PendingItemResponse(
            id=item['id'],
            doctor_phone=item['doctor_phone'],
            doctor_name=item.get('doctor_name'),
            item_id=item['item_id'],
            item_code=item['item_code'],
            item_name=item['item_name'],
            quantity=item['quantity'],
            original_order_id=item['original_order_id'],
            original_order_number=item['original_order_number'],
            original_order_date=order_date,
            created_at=created_at
        ))
    
    return result

@api_router.delete("/pending-items/{item_id}")
async def delete_pending_item(item_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a pending item after customer contact"""
    result = await db.pending_items.delete_one({'id': item_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Pending item not found")
    return {"message": "Pending item deleted successfully"}

@api_router.get("/pending-items/by-item")
async def get_pending_items_grouped_by_item(current_user: dict = Depends(get_current_user)):
    """Get pending items grouped by item (for stock arrival notifications)"""
    pipeline = [
        {
            "$group": {
                "_id": {
                    "item_id": "$item_id",
                    "item_code": "$item_code",
                    "item_name": "$item_name"
                },
                "doctors": {
                    "$push": {
                        "pending_id": "$id",
                        "doctor_phone": "$doctor_phone",
                        "doctor_name": "$doctor_name",
                        "quantity": "$quantity",
                        "original_order_number": "$original_order_number",
                        "created_at": "$created_at"
                    }
                },
                "total_quantity": {"$sum": 1},  # Count of pending requests (quantity is text)
                "doctor_count": {"$sum": 1}
            }
        },
        {
            "$project": {
                "_id": 0,
                "item_id": "$_id.item_id",
                "item_code": "$_id.item_code",
                "item_name": "$_id.item_name",
                "doctors": 1,
                "total_quantity": 1,
                "doctor_count": 1
            }
        },
        {"$sort": {"doctor_count": -1}}
    ]
    
    result = await db.pending_items.aggregate(pipeline).to_list(100)
    return result

@api_router.post("/pending-items/notify-stock-arrived/{item_code}")
async def notify_stock_arrived_by_item(item_code: str, background_tasks: BackgroundTasks, current_user: dict = Depends(get_current_user)):
    """Send stock arrived notification to all doctors waiting for a specific item"""
    # Find all pending items with this item code
    pending_items = await db.pending_items.find({'item_code': item_code}, {'_id': 0}).to_list(100)
    
    if not pending_items:
        raise HTTPException(status_code=404, detail="No pending items found with this item code")
    
    # Get item details from first pending item
    item_name = pending_items[0].get('item_name', item_code)
    
    # Send notifications to all doctors
    notifications_sent = 0
    notifications_failed = 0
    doctors_notified = []
    
    for pending in pending_items:
        doctor_phone = pending.get('doctor_phone')
        doctor_name = pending.get('doctor_name')
        quantity = pending.get('quantity')
        
        # Avoid sending duplicate notifications to same phone
        if doctor_phone in doctors_notified:
            continue
        
        success = await send_whatsapp_stock_arrived(
            doctor_phone=doctor_phone,
            doctor_name=doctor_name,
            item_name=item_name,
            item_code=item_code,
            quantity=quantity
        )
        
        if success:
            notifications_sent += 1
            doctors_notified.append(doctor_phone)
        else:
            notifications_failed += 1
    
    return {
        "message": f"Stock arrived notifications sent for {item_name}",
        "item_code": item_code,
        "item_name": item_name,
        "notifications_sent": notifications_sent,
        "notifications_failed": notifications_failed,
        "doctors_notified": len(doctors_notified)
    }

@api_router.post("/pending-items/{pending_id}/notify-stock-arrived")
async def notify_stock_arrived_single(pending_id: str, current_user: dict = Depends(get_current_user)):
    """Send stock arrived notification for a single pending item"""
    pending_item = await db.pending_items.find_one({'id': pending_id}, {'_id': 0})
    
    if not pending_item:
        raise HTTPException(status_code=404, detail="Pending item not found")
    
    success = await send_whatsapp_stock_arrived(
        doctor_phone=pending_item.get('doctor_phone'),
        doctor_name=pending_item.get('doctor_name'),
        item_name=pending_item.get('item_name'),
        item_code=pending_item.get('item_code'),
        quantity=pending_item.get('quantity')
    )
    
    if success:
        return {"message": "Stock arrived notification sent successfully"}
    else:
        raise HTTPException(status_code=500, detail="Failed to send notification")

# ============== TRANSPORT ROUTES ==============

@api_router.post("/transports", response_model=TransportResponse)
async def create_transport(transport: TransportCreate, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can add transports")
    
    transport_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    transport_doc = {
        'id': transport_id,
        'name': transport.name,
        'tracking_url_template': transport.tracking_url_template if not transport.is_local else None,
        'is_local': transport.is_local,
        'contact_number': transport.contact_number,
        'alternate_number': transport.alternate_number,
        'created_at': now.isoformat()
    }
    
    await db.transports.insert_one(transport_doc)
    
    return TransportResponse(
        id=transport_id,
        name=transport.name,
        tracking_url_template=transport.tracking_url_template if not transport.is_local else None,
        is_local=transport.is_local,
        contact_number=transport.contact_number,
        alternate_number=transport.alternate_number,
        created_at=now
    )

@api_router.get("/transports", response_model=List[TransportResponse])
async def get_transports(current_user: dict = Depends(get_current_user)):
    transports = await db.transports.find({}, {'_id': 0}).sort('name', 1).to_list(100)
    
    result = []
    for t in transports:
        created_at = t['created_at']
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
        
        result.append(TransportResponse(
            id=t['id'],
            name=t['name'],
            tracking_url_template=t.get('tracking_url_template'),
            is_local=t.get('is_local', False),
            contact_number=t.get('contact_number'),
            alternate_number=t.get('alternate_number'),
            created_at=created_at
        ))
    
    return result

@api_router.delete("/transports/{transport_id}")
async def delete_transport(transport_id: str, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can delete transports")
    
    result = await db.transports.delete_one({'id': transport_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Transport not found")
    return {"message": "Transport deleted successfully"}

# ============== EXPENSE ROUTES ==============

# Default expense categories
DEFAULT_EXPENSE_CATEGORIES = [
    {"name": "Transport/Shipping", "description": "Shipping and transport costs"},
    {"name": "Office Supplies", "description": "Office materials and supplies"},
    {"name": "Salaries", "description": "Employee salaries and wages"},
    {"name": "Utilities", "description": "Electricity, water, internet bills"},
    {"name": "Marketing", "description": "Advertising and marketing expenses"},
    {"name": "Miscellaneous", "description": "Other miscellaneous expenses"},
]

async def ensure_default_categories():
    """Create default expense categories if they don't exist"""
    existing = await db.expense_categories.count_documents({})
    if existing == 0:
        now = datetime.now(timezone.utc)
        for cat in DEFAULT_EXPENSE_CATEGORIES:
            await db.expense_categories.insert_one({
                'id': str(uuid.uuid4()),
                'name': cat['name'],
                'description': cat['description'],
                'is_default': True,
                'created_at': now.isoformat()
            })

@api_router.get("/expense-categories", response_model=List[ExpenseCategoryResponse])
async def get_expense_categories(current_user: dict = Depends(get_current_user)):
    """Get all expense categories"""
    await ensure_default_categories()
    categories = await db.expense_categories.find({}, {'_id': 0}).sort('name', 1).to_list(100)
    
    result = []
    for cat in categories:
        created_at = cat.get('created_at')
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
        
        result.append(ExpenseCategoryResponse(
            id=cat['id'],
            name=cat['name'],
            description=cat.get('description'),
            is_default=cat.get('is_default', False),
            created_at=created_at
        ))
    
    return result

@api_router.post("/expense-categories", response_model=ExpenseCategoryResponse)
async def create_expense_category(category: ExpenseCategoryCreate, current_user: dict = Depends(get_current_user)):
    """Create a new expense category"""
    cat_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    cat_doc = {
        'id': cat_id,
        'name': category.name,
        'description': category.description,
        'is_default': False,
        'created_at': now.isoformat()
    }
    
    await db.expense_categories.insert_one(cat_doc)
    
    return ExpenseCategoryResponse(
        id=cat_id,
        name=category.name,
        description=category.description,
        is_default=False,
        created_at=now
    )

@api_router.delete("/expense-categories/{category_id}")
async def delete_expense_category(category_id: str, current_user: dict = Depends(get_current_user)):
    """Delete an expense category (only non-default)"""
    category = await db.expense_categories.find_one({'id': category_id}, {'_id': 0})
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    if category.get('is_default', False):
        raise HTTPException(status_code=400, detail="Cannot delete default categories")
    
    expense_count = await db.expenses.count_documents({'category_id': category_id})
    if expense_count > 0:
        raise HTTPException(status_code=400, detail=f"Category is used by {expense_count} expenses")
    
    await db.expense_categories.delete_one({'id': category_id})
    return {"message": "Category deleted successfully"}

@api_router.post("/expenses", response_model=ExpenseResponse)
async def create_expense(expense: ExpenseCreate, current_user: dict = Depends(get_current_user)):
    """Create a new expense"""
    category = await db.expense_categories.find_one({'id': expense.category_id}, {'_id': 0})
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    expense_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    expense_doc = {
        'id': expense_id,
        'category_id': expense.category_id,
        'category_name': category['name'],
        'date': expense.date,
        'amount': expense.amount,
        'payment_type': expense.payment_type,
        'payment_account': expense.payment_account,
        'paid_by': expense.paid_by,
        'reason': expense.reason,
        'transport_id': expense.transport_id,
        'transport_name': expense.transport_name,
        'transport_location': expense.transport_location,
        'order_id': expense.order_id,
        'order_number': expense.order_number,
        'is_auto_generated': False,
        'created_at': now.isoformat(),
        'updated_at': now.isoformat(),
        'created_by': current_user['id']
    }
    
    await db.expenses.insert_one(expense_doc)
    
    return ExpenseResponse(
        id=expense_id,
        category_id=expense.category_id,
        category_name=category['name'],
        date=expense.date,
        amount=expense.amount,
        payment_type=expense.payment_type,
        payment_account=expense.payment_account,
        paid_by=expense.paid_by,
        reason=expense.reason,
        transport_id=expense.transport_id,
        transport_name=expense.transport_name,
        transport_location=expense.transport_location,
        order_id=expense.order_id,
        order_number=expense.order_number,
        is_auto_generated=False,
        created_at=now,
        updated_at=now
    )

@api_router.get("/expenses", response_model=List[ExpenseResponse])
async def get_expenses(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    category_id: Optional[str] = None,
    payment_type: Optional[str] = None,
    payment_account: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all expenses with optional filters"""
    query = {}
    
    if start_date and end_date:
        query['date'] = {'$gte': start_date, '$lte': end_date}
    elif start_date:
        query['date'] = {'$gte': start_date}
    elif end_date:
        query['date'] = {'$lte': end_date}
    
    if category_id:
        query['category_id'] = category_id
    if payment_type:
        query['payment_type'] = payment_type
    if payment_account:
        query['payment_account'] = payment_account
    
    expenses = await db.expenses.find(query, {'_id': 0}).sort('date', -1).to_list(1000)
    
    result = []
    for exp in expenses:
        created_at = exp.get('created_at')
        updated_at = exp.get('updated_at') or exp.get('created_at')
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
        if isinstance(updated_at, str):
            updated_at = datetime.fromisoformat(updated_at.replace('Z', '+00:00'))
        
        result.append(ExpenseResponse(
            id=exp['id'],
            category_id=exp['category_id'],
            category_name=exp.get('category_name'),
            date=exp['date'],
            amount=exp['amount'],
            payment_type=exp['payment_type'],
            payment_account=exp['payment_account'],
            paid_by=exp.get('paid_by'),
            reason=exp['reason'],
            transport_id=exp.get('transport_id'),
            transport_name=exp.get('transport_name'),
            transport_location=exp.get('transport_location'),
            order_id=exp.get('order_id'),
            order_number=exp.get('order_number'),
            is_auto_generated=exp.get('is_auto_generated', False),
            created_at=created_at,
            updated_at=updated_at
        ))
    
    return result

@api_router.put("/expenses/{expense_id}", response_model=ExpenseResponse)
async def update_expense(expense_id: str, expense_data: ExpenseUpdate, current_user: dict = Depends(get_current_user)):
    """Update an expense"""
    expense = await db.expenses.find_one({'id': expense_id}, {'_id': 0})
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    
    update_data = {k: v for k, v in expense_data.model_dump().items() if v is not None}
    
    if 'category_id' in update_data:
        category = await db.expense_categories.find_one({'id': update_data['category_id']}, {'_id': 0})
        if category:
            update_data['category_name'] = category['name']
    
    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.expenses.update_one({'id': expense_id}, {'$set': update_data})
    
    updated = await db.expenses.find_one({'id': expense_id}, {'_id': 0})
    created_at = updated.get('created_at')
    updated_at = updated.get('updated_at')
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
    if isinstance(updated_at, str):
        updated_at = datetime.fromisoformat(updated_at.replace('Z', '+00:00'))
    
    return ExpenseResponse(
        id=updated['id'],
        category_id=updated['category_id'],
        category_name=updated.get('category_name'),
        date=updated['date'],
        amount=updated['amount'],
        payment_type=updated['payment_type'],
        payment_account=updated['payment_account'],
        paid_by=updated.get('paid_by'),
        reason=updated['reason'],
        transport_id=updated.get('transport_id'),
        transport_name=updated.get('transport_name'),
        transport_location=updated.get('transport_location'),
        order_id=updated.get('order_id'),
        order_number=updated.get('order_number'),
        is_auto_generated=updated.get('is_auto_generated', False),
        created_at=created_at,
        updated_at=updated_at
    )

@api_router.delete("/expenses/{expense_id}")
async def delete_expense(expense_id: str, current_user: dict = Depends(get_current_user)):
    """Delete an expense"""
    result = await db.expenses.delete_one({'id': expense_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Expense not found")
    return {"message": "Expense deleted successfully"}

@api_router.get("/expenses/stats/monthly")
async def get_monthly_expense_stats(current_user: dict = Depends(get_current_user)):
    """Get monthly expense statistics"""
    import calendar
    now = datetime.now(timezone.utc)
    current_month_start = now.replace(day=1).strftime('%Y-%m-%d')
    current_month_end = now.strftime('%Y-%m-%d')
    
    if now.month == 1:
        prev_month_start = now.replace(year=now.year-1, month=12, day=1).strftime('%Y-%m-%d')
        prev_month_end = now.replace(year=now.year-1, month=12, day=31).strftime('%Y-%m-%d')
    else:
        prev_month_start = now.replace(month=now.month-1, day=1).strftime('%Y-%m-%d')
        last_day = calendar.monthrange(now.year, now.month-1)[1]
        prev_month_end = now.replace(month=now.month-1, day=last_day).strftime('%Y-%m-%d')
    
    current_expenses = await db.expenses.find({
        'date': {'$gte': current_month_start, '$lte': current_month_end}
    }, {'_id': 0}).to_list(1000)
    current_total = sum(exp['amount'] for exp in current_expenses)
    
    prev_expenses = await db.expenses.find({
        'date': {'$gte': prev_month_start, '$lte': prev_month_end}
    }, {'_id': 0, 'amount': 1}).to_list(1000)
    prev_total = sum(exp['amount'] for exp in prev_expenses)
    
    by_category = {}
    by_payment_type = {}
    for exp in current_expenses:
        cat_name = exp.get('category_name', 'Uncategorized')
        by_category[cat_name] = by_category.get(cat_name, 0) + exp['amount']
        pt = exp.get('payment_type', 'other')
        by_payment_type[pt] = by_payment_type.get(pt, 0) + exp['amount']
    
    return {
        'current_month_total': current_total,
        'previous_month_total': prev_total,
        'change_percent': round(((current_total - prev_total) / prev_total * 100) if prev_total > 0 else 0, 1),
        'by_category': by_category,
        'by_payment_type': by_payment_type,
        'expense_count': len(current_expenses)
    }

# ============== REMINDER ROUTES ==============

@api_router.post("/reminders", response_model=ReminderResponse)
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

@api_router.get("/reminders", response_model=List[ReminderResponse])
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

@api_router.get("/reminders/today")
async def get_today_reminders(current_user: dict = Depends(get_current_user)):
    """Get all reminders for today including auto-generated ones"""
    today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    today_md = datetime.now(timezone.utc).strftime('%m-%d')  # For birthday/anniversary matching
    
    reminders = []
    
    # 1. Get manual reminders for today
    manual_reminders = await db.reminders.find({
        'reminder_date': today,
        'is_completed': False
    }, {'_id': 0}).to_list(100)
    
    for rem in manual_reminders:
        created_at = rem.get('created_at')
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
        reminders.append({
            'id': rem['id'],
            'title': rem['title'],
            'description': rem.get('description'),
            'reminder_type': rem['reminder_type'],
            'reminder_date': rem['reminder_date'],
            'reminder_time': rem.get('reminder_time'),
            'entity_type': rem.get('entity_type'),
            'entity_id': rem.get('entity_id'),
            'entity_name': rem.get('entity_name'),
            'priority': rem.get('priority', 'moderate'),
            'is_completed': rem.get('is_completed', False),
            'is_auto_generated': rem.get('is_auto_generated', False),
            'phone': None
        })
    
    # 2. Get doctors with follow-up due today
    doctors_followup = await db.doctors.find({
        'follow_up_date': today,
        'lead_status': {'$nin': ['Not Interested', 'Closed']}
    }, {'_id': 0}).to_list(100)
    
    for doc in doctors_followup:
        reminders.append({
            'id': f"auto_followup_doctor_{doc['id']}",
            'title': f"Follow-up: {doc['name']}",
            'description': f"Follow-up due for {doc['name']} ({doc.get('customer_code', '')})",
            'reminder_type': 'follow_up',
            'reminder_date': today,
            'reminder_time': None,
            'entity_type': 'doctor',
            'entity_id': doc['id'],
            'entity_name': doc['name'],
            'priority': doc.get('priority', 'moderate'),
            'is_completed': False,
            'is_auto_generated': True,
            'phone': doc.get('phone')
        })
    
    # 3. Get medicals with follow-up due today
    medicals_followup = await db.medicals.find({
        'follow_up_date': today,
        'lead_status': {'$nin': ['Not Interested', 'Closed']}
    }, {'_id': 0}).to_list(100)
    
    for med in medicals_followup:
        reminders.append({
            'id': f"auto_followup_medical_{med['id']}",
            'title': f"Follow-up: {med['name']}",
            'description': f"Follow-up due for {med['name']} ({med.get('customer_code', '')})",
            'reminder_type': 'follow_up',
            'reminder_date': today,
            'reminder_time': None,
            'entity_type': 'medical',
            'entity_id': med['id'],
            'entity_name': med['name'],
            'priority': med.get('priority', 'moderate'),
            'is_completed': False,
            'is_auto_generated': True,
            'phone': med.get('phone')
        })
    
    # 4. Get agencies with follow-up due today
    agencies_followup = await db.agencies.find({
        'follow_up_date': today,
        'lead_status': {'$nin': ['Not Interested', 'Closed']}
    }, {'_id': 0}).to_list(100)
    
    for agy in agencies_followup:
        reminders.append({
            'id': f"auto_followup_agency_{agy['id']}",
            'title': f"Follow-up: {agy['name']}",
            'description': f"Follow-up due for {agy['name']} ({agy.get('customer_code', '')})",
            'reminder_type': 'follow_up',
            'reminder_date': today,
            'reminder_time': None,
            'entity_type': 'agency',
            'entity_id': agy['id'],
            'entity_name': agy['name'],
            'priority': agy.get('priority', 'moderate'),
            'is_completed': False,
            'is_auto_generated': True,
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

@api_router.put("/reminders/{reminder_id}", response_model=ReminderResponse)
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

@api_router.delete("/reminders/{reminder_id}")
async def delete_reminder(reminder_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a reminder"""
    result = await db.reminders.delete_one({'id': reminder_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Reminder not found")
    return {"message": "Reminder deleted successfully"}

@api_router.post("/reminders/{reminder_id}/complete")
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

@api_router.post("/reminders/send-whatsapp-summary")
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
    
    # Build message
    message_lines = [
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
        message_lines.append("📞 *Follow-ups:*")
        for r in followups[:5]:  # Limit to 5
            message_lines.append(f"• {r['entity_name']}")
        if len(followups) > 5:
            message_lines.append(f"  +{len(followups) - 5} more...")
        message_lines.append("")
    
    if birthdays:
        message_lines.append("🎂 *Birthdays:*")
        for r in birthdays:
            message_lines.append(f"• {r['entity_name']}")
        message_lines.append("")
    
    if anniversaries:
        message_lines.append("🎉 *Anniversaries:*")
        for r in anniversaries:
            message_lines.append(f"• {r['entity_name']}")
        message_lines.append("")
    
    if custom:
        message_lines.append("📝 *Other:*")
        for r in custom[:3]:
            message_lines.append(f"• {r['title']}")
        if len(custom) > 3:
            message_lines.append(f"  +{len(custom) - 3} more...")
    
    message = "\n".join(message_lines)
    
    # Send WhatsApp
    try:
        import httpx
        async with httpx.AsyncClient() as client:
            response = await client.post(
                wa_config['api_url'],
                json={
                    "token": wa_config['api_token'],
                    "phone": admin_phone,
                    "message": message
                },
                timeout=30.0
            )
            
            if response.status_code == 200:
                logger.info(f"Reminder summary sent to admin: {admin_phone}")
                return {"message": "Reminder summary sent successfully", "sent": True, "phone": admin_phone}
            else:
                logger.error(f"Failed to send reminder summary: {response.text}")
                raise HTTPException(status_code=500, detail="Failed to send WhatsApp message")
    except Exception as e:
        logger.error(f"Error sending reminder summary: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ============== WHATSAPP CONFIG ROUTES ==============

@api_router.post("/whatsapp-config", response_model=WhatsAppConfigResponse)
async def save_whatsapp_config(config: WhatsAppConfigCreate, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can configure WhatsApp settings")
    
    config_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    # Delete existing config (only one allowed)
    await db.whatsapp_config.delete_many({})
    
    config_doc = {
        'id': config_id,
        'api_url': config.api_url,
        'auth_token': config.auth_token,
        'sender_id': config.sender_id,
        'updated_at': now.isoformat()
    }
    
    await db.whatsapp_config.insert_one(config_doc)
    
    return WhatsAppConfigResponse(
        id=config_id,
        api_url=config.api_url,
        sender_id=config.sender_id,
        updated_at=now
    )

@api_router.get("/whatsapp-config", response_model=Optional[WhatsAppConfigResponse])
async def get_whatsapp_config_route(current_user: dict = Depends(get_current_user)):
    config = await db.whatsapp_config.find_one({}, {'_id': 0, 'auth_token': 0})
    if not config:
        # Return default config info (without token)
        return WhatsAppConfigResponse(
            id='default',
            api_url='https://api.botmastersender.com/api/v1/',
            sender_id='919944472488',
            updated_at=datetime.now(timezone.utc)
        )
    
    updated_at = config['updated_at']
    if isinstance(updated_at, str):
        updated_at = datetime.fromisoformat(updated_at.replace('Z', '+00:00'))
    
    return WhatsAppConfigResponse(
        id=config['id'],
        api_url=config['api_url'],
        sender_id=config['sender_id'],
        updated_at=updated_at
    )

@api_router.post("/whatsapp-config/test")
async def test_whatsapp_config(mobile: str, current_user: dict = Depends(get_current_user)):
    """Send a test message to verify WhatsApp configuration"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can test WhatsApp")
    
    config = await get_whatsapp_config()
    
    clean_mobile = ''.join(filter(str.isdigit, mobile))
    if not clean_mobile.startswith('91'):
        clean_mobile = f"91{clean_mobile[-10:]}"
    
    message = "Test message from VMP CRM. WhatsApp integration is working!"
    
    params = {
        'action': 'send',
        'senderId': config['sender_id'],
        'authToken': config['auth_token'],
        'messageText': message,
        'receiverId': clean_mobile
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(config['api_url'], params=params, timeout=30)
            if response.status_code == 200:
                return {"message": "Test message sent successfully", "status": "success"}
            else:
                return {"message": f"API returned status {response.status_code}", "status": "failed", "response": response.text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send test message: {str(e)}")

# ============== WHATSAPP LOGS ROUTES ==============

@api_router.get("/whatsapp-logs")
async def get_whatsapp_logs(
    skip: int = 0,
    limit: int = 50,
    message_type: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get WhatsApp logs with filtering and pagination"""
    query = {}
    
    if message_type:
        query['message_type'] = message_type
    
    if status:
        query['status'] = status
    
    if search:
        query['$or'] = [
            {'recipient_phone': {'$regex': search, '$options': 'i'}},
            {'recipient_name': {'$regex': search, '$options': 'i'}},
            {'message_preview': {'$regex': search, '$options': 'i'}}
        ]
    
    total = await db.whatsapp_logs.count_documents(query)
    
    logs = await db.whatsapp_logs.find(query, {'_id': 0}).sort('created_at', -1).skip(skip).limit(limit).to_list(limit)
    
    # Parse dates
    for log in logs:
        if isinstance(log.get('created_at'), str):
            log['created_at'] = datetime.fromisoformat(log['created_at'].replace('Z', '+00:00'))
    
    return {
        'logs': logs,
        'total': total,
        'skip': skip,
        'limit': limit
    }

@api_router.get("/whatsapp-logs/stats")
async def get_whatsapp_logs_stats(current_user: dict = Depends(get_current_user)):
    """Get WhatsApp logs statistics"""
    total = await db.whatsapp_logs.count_documents({})
    success = await db.whatsapp_logs.count_documents({'status': 'success'})
    failed = await db.whatsapp_logs.count_documents({'status': 'failed'})
    
    # Get counts by message type
    pipeline = [
        {'$group': {'_id': '$message_type', 'count': {'$sum': 1}}},
        {'$sort': {'count': -1}}
    ]
    type_counts = await db.whatsapp_logs.aggregate(pipeline).to_list(100)
    
    return {
        'total': total,
        'success': success,
        'failed': failed,
        'by_type': {item['_id']: item['count'] for item in type_counts}
    }

@api_router.delete("/whatsapp-logs/{log_id}")
async def delete_whatsapp_log(log_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a WhatsApp log entry"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can delete logs")
    
    result = await db.whatsapp_logs.delete_one({'id': log_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Log not found")
    
    return {"message": "Log deleted successfully"}

@api_router.delete("/whatsapp-logs")
async def clear_whatsapp_logs(current_user: dict = Depends(get_current_user)):
    """Clear all WhatsApp logs (admin only)"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can clear logs")
    
    result = await db.whatsapp_logs.delete_many({})
    return {"message": f"Deleted {result.deleted_count} logs"}

# ============== USER MANAGEMENT ROUTES ==============

@api_router.get("/users")
async def get_users(current_user: dict = Depends(get_current_user)):
    """Get all users (admin only)"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can view users")
    
    users = await db.users.find({}, {'_id': 0, 'password': 0}).to_list(100)
    
    # Parse dates
    for user in users:
        if isinstance(user.get('created_at'), str):
            user['created_at'] = datetime.fromisoformat(user['created_at'].replace('Z', '+00:00'))
    
    return users

@api_router.post("/users")
async def create_user(user_data: UserCreateByAdmin, current_user: dict = Depends(get_current_user)):
    """Create a new user (admin only)"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can create users")
    
    # Check if email already exists
    existing = await db.users.find_one({'email': user_data.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    # Default permissions for staff
    default_permissions = UserPermissions()
    permissions = user_data.permissions or default_permissions
    
    # Admin gets all permissions by default
    if user_data.role == 'admin':
        permissions = UserPermissions(
            doctors=True, medicals=True, agencies=True, items=True, orders=True,
            expenses=True, reminders=True, pending_items=True, email_logs=True,
            whatsapp_logs=True, users=True, smtp_settings=True, company_settings=True,
            whatsapp_settings=True
        )
    
    user_doc = {
        'id': user_id,
        'email': user_data.email.lower(),
        'password': pwd_context.hash(user_data.password),
        'name': user_data.name,
        'role': user_data.role,
        'permissions': permissions.model_dump(),
        'created_at': now.isoformat()
    }
    
    await db.users.insert_one(user_doc)
    
    return {
        'id': user_id,
        'email': user_data.email.lower(),
        'name': user_data.name,
        'role': user_data.role,
        'permissions': permissions.model_dump(),
        'created_at': now
    }

@api_router.put("/users/{user_id}")
async def update_user(user_id: str, user_data: UserUpdateByAdmin, current_user: dict = Depends(get_current_user)):
    """Update a user (admin only)"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can update users")
    
    # Get existing user
    existing = await db.users.find_one({'id': user_id})
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")
    
    update_doc = {}
    
    if user_data.email:
        # Check if new email already exists for another user
        email_exists = await db.users.find_one({'email': user_data.email.lower(), 'id': {'$ne': user_id}})
        if email_exists:
            raise HTTPException(status_code=400, detail="Email already in use")
        update_doc['email'] = user_data.email.lower()
    
    if user_data.name:
        update_doc['name'] = user_data.name
    
    if user_data.role:
        update_doc['role'] = user_data.role
    
    if user_data.password:
        update_doc['password'] = pwd_context.hash(user_data.password)
    
    if user_data.permissions:
        update_doc['permissions'] = user_data.permissions.model_dump()
    
    if update_doc:
        await db.users.update_one({'id': user_id}, {'$set': update_doc})
    
    # Return updated user
    updated = await db.users.find_one({'id': user_id}, {'_id': 0, 'password': 0})
    if isinstance(updated.get('created_at'), str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'].replace('Z', '+00:00'))
    
    return updated

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a user (admin only)"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can delete users")
    
    # Prevent deleting yourself
    if user_id == current_user['id']:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    result = await db.users.delete_one({'id': user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "User deleted successfully"}

@api_router.get("/users/{user_id}")
async def get_user(user_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific user (admin only)"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can view user details")
    
    user = await db.users.find_one({'id': user_id}, {'_id': 0, 'password': 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if isinstance(user.get('created_at'), str):
        user['created_at'] = datetime.fromisoformat(user['created_at'].replace('Z', '+00:00'))
    
    return user

# ============== HEALTH CHECK ==============

@api_router.get("/")
async def root():
    return {"message": "VMP CRM API is running"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    """Start background tasks on app startup"""
    global daily_reminder_task
    daily_reminder_task = asyncio.create_task(send_daily_reminder_summary())
    logger.info("Daily reminder background task started")

@app.on_event("shutdown")
async def shutdown_db_client():
    global daily_reminder_task
    if daily_reminder_task:
        daily_reminder_task.cancel()
        try:
            await daily_reminder_task
        except asyncio.CancelledError:
            pass
        logger.info("Daily reminder background task stopped")
    client.close()
