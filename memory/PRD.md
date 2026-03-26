# VMP CRM - Product Requirements Document

## Original Problem Statement
A full-stack CRM system for a veterinary pharmaceutical company. Includes an Admin Panel, Customer Portal, and Medical Representative (MR) PWA module.

## Architecture
- **Backend**: FastAPI + MongoDB (server.py - monolithic, ~12,400 lines)
- **Frontend**: React + TailwindCSS + Shadcn/UI
- **MR Module**: Separate PWA with offline sync
- **Customer Portal**: Login, orders, ledger, support
- **Push Notifications**: Web Push via pywebpush + VAPID

## Core Features Implemented

### Admin Panel
- [x] Dashboard with stats, charts
- [x] Doctor/Medical/Agency management with follow-ups
- [x] Items/Products management with categories, subcategories, images
- [x] **Item hide/show toggle** - global visibility control
- [x] **Item images bulk ZIP download** - backup/migration support
- [x] Orders management (manual + customer + MR orders)
- [x] Payments with WhatsApp receipts + **Email receipts**
- [x] Expenses tracking
- [x] Marketing campaigns (WhatsApp + Push Notifications + **Email**)
- [x] **Dynamic WhatsApp Config** - multiple configs with customizable API field mappings
- [x] **Message Templates Editor** - edit all WhatsApp & Email templates with variable insertion
- [x] **Company Short Name** - used in all messages
- [x] **Web Push Notifications** - admin receives push for new orders, registrations
- [x] Item import/export (Excel/PDF) with Special Offer 2 fields
- [x] Reminders, Greeting Templates
- [x] User/Role management
- [x] SMTP & WhatsApp settings
- [x] Database backup
- [x] MR Management & Reports
- [x] Visual Aids, Support tickets, Company settings

### Customer Portal
- [x] Registration & login (password + OTP)
- [x] **Dynamic company branding** on login page (logo + name from admin DB)
- [x] **Web Push Notifications** - order status changes, birthday greetings, product announcements
- [x] Product catalog with role-based pricing
- [x] Order placement, Ledger/statement view, Support tickets, Profile

### MR Module (PWA)
- [x] Separate installable PWA with offline order sync
- [x] **Web Push Notifications** - auto-subscribed
- [x] Customer visits, follow-ups, Order creation with editable rates, Visual aids

### Email Parity (NEW - Feb 2026)
- [x] **Order status updates** - Email sent for confirmed/shipped/delivered/cancelled
- [x] **Payment receipts** - Email with payment details and balance
- [x] **Account approval/rejection** - Email to customer on status change
- [x] **Support ticket status** - Email on ticket status changes
- [x] **Support ticket replies** - Email when admin replies to ticket
- [x] **Marketing campaigns** - Email sent alongside WhatsApp to recipients with email
- [x] **Reusable send_notification_email()** utility with HTML templating, logging, and attachment support

### Ledger Improvements (NEW - Feb 2026)
- [x] WhatsApp ledger sends **summary text + PDF attachment** (via temp URL)
- [x] Email ledger sends **summary + PDF attachment**
- [x] **Automated monthly statements** - Background task runs on 27th of each month, sends to customers with outstanding balance
- [x] Reusable `generate_ledger_pdf_bytes()` helper
- [x] Public `/api/ledger-pdf/{token}` endpoint for WhatsApp PDF download (48h expiry)

### PWA Icons (NEW - Feb 2026)
- [x] Updated customer/main app icons with **VETMECH** branding (192x192, 512x512)
- [x] Updated MR panel icons with **MR PANEL** branding (192x192, 512x512)

### Bug Fixes
- [x] **WhatsApp marketing image attachment bug (P0)** - Campaign images were served as base64 text instead of decoded binary data. Fixed with `base64.b64decode()`. Added JPEG format conversion (`?fmt=jpg`) for better external API compatibility.
- [x] **Hardcoded preview URL** - Replaced with configurable `APP_BASE_URL` environment variable
- [x] **Missing function definition** - Restored `send_whatsapp_ready_to_despatch()` function
- [x] **Undefined variable** - Fixed `entity_name` reference in order push notification

## Key DB Collections
- `items` - Products with is_hidden, special_offer_2_* fields
- `push_subscriptions` - Web Push subscriptions
- `message_templates` - Customizable WhatsApp & Email templates
- `whatsapp_config` - Multiple configs with field mappings
- `company_settings` - Company info with company_short_name
- `temp_ledger_pdfs` - Temporary PDF storage for WhatsApp ledger delivery (NEW)

## Technical Debt (P0)
- **server.py refactor** - 12,400+ lines, needs modular router-based architecture
- **Duplicated follow-up UI** - Doctors.jsx, Medicals.jsx, Agencies.jsx share code

## Upcoming Tasks
- (P1) Refactor server.py into modular router-based structure
- (P1) Stock/Inventory Management
- (P1) Follow-up UI refactor
- (P2) Sales reports with charts
- (P2) Broader data import/export
- (P2) Sales targets for MRs
- (P2) Installation script for VPS deployment

## Blocked
- WhatsApp OTP delivery - External API (BotMasterSender) issue, needs user to verify API credentials

## Credentials
- Admin: admin@vmpcrm.com / admin123
- Test MR: 9876543211 / testpass
- Test Customer: 9999777766 / test123
- WhatsApp test numbers: 9486544884 / 9342704047
