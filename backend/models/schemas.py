"""All Pydantic models for the CRM backend."""
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
from datetime import datetime

# ============== MODELS ==============

# Greeting Template Models
class GreetingTemplateCreate(BaseModel):
    type: str  # birthday, anniversary
    message: str  # Template with {customer_name}, {company_name} placeholders
    image_url: Optional[str] = None
    is_active: bool = True

class GreetingTemplateUpdate(BaseModel):
    type: Optional[str] = None
    message: Optional[str] = None
    image_url: Optional[str] = None
    is_active: Optional[bool] = None

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
    address: Optional[str] = None  # Legacy field for backward compatibility
    address_line_1: Optional[str] = None
    address_line_2: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    delivery_station: Optional[str] = None
    transport_id: Optional[str] = None  # Preferred transport
    email: EmailStr
    phone: str
    lead_status: str = "Pipeline"
    dob: Optional[str] = None
    opening_balance: Optional[float] = 0

class DoctorUpdate(BaseModel):
    name: Optional[str] = None
    reg_no: Optional[str] = None
    address: Optional[str] = None
    address_line_1: Optional[str] = None
    address_line_2: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    delivery_station: Optional[str] = None
    transport_id: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    lead_status: Optional[str] = None
    dob: Optional[str] = None
    priority: Optional[str] = None
    last_contact_date: Optional[str] = None
    follow_up_date: Optional[str] = None
    opening_balance: Optional[float] = None

class DoctorResponse(BaseModel):
    id: str
    customer_code: str
    name: str
    reg_no: str
    address: Optional[str] = None
    address_line_1: Optional[str] = None
    address_line_2: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    delivery_station: Optional[str] = None
    transport_id: Optional[str] = None
    transport_name: Optional[str] = None
    email: str
    phone: str
    lead_status: str
    dob: Optional[str] = None
    priority: Optional[str] = None
    last_contact_date: Optional[str] = None
    follow_up_date: Optional[str] = None
    is_portal_customer: Optional[bool] = False
    portal_customer_id: Optional[str] = None
    opening_balance: Optional[float] = 0
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
    address: Optional[str] = None  # Legacy field
    address_line_1: Optional[str] = None
    address_line_2: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    pincode: Optional[str] = None
    delivery_station: Optional[str] = None
    transport_id: Optional[str] = None  # Preferred transport
    email: Optional[EmailStr] = None
    phone: str
    alternate_phone: Optional[str] = None
    lead_status: str = "Pipeline"
    birthday: Optional[str] = None  # Format: YYYY-MM-DD
    anniversary: Optional[str] = None  # Format: YYYY-MM-DD
    opening_balance: Optional[float] = 0

class MedicalUpdate(BaseModel):
    name: Optional[str] = None
    proprietor_name: Optional[str] = None
    gst_number: Optional[str] = None
    drug_license: Optional[str] = None
    address: Optional[str] = None
    address_line_1: Optional[str] = None
    address_line_2: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    pincode: Optional[str] = None
    delivery_station: Optional[str] = None
    transport_id: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    alternate_phone: Optional[str] = None
    lead_status: Optional[str] = None
    priority: Optional[str] = None
    last_contact_date: Optional[str] = None
    follow_up_date: Optional[str] = None
    birthday: Optional[str] = None
    anniversary: Optional[str] = None
    opening_balance: Optional[float] = None

class MedicalResponse(BaseModel):
    id: str
    customer_code: str
    name: str
    proprietor_name: Optional[str] = None
    gst_number: Optional[str] = None
    drug_license: Optional[str] = None
    address: Optional[str] = None
    address_line_1: Optional[str] = None
    address_line_2: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    pincode: Optional[str] = None
    delivery_station: Optional[str] = None
    transport_id: Optional[str] = None
    transport_name: Optional[str] = None  # Populated from transport lookup
    email: Optional[str] = None
    phone: str
    alternate_phone: Optional[str] = None
    lead_status: str
    priority: Optional[str] = None
    last_contact_date: Optional[str] = None
    follow_up_date: Optional[str] = None
    birthday: Optional[str] = None
    anniversary: Optional[str] = None
    is_portal_customer: Optional[bool] = False  # Flag for portal customers
    portal_customer_id: Optional[str] = None  # Link to portal_customers
    opening_balance: Optional[float] = 0
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
    address: Optional[str] = None  # Legacy field
    address_line_1: Optional[str] = None
    address_line_2: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    pincode: Optional[str] = None
    delivery_station: Optional[str] = None
    transport_id: Optional[str] = None  # Preferred transport
    email: Optional[EmailStr] = None
    phone: str
    alternate_phone: Optional[str] = None
    lead_status: str = "Pipeline"
    birthday: Optional[str] = None
    anniversary: Optional[str] = None
    opening_balance: Optional[float] = 0

class AgencyUpdate(BaseModel):
    name: Optional[str] = None
    proprietor_name: Optional[str] = None
    gst_number: Optional[str] = None
    drug_license: Optional[str] = None
    address: Optional[str] = None
    address_line_1: Optional[str] = None
    address_line_2: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    pincode: Optional[str] = None
    delivery_station: Optional[str] = None
    transport_id: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    alternate_phone: Optional[str] = None
    lead_status: Optional[str] = None
    priority: Optional[str] = None
    last_contact_date: Optional[str] = None
    follow_up_date: Optional[str] = None
    birthday: Optional[str] = None
    anniversary: Optional[str] = None
    opening_balance: Optional[float] = None

class AgencyResponse(BaseModel):
    id: str
    customer_code: str
    name: str
    proprietor_name: Optional[str] = None
    gst_number: Optional[str] = None
    drug_license: Optional[str] = None
    address: Optional[str] = None
    address_line_1: Optional[str] = None
    address_line_2: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    pincode: Optional[str] = None
    delivery_station: Optional[str] = None
    transport_id: Optional[str] = None
    transport_name: Optional[str] = None
    email: Optional[str] = None
    phone: str
    alternate_phone: Optional[str] = None
    lead_status: str
    priority: Optional[str] = None
    last_contact_date: Optional[str] = None
    follow_up_date: Optional[str] = None
    birthday: Optional[str] = None
    anniversary: Optional[str] = None
    is_portal_customer: Optional[bool] = False
    portal_customer_id: Optional[str] = None
    opening_balance: Optional[float] = 0
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
    # Common pricing
    mrp: float
    gst: float = 0
    # Role-based pricing - Doctors
    rate_doctors: Optional[float] = None
    offer_doctors: Optional[str] = None
    special_offer_doctors: Optional[str] = None
    # Role-based pricing - Medicals
    rate_medicals: Optional[float] = None
    offer_medicals: Optional[str] = None
    special_offer_medicals: Optional[str] = None
    # Role-based pricing - Agencies
    rate_agencies: Optional[float] = None
    offer_agencies: Optional[str] = None
    special_offer_agencies: Optional[str] = None
    # Special Offer 2 - for dashboard scroll (near expiry, launch, no movement)
    special_offer_2_doctors: Optional[str] = None
    special_offer_2_doctors_desc: Optional[str] = None
    special_offer_2_medicals: Optional[str] = None
    special_offer_2_medicals_desc: Optional[str] = None
    special_offer_2_agencies: Optional[str] = None
    special_offer_2_agencies_desc: Optional[str] = None
    # Legacy fields (for backward compatibility)
    rate: Optional[float] = None
    offer: Optional[str] = None
    special_offer: Optional[str] = None
    custom_fields: Optional[List[CustomField]] = []
    image_base64: Optional[str] = None  # Base64 encoded image
    out_of_stock: Optional[bool] = False
    is_hidden: Optional[bool] = False  # Global hide - hidden items won't show to MR/customers

class ItemUpdate(BaseModel):
    item_name: Optional[str] = None
    item_code: Optional[str] = None
    main_categories: Optional[List[str]] = None
    subcategories: Optional[List[str]] = None
    composition: Optional[str] = None
    mrp: Optional[float] = None
    gst: Optional[float] = None
    # Role-based pricing - Doctors
    rate_doctors: Optional[float] = None
    offer_doctors: Optional[str] = None
    special_offer_doctors: Optional[str] = None
    # Role-based pricing - Medicals
    rate_medicals: Optional[float] = None
    offer_medicals: Optional[str] = None
    special_offer_medicals: Optional[str] = None
    # Role-based pricing - Agencies
    rate_agencies: Optional[float] = None
    offer_agencies: Optional[str] = None
    special_offer_agencies: Optional[str] = None
    # Special Offer 2 - for dashboard scroll (near expiry, launch, no movement)
    special_offer_2_doctors: Optional[str] = None
    special_offer_2_doctors_desc: Optional[str] = None
    special_offer_2_medicals: Optional[str] = None
    special_offer_2_medicals_desc: Optional[str] = None
    special_offer_2_agencies: Optional[str] = None
    special_offer_2_agencies_desc: Optional[str] = None
    # Legacy fields
    rate: Optional[float] = None
    offer: Optional[str] = None
    special_offer: Optional[str] = None
    custom_fields: Optional[List[CustomField]] = None
    image_base64: Optional[str] = None
    out_of_stock: Optional[bool] = None
    is_hidden: Optional[bool] = None  # Global hide

class ItemResponse(BaseModel):
    id: str
    item_code: str
    item_name: str
    main_categories: List[str] = []
    subcategories: List[str] = []
    composition: Optional[str] = None
    mrp: float
    gst: float
    # Role-based pricing - Doctors
    rate_doctors: Optional[float] = None
    offer_doctors: Optional[str] = None
    special_offer_doctors: Optional[str] = None
    # Role-based pricing - Medicals
    rate_medicals: Optional[float] = None
    offer_medicals: Optional[str] = None
    special_offer_medicals: Optional[str] = None
    # Role-based pricing - Agencies
    rate_agencies: Optional[float] = None
    offer_agencies: Optional[str] = None
    special_offer_agencies: Optional[str] = None
    # Special Offer 2 - for dashboard scroll (near expiry, launch, no movement)
    special_offer_2_doctors: Optional[str] = None
    special_offer_2_doctors_desc: Optional[str] = None
    special_offer_2_medicals: Optional[str] = None
    special_offer_2_medicals_desc: Optional[str] = None
    special_offer_2_agencies: Optional[str] = None
    special_offer_2_agencies_desc: Optional[str] = None
    # Legacy fields (for backward compatibility)
    rate: float
    offer: Optional[str] = None
    special_offer: Optional[str] = None
    custom_fields: List[CustomField] = []
    image_url: Optional[str] = None
    out_of_stock: Optional[bool] = False
    is_hidden: Optional[bool] = False
    created_at: datetime

class CategoryResponse(BaseModel):
    name: str
    count: int

# ============== CUSTOMER PORTAL MODELS ==============

class CustomerRegister(BaseModel):
    """Customer registration request"""
    name: str
    phone: str
    email: Optional[EmailStr] = None
    password: str
    role: str  # doctor, medical, agency
    # Role-specific fields (Doctor)
    reg_no: Optional[str] = None
    dob: Optional[str] = None
    # Role-specific fields (Medical/Agency)
    proprietor_name: Optional[str] = None
    gst_number: Optional[str] = None
    drug_license: Optional[str] = None
    alternate_phone: Optional[str] = None
    birthday: Optional[str] = None
    anniversary: Optional[str] = None
    # Address fields
    address_line_1: Optional[str] = None
    address_line_2: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    pincode: Optional[str] = None
    delivery_station: Optional[str] = None
    transport_id: Optional[str] = None

class CustomerLogin(BaseModel):
    phone: str
    password: str

class CustomerOTPRequest(BaseModel):
    phone: str
    purpose: str = "register"  # register, reset_password

class CustomerOTPVerify(BaseModel):
    phone: str
    otp: str
    purpose: str = "register"

class CustomerResetPassword(BaseModel):
    phone: str
    otp: str
    new_password: str

class CustomerProfileUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    reg_no: Optional[str] = None
    proprietor_name: Optional[str] = None
    gst_number: Optional[str] = None
    drug_license: Optional[str] = None
    address_line_1: Optional[str] = None
    address_line_2: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    pincode: Optional[str] = None
    delivery_station: Optional[str] = None
    transport_id: Optional[str] = None

class CustomerResponse(BaseModel):
    id: str
    customer_code: str
    name: str
    phone: str
    email: Optional[str] = None
    role: str  # doctor, medical, agency
    status: str  # pending_approval, approved, rejected, suspended
    reg_no: Optional[str] = None
    proprietor_name: Optional[str] = None
    gst_number: Optional[str] = None
    drug_license: Optional[str] = None
    address_line_1: Optional[str] = None
    address_line_2: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    pincode: Optional[str] = None
    delivery_station: Optional[str] = None
    transport_id: Optional[str] = None
    transport_name: Optional[str] = None
    created_at: datetime
    approved_at: Optional[datetime] = None
    approved_by: Optional[str] = None

class CustomerApproval(BaseModel):
    status: str  # approved, rejected, suspended
    rejection_reason: Optional[str] = None

# ============== FALLBACK OTP MODELS ==============

class FallbackOTPCreate(BaseModel):
    otp: str

class FallbackOTPResponse(BaseModel):
    id: str
    otp: str
    is_active: bool
    used_count: int
    created_at: datetime
    created_by: str

# ============== MARKETING MODELS ==============

class MarketingTemplateCreate(BaseModel):
    name: str
    category: str  # greeting, product_promo, announcement, circular
    message: str
    is_active: bool = True

class MarketingTemplateResponse(BaseModel):
    id: str
    name: str
    category: str
    message: str
    is_active: bool
    created_at: datetime
    created_by: str

class MarketingCampaignCreate(BaseModel):
    name: str
    campaign_type: str  # product_promo, greeting, announcement, circular
    target_entity: str  # doctors, medicals, agencies, all
    target_status: str  # all, pipeline, customer, contacted, not_interested, closed
    recipient_ids: List[str]  # Selected recipient IDs
    message: str
    item_ids: Optional[List[str]] = None  # For product promotions
    image_base64: Optional[str] = None  # Optional image attachment
    pdf_base64: Optional[str] = None  # Optional PDF attachment
    scheduled_at: Optional[str] = None  # ISO datetime for scheduling
    batch_size: int = 10  # Messages per batch
    batch_delay_seconds: int = 60  # Delay between batches (to avoid ban)
    send_push: Optional[bool] = False  # Also send as push notification

class MarketingCampaignResponse(BaseModel):
    id: str
    name: str
    campaign_type: str
    target_entity: str
    target_status: str
    total_recipients: int
    sent_count: int
    failed_count: int
    pending_count: int
    status: str  # draft, scheduled, sending, completed, cancelled
    message_preview: str
    has_image: bool
    scheduled_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    created_by: str

class CampaignLogResponse(BaseModel):
    id: str
    campaign_id: str
    recipient_id: str
    recipient_name: str
    recipient_phone: str
    recipient_type: str  # doctor, medical, agency
    reference_number: str  # Random ref for anti-ban
    status: str  # pending, sent, failed
    error_message: Optional[str] = None
    sent_at: Optional[datetime] = None

# ============== SUPPORT TICKET MODELS ==============

class TicketCreate(BaseModel):
    subject: str
    description: str
    order_id: Optional[str] = None  # Link to order if related
    priority: str = "medium"  # low, medium, high

class TicketReply(BaseModel):
    message: str

class TicketResponse(BaseModel):
    id: str
    ticket_number: str
    customer_id: str
    customer_name: str
    customer_phone: str
    customer_role: str
    subject: str
    description: str
    order_id: Optional[str] = None
    order_number: Optional[str] = None
    priority: str
    status: str  # open, in_progress, resolved, closed
    replies: List[dict] = []
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime] = None

# ============== COMPANY SETTINGS MODELS ==============

class CompanySettingsCreate(BaseModel):
    company_name: str
    company_short_name: Optional[str] = None  # Short name for messages (e.g., VMPPL)
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
    company_short_name: Optional[str] = None
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
    delete_orders: bool = False
    expenses: bool = True
    reminders: bool = True
    pending_items: bool = True
    marketing: bool = True
    support: bool = True
    portal_customers: bool = True
    email_logs: bool = False
    whatsapp_logs: bool = False
    users: bool = False
    smtp_settings: bool = False
    company_settings: bool = False
    whatsapp_settings: bool = False
    backup: bool = False

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

class ManualOrderCreate(BaseModel):
    customer_name: str
    customer_phone: str
    customer_email: Optional[str] = None
    customer_address: Optional[str] = None
    customer_type: str = "doctor"  # doctor, medical, agency
    customer_id: Optional[str] = None  # If linking to existing entity
    items: List[OrderItem]
    pending_items: Optional[List[dict]] = None  # Items to mark as pending (out of stock)

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
    payment_amount: Optional[float] = None
    expense_paid_by: Optional[str] = None
    expense_account: Optional[str] = None
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
    # MR Order fields
    source: Optional[str] = None
    mr_id: Optional[str] = None
    mr_name: Optional[str] = None
    cancel_requested: Optional[bool] = None
    cancel_requested_by: Optional[str] = None
    cancel_reason: Optional[str] = None
    # Additional fields
    notes: Optional[str] = None
    customer_type: Optional[str] = None
    created_by: Optional[str] = None
    # Transfer fields
    transferred_to_agency_id: Optional[str] = None
    transferred_to_agency_name: Optional[str] = None
    transferred_to_agency_phone: Optional[str] = None
    transferred_at: Optional[str] = None

# ============== WHATSAPP CONFIG MODELS ==============

class WhatsAppConfigCreate(BaseModel):
    name: str = "Default Config"
    api_url: str
    auth_token: str
    sender_id: str
    http_method: str = "GET"
    api_type: str = "query_param"  # 'query_param' (BotMasterSender) or 'rest_api' (AKNexus)
    instance_id: Optional[str] = None  # Required for rest_api type
    # Dynamic field name mappings (for query_param type)
    field_action: str = "action"
    field_sender_id: str = "senderId"
    field_auth_token: str = "authToken"
    field_message: str = "messageText"
    field_receiver: str = "receiverId"
    field_file_url: str = "fileUrl"
    field_file_caption: str = "fileCaption"
    # Action values (for query_param type)
    action_send: str = "send"
    action_send_file: str = "sendFile"
    is_active: bool = True

class WhatsAppConfigResponse(BaseModel):
    id: str
    name: str = "Default Config"
    api_url: str
    sender_id: str
    http_method: str = "GET"
    api_type: Optional[str] = "query_param"
    instance_id: Optional[str] = None
    field_action: Optional[str] = "action"
    field_sender_id: Optional[str] = "senderId"
    field_auth_token: Optional[str] = "authToken"
    field_message: Optional[str] = "messageText"
    field_receiver: Optional[str] = "receiverId"
    field_file_url: Optional[str] = "fileUrl"
    field_file_caption: Optional[str] = "fileCaption"
    action_send: Optional[str] = "send"
    action_send_file: Optional[str] = "sendFile"
    is_active: bool = True
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
    payment_amount: Optional[float] = None  # Amount for to_pay or paid
    # Expense details (only for 'paid' payment mode)
    expense_paid_by: Optional[str] = None  # Who paid for the transport
    expense_account: Optional[str] = None  # Which account was used
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

# ============== FOLLOWUP MODELS ==============

class FollowUpCreate(BaseModel):
    entity_type: str  # doctor, medical, agency
    entity_id: str
    notes: str
    new_status: Optional[str] = None  # Update lead status
    next_follow_up_date: Optional[str] = None  # YYYY-MM-DD
    next_follow_up_time: Optional[str] = None  # HH:MM

class FollowUpResponse(BaseModel):
    id: str
    entity_type: str
    entity_id: str
    entity_name: str
    notes: str
    new_status: Optional[str] = None
    next_follow_up_date: Optional[str] = None
    next_follow_up_time: Optional[str] = None
    status: str  # open, closed
    created_by: str
    created_at: str

# ============== MR (Medical Representative) MODELS ==============

class MRCreate(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None
    password: str
    state: str
    districts: List[str] = []
    status: str = "active"

class MRUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    state: Optional[str] = None
    districts: Optional[List[str]] = None
    status: Optional[str] = None

class VisualAidDeckCreate(BaseModel):
    name: str
    deck_type: str = "custom"  # category, subcategory, custom
    category: Optional[str] = None
    subcategory: Optional[str] = None
    description: Optional[str] = None
    status: str = "active"

class VisualAidDeckUpdate(BaseModel):
    name: Optional[str] = None
    deck_type: Optional[str] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None


# ============== ADMIN PROFILE MODELS ==============

class AdminProfileUpdate(BaseModel):
    name: str
    email: str

class AdminPasswordChange(BaseModel):
    current_password: str
    new_password: str



class AdminProfileUpdate(BaseModel):
    name: str
    email: str

class AdminPasswordChange(BaseModel):
    current_password: str
    new_password: str

