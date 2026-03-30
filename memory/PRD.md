# VMP CRM - Product Requirements Document

## Original Problem Statement
Full-stack Veterinary CRM (FastAPI + React + MongoDB) for pharmaceutical distribution management. Features include Admin, Customer, and Medical Representative (MR) modules with WhatsApp/Email notifications, offline ordering, and analytics.

## Architecture
- **Frontend**: React, Tailwind, Shadcn UI, Recharts
- **Backend**: FastAPI, MongoDB (Motor), Multiple WhatsApp API styles
- **Key**: AKNexus determines message type via URL extension suffix (.pdf, .jpg)

## Completed Features

### Core CRM
- Admin/MR/Customer portals with authentication
- Doctor/Medical/Agency CRUD with lead management
- Order management with role-based pricing
- Item/Product management with images
- Email & WhatsApp notifications, Follow-up tracking, Payment tracking

### WhatsApp Enhancements
- Dual WhatsApp API (BotMasterSender + AKNexus) with UI toggle
- Individual WhatsApp message in Doctors/Medicals/Agencies (Text/Image/PDF/Product with role-specific pricing)
- WhatsApp file-to-text fallback, AKNexus image/PDF extensions

### Marketing
- Campaign creation with image AND PDF attachments
- Multi-recipient bulk sending with batch control

### Message Templates (Mar 30, 2026)
- 18 WhatsApp + 13 Email templates — all visible, editable, with preview
- Variable documentation, live preview with sample data, search, reset to default

### Reports & Analytics (Mar 30, 2026)
- **Overview**: Revenue/Orders trend, status distribution, payment modes
- **Products**: Top products by revenue/qty, slow movers
- **Customers**: Top doctors/medicals/agencies, frequent orderers, dormant customers (30/60/90 days)
- **Orders**: Monthly trends, day-of-week analysis, avg order value
- **Activity**: Revenue bars, customer distribution pie, dormant summary
- Period selector: 1mo/3mo/6mo/1yr
- Testing: 100% backend (17/17), 100% frontend

## Key API Endpoints
- `GET /api/analytics/reports?period=6months` — Comprehensive analytics
- `POST /api/whatsapp/send-direct` — Direct WA (text/image/pdf/product)
- `GET/PUT /api/message-templates` — Template CRUD
- `POST /api/marketing/campaigns` — Campaign with image + PDF

## Tech Debt
- **P0**: `server.py` is ~13,200 lines — needs modular refactoring into routes/

## Backlog (P2)
- Stock/Inventory Management
- Sales target management for MRs
- Data import/export
- VPS installation script
- AI Insights for analytics (user requested: add later)
- Refactor follow-up UI

## Test Credentials
- Admin: admin@vmpcrm.com / admin123
- MR: 9876543211 / testpass
- Customer: 9999777766 / test123
