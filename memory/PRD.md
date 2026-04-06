# VMP CRM - Product Requirements Document

## Architecture
- **Frontend**: React, Tailwind, Shadcn UI
- **Backend**: FastAPI (modular routes), MongoDB (Motor), Multi-WhatsApp API

## Recent Changes (Apr 6, 2026)

### Customer Portal - Change Password
- New `POST /api/customer/change-password` endpoint in `routes/customers.py`
- Requires old password verification + min 6 char new password
- UI added to `CustomerProfile.jsx` with password visibility toggles
- Fully tested (7/7 backend, all frontend validations pass)

### Order Update WhatsApp Fix
- Fixed: qty formats "10+5" (scheme) and "1 case offer" now send WhatsApp correctly
- Fixed: Subsequent edits always trigger WhatsApp (was silently crashing on non-int qty)
- All `int(quantity)` replaced with safe `str(quantity)` across all notification functions

### Transport Notifications
- Ready to Dispatch now correctly sends WhatsApp to transporter by looking up phone from transports collection
- Message includes delivery station, package details (boxes/cans/bags)

### Updated WhatsApp Templates
- **Delivered**: Now includes Invoice No, Invoice Date, Invoice Value
- **Shipped/Dispatched**: Now includes Transport, Tracking No, Delivery Station, Package Details, Payment mode (to_pay only)

### Transport Edit
- New PUT /api/transports/{id} endpoint
- Edit button in Orders > Manage Transports UI

### Customer Portal Items
- Always sorted alphabetically by item name (with or without filters)

### Marketing Campaign Delete
- New DELETE /api/marketing/campaigns/{id} endpoint
- Cascades: deletes campaign logs + inline images/PDFs
- Delete button (Trash2 icon) on each campaign row

### VPS Deployment
- `vmpcrm_code.tar.gz` rebuilt with latest changes
- `install.sh` supports --update and --migrate flags
- `migrate.py` for non-destructive DB migrations
- Auto-cleanup of temp ledger PDFs and backup files (24h TTL)

### Database Restore
- `POST /api/database/restore` for JSON upload restore
- UI in Admin Settings

### Pre-existing Fix
- Items without 'mrp' field no longer cause 500 error

## Test Credentials
- Admin: info@vetmech.in / Kongu@@44884
- Customer: 9999777766 / test123

## Backlog (P2)
- AI Insights for Reports
- Stock/Inventory Management
- Sales target management for MRs
- Data import/export (CSV)
