# VMP CRM - Product Requirements Document

## Original Problem Statement
Build a simple CRM for managing doctor leads. Features include:
- Only admin and staff login (no end-user access)
- Basic CRM fields: Doctor Name, Reg.no, Address, Mail id, Phone Number, Lead status
- CRUD operations (create, edit, delete)
- Customer code (individual, VMP format)
- SMTP mail integration
- Additional field: Doctor Date of Birth

## User Choices
- **Authentication**: JWT-based custom auth (email/password)
- **Email**: Custom SMTP (user provides credentials)
- **Lead Statuses**: Customer, Contacted, Pipeline, Not Interested, Closed
- **Customer Code Format**: VMP-XXXX (auto-generated)

## User Personas
1. **Admin**: Full access to all features including SMTP configuration, user management, and all doctor operations
2. **Staff**: Access to doctor CRUD operations, search/filter, and email sending (no SMTP config access)

## Core Requirements
- [x] JWT Authentication (login/register)
- [x] Role-based access (admin/staff)
- [x] Doctor CRUD with all fields
- [x] Auto-generated customer codes (VMP-0001, VMP-0002, ...)
- [x] Lead status management
- [x] SMTP configuration (admin only)
- [x] Email sending to doctors
- [x] Email logs tracking
- [x] Dashboard with statistics
- [x] Search and filter functionality

## Items/Products Management (Iteration 2-3)
- [x] Items CRUD with fields: name, composition, offer, MRP, Rate, GST
- [x] Item categories
- [x] Custom item codes
- [x] Image uploads (100x100px, WebP compressed <25KB)
- [x] Special offers with styling

## Public Showcase & Ordering (Iteration 4-6)
- [x] Public product showcase page (mobile-responsive)
- [x] Editable company header (logo, name, address)
- [x] Products grouped by category
- [x] Order form with quantity input
- [x] WhatsApp OTP verification for orders
- [x] Order confirmation via WhatsApp
- [x] Dynamic WhatsApp API configuration

## Order Management & Transport (Iteration 7-9) - COMPLETED Jan 22, 2026
- [x] Transport provider management (CRUD)
- [x] Order tracking with transport details
- [x] Payment status tracking (To Pay/Paid)
- [x] **WhatsApp notifications for status changes:**
  - Confirmed: Order confirmation message
  - Shipped: Full transport details, package counts, invoice info
  - Delivered: Delivery confirmation
  - Cancelled: Cancellation with reason
- [x] **Conditional fields based on status:**
  - Shipped: Transport, tracking, delivery station, payment mode, package counts (boxes/cans/bags), invoice details
  - Cancelled: Cancellation reason (required)
- [x] Package details: Boxes, Cans, Bags counts
- [x] Invoice details: Number, Date, Value

## Order Editing & Pending Items - COMPLETED Jan 22, 2026
- [x] **Edit Order Items**: Remove items when out of stock
- [x] **Pending Items Tracking**: Mark removed items as "pending" for customer follow-up
- [x] **Pending Items Page**: Dedicated page showing all pending items grouped by doctor
- [x] **Dashboard Alert**: Shows pending items count for follow-up
- [x] **Sidebar Badge**: Shows pending items count in navigation
- [x] **Order Details**: Shows pending items for the customer in order view
- [x] **WhatsApp Out of Stock Notification**: Auto-sends message when items are marked as pending with:
  - ⚠️ Stock Update notification
  - List of out of stock items
  - Apology and assurance message
  - Company contact info

## Customer/Doctor Info Management - COMPLETED Jan 22, 2026
- [x] **Edit Customer from Order**: Edit customer info directly from order details
- [x] **Auto-detect Existing Doctor**: Looks up existing doctor by phone number
- [x] **Link/Create Doctor**: Option to create new doctor record or update existing
- [x] **"Linked" Badge**: Shows when order is linked to a doctor record

## Architecture

### Backend (FastAPI)
- **Auth**: JWT tokens with bcrypt password hashing
- **Database**: MongoDB collections:
  - `users`: Admin and staff accounts
  - `doctors`: Doctor/lead records
  - `smtp_config`: SMTP settings (single record)
  - `email_logs`: Email send history

### Frontend (React)
- **State Management**: Context API for auth
- **UI Library**: Shadcn/UI components
- **Styling**: Tailwind CSS with Manrope/Inter fonts
- **Charts**: Recharts for dashboard visualization

### API Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/register` | POST | Register new user |
| `/api/auth/login` | POST | Login and get JWT |
| `/api/auth/me` | GET | Get current user |
| `/api/doctors` | GET/POST | List/Create doctors |
| `/api/doctors/{id}` | GET/PUT/DELETE | Doctor CRUD |
| `/api/smtp-config` | GET/POST | SMTP settings |
| `/api/send-email` | POST | Send email to doctor |
| `/api/email-logs` | GET | Get email history |
| `/api/dashboard/stats` | GET | Dashboard statistics |

## What's Been Implemented (January 2025)

### Phase 1 - MVP Complete ✅
- Full JWT authentication system
- Doctor management with all CRUD operations
- Auto-generated VMP-XXXX customer codes
- Lead status tracking with 5 statuses
- Dashboard with statistics and pie chart
- SMTP configuration page (admin only)
- Email sending functionality with background tasks
- Email logs tracking
- Search and filter for doctors
- Responsive sidebar navigation
- Professional UI with Manrope/Inter fonts

### Phase 3 - Public Product Showcase & Orders ✅ (January 2025)
- **Public Showcase Page** (`/showcase`) - No login required
  - Company header: Logo, Name, Address, Email, GST, Drug License
  - Products grouped by category in table format
  - Table columns: Code, Item, Image, Composition & Offer (with GST%), MRP, Rate, Qty
  - Quantity input (supports formats like 10, 10+2, 50+10)
  - Terms & Conditions acceptance checkbox
  - WhatsApp OTP verification via botmastersender API
  - Auto-fetch doctor details when mobile number entered
  - Captures: IP address, location, device info on submission

- **Company Settings Page** (Admin only)
  - Logo upload
  - Editable fields: Company Name, Address, Email, GST Number, Drug License
  - Terms & Conditions text
  - Public showcase link with copy button

- **Orders Management Page**
  - View all orders from public showcase
  - Order details: Customer info, items, quantities, device info
  - Status management: Pending, Confirmed, Processing, Completed, Cancelled
  - Filter orders by status

- **WhatsApp Integration** (botmastersender API)
  - OTP sending for order verification
  - Order confirmation messages
- Items/Products page with single-page layout (list left, details right)
- Item fields: Name, Composition, Offer, MRP, Rate, GST
- Auto-generated item codes (ITM-0001, ITM-0002, ...) OR custom codes
- **Category field** with filter dropdown and "Add New Category" option
- **Custom Item Code** field (can specify custom code like AMX-500)
- **Image Upload**: 
  - Auto-resizes to 100x100 pixels
  - Converts to WebP format
  - Compresses to under 25KB automatically
  - Displays thumbnail in list and detail view
- **Custom Fields feature**: Add unlimited custom fields per item
- Add, Edit, Delete operations on single page
- Search and category filter functionality

## Prioritized Backlog

### P0 (Critical) - None remaining

### P1 (High Priority)
- [ ] Bulk email sending to multiple doctors
- [ ] Export doctors to CSV/Excel
- [ ] Import doctors from CSV

### P2 (Medium Priority)
- [ ] Email templates with variables
- [ ] Activity log for doctor interactions
- [ ] Notes/comments on doctor records
- [ ] Pagination for large datasets

### P3 (Low Priority)
- [ ] Dark mode support
- [ ] Multi-language support
- [ ] Advanced reporting and analytics
- [ ] Custom lead status configuration

## Next Tasks
1. Configure SMTP with your email provider credentials
2. Start adding doctor leads
3. Consider implementing bulk email feature for marketing campaigns
4. Add export functionality for reporting

## Tech Stack
- **Backend**: FastAPI, Motor (async MongoDB), PyJWT, bcrypt
- **Frontend**: React 19, React Router, Axios, Tailwind CSS, Shadcn/UI, Recharts
- **Database**: MongoDB
- **Auth**: JWT tokens
