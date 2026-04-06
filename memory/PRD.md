# VMP CRM - Product Requirements Document

## Architecture
- **Frontend**: React, Tailwind, Shadcn UI
- **Backend**: FastAPI (modular routes), MongoDB (Motor), Multi-WhatsApp API
- **PWA**: Service workers for both Customer (`sw.js`) and MR (`mr-sw.js`) portals

## Recent Changes (Apr 6, 2026)

### Bug Fixes - Push Notifications, Sessions, PWA
- **Fixed**: Customer push notifications broken — `usePushNotifications.js` was reading `customer_token` instead of `customerToken` from localStorage
- **Fixed**: Customer profile never refreshing — `CustomerLayout.jsx` was calling non-existent `/api/portal/profile` instead of `/api/customer/profile`
- **Fixed**: Customer push subscribe endpoint — missing `jwt`, `JWT_SECRET`, `JWT_ALGORITHM` imports in `push.py`
- **Verified**: PWA install prompts exist for both Customer and MR portals
- **Verified**: Login session persistence works for Admin, Customer, and MR (all use localStorage)

### Customer Portal - Change Password
- `POST /api/customer/change-password` endpoint — validates old password, enforces min 6-char new password
- UI in `CustomerProfile.jsx` with password visibility toggles and confirm-match validation

### Order Update WhatsApp Fix
- Fixed: qty formats "10+5" (scheme) and "1 case offer" now send WhatsApp correctly
- All `int(quantity)` replaced with safe `str(quantity)` across all notification functions

### Transport Notifications
- Ready to Dispatch sends WhatsApp to transporter with delivery station, package details

### Updated WhatsApp Templates
- **Delivered**: Includes Invoice No, Invoice Date, Invoice Value
- **Shipped/Dispatched**: Includes Transport, Tracking No, Delivery Station, Package Details

### Transport Edit
- PUT /api/transports/{id} endpoint + Edit button in UI

### Customer Portal Items
- Always sorted alphabetically by item name

### Marketing Campaign Delete
- DELETE /api/marketing/campaigns/{id} — cascades to logs + inline images/PDFs

### VPS Deployment
- `vmpcrm_code.tar.gz` rebuilt with all latest changes
- `install.sh` supports --update and --migrate flags
- Background auto-cleanup of temp ledger PDFs and backup files (24h TTL)

### Database Restore
- POST /api/database/restore for JSON upload restore with Settings UI

## Test Credentials
- Admin: info@vetmech.in / Kongu@@44884
- Customer: 9999777766 / test123
- MR: 9876543211 / testpass

## Backlog (P2)
- AI Insights for Reports
- Stock/Inventory Management
- Sales target management for MRs
- Data import/export (CSV)
