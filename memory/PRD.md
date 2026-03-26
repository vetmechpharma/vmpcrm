# VMP CRM - Product Requirements Document

## Original Problem Statement
A full-stack CRM system for a veterinary pharmaceutical company. Includes an Admin Panel, Customer Portal, and Medical Representative (MR) PWA module.

## Architecture
- **Backend**: FastAPI + MongoDB (server.py - monolithic, ~12,500 lines)
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
- [x] **Offline Data Caching** - Pre-fetches customers, items, orders, dashboard, outstanding on app load
- [x] **localStorage Fallback** - All pages work offline with cached data
- [x] **Service Worker v3** - Enhanced caching with base URL key dedup
- [x] **Outstanding Page** - Shows balance details for Doctors/Medicals/Agencies with offline sync
- [x] Customer visits, follow-ups, Order creation, Visual aids

### Email Parity (Feb 2026)
- [x] Order status, Payment receipts, Account approval/rejection, Ticket status/replies, Marketing

### Ledger Improvements (Feb 2026)
- [x] WhatsApp/Email with summary + PDF attachment, Automated monthly statements (27th)

### PWA Icons (Feb 2026)
- [x] VETMECH for customer app, MR PANEL for MR app

### Bug Fixes
- [x] WhatsApp marketing image bug (base64→binary), MR offline mode, Hardcoded URL→configurable

## Key New Files
- `/app/frontend/src/pages/mrvet/MROutstanding.jsx` - Outstanding balance page
- `/app/frontend/src/lib/offlineData.js` - Offline data caching utility
- `/app/frontend/public/mr-sw.js` - Service Worker v3

## Key New Endpoints
- `GET /api/mr/outstanding` - Returns customer outstanding balances for MR territory
- `GET /api/ledger-pdf/{token}` - Public temporary PDF serving endpoint

## Technical Debt
- **server.py refactor** - 12,500+ lines, needs modular architecture (P0)
- **Duplicated follow-up UI** - Doctors/Medicals/Agencies share code (P2)

## Upcoming Tasks
- (P1) Refactor server.py into modular router-based structure
- (P1) Stock/Inventory Management
- (P2) Follow-up UI refactor, Sales reports, Data import/export, MR sales targets, VPS script

## Credentials
- Admin: admin@vmpcrm.com / admin123
- Test MR: 9876543211 / testpass
- Test Customer: 9999777766 / test123
