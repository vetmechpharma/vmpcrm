# VMP CRM - Product Requirements Document

## Architecture
- **Frontend**: React, Tailwind, Shadcn UI
- **Backend**: FastAPI (modular routes), MongoDB (Motor), Multi-WhatsApp API

## Recent Changes (Apr 6, 2026)

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

### Pre-existing Fix
- Items without 'mrp' field no longer cause 500 error

## Test Credentials
- Admin: info@vetmech.in / Kongu@@44884

## Backlog (P2)
- AI Insights for Reports
- Stock/Inventory Management
- Sales target management for MRs
- Data import/export (CSV)
