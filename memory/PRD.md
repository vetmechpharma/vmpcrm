# VMP CRM - Product Requirements Document

## Architecture
- **Frontend**: React, Tailwind, Shadcn UI
- **Backend**: FastAPI (modular routes), MongoDB (Motor), Multi-WhatsApp API
- **PWA**: Service workers for Customer + MR portals

## Security Hardening (Apr 9, 2026)
- JWT Secret required in `.env`, brute force protection, rate limiting, 7-day token expiry
- CORS configurable via `CORS_ORIGINS` env var

## Recent Changes

### WhatsApp Phone Number Normalization Fix (Apr 11, 2026)
- **Fixed**: WhatsApp API 400 error when sending payment receipts to certain customer codes (e.g., VMP-0001)
- **Root cause**: Phone numbers with non-digit characters (+, spaces, dashes) were sliced before stripping, producing invalid numbers
- **Fix**: All phone normalization now strips non-digits FIRST, then extracts last 10 digits + 91 prefix
- **Files fixed**: `utils/whatsapp.py` (universal `send_wa_msg`), `routes/payments.py` (receipt, reminder, ledger WA sends)
- Tarball rebuilt for VPS deployment

### Customer Individual Ledger (Apr 10, 2026)
- **New "Customer Ledger" tab** in Payments page — search any customer (doctor/medical/agency)
- Shows all transactions: Opening Balance, Orders/Invoices (debit), Payments (credit), Sales Returns (credit)
- **Manual Opening Balance**: Edit button to set/update opening balance per customer
- **Clickable rows**: Click any transaction to view full detail (order items, payment info, return info)
- Running balance calculation across all entries
- Date range filters (Week/Month/Year presets + custom) + CSV Export + Print
- Backend: `PUT /api/customer-opening-balance/{type}/{id}`, updated `GET /api/ledger/{type}/{id}` with sales returns + ref_ids

### Notification Message Fixes (Apr 10, 2026)
- **Order confirmation WA message**: Removed item amount (Rs.xxx) — now shows only item name x qty
- **Account approval WA message**: Login URL now properly included using APP_BASE_URL with request-origin fallback
- **Account approval email**: Login URL also uses same base URL logic
- Updated default template for `account_approved` to include `{login_url}` variable

### Filters, Print & Export (Apr 10, 2026)
- **Item Ledger**: Date range filter (Week/Month/Year presets + custom) + CSV Export + Print
- **User Ledger**: Date range filter + CSV Export + Print
- **Stock Issue**: Date range filter + CSV Export + Print
- **Purchase**: Date range filter + CSV Export + Print
- **Sales Return**: Date range filter + CSV Export + Print
- **Stock Status**: Main Category / Sub Category dropdown filters + CSV Export + Print
- **Item Report (NEW TAB)**: Weekly/Monthly/Yearly/Custom item movement report (Opening, Purchase, Pur.Return, Sales, Sal.Return, Issues, Closing) with totals row + CSV + Print
- **Opening/Closing Report (NEW TAB)**: Opening stock, Closing stock, Difference per item for any date range + CSV + Print
- All exports are client-side only (no server storage) - blob download in browser
- Backend: `GET /api/stock/period-report?from_date=&to_date=` for date-range stock calculations

### Bug Fix: Doctor Add (Apr 10, 2026)
- Fixed: `reg_no` and `email` changed from required to optional in DoctorCreate schema
- Fixed: `generate_customer_code()` crash on legacy `DOC-` prefixed codes

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
