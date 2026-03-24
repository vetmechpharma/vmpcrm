# VMP CRM - Product Requirements Document

## Original Problem Statement
A full-stack CRM system for a veterinary pharmaceutical company. Includes an Admin Panel, Customer Portal, and Medical Representative (MR) PWA module.

## Architecture
- **Backend**: FastAPI + MongoDB (server.py - monolithic, ~12,000 lines)
- **Frontend**: React + TailwindCSS + Shadcn/UI
- **MR Module**: Separate PWA with offline sync
- **Customer Portal**: Login, orders, ledger, support
- **Push Notifications**: Web Push via pywebpush + VAPID

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
- [x] Marketing campaigns (WhatsApp + **Push Notifications**)
- [x] **Dynamic WhatsApp Config** - multiple configs with customizable API field mappings
- [x] **Message Templates Editor** - edit all WhatsApp & Email templates with variable insertion
- [x] **Company Short Name** - used in all messages instead of hardcoded names
- [x] **Web Push Notifications** - admin receives push for new orders, new registrations
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

### Push Notification Triggers
- New order placed → Admin push
- New customer registration → Admin push
- Order status change (confirmed/dispatched/delivered) → Customer push
- Birthday/anniversary greetings → Customer push
- Marketing campaign (with checkbox) → All customers push

## Key DB Collections
- `items` - Products with is_hidden, special_offer_2_* fields
- `push_subscriptions` - Web Push subscriptions (user_id, user_type, subscription)
- `message_templates` - Customizable WhatsApp & Email templates
- `whatsapp_config` - Multiple configs with field mappings
- `company_settings` - Company info with company_short_name

## Technical Debt (P0)
- **server.py refactor** - 12,000+ lines, needs modular router-based architecture
- **Duplicated follow-up UI** - Doctors.jsx, Medicals.jsx, Agencies.jsx share code

## Upcoming Tasks
- (P1) Stock/Inventory Management
- (P1) Follow-up UI refactor
- (P2) Sales reports with charts, Data import/export, Sales targets

## Credentials
- Admin: admin@vmpcrm.com / admin123
- Test MR: 9876543211 / testpass
- Test Customer: 9999777766 / test123
- WhatsApp test numbers: 9486544884 / 9342704047
