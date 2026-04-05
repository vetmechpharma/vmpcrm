#!/usr/bin/env python3
"""
VMP CRM - Database Migration Script (Non-Destructive)
=====================================================
Safely migrates/updates the MongoDB database without affecting existing data.
- Adds missing collections, indexes, and default fields
- Seeds default templates only if they don't exist
- Updates existing documents with new required fields (defaults only)
- 100% idempotent — safe to run multiple times

Usage:
  python3 migrate.py                          # Uses MONGO_URL from .env
  python3 migrate.py --mongo-url "mongodb://localhost:27017" --db-name "CRM_VETMECH"
"""
import asyncio
import sys
import os
import uuid
from datetime import datetime, timezone

# Try to load .env from same directory
env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, val = line.split('=', 1)
                val = val.strip().strip('"').strip("'")
                os.environ.setdefault(key.strip(), val)

try:
    from motor.motor_asyncio import AsyncIOMotorClient
except ImportError:
    print("[ERROR] motor package not installed. Run: pip install motor")
    sys.exit(1)

# ============================================================================
# Configuration
# ============================================================================

MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'CRM_VETMECH')

# Parse CLI args
for i, arg in enumerate(sys.argv[1:], 1):
    if arg == '--mongo-url' and i < len(sys.argv) - 1:
        MONGO_URL = sys.argv[i + 1]
    elif arg == '--db-name' and i < len(sys.argv) - 1:
        DB_NAME = sys.argv[i + 1]

# ============================================================================
# Color Output
# ============================================================================

GREEN = '\033[92m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RED = '\033[91m'
NC = '\033[0m'

def log_ok(msg):    print(f"{GREEN}[OK]{NC} {msg}")
def log_info(msg):  print(f"{BLUE}[INFO]{NC} {msg}")
def log_warn(msg):  print(f"{YELLOW}[WARN]{NC} {msg}")
def log_error(msg): print(f"{RED}[ERROR]{NC} {msg}")
def log_skip(msg):  print(f"{YELLOW}[SKIP]{NC} {msg}")

# ============================================================================
# Migration Steps
# ============================================================================

async def migrate():
    log_info(f"Connecting to MongoDB: {MONGO_URL}")
    log_info(f"Database: {DB_NAME}")

    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    # Verify connection
    try:
        await client.admin.command('ping')
        log_ok("MongoDB connection successful")
    except Exception as e:
        log_error(f"Cannot connect to MongoDB: {e}")
        sys.exit(1)

    existing_collections = await db.list_collection_names()
    log_info(f"Existing collections: {len(existing_collections)}")

    changes = 0

    # ------------------------------------------------------------------
    # Step 1: Ensure all required collections exist
    # ------------------------------------------------------------------
    log_info("Step 1: Ensuring collections exist...")
    required_collections = [
        'users', 'doctors', 'medicals', 'agencies', 'items', 'orders',
        'payments', 'invoices', 'expenses', 'expense_categories',
        'pending_items', 'transports', 'tasks', 'reminders', 'followups',
        'portal_customers', 'mrs', 'mr_visits', 'payment_requests',
        'company_settings', 'smtp_settings', 'smtp_config',
        'whatsapp_config', 'whatsapp_logs', 'email_logs',
        'message_templates', 'greeting_templates', 'greeting_logs',
        'marketing_campaigns', 'marketing_templates', 'campaign_logs',
        'visual_aid_decks', 'visual_aid_slides',
        'push_subscriptions', 'support_tickets',
        'system_settings', 'catalogue_settings', 'subcategory_order',
        'completed_reminders', 'backup_history',
        'doctor_notes', 'medical_notes', 'agency_notes',
        'otps', 'fallback_otps',
        'temp_ledger_pdfs', 'temp_backup_files',
    ]

    for coll_name in required_collections:
        if coll_name not in existing_collections:
            await db.create_collection(coll_name)
            log_ok(f"  Created collection: {coll_name}")
            changes += 1
        else:
            pass  # Already exists, skip silently

    # ------------------------------------------------------------------
    # Step 2: Create indexes for performance
    # ------------------------------------------------------------------
    log_info("Step 2: Creating indexes...")

    indexes = [
        ('users', 'email', True),
        ('users', 'id', True),
        ('doctors', 'id', True),
        ('doctors', 'phone', False),
        ('doctors', 'state', False),
        ('doctors', 'district', False),
        ('medicals', 'id', True),
        ('medicals', 'phone', False),
        ('medicals', 'state', False),
        ('agencies', 'id', True),
        ('agencies', 'phone', False),
        ('agencies', 'state', False),
        ('items', 'id', True),
        ('items', 'item_code', True),
        ('orders', 'id', True),
        ('orders', 'order_number', True),
        ('orders', 'doctor_phone', False),
        ('orders', 'status', False),
        ('orders', 'created_at', False),
        ('payments', 'id', True),
        ('payments', 'doctor_phone', False),
        ('pending_items', 'id', True),
        ('pending_items', 'doctor_phone', False),
        ('pending_items', 'item_code', False),
        ('pending_items', 'status', False),
        ('portal_customers', 'id', True),
        ('portal_customers', 'phone', True),
        ('mrs', 'id', True),
        ('mrs', 'phone', True),
        ('transports', 'id', True),
        ('expenses', 'id', True),
        ('tasks', 'id', True),
        ('reminders', 'id', True),
        ('followups', 'id', True),
        ('whatsapp_config', 'id', True),
        ('whatsapp_logs', 'id', True),
        ('whatsapp_logs', 'created_at', False),
        ('message_templates', 'key', False),
        ('greeting_templates', 'id', True),
        ('marketing_campaigns', 'id', True),
        ('visual_aid_decks', 'id', True),
        ('visual_aid_slides', 'id', True),
        ('visual_aid_slides', 'deck_id', False),
        ('push_subscriptions', 'id', True),
        ('support_tickets', 'id', True),
        ('support_tickets', 'customer_id', False),
        ('payment_requests', 'id', True),
        ('mr_visits', 'id', True),
        ('invoices', 'id', True),
        ('invoices', 'order_id', False),
    ]

    for coll_name, field, unique in indexes:
        try:
            await db[coll_name].create_index(field, unique=unique, background=True)
        except Exception:
            # Index might conflict with existing data if unique — just skip
            pass

    log_ok(f"  Ensured {len(indexes)} indexes")
    changes += 1

    # ------------------------------------------------------------------
    # Step 3: Update existing whatsapp_config docs with new fields
    # ------------------------------------------------------------------
    log_info("Step 3: Updating whatsapp_config with new fields...")

    wa_defaults = {
        'api_type': 'query_param',
        'instance_id': None,
        'is_active': True,
        'http_method': 'GET',
        'field_action': 'action',
        'field_sender_id': 'senderId',
        'field_auth_token': 'authToken',
        'field_message': 'messageText',
        'field_receiver': 'receiverId',
        'field_file_url': 'fileUrl',
        'field_file_caption': 'fileCaption',
        'action_send': 'send',
        'action_send_file': 'sendFile',
    }

    wa_configs = await db.whatsapp_config.find({}).to_list(100)
    wa_updated = 0
    for wc in wa_configs:
        update_fields = {}
        for field, default_val in wa_defaults.items():
            if field not in wc:
                update_fields[field] = default_val
        if update_fields:
            await db.whatsapp_config.update_one(
                {'_id': wc['_id']},
                {'$set': update_fields}
            )
            wa_updated += 1

    if wa_updated:
        log_ok(f"  Updated {wa_updated} whatsapp_config doc(s) with new fields")
        changes += wa_updated
    else:
        log_skip("  whatsapp_config already up to date (or no configs exist)")

    # If multiple configs exist but none is_active, activate the first one
    active_count = await db.whatsapp_config.count_documents({'is_active': True})
    total_wa = await db.whatsapp_config.count_documents({})
    if total_wa > 0 and active_count == 0:
        first = await db.whatsapp_config.find_one({})
        if first:
            await db.whatsapp_config.update_one({'_id': first['_id']}, {'$set': {'is_active': True}})
            log_ok("  Activated first whatsapp_config (none were active)")
            changes += 1

    # ------------------------------------------------------------------
    # Step 4: Seed default message templates (WA + Email) if empty
    # ------------------------------------------------------------------
    log_info("Step 4: Seeding default message templates...")

    existing_templates = await db.message_templates.count_documents({})
    if existing_templates == 0:
        default_wa_templates = [
            {'key': 'otp', 'name': 'OTP Verification', 'category': 'whatsapp',
             'variables': ['otp', 'company_short_name'],
             'template': 'Your {company_short_name} verification code is: *{otp}*\n\nThis code expires in 5 minutes. Do not share this code with anyone.'},
            {'key': 'order_confirmation', 'name': 'Order Confirmation', 'category': 'whatsapp',
             'variables': ['customer_name', 'order_number', 'item_count', 'items_text', 'company_short_name', 'company_phone'],
             'template': 'Hello {customer_name},\n\nYour order *{order_number}* has been received!\n\n*Items:*\n{items_text}\n\nWe will process your order shortly.\n\nRegards,\n*{company_short_name}*\n+{company_phone}'},
            {'key': 'status_confirmed', 'name': 'Order Confirmed', 'category': 'whatsapp',
             'variables': ['customer_name', 'order_number', 'company_short_name', 'company_phone'],
             'template': 'Hello {customer_name},\n\nYour order *{order_number}* has been *CONFIRMED*!\n\nWe are preparing your order for dispatch.\n\nRegards,\n*{company_short_name}*\n+{company_phone}'},
            {'key': 'status_processing', 'name': 'Order Processing', 'category': 'whatsapp',
             'variables': ['customer_name', 'order_number', 'company_short_name', 'company_phone'],
             'template': 'Hello {customer_name},\n\nYour order *{order_number}* is now being *PROCESSED*!\n\nRegards,\n*{company_short_name}*\n+{company_phone}'},
            {'key': 'status_ready', 'name': 'Ready to Dispatch', 'category': 'whatsapp',
             'variables': ['customer_name', 'order_number', 'items_text', 'transport_name', 'company_short_name', 'company_phone'],
             'template': 'Hello {customer_name},\n\nYour order *{order_number}* is *READY TO DISPATCH*!\n\n*Items:*\n{items_text}\n\n*Transport:* {transport_name}\n\nRegards,\n*{company_short_name}*\n+{company_phone}'},
            {'key': 'status_dispatched', 'name': 'Order Dispatched', 'category': 'whatsapp',
             'variables': ['customer_name', 'order_number', 'company_short_name', 'company_phone'],
             'template': 'Hello {customer_name},\n\nYour order *{order_number}* has been *DISPATCHED*!\n\nRegards,\n*{company_short_name}*\n+{company_phone}'},
            {'key': 'status_delivered', 'name': 'Order Delivered', 'category': 'whatsapp',
             'variables': ['customer_name', 'order_number', 'company_short_name', 'company_phone'],
             'template': 'Hello {customer_name},\n\nYour order *{order_number}* has been *DELIVERED*!\n\nThank you for your business.\n\nRegards,\n*{company_short_name}*\n+{company_phone}'},
            {'key': 'status_cancelled', 'name': 'Order Cancelled', 'category': 'whatsapp',
             'variables': ['customer_name', 'order_number', 'reason', 'company_short_name', 'company_phone'],
             'template': 'Hello {customer_name},\n\nYour order *{order_number}* has been *CANCELLED*.\n\nReason: {reason}\n\nRegards,\n*{company_short_name}*\n+{company_phone}'},
            {'key': 'payment_receipt', 'name': 'Payment Receipt', 'category': 'whatsapp',
             'variables': ['customer_name', 'amount', 'payment_mode', 'balance', 'company_short_name', 'company_phone'],
             'template': 'Hello {customer_name},\n\nPayment of Rs. {amount} received via {payment_mode}.\n\nOutstanding balance: Rs. {balance}\n\nThank you!\n\n*{company_short_name}*\n+{company_phone}'},
            {'key': 'out_of_stock', 'name': 'Out of Stock Notice', 'category': 'whatsapp',
             'variables': ['customer_name', 'order_number', 'items_text', 'company_short_name', 'company_phone'],
             'template': 'Hello {customer_name},\n\nSome items in your order *{order_number}* are currently *OUT OF STOCK*:\n\n{items_text}\n\nWe will notify you when they are available.\n\nRegards,\n*{company_short_name}*\n+{company_phone}'},
            {'key': 'stock_arrived', 'name': 'Stock Arrived', 'category': 'whatsapp',
             'variables': ['customer_name', 'item_name', 'item_code', 'company_short_name', 'company_phone'],
             'template': 'Hello {customer_name},\n\n*{item_name}* ({item_code}) is now back in stock!\n\nYou can place your order now.\n\nRegards,\n*{company_short_name}*\n+{company_phone}'},
            {'key': 'account_approved', 'name': 'Account Approved', 'category': 'whatsapp',
             'variables': ['customer_name', 'customer_code', 'company_short_name'],
             'template': 'Great news, {customer_name}!\n\nYour {company_short_name} account has been *APPROVED*!\n\nYou can now login to view products and place orders.\n\nCustomer Code: {customer_code}'},
            {'key': 'account_declined', 'name': 'Account Declined', 'category': 'whatsapp',
             'variables': ['customer_name', 'reason', 'company_short_name'],
             'template': 'Hello {customer_name},\n\nUnfortunately, your {company_short_name} registration has been declined.\n\nReason: {reason}\n\nPlease contact support for assistance.'},
            {'key': 'password_reset', 'name': 'Password Reset', 'category': 'whatsapp',
             'variables': ['customer_name', 'new_password', 'company_short_name'],
             'template': 'Hello {customer_name},\n\nYour {company_short_name} portal login credentials:\n\nPassword: {new_password}\n\nPlease change your password after logging in.'},
            {'key': 'test_message', 'name': 'Test Message', 'category': 'whatsapp',
             'variables': ['company_short_name'],
             'template': 'Test message from {company_short_name}. WhatsApp integration is working!'},
            {'key': 'daily_reminder', 'name': 'Daily Order Reminder', 'category': 'whatsapp',
             'variables': ['customer_name', 'summary', 'company_short_name', 'company_phone'],
             'template': 'Hello {customer_name},\n\nHere is your daily order summary:\n\n{summary}\n\nRegards,\n*{company_short_name}*\n+{company_phone}'},
            {'key': 'ledger_statement', 'name': 'Ledger Statement', 'category': 'whatsapp',
             'variables': ['customer_name', 'period', 'total_balance', 'company_short_name', 'company_phone'],
             'template': 'Hello {customer_name},\n\nYour ledger statement for *{period}* is attached.\n\nCurrent Balance: *Rs. {total_balance}*\n\nRegards,\n*{company_short_name}*\n+{company_phone}'},
            {'key': 'birthday_greeting', 'name': 'Birthday Greeting', 'category': 'whatsapp',
             'variables': ['customer_name', 'company_short_name'],
             'template': 'Happy Birthday, {customer_name}!\n\nWishing you a wonderful year ahead.\n\nWarm regards,\n*{company_short_name}*'},
            {'key': 'anniversary_greeting', 'name': 'Anniversary Greeting', 'category': 'whatsapp',
             'variables': ['customer_name', 'company_short_name'],
             'template': 'Happy Anniversary, {customer_name}!\n\nWishing you many more happy years ahead.\n\nWarm regards,\n*{company_short_name}*'},
        ]

        for t in default_wa_templates:
            t['id'] = str(uuid.uuid4())
            t['created_at'] = datetime.now(timezone.utc).isoformat()
        await db.message_templates.insert_many(default_wa_templates)
        log_ok(f"  Seeded {len(default_wa_templates)} default WA message templates")
        changes += len(default_wa_templates)

        default_email_templates = [
            {'key': 'order_confirmation_email', 'name': 'Order Confirmation Email', 'category': 'email',
             'variables': ['customer_name', 'order_number', 'items_html', 'company_name', 'company_short_name'],
             'subject': 'Order {order_number} - Confirmation | {company_short_name}',
             'template': '<h2>Hello {customer_name},</h2><p>Your order <strong>{order_number}</strong> has been received.</p>{items_html}<p>We will process your order shortly.</p><p>Regards,<br/><strong>{company_name}</strong></p>'},
            {'key': 'order_confirmed_email', 'name': 'Order Confirmed Email', 'category': 'email',
             'variables': ['customer_name', 'order_number', 'items_html', 'company_name', 'company_short_name'],
             'subject': 'Order {order_number} - Confirmed | {company_short_name}',
             'template': '<h2>Hello {customer_name},</h2><p>Your order <strong>{order_number}</strong> has been <strong style="color:#10b981;">CONFIRMED</strong>!</p><p>We are preparing your order for dispatch.</p>{items_html}<p>Regards,<br/><strong>{company_name}</strong></p>'},
            {'key': 'order_dispatched_email', 'name': 'Order Dispatched Email', 'category': 'email',
             'variables': ['customer_name', 'order_number', 'items_html', 'transport_name', 'tracking_number', 'company_name', 'company_short_name'],
             'subject': 'Order {order_number} - Dispatched | {company_short_name}',
             'template': '<h2>Hello {customer_name},</h2><p>Your order <strong>{order_number}</strong> has been <strong style="color:#3b82f6;">DISPATCHED</strong>!</p>{items_html}<p><strong>Transport:</strong> {transport_name}<br/><strong>Tracking:</strong> {tracking_number}</p><p>Regards,<br/><strong>{company_name}</strong></p>'},
            {'key': 'order_delivered_email', 'name': 'Order Delivered Email', 'category': 'email',
             'variables': ['customer_name', 'order_number', 'company_name', 'company_short_name'],
             'subject': 'Order {order_number} - Delivered | {company_short_name}',
             'template': '<h2>Hello {customer_name},</h2><p>Your order <strong>{order_number}</strong> has been <strong style="color:#10b981;">DELIVERED</strong>!</p><p>Thank you for your business.</p><p>Regards,<br/><strong>{company_name}</strong></p>'},
            {'key': 'order_cancelled_email', 'name': 'Order Cancelled Email', 'category': 'email',
             'variables': ['customer_name', 'order_number', 'reason', 'company_name', 'company_short_name'],
             'subject': 'Order {order_number} - Cancelled | {company_short_name}',
             'template': '<h2>Hello {customer_name},</h2><p>Your order <strong>{order_number}</strong> has been <strong style="color:#ef4444;">CANCELLED</strong>.</p><p><strong>Reason:</strong> {reason}</p><p>For any queries, please contact us.</p><p>Regards,<br/><strong>{company_name}</strong></p>'},
            {'key': 'payment_receipt_email', 'name': 'Payment Receipt Email', 'category': 'email',
             'variables': ['customer_name', 'amount', 'payment_mode', 'balance', 'company_name', 'company_short_name'],
             'subject': 'Payment Receipt | {company_short_name}',
             'template': '<h2>Hello {customer_name},</h2><p>Payment of <strong>Rs. {amount}</strong> received via {payment_mode}.</p><p>Outstanding balance: Rs. {balance}</p><p>Thank you!</p><p>Regards,<br/><strong>{company_name}</strong></p>'},
            {'key': 'account_approved_email', 'name': 'Account Approved Email', 'category': 'email',
             'variables': ['customer_name', 'customer_code', 'company_name', 'company_short_name'],
             'subject': 'Account Approved | {company_short_name}',
             'template': '<h2>Welcome, {customer_name}!</h2><p>Your account has been <strong>approved</strong>.</p><p>Customer Code: <strong>{customer_code}</strong></p><p>You can now login to view products and place orders.</p><p>Regards,<br/><strong>{company_name}</strong></p>'},
            {'key': 'account_declined_email', 'name': 'Account Declined Email', 'category': 'email',
             'variables': ['customer_name', 'reason', 'company_name', 'company_short_name'],
             'subject': 'Registration Update | {company_short_name}',
             'template': '<h2>Hello {customer_name},</h2><p>Unfortunately, your registration has been <strong style="color:#ef4444;">declined</strong>.</p><p><strong>Reason:</strong> {reason}</p><p>Please contact support for assistance.</p><p>Regards,<br/><strong>{company_name}</strong></p>'},
            {'key': 'out_of_stock_email', 'name': 'Out of Stock Notice Email', 'category': 'email',
             'variables': ['customer_name', 'order_number', 'items_html', 'company_name', 'company_short_name'],
             'subject': 'Out of Stock Items - Order {order_number} | {company_short_name}',
             'template': '<h2>Hello {customer_name},</h2><p>Some items in your order <strong>{order_number}</strong> are currently <strong style="color:#ef4444;">out of stock</strong>:</p>{items_html}<p>We will notify you when they become available.</p><p>Regards,<br/><strong>{company_name}</strong></p>'},
            {'key': 'ledger_statement_email', 'name': 'Ledger Statement Email', 'category': 'email',
             'variables': ['customer_name', 'period', 'total_balance', 'company_name', 'company_short_name'],
             'subject': 'Ledger Statement - {period} | {company_short_name}',
             'template': '<h2>Hello {customer_name},</h2><p>Please find your ledger statement for <strong>{period}</strong> attached.</p><p>Current Balance: <strong>Rs. {total_balance}</strong></p><p>Regards,<br/><strong>{company_name}</strong></p>'},
        ]

        for t in default_email_templates:
            t['id'] = str(uuid.uuid4())
            t['created_at'] = datetime.now(timezone.utc).isoformat()
        await db.message_templates.insert_many(default_email_templates)
        log_ok(f"  Seeded {len(default_email_templates)} default Email templates")
        changes += len(default_email_templates)
    else:
        log_skip(f"  message_templates already has {existing_templates} templates — not overwriting")

    # ------------------------------------------------------------------
    # Step 5: Add missing fields to existing orders
    # ------------------------------------------------------------------
    log_info("Step 5: Updating orders with new fields...")

    orders_updated = await db.orders.update_many(
        {'customer_type': {'$exists': False}},
        {'$set': {'customer_type': 'doctor'}}
    )
    if orders_updated.modified_count:
        log_ok(f"  Added 'customer_type' to {orders_updated.modified_count} orders")
        changes += orders_updated.modified_count
    else:
        log_skip("  All orders already have 'customer_type'")

    orders_src = await db.orders.update_many(
        {'source': {'$exists': False}},
        {'$set': {'source': 'admin_panel'}}
    )
    if orders_src.modified_count:
        log_ok(f"  Added 'source' to {orders_src.modified_count} orders")
        changes += orders_src.modified_count

    # ------------------------------------------------------------------
    # Step 6: Add missing fields to users (permissions)
    # ------------------------------------------------------------------
    log_info("Step 6: Checking users collection...")

    users_no_perms = await db.users.update_many(
        {'permissions': {'$exists': False}},
        {'$set': {'permissions': None}}
    )
    if users_no_perms.modified_count:
        log_ok(f"  Added 'permissions' field to {users_no_perms.modified_count} users")
        changes += users_no_perms.modified_count

    # ------------------------------------------------------------------
    # Step 7: Add state/district fields to entities if missing
    # ------------------------------------------------------------------
    log_info("Step 7: Adding geo fields to entities...")

    for coll in ['doctors', 'medicals', 'agencies']:
        for field in ['state', 'district']:
            result = await db[coll].update_many(
                {field: {'$exists': False}},
                {'$set': {field: ''}}
            )
            if result.modified_count:
                log_ok(f"  Added '{field}' to {result.modified_count} {coll}")
                changes += result.modified_count

    # ------------------------------------------------------------------
    # Step 8: Add role_rates to items if missing
    # ------------------------------------------------------------------
    log_info("Step 8: Checking items for role_rates...")

    items_no_rates = await db.items.update_many(
        {'role_rates': {'$exists': False}},
        {'$set': {'role_rates': {}}}
    )
    if items_no_rates.modified_count:
        log_ok(f"  Added 'role_rates' to {items_no_rates.modified_count} items")
        changes += items_no_rates.modified_count

    items_no_offer = await db.items.update_many(
        {'offer_rate': {'$exists': False}},
        {'$set': {'offer_rate': None, 'special_offer': None}}
    )
    if items_no_offer.modified_count:
        log_ok(f"  Added 'offer_rate'/'special_offer' to {items_no_offer.modified_count} items")
        changes += items_no_offer.modified_count

    # ------------------------------------------------------------------
    # Step 9: Ensure pending_items have status field
    # ------------------------------------------------------------------
    log_info("Step 9: Checking pending_items...")

    pi_status = await db.pending_items.update_many(
        {'status': {'$exists': False}},
        {'$set': {'status': 'pending'}}
    )
    if pi_status.modified_count:
        log_ok(f"  Added 'status' to {pi_status.modified_count} pending_items")
        changes += pi_status.modified_count

    # ------------------------------------------------------------------
    # Step 10: Seed admin user if none exists
    # ------------------------------------------------------------------
    log_info("Step 10: Checking admin user...")

    admin_exists = await db.users.find_one({'role': 'admin'}, {'_id': 1})
    if not admin_exists:
        try:
            import bcrypt
            hashed = bcrypt.hashpw('admin123'.encode(), bcrypt.gensalt()).decode()
        except ImportError:
            import hashlib
            hashed = hashlib.sha256('admin123'.encode()).hexdigest()
            log_warn("  bcrypt not available — used sha256 hash (change password after login!)")

        admin_doc = {
            'id': str(uuid.uuid4()),
            'email': 'admin@vmpcrm.com',
            'password': hashed,
            'name': 'Admin',
            'role': 'admin',
            'permissions': None,
            'created_at': datetime.now(timezone.utc).isoformat(),
            'updated_at': datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(admin_doc)
        log_ok("  Created default admin user (admin@vmpcrm.com / admin123)")
        log_warn("  IMPORTANT: Change the admin password immediately after login!")
        changes += 1
    else:
        log_skip("  Admin user already exists")

    # ------------------------------------------------------------------
    # Summary
    # ------------------------------------------------------------------
    print(f"\n{'='*50}")
    if changes > 0:
        log_ok(f"Migration complete! {changes} change(s) applied.")
    else:
        log_ok("Migration complete! Database is already up to date.")
    print(f"{'='*50}")

    client.close()
    return changes


if __name__ == '__main__':
    print(f"\n{'='*50}")
    print("  VMP CRM - Database Migration")
    print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*50}\n")

    changes = asyncio.run(migrate())
    sys.exit(0)
