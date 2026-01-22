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
    created_at: datetime
    updated_at: datetime

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
    category: Optional[str] = None
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
    category: Optional[str] = None
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
    category: Optional[str] = None
    composition: Optional[str] = None
    offer: Optional[str] = None
    special_offer: Optional[str] = None
    mrp: float
    rate: float
    gst: float
    custom_fields: List[CustomField] = []
    image_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime

class CategoryResponse(BaseModel):
    name: str
    count: int

# ============== COMPANY SETTINGS MODELS ==============

class CompanySettingsCreate(BaseModel):
    company_name: str
    address: str
    email: EmailStr
    gst_number: str
    drug_license: str
    logo_base64: Optional[str] = None
    terms_conditions: Optional[str] = None

class CompanySettingsResponse(BaseModel):
    id: str
    company_name: str
    address: str
    email: str
    gst_number: str
    drug_license: str
    logo_url: Optional[str] = None
    terms_conditions: Optional[str] = None
    updated_at: datetime

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
    items: List[OrderItem]

class OTPVerify(BaseModel):
    mobile: str
    otp: str
    items: List[OrderItem]
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
        created_at = doc['created_at']
        updated_at = doc['updated_at']
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
        if isinstance(updated_at, str):
            updated_at = datetime.fromisoformat(updated_at.replace('Z', '+00:00'))
        
        result.append(DoctorResponse(
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
    
    return result

@api_router.get("/doctors/{doctor_id}", response_model=DoctorResponse)
async def get_doctor(doctor_id: str, current_user: dict = Depends(get_current_user)):
    doctor = await db.doctors.find_one({'id': doctor_id}, {'_id': 0})
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    
    created_at = doctor['created_at']
    updated_at = doctor['updated_at']
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
    if isinstance(updated_at, str):
        updated_at = datetime.fromisoformat(updated_at.replace('Z', '+00:00'))
    
    return DoctorResponse(
        id=doctor['id'],
        customer_code=doctor['customer_code'],
        name=doctor['name'],
        reg_no=doctor['reg_no'],
        address=doctor['address'],
        email=doctor['email'],
        phone=doctor['phone'],
        lead_status=doctor['lead_status'],
        dob=doctor.get('dob'),
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
    
    created_at = updated_doctor['created_at']
    updated_at = updated_doctor['updated_at']
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
    if isinstance(updated_at, str):
        updated_at = datetime.fromisoformat(updated_at.replace('Z', '+00:00'))
    
    return DoctorResponse(
        id=updated_doctor['id'],
        customer_code=updated_doctor['customer_code'],
        name=updated_doctor['name'],
        reg_no=updated_doctor['reg_no'],
        address=updated_doctor['address'],
        email=updated_doctor['email'],
        phone=updated_doctor['phone'],
        lead_status=updated_doctor['lead_status'],
        dob=updated_doctor.get('dob'),
        created_at=created_at,
        updated_at=updated_at
    )

@api_router.delete("/doctors/{doctor_id}")
async def delete_doctor(doctor_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.doctors.delete_one({'id': doctor_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Doctor not found")
    return {"message": "Doctor deleted successfully"}

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
        'category': item_data.category,
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
        category=item_data.category,
        composition=item_data.composition,
        offer=item_data.offer,
        special_offer=item_data.special_offer,
        mrp=item_data.mrp,
        rate=item_data.rate,
        gst=item_data.gst,
        custom_fields=item_data.custom_fields or [],
        image_url=f"/api/items/{item_id}/image" if processed_image else None,
        created_at=now,
        updated_at=now
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
    category: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    
    if search:
        query['$or'] = [
            {'item_name': {'$regex': search, '$options': 'i'}},
            {'item_code': {'$regex': search, '$options': 'i'}},
            {'composition': {'$regex': search, '$options': 'i'}}
        ]
    
    if category:
        query['category'] = category
    
    items = await db.items.find(query, {'_id': 0, 'image_webp': 0}).sort('created_at', -1).to_list(1000)
    
    result = []
    for item in items:
        created_at = item['created_at']
        updated_at = item['updated_at']
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
        if isinstance(updated_at, str):
            updated_at = datetime.fromisoformat(updated_at.replace('Z', '+00:00'))
        
        custom_fields = [CustomField(**cf) for cf in item.get('custom_fields', [])]
        
        # Check if image exists
        has_image = await db.items.find_one({'id': item['id'], 'image_webp': {'$ne': None}}, {'_id': 1})
        
        result.append(ItemResponse(
            id=item['id'],
            item_code=item['item_code'],
            item_name=item['item_name'],
            category=item.get('category'),
            composition=item.get('composition'),
            offer=item.get('offer'),
            mrp=item['mrp'],
            rate=item['rate'],
            gst=item.get('gst', 0),
            custom_fields=custom_fields,
            image_url=f"/api/items/{item['id']}/image" if has_image else None,
            created_at=created_at,
            updated_at=updated_at
        ))
    
    return result

@api_router.get("/items/{item_id}", response_model=ItemResponse)
async def get_item(item_id: str, current_user: dict = Depends(get_current_user)):
    item = await db.items.find_one({'id': item_id}, {'_id': 0, 'image_webp': 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    created_at = item['created_at']
    updated_at = item['updated_at']
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
    if isinstance(updated_at, str):
        updated_at = datetime.fromisoformat(updated_at.replace('Z', '+00:00'))
    
    custom_fields = [CustomField(**cf) for cf in item.get('custom_fields', [])]
    
    # Check if image exists
    has_image = await db.items.find_one({'id': item_id, 'image_webp': {'$ne': None}}, {'_id': 1})
    
    return ItemResponse(
        id=item['id'],
        item_code=item['item_code'],
        item_name=item['item_name'],
        category=item.get('category'),
        composition=item.get('composition'),
        offer=item.get('offer'),
        mrp=item['mrp'],
        rate=item['rate'],
        gst=item.get('gst', 0),
        custom_fields=custom_fields,
        image_url=f"/api/items/{item['id']}/image" if has_image else None,
        created_at=created_at,
        updated_at=updated_at
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
    updated_at = updated_item['updated_at']
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
    if isinstance(updated_at, str):
        updated_at = datetime.fromisoformat(updated_at.replace('Z', '+00:00'))
    
    custom_fields = [CustomField(**cf) for cf in updated_item.get('custom_fields', [])]
    
    # Check if image exists
    has_image = await db.items.find_one({'id': item_id, 'image_webp': {'$ne': None}}, {'_id': 1})
    
    return ItemResponse(
        id=updated_item['id'],
        item_code=updated_item['item_code'],
        item_name=updated_item['item_name'],
        category=updated_item.get('category'),
        composition=updated_item.get('composition'),
        offer=updated_item.get('offer'),
        mrp=updated_item['mrp'],
        rate=updated_item['rate'],
        gst=updated_item.get('gst', 0),
        custom_fields=custom_fields,
        image_url=f"/api/items/{item_id}/image" if has_image else None,
        created_at=created_at,
        updated_at=updated_at
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
    
    # Delete existing settings (only one allowed)
    await db.company_settings.delete_many({})
    
    settings_doc = {
        'id': settings_id,
        'company_name': settings.company_name,
        'address': settings.address,
        'email': settings.email,
        'gst_number': settings.gst_number,
        'drug_license': settings.drug_license,
        'logo_webp': processed_logo,
        'terms_conditions': settings.terms_conditions,
        'updated_at': now.isoformat()
    }
    
    await db.company_settings.insert_one(settings_doc)
    
    return CompanySettingsResponse(
        id=settings_id,
        company_name=settings.company_name,
        address=settings.address,
        email=settings.email,
        gst_number=settings.gst_number,
        drug_license=settings.drug_license,
        logo_url="/api/company-settings/logo" if processed_logo else None,
        terms_conditions=settings.terms_conditions,
        updated_at=now
    )

@api_router.get("/company-settings", response_model=Optional[CompanySettingsResponse])
async def get_company_settings(current_user: dict = Depends(get_current_user)):
    settings = await db.company_settings.find_one({}, {'_id': 0, 'logo_webp': 0})
    if not settings:
        return None
    
    updated_at = settings['updated_at']
    if isinstance(updated_at, str):
        updated_at = datetime.fromisoformat(updated_at.replace('Z', '+00:00'))
    
    has_logo = await db.company_settings.find_one({'logo_webp': {'$ne': None}}, {'_id': 1})
    
    return CompanySettingsResponse(
        id=settings['id'],
        company_name=settings['company_name'],
        address=settings['address'],
        email=settings['email'],
        gst_number=settings['gst_number'],
        drug_license=settings['drug_license'],
        logo_url="/api/company-settings/logo" if has_logo else None,
        terms_conditions=settings.get('terms_conditions'),
        updated_at=updated_at
    )

@api_router.get("/company-settings/logo")
async def get_company_logo():
    settings = await db.company_settings.find_one({}, {'logo_webp': 1})
    if not settings or not settings.get('logo_webp'):
        raise HTTPException(status_code=404, detail="Logo not found")
    
    image_data = base64.b64decode(settings['logo_webp'])
    return Response(content=image_data, media_type="image/webp")

# ============== PUBLIC SHOWCASE ROUTES (NO AUTH) ==============

@api_router.get("/public/company-settings")
async def get_public_company_settings():
    settings = await db.company_settings.find_one({}, {'_id': 0, 'logo_webp': 0})
    if not settings:
        return None
    
    has_logo = await db.company_settings.find_one({'logo_webp': {'$ne': None}}, {'_id': 1})
    
    return {
        'company_name': settings['company_name'],
        'address': settings['address'],
        'email': settings['email'],
        'gst_number': settings['gst_number'],
        'drug_license': settings['drug_license'],
        'logo_url': "/api/company-settings/logo" if has_logo else None,
        'terms_conditions': settings.get('terms_conditions')
    }

@api_router.get("/public/items")
async def get_public_items():
    """Get all items grouped by category for public showcase"""
    items = await db.items.find({}, {'_id': 0, 'image_webp': 0, 'created_by': 0}).sort('category', 1).to_list(1000)
    
    # Group by category
    categories = {}
    uncategorized = []
    
    for item in items:
        has_image = await db.items.find_one({'id': item['id'], 'image_webp': {'$ne': None}}, {'_id': 1})
        item_data = {
            'id': item['id'],
            'item_code': item['item_code'],
            'item_name': item['item_name'],
            'composition': item.get('composition'),
            'offer': item.get('offer'),
            'mrp': item['mrp'],
            'rate': item['rate'],
            'gst': item.get('gst', 0),
            'image_url': f"/api/items/{item['id']}/image" if has_image else None
        }
        
        category = item.get('category')
        if category:
            if category not in categories:
                categories[category] = []
            categories[category].append(item_data)
        else:
            uncategorized.append(item_data)
    
    result = []
    for cat_name, cat_items in sorted(categories.items()):
        result.append({'category': cat_name, 'items': cat_items})
    
    if uncategorized:
        result.append({'category': 'Other Products', 'items': uncategorized})
    
    return result

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

async def send_whatsapp_otp(mobile: str, otp: str):
    """Send OTP via WhatsApp API"""
    config = await get_whatsapp_config()
    
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
            return response.status_code == 200
    except Exception as e:
        logger.error(f"WhatsApp OTP error: {str(e)}")
        return False

async def send_whatsapp_order(mobile: str, items: List[OrderItem], order_number: str):
    """Send order confirmation via WhatsApp"""
    config = await get_whatsapp_config()
    
    clean_mobile = ''.join(filter(str.isdigit, mobile))
    if not clean_mobile.startswith('91'):
        clean_mobile = f"91{clean_mobile[-10:]}"
    
    # Build order message
    items_text = "\n".join([f"- {item.item_name}: {item.quantity}" for item in items if item.quantity])
    message = f"Order #{order_number}\n\nItems:\n{items_text}\n\nThank you for your order!"
    
    params = {
        'action': 'send',
        'senderId': config['sender_id'],
        'authToken': config['auth_token'],
        'messageText': message,
        'receiverId': clean_mobile
    }
    
    try:
        async with httpx.AsyncClient() as client:
            await client.get(config['api_url'], params=params, timeout=30)
    except Exception as e:
        logger.error(f"WhatsApp order message error: {str(e)}")

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
    
    # Send order confirmation via WhatsApp
    await send_whatsapp_order(request.mobile, valid_items, order_number)
    
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
            ip_address=order.get('ip_address'),
            location=order.get('location'),
            device_info=order.get('device_info'),
            created_at=created_at
        ))
    
    return result

@api_router.put("/orders/{order_id}/status")
async def update_order_status(order_id: str, status: str, current_user: dict = Depends(get_current_user)):
    result = await db.orders.update_one(
        {'id': order_id},
        {'$set': {'status': status, 'updated_at': datetime.now(timezone.utc).isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    return {"message": "Order status updated"}

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

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
