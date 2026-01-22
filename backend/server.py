from fastapi import FastAPI, APIRouter, HTTPException, Depends, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
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
