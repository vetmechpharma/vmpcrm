# VMP CRM - Product Requirements Document

## Original Problem Statement
Full-stack Veterinary CRM (FastAPI + React + MongoDB) for pharmaceutical distribution management.

## Architecture
- **Frontend**: React, Tailwind, Shadcn UI, Recharts
- **Backend**: FastAPI (modular routes), MongoDB (Motor), Multi-WhatsApp API

### Backend Structure
```
/app/backend/
├── server.py, deps.py, migrate.py
├── models/schemas.py
├── utils/ (whatsapp, email, templates, notifications, image, ledger, push, code_gen)
└── routes/ (28 modules including database.py with restore)
```

## Implemented Features (Apr 5, 2026)

### WhatsApp Template Audit
- All templates use `render_wa_template` with proper `company_short_name` and `company_phone`
- Fixed `+None` display when company phone is null
- Templates: otp, order_confirmation, status_confirmed/processing/ready/dispatched/delivered/cancelled, payment_receipt, out_of_stock, stock_arrived, account_approved/declined, password_reset, daily_reminder, ledger_statement, birthday/anniversary_greeting, order_updated, payment_reminder

### Auto-Delete Temp Files
- Background task `cleanup_temp_files` runs every 6 hours
- Cleans expired `temp_ledger_pdfs` (48h TTL)
- Cleans expired `temp_backup_files` (48h TTL)
- Also cleans entries without `expires_at` that are older than 2 days

### Database Backup Email Attachment
- Already existed: `POST /api/database/send-email-backup` sends full JSON backup via SMTP
- `POST /api/database/trigger-backup` sends via both WhatsApp + Email

### Database Restore (NEW)
- **Merge Mode** (`POST /api/database/restore`): Adds missing records, skips duplicates by `id`
- **Replace Mode** (`POST /api/database/restore-replace`): Replaces collection data; protected collections (users, system_settings, whatsapp_config, smtp_settings) are always merged safely
- UI in Settings > Database Management with file picker, Merge/Replace toggle, and Restore button
- Supports JSON backup files exported by the system

### Previous Session Work
- Order edit WhatsApp notification with updated items list
- Payment reminder via template-based WhatsApp API
- Removed raw wa.me WhatsApp button from Orders page
- Reports Orders tab crash fix (state mutation, NaN, empty arrays)
- VPS auto-cleanup of downloaded archives
- Database migration script (migrate.py)

## Test Credentials
- Admin: info@vetmech.in / Kongu@@44884

## Backlog (P2)
- AI Insights for Reports dashboard
- Stock/Inventory Management
- Sales target management for MRs
- Data import/export (CSV)
