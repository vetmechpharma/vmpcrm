# VMP CRM - Product Requirements Document

## Architecture
- **Frontend**: React, Tailwind, Shadcn UI
- **Backend**: FastAPI (modular routes), MongoDB (Motor), Multi-WhatsApp API
- **PWA**: Service workers for Customer + MR portals

## Security Hardening (Apr 9, 2026)
- JWT Secret required in `.env`, brute force protection, rate limiting, 7-day token expiry
- CORS configurable via `CORS_ORIGINS` env var

## Recent Changes

### Edit/Delete for Stock Transactions (Apr 10, 2026)
- **Purchase Tab**: Edit/Delete buttons with edit dialog (already done prior)
- **Sales Return Tab**: Added history table showing past sales returns, Edit/Delete buttons with edit dialog (qty, rate, GST%, date, customer info, notes, amount preview)
- **Stock Issue Tab**: Added Edit/Delete buttons to existing history table, edit dialog (qty, reason, date, notes)
- **Stock Issue Tab**: Now visible in main tab layout (was exported but not displayed)
- Backend: `GET /api/stock/sales-returns`, `PUT /api/stock/transaction/{id}`, `DELETE /api/stock/transaction/{id}`

### Stock Module Enhancements (Apr 10, 2026)
- **Item Ledger**: Now shows customer name + order ID in sale descriptions (was only order ID)
- **Products List**: Shows stock qty (Stk: N) AND purchase rate (PR: ₹N) per item
- **Main Categories**: Checkboxes now properly show previous selections on edit, moved below image/code row
- **Item Code**: Input now full width
- **Opening Balance**: Each item has its own date input (not shared)
- **Sales Return**: Customer search by name/phone, shows full order history grouped by item, click-to-add return items
- **User Ledger**: Fixed to search doctor_name/phone + customer_name/phone; shows item-wise qty totals summary
- **Manual Order (Admin)**: Purchase rate shown alongside MRP, rate, offers, and special offers
- **Stock Auto-Deduction**: Stock already auto-reduces based on shipped/delivered order status (no duplication)

### Items & Inventory Merge (Apr 10, 2026)
- Merged Items and Stock Management into single "Items & Inventory" page
- 8 tabs: Products | Stock Status | Opening Bal. | Purchases | Sales Return | Item Ledger | User Ledger | Suppliers
- Sidebar updated: single "Items & Inventory" nav item

### Stock & Inventory Module (Apr 9, 2026)
- Opening balance, Purchase entry, Stock status reports, Supplier management
- Item/User ledger, Sales return, Purchase return tracking

### Customer Portal Enhancements (Apr 8-9, 2026)
- Change Password, compulsory registration fields, PWA install button, login URL in approvals

### VPS Deployment Scripts (Apr 9, 2026)
- update.sh preserves .env files during updates
- date-fns v2.30.0, react-day-picker v9.14.0 for React 19 compatibility
- ajv@8.17.1 required for build

## Test Credentials
- Admin: info@vetmech.in / Kongu@@44884
- Customer: 9999777766 / test123
- MR: 9876543211 / testpass

## VPS Deployment
- Tarball: `cd /app && tar --exclude='frontend/node_modules' --exclude='backend/venv' --exclude='frontend/build' --exclude='backend/__pycache__' --exclude='.git' --exclude='frontend/public/vmpcrm_code.tar.gz' --exclude='*.env' --exclude='__pycache__' --exclude='node_modules' -czf /tmp/vmpcrm_code.tar.gz frontend backend update.sh install.sh migrate.sh && cp /tmp/vmpcrm_code.tar.gz /app/frontend/public/vmpcrm_code.tar.gz`
- VPS install: `npm install --legacy-peer-deps && npm run build`

## Key API Endpoints
- `GET /api/stock/sales-returns` - List all sales return records
- `PUT /api/stock/transaction/{id}` - Edit any stock transaction (purchase, sales return, stock issue)
- `DELETE /api/stock/transaction/{id}` - Delete any stock transaction
- `GET /api/stock/customer-orders?phone=xxx` - Customer order history for sales return
- `GET /api/stock/user-ledger?customer_phone=xxx` - User ledger with item totals
- `GET /api/stock/item-ledger/{item_id}` - Item ledger with customer names
- `GET /api/stock/availability` - Stock qty + purchase rate per item
- `POST /api/stock/opening-balance/bulk` - Per-item dates supported

## Backlog
- (P0) Refactor server.py monolith into modular routes
- (P2) AI Insights for Reports
- (P2) Sales target management for MRs
- (P2) Data import/export (CSV)
