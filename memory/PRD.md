# VMP CRM - Product Requirements Document

## Original Problem Statement
A full-stack CRM system for a veterinary pharmaceutical company with Admin Panel, Customer Portal, and MR PWA module.

## Architecture
- **Backend**: FastAPI + MongoDB (server.py ~12,700 lines)
- **Frontend**: React + TailwindCSS + Shadcn/UI
- **MR Module**: PWA with offline sync + localStorage caching
- **Customer Portal**: Login, orders, ledger, support
- **Push Notifications**: Web Push via pywebpush + VAPID

## All Implemented Features

### Admin Panel
- Dashboard, Doctor/Medical/Agency management, Items, Orders, Payments, Expenses
- Item hide/show, Images ZIP download, Dynamic WhatsApp Config
- Message Templates Editor, Company Short Name
- Marketing (WhatsApp + Push + Email), Web Push Notifications
- Item import/export, Reminders, Greetings, User/Role management
- SMTP/WhatsApp settings, DB backup, MR Management
- **Order Transfer to Agency** - Transfer button → agency selection → WhatsApp to agency + customer
- **MR Payment Approvals** - Admin Payments page has "MR Approvals" tab with approve/reject

### Customer Portal
- Registration & login, Dynamic branding, Web Push, Product catalog
- Order placement, Ledger view, Support tickets, Profile

### MR Module (PWA)
- Offline data caching (pre-fetches customers, items, orders, dashboard, outstanding)
- localStorage fallback, Service Worker v3
- Outstanding Page - balance details for Doctors/Medicals/Agencies with offline sync
- **Payment Recording** - MR records payments for admin approval
- **Role-based Default Rate** - Order form shows correct rate per customer type (doctor/medical/agency)
- Customer visits, follow-ups, Order creation, Visual aids

### Email Parity
- Order status, Payment receipts, Account approval, Ticket status/replies, Marketing, Ledger

### Ledger Improvements
- WhatsApp/Email with summary + PDF attachment, Automated monthly statements (27th)

### Recent Bug Fixes (Feb-Mar 2026)
- WhatsApp marketing image bug (base64→binary decode)
- MR offline mode (pre-caching + localStorage)
- Hardcoded URL → configurable APP_BASE_URL
- Missing function definitions restored
- **Order notes now visible** in admin order views
- **MR name displayed** on orders ("Submitted by: MR Name")
- **MR Order Form role-based rate display** — Verified working (Mar 2026). getRoleRate() uses entity_type correctly. Rate shows in item search dropdown + selected item cards. Tested 100% pass (iteration 41).

## Key New Endpoints (This Session)
- `POST /api/orders/{id}/transfer` - Transfer order to agency
- `POST /api/mr/payment-requests` - MR records payment
- `GET /api/mr/payment-requests` - MR's payment request history
- `GET /api/payment-requests` - Admin views all requests
- `POST /api/payment-requests/{id}/approve` - Admin approve/reject

## Key DB Collections (New)
- `payment_requests` - MR payment submissions with status, mr_name, amount, mode

## Technical Debt
- server.py refactor (12,700+ lines) - P0
- Duplicated follow-up UI - P2

## Upcoming Tasks
- (P1) Refactor server.py
- (P1) Stock/Inventory Management
- (P2) Follow-up UI refactor, Sales reports, Data import/export, MR sales targets, VPS script

## Credentials
- Admin: admin@vmpcrm.com / admin123
- MR: 9876543211 / testpass
- Customer: 9999777766 / test123
