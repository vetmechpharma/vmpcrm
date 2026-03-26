# VMP CRM - Product Requirements Document

## Original Problem Statement
A full-stack CRM system for a veterinary pharmaceutical company. Includes an Admin Panel, Customer Portal, and Medical Representative (MR) PWA module.

## Architecture
- **Backend**: FastAPI + MongoDB (server.py - monolithic, ~12,400 lines)
- **Frontend**: React + TailwindCSS + Shadcn/UI
- **MR Module**: Separate PWA with offline sync + localStorage caching
- **Customer Portal**: Login, orders, ledger, support
- **Push Notifications**: Web Push via pywebpush + VAPID

## Core Features Implemented

### Admin Panel
- [x] Dashboard, Doctor/Medical/Agency management, Items, Orders, Payments, Expenses
- [x] Item hide/show toggle, Images bulk ZIP download
- [x] Dynamic WhatsApp Config, Message Templates Editor, Company Short Name
- [x] Marketing campaigns (WhatsApp + Push + Email)
- [x] Web Push Notifications, Item import/export, Reminders, Greetings
- [x] User/Role management, SMTP/WhatsApp settings, DB backup, MR Management

### Customer Portal
- [x] Registration & login, Dynamic branding, Web Push, Product catalog
- [x] Order placement, Ledger view, Support tickets, Profile

### MR Module (PWA)
- [x] Installable PWA with offline order sync
- [x] **Offline Data Caching** - Pre-fetches customers, items, orders, dashboard on app load
- [x] **localStorage Fallback** - All pages work offline with cached data
- [x] **Service Worker v3** - Enhanced caching with base URL key dedup
- [x] Customer visits, follow-ups, Order creation, Visual aids

### Email Parity (Feb 2026)
- [x] Order status emails, Payment receipts, Account approval/rejection
- [x] Support ticket status/replies, Marketing campaigns
- [x] Reusable `send_notification_email()` utility

### Ledger Improvements (Feb 2026)
- [x] WhatsApp/Email ledger with summary text + PDF attachment
- [x] Automated monthly statements (27th of each month)
- [x] Public `/api/ledger-pdf/{token}` endpoint (48h expiry)

### PWA Icons (Feb 2026)
- [x] VETMECH branding for customer app, MR PANEL branding for MR app

### Bug Fixes
- [x] **WhatsApp marketing image bug (P0)** - base64 text → binary decode fix
- [x] **MR offline mode (P0)** - Added pre-caching, localStorage fallback, SW v3
- [x] **Hardcoded preview URL** → configurable APP_BASE_URL
- [x] **Missing function/variable** - restored send_whatsapp_ready_to_despatch, fixed entity_name

## Key DB Collections
- items, push_subscriptions, message_templates, whatsapp_config, company_settings
- temp_ledger_pdfs (NEW - for WhatsApp ledger delivery)

## Technical Debt (P0)
- **server.py refactor** - 12,400+ lines, needs modular architecture
- **Duplicated follow-up UI** - Doctors/Medicals/Agencies share code

## Upcoming Tasks
- (P1) Refactor server.py into modular router-based structure
- (P1) Stock/Inventory Management
- (P1) Follow-up UI refactor
- (P2) Sales reports with charts
- (P2) Broader data import/export
- (P2) Sales targets for MRs
- (P2) Installation script for VPS deployment

## Blocked
- WhatsApp OTP delivery - External BotMasterSender API issue

## Credentials
- Admin: admin@vmpcrm.com / admin123
- Test MR: 9876543211 / testpass
- Test Customer: 9999777766 / test123
- WhatsApp test numbers: 9486544884 / 9342704047
