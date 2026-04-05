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

## Bug Fixes Applied (Apr 5, 2026 - Post-Refactor Audit)
- Fixed `process_image_to_webp` import in `marketing.py`, `company_settings.py`
- Fixed `bcrypt`/`asyncio` imports in `customers.py`
- Fixed `bcrypt` import in `admin_profile.py`
- Fixed `smtplib`/`MIMEMultipart` imports in `marketing.py`
- Fixed `MIMEApplication` import in `email_routes.py`
- Fixed `base64` import in `company_settings.py`
- Fixed `PIL.Image` import in `items.py`
- Fixed `get_wa_template` import in `customers.py`, `whatsapp_config.py`
- Fixed `get_company_short_name` import in `whatsapp_config.py`
- Fixed `send_whatsapp_otp` import in `marketing.py`
- Fixed `send_wa_msg` import in `reminders.py`
- Fixed `send_push_to_admins` import in `orders_admin.py`
- Fixed `send_push_to_user` import in `mr.py`
- Fixed `OrderItem` import in `orders_admin.py`, `mr.py`
- Fixed `UserPermissions` import in `users.py`
- Removed unnecessary `sender_id` check blocking OTP sending
- Created `utils/notifications.py` with order notification functions lost during refactoring
- Removed duplicate push notification functions from `routes/push.py`
- Added admin auto-seeding in `server.py` startup
- Fixed `install.sh`: Python venv detection, getcwd error, IP-only support
- Removed `emergentintegrations` from `requirements.txt`

## WhatsApp Template Fix (Apr 5, 2026)
- Fixed `+None` appearing in WhatsApp messages when company phone is null
- Fixed `get_company_short_name()` to handle `None` phone values with `or` operator
- Added cleanup in `render_wa_template()` to strip `+None` patterns
- Fixed `int()` casting for quantity in notification item calculations (was causing email error)
- All order notifications now use `render_wa_template` for proper variable interpolation
- VPS code package rebuilt with latest fixes

## Test Credentials
- Admin: info@vetmech.in / Kongu@@44884

## Backlog (P2)
- AI Insights for Reports dashboard
- Stock/Inventory Management
- Sales target management for MRs
- Data import/export
