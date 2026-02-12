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

## Order Management & Transport (Iteration 7-9) - UPDATED Jan 23, 2026
- [x] Transport provider management (CRUD)
- [x] **Transport URL**: Simple URL field for transport provider website (no tracking number template)
- [x] **Transport Contact Numbers**: Incharge contact number + alternate number for each transport
- [x] Order tracking with transport details
- [x] **Transport Display**: Orders page shows transport name + tracking number as plain text (no clickable links)
- [x] Payment status tracking (To Pay/Paid)
- [x] **New Order Status: Ready to Despatch**:
  - Added between Confirmed and Shipped statuses
  - Captures: Transport, Delivery Station, Payment Mode, Package Details (Box/Can/Bag), Invoice Details
  - Sends WhatsApp to **Transporter ONLY** with complete billing info (using transport contact number)
  - NO message sent to customer at this stage
- [x] **Shipped Status with Full Details**:
  - Only requires Tracking Number entry (other details from Ready to Despatch)
  - Sends WhatsApp to **Customer** with: Tracking Number + Package Details + Invoice Details
- [x] **WhatsApp notifications for status changes:**
  - Confirmed: Order confirmation message to customer
  - Ready to Despatch: Full billing details to **transporter only**
  - Shipped: Full details (tracking, package, invoice) to **customer**
  - Delivered: Delivery confirmation to customer
  - Cancelled: Cancellation with reason to customer
- [x] **Conditional fields based on status:**
  - Ready to Despatch: Transport, delivery station, payment mode, package counts (boxes/cans/bags), invoice details
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

## Medicals & Agencies Management - COMPLETED Jan 25, 2026
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
  - Item Search to add products to order
  - Quantity controls with +/- buttons
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

## Prioritized Backlog

### P0 (Critical) 
- [ ] **Refactor `server.py`**: Backend is >4000 lines monolithic file - needs to be split into routers/models/services
- [ ] **Apply Table View to Medicals & Agencies**: Convert UI to match Doctors page table format for consistency

### P1 (High Priority)
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
