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
- **Token Expiry**: Customer/MR tokens reduced from 30 days → 7 days. Admin tokens: 24 hours
- **CORS**: Configurable via `CORS_ORIGINS` env var (default `*`, should be locked on VPS)

## Recent Changes (Apr 8-9, 2026)

### Customer Portal Enhancements
- Change Password feature (POST /api/customer/change-password)
- Registration form: all fields now compulsory with validation
- Install App button on login page + dashboard
- WhatsApp approval message now includes login URL

### Bug Fixes
- Customer push notifications: fixed localStorage key mismatch
- Customer profile refresh: fixed wrong API URL (/api/portal/profile → /api/customer/profile)
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

## Backlog (P2)
- AI Insights for Reports
- Stock/Inventory Management
- Sales target management for MRs
- Data import/export (CSV)
