# VMP CRM - Product Requirements Document

## Original Problem Statement
A full-stack CRM system for a veterinary pharmaceutical company. Includes an Admin Panel, Customer Portal, and Medical Representative (MR) PWA module.

## Architecture
- **Backend**: FastAPI + MongoDB (server.py - monolithic, ~11,700 lines)
- **Frontend**: React + TailwindCSS + Shadcn/UI
- **MR Module**: Separate PWA with offline sync
- **Customer Portal**: Login, orders, ledger, support

## Core Features Implemented

### Admin Panel
- [x] Dashboard with stats, charts
- [x] Doctor/Medical/Agency management with follow-ups
- [x] Items/Products management with categories, subcategories, images
- [x] **Item hide/show toggle** - global visibility control (hidden from MR & customers)
- [x] **Item images bulk ZIP download** - backup/migration support
- [x] Orders management (manual + customer + MR orders)
- [x] Payments with WhatsApp receipts
- [x] Expenses tracking
- [x] Marketing campaigns (WhatsApp)
- [x] **Dynamic WhatsApp Config** - multiple configs with customizable API field mappings
- [x] **Message Templates Editor** - edit all WhatsApp & Email templates with variable insertion
- [x] **Company Short Name** - used in all messages instead of hardcoded "VMP CRM"
- [x] Item import/export (Excel/PDF) with Special Offer 2 fields
- [x] Reminders, Greeting Templates
- [x] User/Role management
- [x] SMTP & WhatsApp settings
- [x] Database backup
- [x] MR Management & Reports
- [x] Visual Aids
- [x] Support tickets
- [x] Company settings with logo, login customization

### Customer Portal
- [x] Registration & login (password + OTP)
- [x] **Dynamic company branding** on login page (logo + name from admin DB)
- [x] **No admin login link** on customer login page
- [x] Product catalog with role-based pricing
- [x] Order placement
- [x] Ledger/statement view
- [x] Support tickets
- [x] Profile management

### MR Module (PWA)
- [x] Separate installable PWA
- [x] Offline order sync
- [x] Customer visits, follow-ups
- [x] Order creation with editable rates
- [x] Visual aids & slideshows
- [x] Session persistence

### Special Features
- [x] Editable Rate/Unit in orders (Admin + MR)
- [x] Special Offer 2 system for dashboard carousel
- [x] Role-based pricing (Doctors, Medicals, Agencies)
- [x] PWA separation (MR app vs User app)
- [x] Navy blue/green admin theme with Poppins font

## Key DB Collections
- `items` - Products with is_hidden, special_offer_2_* fields
- `orders`, `payments`, `expenses`
- `doctors`, `medicals`, `agencies`
- `portal_customers` - Customer portal accounts
- `whatsapp_config` - Multiple configs with field mappings
- `message_templates` - Customizable WhatsApp & Email templates
- `company_settings` - Company info with company_short_name
- `marketing_campaigns`, `campaign_logs`
- `mr_users`, `mr_visits`, `mr_followups`

## Pending Issues
- WhatsApp OTP via BotMasterSender may have intermittent 400 errors (external API)

## Technical Debt (P0)
- **server.py refactor** - 11,700+ lines, needs modular router-based architecture
- **Duplicated follow-up UI** - Doctors.jsx, Medicals.jsx, Agencies.jsx share code

## Upcoming Tasks
- (P1) Stock/Inventory Management - quantity tracking, low-stock alerts
- (P1) Follow-up UI refactor into shared component
- (P2) Sales reports with charts
- (P2) Data import/export (broader)
- (P2) Sales target management for MRs

## Credentials
- Admin: admin@vmpcrm.com / admin123
- Test MR: 9876543211 / testpass
- Test Customer: 9999777766 / test123
