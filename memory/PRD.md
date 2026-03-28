# VMP CRM - Product Requirements Document

## Original Problem Statement
Full-stack Veterinary CRM (FastAPI + React + MongoDB) for pharmaceutical distribution management. Features include:
- Admin, Customer, and Medical Representative (MR) modules
- Dynamic multi-API WhatsApp configuration (BotMasterSender + AKNexus)
- Offline MR ordering, automated ledgers, dual-channel notifications (Email + WA)
- Role-based pricing, pending/out-of-stock item management

## Architecture
- **Frontend**: React, Tailwind, Shadcn UI
- **Backend**: FastAPI, MongoDB (Motor), Multiple WhatsApp API styles
- **Key**: AKNexus determines message type via URL extension suffix (.pdf, .jpg)

## Completed Features (All Tested)

### Phase 1 - Core CRM
- Admin/MR/Customer authentication & portals
- Doctor/Medical/Agency CRUD with lead management
- Order management with role-based pricing
- Item/Product management with images
- Email & WhatsApp notifications
- Follow-up tracking, notes, tasks
- Payment tracking & ledger management

### Phase 2 - Role-Based Enhancements
- MR & Admin Order Form role-based default rate mapping
- Pending/Out-of-stock items displayed during order creation (Admin, MR, Customer)

### Phase 3 - WhatsApp Multi-API
- Dual WhatsApp API support (BotMasterSender Query Param + AKNexus REST)
- UI for switching/testing WhatsApp configs
- WhatsApp file-to-text fallback for failed media
- Fixed AKNexus image/PDF extensions (.jpg, .pdf endpoints)

### Phase 4 - Direct WhatsApp Messaging (Latest - Mar 28, 2026)
- Individual WhatsApp message buttons in Doctors, Medicals, Agencies tables
- Enhanced dialog with 4 message types: **Text, Image, PDF, Product**
- Product selection from items list with search, thumbnails, MRP display
- Shared `WhatsAppDirectDialog` component (deduplicated across 3 pages)
- Backend `POST /api/whatsapp/send-direct` supports all message types
- Tested: 100% backend (10/10), 100% frontend (all 3 pages)

## Key API Endpoints
- `POST /api/whatsapp/send-direct` - Send direct WA (text/image/pdf/product)
- `POST /api/whatsapp-config` & `PUT /api/whatsapp-config/{id}/activate`
- `GET /api/pending-items/doctor/{phone}`
- `GET /api/items/{item_id}/image.jpg` (AKNexus image endpoint)

## DB Schema (Key Collections)
- `whatsapp_config`: name, api_url, auth_token, api_type, instance_id, is_active
- `pending_items`: doctor_phone, item_id, quantity, original_order_id
- `items`: item_name, item_code, mrp, rate_doctors/medicals/agencies, image_webp

## Tech Debt
- **P0**: `server.py` is ~12,950 lines - needs modular refactoring into routes/

## Backlog (P2)
- Stock/Inventory Management (quantity tracking, low-stock alerts)
- Sales reports with charts
- Data import/export functionality
- Sales target management for MRs
- VPS installation script (install.sh)
- Refactor follow-up UI (extract duplicated logic)

## 3rd Party Integrations
- BotMasterSender API (WhatsApp Query Params) — User API Key
- AKNexus API (WhatsApp REST) — User Access Token + Instance ID
- Custom SMTP (Email) — User Credentials

## Test Credentials
- Admin: admin@vmpcrm.com / admin123
- MR: 9876543211 / testpass
- Customer: 9999777766 / test123
