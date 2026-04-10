# VMP CRM - Product Requirements Document

## Architecture
- **Frontend**: React, Tailwind, Shadcn UI
- **Backend**: FastAPI (modular routes), MongoDB (Motor), Multi-WhatsApp API
- **PWA**: Service workers for Customer + MR portals

## Security Hardening (Apr 9, 2026)
- **JWT Secret**: Now required in `.env` — no weak fallback. Server won't start without it
- **Brute Force Protection**: All login endpoints (Admin, Customer, MR) lock out after 5 failed attempts for 15 minutes. Uses IP:identifier tracking
- **OTP Protection**: OTP verification locked after 5 wrong attempts. OTP send rate-limited to 5/minute
- **Rate Limiting**: slowapi with `X-Forwarded-For` real IP detection for proxy environments
- **Token Expiry**: Customer/MR tokens reduced from 30 days to 7 days. Admin tokens: 24 hours
- **CORS**: Configurable via `CORS_ORIGINS` env var (default `*`, should be locked on VPS)

## Recent Changes

### Items & Inventory Merge (Apr 10, 2026)
- Merged Items page and Stock Management page into single "Items & Inventory" page
- 8 tabs: Products | Stock Status | Opening Bal. | Purchases | Sales Return | Item Ledger | User Ledger | Suppliers
- Stock quantity badge (Stk: N) shown per item in products list
- Header action buttons (Export, Import, etc.) only visible on Products tab
- Sidebar updated: single "Items & Inventory" nav item
- /admin/stock route removed, everything at /admin/items

### Stock & Inventory Module (Apr 9, 2026)
- Opening balance, Purchase entry, Stock status reports
- Supplier management (CRUD)
- Item ledger (credit/debit tracking)
- User ledger (customer purchase history)
- Sales return and Purchase return tracking
- Stock availability display in Admin order processing

### Customer Portal Enhancements (Apr 8-9, 2026)
- Change Password feature (POST /api/customer/change-password)
- Registration form: all fields now compulsory with validation
- Install App button on login page + dashboard
- WhatsApp approval message now includes login URL

### Bug Fixes (Apr 8-9, 2026)
- Customer push notifications: fixed localStorage key mismatch
- Customer profile refresh: fixed wrong API URL
- Push subscribe endpoint: added missing JWT imports

## Test Credentials
- Admin: info@vetmech.in / Kongu@@44884
- Customer: 9999777766 / test123
- MR: 9876543211 / testpass

## VPS Deployment
- Update command: wget + tar + npm build + backend restart
- `JWT_SECRET` must be set in backend .env
- `CORS_ORIGINS` should be set to domain (e.g., https://vetmechpharma.in)
- `APP_BASE_URL` must point to VPS domain
- Tarball rebuild: `cd /app && tar --exclude='frontend/node_modules' --exclude='backend/venv' --exclude='frontend/build' --exclude='backend/__pycache__' --exclude='.git' --exclude='frontend/public/vmpcrm_code.tar.gz' --exclude='*.env' --exclude='__pycache__' --exclude='node_modules' -czf /tmp/vmpcrm_code.tar.gz frontend backend update.sh install.sh migrate.sh && cp /tmp/vmpcrm_code.tar.gz /app/frontend/public/vmpcrm_code.tar.gz`

## Key Pages
- `/admin/items` - Items & Inventory (merged, 8 tabs)
- `/admin/orders` - Order management
- `/admin/stock` - REMOVED (merged into /admin/items)

## Backlog (P2)
- Refactor server.py monolith into modular routes (P0 tech debt)
- AI Insights for Reports
- Sales target management for MRs
- Data import/export (CSV)
