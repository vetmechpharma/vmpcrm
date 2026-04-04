# VMP CRM - Product Requirements Document

## Original Problem Statement
Full-stack Veterinary CRM (FastAPI + React + MongoDB) for pharmaceutical distribution management. Features Admin, Customer, and Medical Representative (MR) modules with WhatsApp/Email notifications, offline ordering, and analytics.

## Architecture
- **Frontend**: React, Tailwind, Shadcn UI, Recharts
- **Backend**: FastAPI (modular routes), MongoDB (Motor), Multi-WhatsApp API
- **Database**: `CRM_VETMECH`

### Backend Structure (Refactored Mar 30, 2026)
```
/app/backend/
├── server.py              # 125 lines - slim orchestrator
├── deps.py                # Shared: db, auth, JWT, logger
├── background_tasks.py    # Daily reminders, greetings, ledger
├── models/
│   └── schemas.py         # All Pydantic models
├── utils/
│   ├── whatsapp.py        # WA send, log, OTP
│   ├── email_utils.py     # SMTP email sending
│   ├── templates.py       # WA/Email template defaults + rendering
│   ├── image.py           # Image processing (WebP)
│   ├── code_gen.py        # Customer/Medical/Agency/Item codes
│   ├── ledger.py          # Ledger calculation + PDF generation
│   └── push.py            # Web push notifications
└── routes/                # 30 route modules
    ├── auth.py, doctors.py, medicals.py, agencies.py
    ├── items.py, orders_admin.py, payments.py, expenses.py
    ├── customers.py, marketing.py, whatsapp_config.py
    ├── dashboard.py, database.py, mr.py, visual_aids.py
    └── ... (15 more modules)
```

### Frontend Shared Components
- `FollowUpDialog.jsx` - Shared follow-up modal (Doctors/Medicals/Agencies)
- `WhatsAppDirectDialog.jsx` - Direct WA messaging

## Completed Features
- Admin/MR/Customer portals with authentication
- Doctor/Medical/Agency CRUD with lead management & follow-ups
- Order management with role-based pricing
- Item/Product management with images
- Email & WhatsApp dual notifications
- Dual WhatsApp API (BotMasterSender + AKNexus)
- Individual WA messaging (Text/Image/PDF/Product)
- Marketing campaigns with image + PDF attachments
- 18 WA + 13 Email templates with edit/preview UI
- Reports dashboard (Revenue, Products, Customers, Dormant tracking)
- Database Management (Export, Email Backup, Factory Reset, Log Cleanup)
- **server.py refactored** from 13,500 → 125 lines (30 route modules)
- **Follow-up UI** extracted to shared FollowUpDialog component
- **VPS install.sh** for Ubuntu 22.04/24.04 with web-based installer

## Bug Fixes
- **Apr 4, 2026**: Fixed missing `process_image_to_webp` import in `routes/marketing.py` and `routes/company_settings.py` — marketing campaign images and company logo/background uploads were silently failing post-refactor.

## VPS Installation System
- `install.sh` at `/app/install.sh`
- Supports: check-only, install, update, setup-web modes
- Web installer at `domain.com/install` with progress tracking
- Non-destructive updates (preserves database + .env files)
- Let's Encrypt SSL auto-setup
- PM2 process management + Nginx reverse proxy

## Test Credentials
- Admin: info@vetmech.in / Kongu@@44884
- MR: 9876543211 / testpass
- Customer: 9999777766 / test123

## Backlog (P2)
- AI Insights for Reports dashboard
- Stock/Inventory Management
- Sales target management for MRs
- Data import/export
