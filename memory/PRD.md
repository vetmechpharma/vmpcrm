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
- **Authentication**: JWT-based custom auth (email/password) - Admin creates users in panel
- **Email**: Custom SMTP (user provides credentials)
- **Lead Statuses**: Customer, Contacted, Pipeline, Not Interested, Closed
- **Customer Code Format**: VMP-XXXX (auto-generated)

## User Personas
1. **Admin**: Full access to all features including SMTP configuration, user management, company settings, and all CRM operations
2. **Staff**: Customizable access to modules based on admin-assigned permissions

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
- [x] **Bulk Delete** (COMPLETED Feb 12, 2026):
  - Table view with checkboxes for selection
  - "Select All" checkbox in header
  - "Delete (N)" button appears when items selected
  - Confirmation modal with warning
  - Deletes related notes and tasks

## Items/Products Management (Iteration 2-3)
- [x] Items CRUD with fields: name, composition, offer, MRP, Rate, GST
- [x] Item categories
- [x] Custom item codes
- [x] Image uploads (100x100px, WebP compressed <25KB)
- [x] Special offers with styling

## Public Showcase & Ordering (Iteration 4-6) - UPDATED Jan 23, 2026
- [x] Public product showcase page (mobile-responsive)
- [x] **Responsive Grid Layout**:
  - Mobile: 2 columns
  - Tablet: 3-4 columns  
  - Desktop: 6-8 columns
- [x] **Category Filter System**:
  - Main categories at top: Large Animals, Poultry, Pets (horizontal scrollable pills)
  - Subcategories appear when main category selected: Injection, Liquids, Bolus, Powder, etc.
  - **Items can have MULTIPLE main categories** (e.g., Tetracycline for both Large Animals and Poultry)
  - Items can have multiple subcategories
  - **Add New Subcategory** option in Items management
- [x] **Product Cards with**:
  - Image with MRP tag overlay
  - **Composition overlay on image tap** (shows composition text on dark background)
  - "Tap for composition" hint on images
  - Special offer badge (sparkle icon)
  - Name, Rate, Offer badge
  - Special offer text
  - Qty add controls (+/- buttons)
- [x] **Floating Cart Summary** at bottom with mobile input and order button
- [x] Order form with quantity input
- [x] WhatsApp OTP verification for orders
- [x] Order confirmation via WhatsApp
- [x] Dynamic WhatsApp API configuration
- [x] **Items Management**: 
  - Removed legacy Category field
  - Added main_categories (multiple selection checkboxes)
  - Added subcategories (multiple selection checkboxes)
  - Added "Add New Subcategory" option
- [x] **Bulk Item Excel Import** (COMPLETED Feb 12, 2026):
  - "Import Excel" button in Items page header
  - Import modal with instructions and template download
  - Excel template with headers: Item Code, Item Name, Main Categories, Subcategories, Composition, MRP, Rate, GST%, Offer, Special Offer
  - Multiple categories/subcategories support (comma-separated in Excel)
  - Auto-generated item codes if not provided
  - Updates existing items if item_code matches
  - Default company logo for items without images (images can be added manually after import)
  - Maximum 500 items per import
  - Import result summary showing created/updated counts and errors

## Order Management & Transport (Iteration 7-9) - UPDATED Jan 23, 2026
- [x] Transport provider management (CRUD)
- [x] **Transport URL**: Simple URL field for transport provider website (no tracking number template)
- [x] **Transport Contact Numbers**: Incharge contact number + alternate number for each transport
- [x] Order tracking with transport details
- [x] **Transport Display**: Orders page shows transport name + tracking number as plain text (no clickable links)
- [x] Payment status tracking (To Pay/Paid)
- [x] **Payment Amount Tracking** (COMPLETED Feb 12, 2026):
  - **To Pay Amount**: Enter amount to collect from customer (stored for reference only, not sent via WhatsApp)
  - **Paid Amount**: Enter paid amount with expense details
  - **Auto Expense Creation**: When "Paid" is selected, auto-creates expense entry in Transport/Shipping category
  - **Expense Details**: "Paid By" (who spent) and "From Account" (company_account, admin_account, employee_account, cash)
  - **Display**: Payment amount shown in Orders table and Order Details modal
- [x] **New Order Status: Ready to Despatch**:
  - Added between Confirmed and Shipped statuses
  - Captures: Transport, Delivery Station, Payment Mode, Payment Amount, Package Details (Box/Can/Bag), Invoice Details
  - Sends WhatsApp to **Transporter ONLY** with complete billing info (using transport contact number)
  - NO message sent to customer at this stage
- [x] **Shipped Status with Full Details**:
  - Only requires Tracking Number entry (other details from Ready to Despatch)
  - Sends WhatsApp to **Customer** with: Tracking Number + Package Details + Invoice Details
  - Auto-creates expense for "Paid" orders (not for "To Pay")
- [x] **WhatsApp notifications for status changes:**
  - Confirmed: Order confirmation message to customer
  - Ready to Despatch: Full billing details to **transporter only**
  - Shipped: Full details (tracking, package, invoice) to **customer**
  - Delivered: Delivery confirmation to customer
  - Cancelled: Cancellation with reason to customer
- [x] **Conditional fields based on status:**
  - Ready to Despatch: Transport, delivery station, payment mode, payment amount, expense details (for Paid), package counts (boxes/cans/bags), invoice details
  - Shipped: Tracking number only (transport info shown if already set)
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

## Lead Management & Follow-up System - COMPLETED Jan 22, 2026
- [x] **Last Contact Tracking**: Record when lead was last contacted
- [x] **Follow-up Date**: Manual or auto-set follow-up date
- [x] **25-Day Auto Follow-up Rule**: If no follow-up set, calculates 25 days from last contact
- [x] **Priority Levels**: Low (gray), Moderate (amber), High (red) with visual indicators
- [x] **Follow-up Due Alert**: Red "Follow-up Due" badge when follow-up is overdue
- [x] **Not Interested = No Auto Follow-up**: Leads marked "Not Interested" skip auto-reminders
- [x] **Notes System**: Add/delete notes per doctor with timestamp and author
- [x] **Tasks System**: Create tasks per doctor with:
  - Title, description, due date
  - Priority (Low/Moderate/High)
  - Status toggle (pending/completed)
- [x] **Mark Contacted Button**: One-click to update last contact and set next follow-up
- [x] **Doctor Detail Modal**: View all info, notes, and tasks in one place

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
| `/api/medicals` | GET/POST | List/Create medicals |
| `/api/medicals/{id}` | GET/PUT/DELETE | Medical CRUD |
| `/api/medicals/{id}/notes` | GET/POST | Medical notes |
| `/api/medicals/{id}/contact` | PUT | Mark medical contacted |
| `/api/agencies` | GET/POST | List/Create agencies |
| `/api/agencies/{id}` | GET/PUT/DELETE | Agency CRUD |
| `/api/agencies/{id}/notes` | GET/POST | Agency notes |
| `/api/agencies/{id}/contact` | PUT | Mark agency contacted |
| `/api/smtp-config` | GET/POST | SMTP settings |
| `/api/send-email` | POST | Send email to doctor |
| `/api/email-logs` | GET | Get email history |
| `/api/dashboard/stats` | GET | Dashboard statistics |

## Expenses Management - COMPLETED Feb 4, 2026
- [x] **Expense Categories**: 6 default categories (Transport/Shipping, Office Supplies, Salaries, Utilities, Marketing, Miscellaneous) + custom categories
- [x] **Expense Tracking**: Full CRUD with fields:
  - Category, Date, Amount
  - Payment Type (Cash, Card, UPI, Net Banking)
  - Payment Account (Company Account, Admin User, Employee User)
  - Paid By (name of person who paid)
  - Reason/Description
- [x] **Transport Auto-Expense**: Auto-create expense when order is shipped with "Paid" status
- [x] **Filtering**: Date range, category, payment type, payment account filters
- [x] **Monthly Statistics**: Current month total, previous month comparison, change %, by category breakdown
- [x] **Dashboard Integration**: Monthly Expenses summary card on dashboard
- [x] **Sidebar Navigation**: Expenses menu item between Orders and Pending Items

## Medicals & Agencies Management - COMPLETED Jan 25, 2026 (Updated Feb 12, 2026)
- [x] **Medicals Entity**: Complete CRUD for medical stores with fields:
  - Name, Proprietor Name, GST Number, Drug License
  - Address (Street, State, District, Pincode)
  - Phone, Alternate Phone, Email
  - Lead Status, Priority, Follow-up Date
  - Auto-generated codes: MED-XXXX
- [x] **Agencies Entity**: Complete CRUD for distribution agencies with same fields
  - Auto-generated codes: AGY-XXXX
- [x] **Lead Management**: Same features as Doctors
  - Lead statuses (Customer, Contacted, Pipeline, Not Interested, Closed)
  - Priority levels (Low, Moderate, High)
  - Mark Contacted with 25-day follow-up
  - Notes system with timestamps
  - Tasks system with due dates and priorities
- [x] **Sidebar Navigation**: Separate menu items for Doctors, Medicals, Agencies
- [x] **Search & Filter**: Search by name, phone, GST; filter by status
- [x] **Table View UI** (Feb 12, 2026): Both Medicals and Agencies pages converted to table view matching Doctors page
- [x] **Bulk Delete** (Feb 12, 2026): Same functionality as Doctors - checkboxes, Select All, Delete (N) button, confirmation modal

## Admin Dashboard UI Redesign - COMPLETED Jan 25, 2026
- [x] **Modern Dashboard Design**: Complete UI overhaul with gradient header and glass-morphism effects
- [x] **Hero Header**: Welcome message with quick stats (Total Doctors, Customers, Orders, Pipeline)
- [x] **Pending Items Alert**: Prominent orange banner showing pending items count and doctors waiting
- [x] **Lead Status Overview**: Visual status breakdown with icons, counts, and progress bars
- [x] **Quick Actions Card**: Easy navigation to Doctors, Orders, Items, and Showcase
- [x] **Recent Doctors**: Activity feed showing latest doctor additions
- [x] **Activity Summary**: Stats for customers, emails sent, and pipeline leads

## Reminder System - COMPLETED Feb 4, 2026
- [x] **Reminder Management Page** (`/reminders`):
  - Stats cards showing Today, Follow-ups, Birthdays, Anniversaries, Custom counts
  - Two tabs: "Today's Reminders" and "All Reminders"
  - Table view with Type, Title/Contact, Entity, Priority, Phone, Actions
  - Add Reminder modal with fields: Title, Description, Type, Priority, Date, Time, Link to Contact
  - Mark Complete action (green checkmark)
  - Delete action with confirmation modal
- [x] **Reminder Types**: Follow-up, Birthday, Anniversary, Custom
- [x] **Priority Levels**: Low, Moderate, High with color badges
- [x] **Entity Linking**: Optional link to Doctor, Medical, or Agency
- [x] **Auto-Generated Reminders**: Automatically shows birthdays/anniversaries from entity records
- [x] **Dashboard Widget**: "Today's Reminders" alert card showing count and preview
- [x] **Send to Admin**: Manual WhatsApp summary button sends daily overview
- [x] **Daily Background Task**: Automated WhatsApp notification to admin at 8 AM IST with reminder summary
- [x] **Sidebar Navigation**: Reminders link with bell icon

## User Management & Permissions - COMPLETED Feb 5, 2026
- [x] **Login Page Redesign**:
  - Removed public registration - users created by admin only
  - Company branding (logo, name, tagline) from Company Settings
  - Custom background color or image
  - Clean Sign In only form
- [x] **User Management Page** (`/users`) - Admin Only:
  - Stats cards: Total Users, Admins, Staff counts
  - Users table with name, email, role, permissions count, created date
  - Add User modal with name, email, password, role fields
  - Edit User modal with all fields pre-filled
  - Delete user with confirmation (cannot delete self)
- [x] **User Permissions System**:
  - 14 module permissions: doctors, medicals, agencies, items, orders, expenses, reminders, pending_items, email_logs, whatsapp_logs, users, smtp_settings, company_settings, whatsapp_settings
  - Toggle switches for each permission
  - Select All / Clear All buttons
  - Admin gets all permissions by default
  - Staff gets basic permissions by default (customers, items, orders, etc.)
- [x] **Company Settings - Login Page Tab**:
  - Live preview of login page appearance
  - Login Tagline input
  - Background Color picker with hex input
  - Background Image upload
  - Save Settings button

## WhatsApp Logs - COMPLETED Feb 5, 2026
- [x] **WhatsApp Logs Page** (`/whatsapp-logs`):
  - Stats cards: Total Messages, Successful, Failed, Success Rate
  - Filters: Search by phone/name, Message Type dropdown, Status filter
  - Message History table with: Type, Recipient, Message Preview, Status, Time, Delete action
  - Pagination with Previous/Next buttons
  - Refresh and Clear All buttons
- [x] **Message Types Tracked**: OTP, Order Confirmation, Status Updates (Confirmed/Shipped/Delivered/Cancelled), Out of Stock, Stock Arrived, Ready to Despatch (Transporter), Reminder
- [x] **Automatic Logging**: All WhatsApp messages logged automatically when sent
- [x] **Sidebar Navigation**: WhatsApp Logs link with message icon

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

## Doctors Table View - COMPLETED Feb 12, 2026
- [x] **Table View Layout**:
  - Stats cards: Total Doctors, Customers, Pipeline, Follow-up Due
  - Search and status filter
  - Table columns: Doctor (name+code), Contact (phone+email), Status, Priority, Follow-up, Last Contact, Actions
  - Row highlighting for overdue follow-ups (red background)
- [x] **Actions**: View Details, Mark Contacted, Edit, Send Email, Delete
- [x] **Detail Modal**: Full info with Notes and Tasks sections

## Orders Enhancement - COMPLETED Feb 12, 2026
- [x] **Manual Order Creation** (`Add Order` button):
  - **Customer Search**: Search across Doctors, Medicals, Agencies by name or phone
  - Search results show: name, phone, customer code, type badge (Doctor/Medical/Agency)
  - Click to select existing customer and auto-fill details
  - Or enter new customer details with type selection
  - Auto-creates customer record if new (with appropriate customer code: VMP-/MED-/AGN-)
  - **Item Search** to add products to order
  - **String-based quantities**: Support for scheme format like "10+5" (buy 10, get 5 free)
  - **Rate, MRP, GST display**: Shows pricing info for each item
  - **Out of Stock button**: Mark items unavailable during order creation
  - **Restore button**: Undo out of stock marking
  - **Pending Items tracking**: Out of stock items automatically added to pending items for customer follow-up
  - **Summary counter**: Shows available and out of stock item counts
  - WhatsApp confirmation sent automatically
- [x] **Edit Order Items**:
  - **String-based quantities**: Support for scheme format like "10+5" (buy 10, get 5 free)
  - **Rate & MRP display**: Shows Rate and MRP for each item during editing
  - Quantity editing with text input (allows numbers or scheme format)
  - "Out of Stock" button (replaced "Remove")
  - "Mark as Pending" checkbox for customer follow-up
  - "Restore" button to undo out of stock
  - Summary of changes before saving
- [x] **Order Sources**: Both customer orders (from public showcase) and admin/staff created orders supported
- [x] **Customer Types**: Orders can be linked to Doctors, Medicals, or Agencies
- [x] **Print Order Feature**:
  - Professional printable order sheet with company branding
  - Items table with S.No, Item Code, Item Name, Qty, Rate, MRP, Amount columns
  - Auto-calculates amounts and grand total (handles "10+5" scheme quantities)
  - Transport Details section (transport name, tracking, station, payment mode, packages)
  - Invoice Details section (invoice no, date, value)
  - Footer with thank you message and contact info
  - Uses react-to-print library for native browser print dialog
- [x] **WhatsApp Order Sharing**:
  - WhatsApp button in order actions row (green icon)
  - Sends formatted message with company name, order number, customer details
  - Includes all items with code, quantity, rate, and MRP
  - Opens wa.me link with pre-filled message
  - Also available in Print Modal via "Send WhatsApp" button

## Order Email Notifications - COMPLETED Feb 15, 2026
- [x] **Order Confirmation Email**: Automatic email sent to customer when order is placed
  - Triggered for both manual orders (staff) and public showcase orders
  - Professional HTML email template with company branding
  - Includes: Order number, date, customer details, address
  - Items table with: Item code, name, quantity, rate, amount
  - Total amount calculation (handles scheme quantities like "10+5")
  - Uses existing SMTP configuration
  - Email logs tracked in Email Logs page with status (sent/failed)
  - Only sends if customer has email address configured

## Enhanced Address & Delivery Preferences - COMPLETED Feb 15, 2026
- [x] **Complete Address Fields for Doctors/Medicals/Agencies**:
  - Address Line 1 & 2
  - State (dropdown with all 36 Indian states/UTs)
  - District (cascading dropdown - populates based on selected state)
  - Pincode
  - Delivery Station (for shipping)
  - Transport Preference (dropdown from transport list)
- [x] **Location APIs**:
  - GET /api/public/states - Returns all Indian states/UTs
  - GET /api/public/districts/{state} - Returns districts for selected state
- [x] **State/District Cascade**: Selecting state fetches and populates district dropdown
- [x] **Order Auto-fill**: When opening order update modal, delivery station and transport auto-fill from customer's saved preferences
- [x] **Backward Compatibility**: Existing customers can update their address details at any time

## Bug Fixes

### Order Status Update Bug - FIXED Feb 15, 2026
- **Issue**: Order status updates were failing for some orders, especially when updating to "Ready to Despatch" with payment details
- **Root Cause**: Frontend was sending empty strings (`''`) for numeric fields (`payment_amount`, `invoice_value`) instead of `null`. Pydantic expects float or null, not empty string
- **Fix Location**: `/app/frontend/src/pages/Orders.jsx` lines 261-270 in `handleSaveOrder()` function
- **Fix**: Added data sanitization to convert empty strings to null before API call:
  ```javascript
  payment_amount: updateForm.payment_amount === '' ? null : updateForm.payment_amount,
  invoice_value: updateForm.invoice_value === '' ? null : updateForm.invoice_value
  ```
- **Testing**: 14/14 backend tests passed, all status transitions verified (Pending→Confirmed, Pending→Ready to Despatch with To Pay/Paid modes, Ready to Despatch→Shipped, Shipped→Delivered, Cancellation)
- **Test File**: `/app/backend/tests/test_order_status_update.py`

## Customer Portal & Role-Based Pricing - COMPLETED Feb 17, 2026

### Phase 1: Backend & Core Features - COMPLETED
- [x] **Backend Models**: Customer portal models (CustomerRegister, CustomerLogin, CustomerOTPRequest, CustomerResponse, etc.)
- [x] **Role-Based Pricing in Items**: rate_doctors, rate_medicals, rate_agencies + offer/special_offer for each role
- [x] **Customer Authentication APIs**: send-otp, verify-otp, register, login, reset-password, profile
- [x] **Customer Portal APIs**: items (role-based pricing), orders, tasks
- [x] **Support Ticket System**: create/view tickets, replies
- [x] **Admin Customer Management**: list, approve/reject

### Phase 2: Mobile-First UI Redesign - COMPLETED Feb 17, 2026
- [x] **Design System**: "PharmaFlow Mobile" - Clinical Organic theme
  - Primary: Deep Emerald (#059669)
  - Secondary: Soft Sage (#ECFDF5)
  - Typography: Manrope (headings), Inter (body)
  - Shapes: rounded-2xl cards, rounded-full buttons
- [x] **Mobile Components**:
  - BottomNav.jsx - 5-item navigation (Home, Products, Orders, Support, Profile)
  - Glassmorphism headers
  - Touch-friendly inputs (h-12 minimum)
  - Safe area support for iOS notch
- [x] **Customer Portal Pages** (mobile-first):
  - CustomerLogin.jsx - phone/password with emerald gradient header
  - CustomerRegister.jsx - 3-step OTP flow with progress bar
  - CustomerLayout.jsx - bottom nav on mobile, sidebar on desktop
  - CustomerDashboard.jsx - welcome banner, quick actions, stats cards
  - CustomerItems.jsx - product grid with filters and role-based pricing
  - CustomerOrders.jsx - tabbed view (Active/Completed/Cancelled)
  - CustomerSupport.jsx - ticket creation and conversation view
  - CustomerProfile.jsx - profile editing with delivery preferences
  - CustomerTasks.jsx - pending/completed tabs
- [x] **Admin Pages**:
  - Customers.jsx - approve/reject customer registrations
  - Support.jsx - manage support tickets

### Phase 3: Portal Customer → Admin List Integration - COMPLETED Feb 17, 2026
- [x] **Auto-Create Record on Approval**: When portal customer is approved, create record in doctors/medicals/agencies collection
- [x] **Fields Copied**: name, phone, email, address, customer_code, reg_no (doctors), proprietor_name/gst_number/drug_license (medicals/agencies)
- [x] **Portal Customer Flags**: `is_portal_customer: true`, `portal_customer_id: <id>`
- [x] **Lead Status**: Auto-set to "Customer" for approved portal customers
- [x] **UI Badge**: Green "Portal" badge shown next to lead status in admin list
- [x] **WhatsApp Notification**: Approval/rejection notification sent to customer

### Phase 4: Enhanced Registration & Fallback OTP - COMPLETED Feb 17, 2026
- [x] **Multi-Step Registration Flow** (5 steps):
  - Step 1: Phone number entry
  - Step 2: OTP verification (WhatsApp or fallback)
  - Step 3: Role selection (Doctor/Medical/Agency)
  - Step 4: Role-specific details form
  - Step 5: Success confirmation
- [x] **Role-Specific Fields**:
  - Doctor: Registration Number*, Date of Birth
  - Medical/Agency: Proprietor Name, GST Number, Drug License, Alternate Phone, Birthday, Anniversary
  - All roles: Name*, Email, Address (Line1, Line2, State, District, Pincode, Delivery Station), Password*
- [x] **Fallback OTP System**:
  - Admin UI in Settings page to manage static OTPs
  - Add/Toggle/Delete fallback OTPs
  - Usage tracking (used_count)
  - Active/Inactive status toggle
  - Fallback OTPs work when WhatsApp delivery fails
- [x] **WhatsApp OTP Fix**: Corrected BotMasterSender API format (GET with senderId, authToken, messageText, receiverId params)
- [x] **State/District Cascade**: Dynamic district loading based on selected state in registration

### Bug Fixes Applied:
- GET/PUT /api/items/{item_id} returns role-based pricing fields
- GET /api/public/transports endpoint for customer profile
- Dashboard stats fallback for missing updated_at field
- MedicalResponse missing transport_map initialization
- WhatsApp OTP API format fixed (was using wrong params)
- States API response handling (array vs object)

### Test Reports: 
- `/app/test_reports/iteration_13.json` - Backend tests (17/17 PASSED)
- `/app/test_reports/iteration_14.json` - Frontend mobile UI tests (100% PASSED)
- `/app/test_reports/iteration_15.json` - OTP & Fallback OTP tests (15/15 PASSED)
- `/app/test_reports/iteration_16.json` - Marketing module tests (32/32 PASSED)

### Test Credentials:
- **Admin**: admin@vmpcrm.com / admin123
- **Customer**: 9999777766 / test123

## Marketing Module - COMPLETED Feb 20, 2026
- [x] **Marketing Page** (`/marketing`) with 3 tabs: Create, Templates, History
- [x] **Recipient Selection**:
  - Filter by entity type: All, Doctors, Medicals, Agencies
  - Filter by status: All, Pipeline, Customers, Contacted, Not Interested, Closed
  - Search by name, phone, customer code
  - Checkbox selection with Select All option
- [x] **Campaign Types**:
  - Product Promotion (with role-based pricing)
  - Greetings (festival wishes)
  - Announcements (product launches)
  - Circulars (government notices)
- [x] **Message Composer**:
  - Personalization with {name} placeholder
  - Image attachment support
  - Product selection for promos with role-based pricing display
- [x] **Anti-Ban Protection**:
  - Batch sending (configurable batch size)
  - Configurable delay between batches (default 60s)
  - Unique 7-digit reference number per message (#Server Ref: XXXXXXX)
- [x] **Scheduling**: Optional schedule for later sending
- [x] **Message Templates**:
  - Quick templates (Diwali, New Year, Product Launch, Price Update)
  - Custom templates with CRUD operations
- [x] **Campaign History**:
  - List of all campaigns with status
  - Progress tracking (sent/failed/pending counts)
  - Detailed logs with reference numbers
  - Send/Cancel actions for draft/scheduled campaigns

## Prioritized Backlog

### P0 (Critical) 
- [ ] **Refactor `server.py`**: Backend is >9000 lines monolithic file - URGENT needs to be split into routers/models/services

### P1 (High Priority)
- [ ] **ForgotPassword.jsx**: Customer password reset flow via WhatsApp OTP
- [ ] **Customer Order History**: View all past orders when clicking a customer (Doctor/Medical/Agency)
- [ ] **Stock/Inventory Management**: Track item quantities with low-stock alerts
- [ ] **Payment Tracking**: Track payments received against orders
- [ ] **Stock Arrived Notification**: Notify doctors when out-of-stock items become available
- [ ] **Invoice/Bill PDF Generation**: Downloadable PDF invoices for orders
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

## Portal Customer Enhancements - COMPLETED Feb 27, 2026
- [x] **Enhanced Customer Approval Modal**:
  - Displays ALL registration data in organized sections:
    - Basic Info: Name, Customer Code, Phone, Alternate Phone, Email
    - Doctor Details (for doctor role): Registration Number, Date of Birth
    - Medical/Agency Details: Proprietor Name, GST Number, Drug License, Birthday, Anniversary
    - Address section with delivery station and transport preferences
    - Registration timestamps (registered on, approved on with approver name)
  - Color-coded sections by role (blue for doctor, emerald for medical, purple for agency)
- [x] **Duplicate Mobile Number Check**:
  - Checks `portal_customers` collection with status-specific messages:
    - Pending: "has a pending registration. Please wait for approval"
    - Approved: "already registered. Please login instead"
    - Rejected: "was rejected. Please contact support"
    - Suspended: "account is suspended. Please contact support"
  - Checks `doctors`, `medicals`, `agencies` collections:
    - Shows: "registered as Doctor/Medical Store/Agency. Please contact admin for portal access"
  - Prevents duplicate registrations across all customer databases
- [x] **Send New Password Feature**:
  - "Send New Password via WhatsApp" button in approved customer modal
  - Generates random 8-character alphanumeric password
  - Sends professional WhatsApp message with login credentials
  - Shows password manually if WhatsApp fails
- [x] **Send Portal Access for Admin-Created Customers**:
  - Key icon button (🔑) added to Doctors, Medicals, Agencies action columns
  - Creates new `portal_customers` record for admin-created customers
  - Copies all customer data to portal account
  - Sets status to 'approved' automatically
  - Sends WhatsApp with login credentials (phone + new password)
  - Enables admin-created customers to use customer portal

## Next Tasks
1. **P0**: Refactor server.py into modular structure (routers, models, services)
2. Stock/Inventory management feature
3. Payment Tracking against orders

## Customer Portal Cart & Order Submission - COMPLETED Feb 28, 2026
- [x] **POST /api/customer/orders endpoint**: Backend endpoint to create orders from customer portal cart
  - Validates cart items, generates order number (ORD-YYYYMMDD-XXXX)
  - Links to customer's entity record (doctor/medical/agency) via phone match
  - Sends WhatsApp confirmation and email notification in background
  - Order source tracked as 'customer_portal'
- [x] **Cart UI (CustomerOrders.jsx)**: 
  - Cart tab shows items with name, code, rate, and editable quantity
  - Order notes (optional) text area
  - Place Order button with loading state
  - Clear Cart button
  - Continue Shopping link
- [x] **Order History UI**: Active/Completed tabs with order cards
- [x] **Order Detail Modal**: Shows only product details (name, code, quantity) - NO prices or totals per user request
- [x] **Product Grid Responsiveness**: 2 cols mobile, 3 cols tablet, 4 cols desktop (grid-cols-2 md:grid-cols-3 lg:grid-cols-4)
- [x] **Test Report**: /app/test_reports/iteration_20.json - 100% pass (11/11 backend, all frontend flows)

## Order Status Tabs Fix - COMPLETED Feb 28, 2026
- [x] **Fixed order filtering**: Pre-computed arrays for each tab (activeOrders, completedOrders, cancelledOrders)
- [x] **Added Cancelled tab**: Cancelled orders now have dedicated tab
- [x] **Dynamic tab counts**: Each tab label shows order count (e.g., "Active (10)", "Completed (1)")

## Customer Tasks Sync Fix - COMPLETED Feb 28, 2026
- [x] **Fixed entity linkage**: `GET /api/customer/tasks` now also checks by `portal_customer_id` as fallback
- [x] **Fixed `update_task` endpoint**: Now handles tasks linked to medicals/agencies (not just doctors)
- [x] **Added auto-refresh**: CustomerTasks polls every 30s for real-time updates from admin changes
- [x] **Added Refresh button**: Manual refresh button on tasks page
- [x] **Data fix**: Created missing linked doctor record for test customer (9999777766)

## Admin Panel Materialize Redesign - COMPLETED Feb 28, 2026
- [x] **Dark sidebar** (#2F3349): Purple active states with glow shadow, "COMPANY" section label
- [x] **Floating header**: Backdrop-blur, rounded, search placeholder, avatar with name/role
- [x] **Dashboard.jsx**: Clean stat widgets, color-coded alert banners, Materialize icon-square design
- [x] **CSS variables**: New color palette (primary #7367F0, success #28C76F, warning #FF9F43, danger #EA5455, info #00CFE8)
- [x] **mat-card class**: Reusable white card with Materialize shadow (0.25rem 1.125rem)

## Cuba Template Design System - COMPLETED Feb 28, 2026
- [x] **Global Shadcn update**: card.jsx (15px radius, Cuba shadow), badge.jsx (soft color variants), button.jsx (color shadow variants), table.jsx (Cuba header/row styling)
- [x] **index.css**: Cuba status classes, .mat-card with 15px radius, .page-title-cuba, .cuba-input, .floating-header rounded 15px
- [x] **Dashboard.jsx**: Welcome banner with greeting + time-of-day, stat cards with % change arrows, recent orders table, combined lead pipeline, two-column expenses/pending
- [x] **Login.jsx**: Split-screen (image left, form right) matching Cuba login_three template
- [x] **All admin pages**: Automatically inherit Cuba card/table/badge/button styling through shared Shadcn components

## Dashboard Enhancements - COMPLETED Feb 27, 2026
- [x] **Comprehensive Dashboard Stats API**: New endpoint `/api/dashboard/comprehensive-stats` providing real-time statistics
- [x] **Customers Overview**:
  - Total counts for Doctors, Medicals, Agencies
  - Lead status breakdown for each (Customer, Contacted, Pipeline, Not Interested, Closed)
  - Combined lead status view
  - Clickable cards navigating to respective pages
- [x] **Orders Status**:
  - All order status counts: Pending, Confirmed, Ready to Dispatch, Shipped, Delivered, Cancelled
  - Recent orders count (last 7 days)
  - Visual icons and color-coded status cards
- [x] **Pending Items (Qty-wise)**:
  - Total pending items count and total quantity
  - Top 10 items by quantity with item-wise breakdown
  - Direct link to pending items page
  - Handles complex quantity expressions (e.g., '10+5')
- [x] **Expenses Overview**:
  - Current month total expenses
  - Previous month comparison with percentage change
  - Breakdown by expense category
  - Visual trend indicator (up/down)
- [x] **Items Statistics**:
  - Total items count
  - Items by main category (Large Animals, Poultry, Pets)
  - Items by subcategory (Injection, Liquids, Bolus, Powder)
  - Most ordered items (top 10 with order count)
  - Least ordered items
  - Stale items: No orders in 30+ days with count and list
- [x] **Support Tickets**:
  - Status breakdown: Open, In Progress, Resolved, Closed
  - Recent tickets count (last 7 days)
  - Clickable cards navigating to support page
- [x] **Modern UI Design**:
  - Gradient hero header with quick action buttons
  - Alert banners for pending items and today's reminders
  - Color-coded sections by entity type
  - Responsive grid layout for all screen sizes
  - Quick actions navigation panel

## Sidebar & Admin Features - COMPLETED Feb 27, 2026
- [x] **Sidebar Reorganization**:
  - Email Logs, WhatsApp Logs, Users, SMTP Settings, Database Backup moved under collapsible "Company" section
  - Company section auto-expands when navigating to sub-routes
  - Clean visual hierarchy with indented sub-items
- [x] **Admin Profile Page** (`/admin/profile`):
  - Profile Information: Edit name and email
  - Email uniqueness validation
  - Change Password: Current password verification, new password update
  - Password visibility toggles
  - Role display (non-editable)
- [x] **Database Backup Feature** (`/admin/database-backup`):
  - **Manual Download**: Export all data as JSON file
  - **Scheduled Backups**: Auto-backup at 9:00 AM and 5:00 PM IST
  - **Notification Recipients**:
    - WhatsApp: 9486544884
    - Email: vetmech2server@gmail.com
  - **Backup Settings**: Toggle auto-backup, configure times and recipients
  - **Trigger Backup Now**: Manually send backup to WhatsApp & Email
  - **Backup History**: View recent backups with status and delivery indicators
  - Collections exported: doctors, medicals, agencies, items, orders, expenses, reminders, pending_items, portal_customers, support_tickets, users, company_settings, item_categories, transports, email_logs, whatsapp_logs, marketing_campaigns

## URL Restructuring - COMPLETED Feb 28, 2026
- [x] **Customer Portal as Default**:
  - `/` → Customer Login page (default landing)
  - `/register` → Customer Registration
  - `/login` → Customer Login (alias)
  - `/forgot-password` → Customer Forgot Password (WhatsApp OTP)
  - `/portal/*` → Customer Portal authenticated routes
    - `/portal/dashboard` → Customer Dashboard
    - `/portal/items` → Product Catalog
    - `/portal/orders` → Order History
    - `/portal/support` → Support Tickets
    - `/portal/profile` → Customer Profile
- [x] **Customer Forgot Password** (`/forgot-password`):
  - 3-step wizard: Phone → OTP → New Password
  - WhatsApp OTP verification
  - Progress indicator
  - Password visibility toggles
  - Resend OTP option
  - Change phone number option
- [x] **Admin Panel under /admin**:
  - `/admin/login` → Admin Login
  - `/admin` → Admin Dashboard
  - `/admin/doctors` → Doctors Management
  - `/admin/medicals` → Medicals Management
  - `/admin/agencies` → Agencies Management
  - `/admin/items` → Items Management
  - `/admin/orders` → Orders Management
  - `/admin/marketing` → Marketing Module
  - `/admin/expenses` → Expenses
  - `/admin/reminders` → Reminders
  - `/admin/pending-items` → Pending Items
  - `/admin/customers` → Portal Customers
  - `/admin/support` → Support Tickets
  - `/admin/company-settings` → Company Details
  - `/admin/users` → User Management
  - `/admin/profile` → Admin Profile
  - `/admin/email-logs` → Email Logs
  - `/admin/whatsapp-logs` → WhatsApp Logs
  - `/admin/smtp-settings` → SMTP Settings
  - `/admin/database-backup` → Database Backup
- [x] **Legacy Route Redirects**: Old routes automatically redirect to new `/admin/*` paths

## Tech Stack
- **Backend**: FastAPI, Motor (async MongoDB), PyJWT, bcrypt
- **Frontend**: React 19, React Router, Axios, Tailwind CSS, Shadcn/UI, Recharts
- **Database**: MongoDB
- **Auth**: JWT tokens (separate for admin and customers)


## Lead Follow-up Management System - COMPLETED Mar 1, 2026
- [x] **Follow-up API**: New `followups` collection with CRUD endpoints
  - `POST /api/followups` - Create follow-up (auto-closes previous open, updates entity status/date)
  - `GET /api/followups/{entity_type}/{entity_id}` - Follow-up history per entity
- [x] **Lead Status Updates**: Added 'Interested', 'Converted', 'Lost' to existing Pipeline/Contacted/Customer/Not Interested/Closed
- [x] **Follow-up Modal** on Doctors, Medicals, Agencies pages:
  - Notes (what happened), status update, next follow-up date/time
  - Follow-up history display with open/closed indicators
  - PhoneCall icon button in table actions
- [x] **Enhanced Reminders Page**:
  - Overdue follow-ups shown with red OVERDUE badge
  - Dedicated "Overdue" tab with count badge
  - Quick follow-up action from reminders (opens modal with entity history)
  - Stats cards: Total Today, Overdue, Follow-ups, Birthdays, Anniversaries, Custom
- [x] **Detail Modal Enhancement**: Follow-up history section in Doctor/Medical/Agency detail view
- [x] **Auto-close Logic**: When new follow-up is added, previous open follow-up is auto-closed
- [x] **Entity Updates**: Follow-up auto-updates entity's `last_contact_date`, `follow_up_date`, `lead_status`

## WhatsApp Reminder Template Enhancement - COMPLETED Mar 1, 2026
- [x] **Detailed WhatsApp message**: Now includes customer names, phone numbers, and lead status grouped by type
- [x] **Format**: Overdue Follow-ups, Today's Follow-ups, Birthdays (with entity type), Anniversaries, Custom reminders
- [x] **Auto-detect birthdays/anniversaries**: When DOB/anniversary date added to Doctor/Medical/Agency, auto-shows in Reminders page on that date

## Reminders Improvement & Portal Customers Edit/Delete - COMPLETED Mar 1, 2026
- [x] **Reminders History tab**: Shows completed/closed reminders separately
- [x] **Birthday/Anniversary**: No "Mark as Complete" button — handled by auto-greeting system
- [x] **Follow-ups**: Only missed/not-updated follow-ups show as OVERDUE; updated ones auto-close
- [x] **Portal Customers Edit**: Admin can edit customer name, phone, email, address, etc. via pencil icon
- [x] **Portal Customers Delete**: Admin can delete customers with confirmation warning
- [x] **Detail modal**: Edit and Delete buttons added at bottom of customer detail view
- [x] **15 default greeting templates** seeded (8 birthday, 7 anniversary) with `{customer_name}` and `{company_name}` placeholders
- [x] **Admin template management** page at `/admin/greeting-templates` with CRUD, active/inactive toggle, image URL support, preview
- [x] **Background auto-send task** runs at 10 AM IST daily: picks random active template, sends via WhatsApp + Email
- [x] **Greeting logs** tracked in `greeting_logs` collection, viewable in "Sent Log" tab
- [x] **Reminders page**: Birthday/anniversary items no longer have "Mark as Complete" button
- [x] **Sidebar**: "Greetings" link added with Gift icon

## Items Rate/Offer/Special Offer Column Removal - COMPLETED Mar 6, 2026
- [x] Removed default "Rate" field from Items form (role-wise rates already available for Doctors/Medicals/Agencies)
- [x] Removed default "Offer" and "Special Offer" fields from Items form (role-wise offers already available)
- [x] Item list sidebar now shows only MRP
- [x] Validation updated: only MRP required
- [x] Role-based pricing (Doctor/Medical/Agency) is now the primary source for rate, offer, special offer
- [x] Backend legacy fields kept (defaults to 0/null) for backward compatibility

## Payment Tracking System - COMPLETED Mar 12, 2026
- [x] **Payment Recording**: Record partial/full payments with customer search, amount, date, mode (Cash/UPI/GPay/Netbanking/Cheque/Credit), notes
- [x] **Outstanding Dashboard**: View all customers with outstanding dues, filterable by Doctor/Medical/Agency, with summary cards
- [x] **Customer Ledger**: Opening balance + invoices (from dispatched orders) + payments with running balance, date-range filter
- [x] **Ledger PDF Export**: Download ledger statement as PDF
- [x] **Opening Balance**: Added to Doctors, Medicals, Agencies create/edit forms
- [x] **Payment History**: View all payments with date filter, delete option
- [x] **Customer Portal Ledger**: Customers can view their own ledger at /portal/ledger (requires entity linking)
- [x] **Admin Sidebar**: Payments link added to admin navigation
- [x] **New pages**: Payments.jsx (admin), CustomerLedger.jsx (portal)
- [x] **APIs**: POST/GET/DELETE /api/payments, GET /api/outstanding, GET /api/ledger/{type}/{id}, GET /api/ledger/export/pdf/{type}/{id}, GET /api/customer/ledger
- [x] **Testing**: 96% backend (23/24), 100% frontend pass rate

## Customer Downloads & Catalogue System - COMPLETED Mar 6, 2026
- [x] **Customer Price List Download**: Customers can download role-based PDF price lists (S.No, Code, Name, Composition, MRP, Rate, Offer, Special Offer) filtered by their role (Doctor/Medical/Agency)
- [x] **Downloads page in Customer Portal**: New `/portal/downloads` page with sidebar navigation link
- [x] **Catalogue Management in Admin Settings**: Admin can add catalogue entries (title, URL, description) that appear in customer downloads
- [x] **New API endpoints**: GET /api/customer/pricelist/pdf, GET/PUT /api/catalogue-settings
- [x] **New files**: CustomerDownloads.jsx, updated App.js routing, CustomerLayout nav, Settings.jsx, api.js

## Items Export & Subcategory Order - COMPLETED Mar 6, 2026
- [x] **Export as PDF**: Items exported by main category (Large Animals / Poultry / Pets / All), grouped by subcategory, no images
  - Columns: #, Code, Item Name, Composition, MRP, GST%, Rate (D), Rate (M), Rate (A)
  - Subcategories ordered by custom sort order
- [x] **Export as Excel**: Same grouping as PDF, professional formatting with styled headers
- [x] **Subcategory Order Management**: Admin can reorder subcategories (1-13) using up/down arrows, saved to DB
- [x] **Default subcategory order**: Injection, Dry Injections, Hormones, Schedule X Drugs, Liquids, Bolus, Powder, Feed Supplements, Shampoo/Soap, Spray/Ointments, Tablets, Syrups, Vaccines
- [x] **Missing subcategories added**: Dry Injections, Hormones, Schedule X Drugs, Shampoo/Soap, Spray/Ointments now in default list
- [x] **New API endpoints**: GET/PUT /api/subcategory-order, GET /api/items/export/pdf, GET /api/items/export/excel

## Items Excel Import Update - COMPLETED Mar 6, 2026
- [x] Updated Excel template headers: Removed Rate/Offer/Special Offer, added role-based columns (Rate Doctors, Offer Doctors, Special Offer Doctors, Rate Medicals, Offer Medicals, Special Offer Medicals, Rate Agencies, Offer Agencies, Special Offer Agencies)
- [x] Updated import processing to parse and store role-based pricing fields
- [x] Backward compatible: legacy Rate/Offer/Special Offer columns still accepted as fallback
- [x] Required columns: Item Name, MRP only (Rate no longer required)
- [x] New items also get `has_image` flag set correctly

## Pending/Upcoming Tasks
- [ ] (P0) PWA/Offline Support for MR Panel (service worker, offline caching, sync)
- [ ] (P1) Refactor monolithic `server.py` (~11200+ lines) into modular routers
- [ ] (P1) Stock/Inventory Management (quantity tracking, low-stock alerts)
- [ ] (P1) Refactor duplicated Follow-up UI in Doctors/Medicals/Agencies into reusable components
- [ ] (P2) Sales reports with charts
- [ ] (P2) Data import/export
- [ ] (P2) Sales target management

## Ledger Balance Display & WhatsApp Sharing - COMPLETED Mar 12, 2026
- [x] **Outstanding Balance on Detail Pages**: Doctors, Medicals, and Agencies detail modals now show outstanding balance prominently in bold red text (₹ amount) at the top
- [x] **WhatsApp Ledger Sharing**: New button in Payments ledger dialog to send full ledger statement via WhatsApp
- [x] **New API**: POST /api/ledger/{customer_type}/{customer_id}/whatsapp - sends formatted ledger statement via WhatsApp with entry details and closing balance
- [x] **Frontend**: Added `sendLedgerWhatsApp` to paymentsAPI, outstanding balance map fetching on Doctors/Medicals/Agencies pages
- [x] **Reminders Page**: Verified fully functional (Today/Overdue/Upcoming/History tabs, Add Reminder, Follow-up actions)
- [x] **Testing**: 100% backend (12/12), 100% frontend pass rate


## MR Module Phase 1 - Admin Setup & Management - COMPLETED Mar 16, 2026
- [x] **MR Management Page** (`/admin/mr-management`): Full CRUD for Medical Representatives
  - Create/Edit/Delete MRs with name, phone, email, password, territory (state + multiple districts)
  - Territory assignment using state dropdown + clickable district badges
  - Stats cards (Total MRs, Active MRs), search by name/phone, status display
- [x] **Visual Aids Page** (`/admin/visual-aids`): Presentation slide deck management
  - Create decks: Category-wise, Subcategory-wise, or Custom types
  - Deck detail view with slide upload (auto-converts to optimized WebP 1200x900)
  - Slide reordering (up/down), delete slides, slide count tracking
  - Stats cards by deck type (Total, Category, Subcategory, Custom)
- [x] **MR Reports Page** (`/admin/mr-reports`): Activity tracking dashboard
  - Summary cards (Total MRs, Active MRs, Total Visits, States Covered)
  - MR Territory Overview with state/district display
  - Activity log (placeholder for Phase 2 visit data)
  - Filters by MR, date range
- [x] **Sidebar Navigation**: New "MR Module" collapsible section with MR Management, Visual Aids, MR Reports
- [x] **Backend APIs**: POST/GET/PUT/DELETE /api/mrs, POST/GET/PUT/DELETE /api/visual-aids, /api/visual-aids/{id}/slides, /api/mr-reports
- [x] **DB Collections**: `mrs` (id, name, phone, email, password_hash, state, districts, status), `visual_aid_decks`, `visual_aid_slides`
- [x] **Testing**: 100% backend (22/22 tests), 100% frontend pass rate


## MR Module Phase 2 - MR Panel - COMPLETED Mar 16, 2026
- [x] **MR Login** (`/mrvet/login`): Phone + password authentication with JWT tokens (type='mr')
- [x] **MR Dashboard** (`/mrvet/dashboard`): Stats (Customers, Today's Visits, Pending Follow-ups, Active Decks), Quick Actions, Territory Summary, Overdue alerts
- [x] **MR Customers** (`/mrvet/customers`): Territory-filtered list grouped by type (doctor/medical/agency), search, phone call links
- [x] **MR Visits** (`/mrvet/visits`): Record visits with customer selection, notes, outcomes (Interested/Not Interested/Order Placed/Follow-up Required), follow-up date scheduling
- [x] **MR Follow-ups** (`/mrvet/followups`): Tabs for Today/Overdue/Upcoming, mark done functionality
- [x] **MR Visual Aids** (`/mrvet/visual-aids`): Browse active decks, Present button
- [x] **MR Slideshow** (`/mrvet/slideshow/:deckId`): Full-screen presentation with keyboard/touch/swipe navigation, fullscreen toggle, progress bar, slide indicators
- [x] **MR Layout**: Navy blue sidebar with navigation, MR profile, sign out
- [x] **Backend APIs**: POST /api/mr/login, GET /api/mr/me, /api/mr/dashboard, /api/mr/customers, /api/mr/visits (CRUD), /api/mr/followups, /api/mr/visual-aids
- [x] **Testing**: 100% (27/27 backend, 100% frontend)

## MR Module Phase 3 - MR Orders - COMPLETED Mar 16, 2026
- [x] **MR Orders Page** (`/mrvet/orders`): 3-step order form (Select Customer -> Add Products -> Review & Place)
- [x] **Product Selection**: Search items, add to cart with +/- quantity controls, cart summary
- [x] **Order Placement**: Creates order with source='mr', mr_id, mr_name fields
- [x] **Order History**: List of MR's orders with status, items summary, order number
- [x] **Cancel Request**: MR can request cancellation on pending orders with reason
- [x] **Admin Integration**: MR orders show 'MR' indigo badge + 'via {MR name}' on admin Orders page
- [x] **Admin Cancel Management**: 'Cancel Req' badge on orders, Approve/Reject buttons in detail dialog
- [x] **Backend APIs**: GET /api/mr/items, POST /api/mr/orders, GET /api/mr/orders, POST /api/mr/orders/{id}/cancel-request, POST /api/orders/{id}/approve-cancel
- [x] **WhatsApp notification**: Auto-sends order notification on placement
- [x] **Testing**: 100% (28/28 backend, 100% frontend)


## MR Order Form Enhancement & PWA Setup - COMPLETED Mar 16, 2026
- [x] **MR Order Form Rewrite**: Full-featured order form matching admin CRM functionality
  - Customer search and selection with territory filtering
  - Item search by name/code with add-to-order
  - Text-based quantity input (e.g., "10+5" for quantity + free scheme)
  - Out-of-stock toggle with restore functionality
  - Order notes field
  - Summary showing available vs out-of-stock items
- [x] **Backend Bug Fix**: MR items search query used `name` instead of `item_name` field
- [x] **PWA Infrastructure**: Complete PWA setup for MR Field App
  - `mr-manifest.json` with start_url=/mrvet/dashboard, scope=/mrvet/, standalone display
  - `mr-sw.js` service worker with network-first (API), cache-first (static), SPA navigation fallback
  - `usePWA.js` hook with online/offline detection, install prompt, sync mechanism
  - IndexedDB-based offline queue for POST/PUT mutations
  - Auto-sync when coming back online
  - Offline banner and sync status indicators in MR Layout
- [x] **Testing**: 100% backend (23/23 + 11/11), 100% frontend

## MR Reports Page Enhancement - COMPLETED Mar 16, 2026
- [x] **Enhanced Backend API** (`GET /api/mr-reports`): Returns comprehensive data
  - Summary: total_mrs, active_mrs, total_visits, today_visits, total_orders, pending_orders, states_covered
  - Per-MR stats: visits, today visits, pending follow-ups, orders, cancelled orders, outcome breakdown
  - Visit log and order list with pagination
  - Filters: MR ID, date range (from/to)
- [x] **Frontend Reports Page** (`/admin/mr-reports`): Full analytics dashboard
  - 7 summary cards with key metrics
  - Three tabs: MR Overview, Visit Log, Orders
  - MR Overview: Per-MR performance cards with outcome badges
  - Visit Log: Chronological visit entries with MR name, customer, outcome
  - Orders: MR-placed orders with status, cancel request, and MR attribution
  - MR dropdown filter and date range filter
- [x] **Testing**: 100% (11/11 backend, 100% frontend)
