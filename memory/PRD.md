# VMP CRM - Product Requirements Document

## Original Problem Statement
Full-stack Veterinary CRM (FastAPI + React + MongoDB) for pharmaceutical distribution management. Features Admin, Customer, and Medical Representative (MR) modules with WhatsApp/Email notifications, offline ordering, and analytics.

## Architecture
- **Frontend**: React, Tailwind, Shadcn UI, Recharts
- **Backend**: FastAPI (modular routes), MongoDB (Motor), Multi-WhatsApp API
- **Database**: `CRM_VETMECH`

### Backend Structure
```
/app/backend/
├── server.py              # Entry point with admin seeding
├── deps.py                # Shared: db, auth, JWT, logger
├── migrate.py             # Database migration (non-destructive, idempotent)
├── models/schemas.py      # All Pydantic models
├── utils/
│   ├── whatsapp.py        # WA send, log, OTP
│   ├── email_utils.py     # SMTP email sending
│   ├── templates.py       # WA/Email template defaults + rendering
│   ├── notifications.py   # Order/Payment WA/Email notifications
│   ├── code_gen.py, ledger.py, image.py, push.py
└── routes/                # 28 route modules
```

### VPS Deployment
```
/app/
├── install.sh             # Full install, update, and migrate commands
├── migrate.sh             # Standalone DB migration wrapper
└── frontend/public/vmpcrm_code.tar.gz  # Downloadable VPS package
```

## Implemented Features

### Apr 5, 2026 — WhatsApp Template Notifications
- **Order Updated Notification**: When order items are added/removed/qty changed, WhatsApp + Email sent with full updated items list
- **Payment Reminder (Template-based)**: Payments page now sends reminders via backend API using `payment_reminder` template instead of raw `wa.me` links
- **Removed raw WhatsApp button** from Orders page (was using `wa.me` link, replaced by proper template notifications)
- New templates: `order_updated`, `payment_reminder`, `order_updated_email`, `payment_reminder_email`
- Templates visible and editable in Message Templates admin page

### Apr 5, 2026 — Database Migration Script
- `migrate.py` — Non-destructive, idempotent DB migration
- Auto-seeds new templates when updating existing DB
- Integrated into `install.sh --install`, `--update`, and `--migrate`

### Previous Sessions (Completed)
- Full monolith → modular routes refactor
- Multi-WhatsApp API support (BotMasterSender + AKNexus)
- Edit Order: role rates, add/delete items, pending items injection
- State/District filters on entity tables
- Payment Click-to-Call and WA buttons
- VPS install script with auto-migration
- Post-refactor comprehensive import audit

## Test Credentials
- Admin: info@vetmech.in / Kongu@@44884

## Backlog (P2)
- AI Insights for Reports dashboard
- Stock/Inventory Management
- Sales target management for MRs
- Data import/export
