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
└── routes/ (28 modules)
```

## Recent Changes (Apr 5, 2026)

### Order Edit WhatsApp Notification
- Items add/remove/qty change triggers WA + Email with full updated list
- New templates: order_updated, payment_reminder (WA + Email)

### Payment Reminder (Template-based)
- Outstanding table and Ledger WA reminder now uses backend API template

### Reports Orders Tab Fix
- Fixed `orderStatus.sort()` mutating React state (caused re-render crash)
- Fixed `avg_value` NaN in StatCard calculation
- Fixed `Math.max()` on empty array returning -Infinity
- Fixed tooltip formatter crash on null values

### VPS Auto-Cleanup
- `install.sh --update` now auto-deletes `/tmp/vmpcrm_upload.tar.gz` after extraction
- Fresh install also auto-cleans

### Database Migration Script
- `migrate.py` — idempotent, non-destructive
- Auto-seeds new templates for existing DBs
- Integrated into install.sh (--install, --update, --migrate)

## Test Credentials
- Admin: info@vetmech.in / Kongu@@44884

## Backlog (P2)
- AI Insights for Reports dashboard
- Stock/Inventory Management
- Sales target management for MRs
- Data import/export
