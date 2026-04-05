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
├── server.py              # ~145 lines - slim orchestrator with admin seeding
├── deps.py                # Shared: db, auth, JWT, logger, VAPID
├── migrate.py             # Database migration script (non-destructive, idempotent)
├── background_tasks.py    # Daily reminders, greetings, ledger
├── models/schemas.py      # All Pydantic models
├── utils/
│   ├── whatsapp.py        # WA send, log, OTP
│   ├── email_utils.py     # SMTP email sending
│   ├── templates.py       # WA/Email template defaults + rendering
│   ├── image.py           # Image processing (WebP)
│   ├── notifications.py   # Order WA/Email notifications
│   ├── code_gen.py        # Customer/Medical/Agency/Item codes
│   ├── ledger.py          # Ledger calculation + PDF generation
│   └── push.py            # Web push notifications
└── routes/                # 28 route modules
```

### VPS Deployment
```
/app/
├── install.sh             # Full install, update, and migrate commands
├── migrate.sh             # Standalone DB migration wrapper
└── frontend/public/vmpcrm_code.tar.gz  # Downloadable VPS package
```

## Migration Script (Apr 5, 2026)
- `backend/migrate.py` — Non-destructive, idempotent database migration
- Creates 47+ collections if missing
- Creates 50 indexes for performance
- Seeds default WA + Email message templates (if none exist)
- Adds new fields to existing docs: whatsapp_config (api_type, is_active, field mappings), orders (customer_type, source), users (permissions), items (role_rates, offer_rate), entities (state, district)
- Seeds default admin if no admin exists
- Integrated into `install.sh --install`, `install.sh --update`, and `install.sh --migrate`
- Also available as standalone `migrate.sh`

## Bug Fixes Applied (Apr 5, 2026)
- Fixed `+None` in WhatsApp messages when company phone is null
- Fixed `get_company_short_name()` None phone handling
- Fixed email notification crash (quantity type casting)
- Fixed all post-refactor missing imports across 15+ route files
- Full list in previous PRD entries

## Test Credentials
- Admin: info@vetmech.in / Kongu@@44884

## Backlog (P2)
- AI Insights for Reports dashboard
- Stock/Inventory Management
- Sales target management for MRs
- Data import/export
