import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Doctors } from './pages/Doctors';
import { Medicals } from './pages/Medicals';
import { Agencies } from './pages/Agencies';
import { Items } from './pages/Items';
import { Expenses } from './pages/Expenses';
import { EmailLogs } from './pages/EmailLogs';
import { WhatsAppLogs } from './pages/WhatsAppLogs';
import { Users } from './pages/Users';
import { Settings } from './pages/Settings';
import { CompanySettings } from './pages/CompanySettings';
import { Orders } from './pages/Orders';
import { PendingItems } from './pages/PendingItems';
import { Reminders } from './pages/Reminders';
import { GreetingTemplates } from './pages/GreetingTemplates';
import { PublicShowcase } from './pages/PublicShowcase';
import { Marketing } from './pages/Marketing';
import Customers from './pages/Customers';
import Support from './pages/Support';
import AdminProfile from './pages/AdminProfile';
import DatabaseBackup from './pages/DatabaseBackup';
import CustomerRegister from './pages/CustomerRegister';
import CustomerLogin from './pages/CustomerLogin';
import CustomerLayout from './pages/CustomerLayout';
import CustomerDashboard from './pages/CustomerDashboard';
import CustomerItems from './pages/CustomerItems';
import CustomerOrders from './pages/CustomerOrders';
import CustomerTasks from './pages/CustomerTasks';
import CustomerSupport from './pages/CustomerSupport';
import CustomerProfile from './pages/CustomerProfile';
import CustomerDownloads from './pages/CustomerDownloads';
import ForgotPassword from './pages/ForgotPassword';
import { Toaster } from './components/ui/sonner';
import './App.css';

// Admin Protected Route wrapper
const AdminProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-600 rounded-full animate-spin"></div>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }
  
  return <Layout>{children}</Layout>;
};

// Admin Public Route wrapper (redirects to admin dashboard if already logged in)
const AdminPublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-600 rounded-full animate-spin"></div>
      </div>
    );
  }
  
  if (isAuthenticated) {
    return <Navigate to="/admin" replace />;
  }
  
  return children;
};

function AppRoutes() {
  return (
    <Routes>
      {/* ============== DEFAULT: CUSTOMER PORTAL ============== */}
      {/* Default landing page is Customer Login */}
      <Route path="/" element={<CustomerLogin />} />
      <Route path="/register" element={<CustomerRegister />} />
      <Route path="/login" element={<CustomerLogin />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      
      {/* Customer Portal - Authenticated Routes */}
      <Route path="/portal" element={<CustomerLayout />}>
        <Route path="dashboard" element={<CustomerDashboard />} />
        <Route path="items" element={<CustomerItems />} />
        <Route path="orders" element={<CustomerOrders />} />
        <Route path="tasks" element={<CustomerTasks />} />
        <Route path="support" element={<CustomerSupport />} />
        <Route path="downloads" element={<CustomerDownloads />} />
        <Route path="profile" element={<CustomerProfile />} />
        <Route index element={<Navigate to="/portal/dashboard" replace />} />
      </Route>
      
      {/* Legacy customer routes - redirect to new paths */}
      <Route path="/customer/register" element={<Navigate to="/register" replace />} />
      <Route path="/customer/login" element={<Navigate to="/" replace />} />
      <Route path="/customer/*" element={<Navigate to="/portal" replace />} />
      
      {/* Public showcase */}
      <Route path="/showcase" element={<PublicShowcase />} />
      
      {/* ============== ADMIN PANEL ============== */}
      {/* Admin Login */}
      <Route 
        path="/admin/login" 
        element={
          <AdminPublicRoute>
            <Login />
          </AdminPublicRoute>
        } 
      />
      
      {/* Admin Dashboard */}
      <Route 
        path="/admin" 
        element={
          <AdminProtectedRoute>
            <Dashboard />
          </AdminProtectedRoute>
        } 
      />
      
      {/* Admin Routes */}
      <Route 
        path="/admin/doctors" 
        element={
          <AdminProtectedRoute>
            <Doctors />
          </AdminProtectedRoute>
        } 
      />
      <Route 
        path="/admin/medicals" 
        element={
          <AdminProtectedRoute>
            <Medicals />
          </AdminProtectedRoute>
        } 
      />
      <Route 
        path="/admin/agencies" 
        element={
          <AdminProtectedRoute>
            <Agencies />
          </AdminProtectedRoute>
        } 
      />
      <Route 
        path="/admin/items" 
        element={
          <AdminProtectedRoute>
            <Items />
          </AdminProtectedRoute>
        } 
      />
      <Route 
        path="/admin/orders" 
        element={
          <AdminProtectedRoute>
            <Orders />
          </AdminProtectedRoute>
        } 
      />
      <Route 
        path="/admin/marketing" 
        element={
          <AdminProtectedRoute>
            <Marketing />
          </AdminProtectedRoute>
        } 
      />
      <Route 
        path="/admin/expenses" 
        element={
          <AdminProtectedRoute>
            <Expenses />
          </AdminProtectedRoute>
        } 
      />
      <Route 
        path="/admin/pending-items" 
        element={
          <AdminProtectedRoute>
            <PendingItems />
          </AdminProtectedRoute>
        } 
      />
      <Route 
        path="/admin/reminders" 
        element={
          <AdminProtectedRoute>
            <Reminders />
          </AdminProtectedRoute>
        } 
      />
      <Route 
        path="/admin/greeting-templates" 
        element={
          <AdminProtectedRoute>
            <GreetingTemplates />
          </AdminProtectedRoute>
        } 
      />
      <Route 
        path="/admin/customers" 
        element={
          <AdminProtectedRoute>
            <Customers />
          </AdminProtectedRoute>
        } 
      />
      <Route 
        path="/admin/support" 
        element={
          <AdminProtectedRoute>
            <Support />
          </AdminProtectedRoute>
        } 
      />
      <Route 
        path="/admin/company-settings" 
        element={
          <AdminProtectedRoute>
            <CompanySettings />
          </AdminProtectedRoute>
        } 
      />
      <Route 
        path="/admin/users" 
        element={
          <AdminProtectedRoute>
            <Users />
          </AdminProtectedRoute>
        } 
      />
      <Route 
        path="/admin/profile" 
        element={
          <AdminProtectedRoute>
            <AdminProfile />
          </AdminProtectedRoute>
        } 
      />
      <Route 
        path="/admin/email-logs" 
        element={
          <AdminProtectedRoute>
            <EmailLogs />
          </AdminProtectedRoute>
        } 
      />
      <Route 
        path="/admin/whatsapp-logs" 
        element={
          <AdminProtectedRoute>
            <WhatsAppLogs />
          </AdminProtectedRoute>
        } 
      />
      <Route 
        path="/admin/smtp-settings" 
        element={
          <AdminProtectedRoute>
            <Settings />
          </AdminProtectedRoute>
        } 
      />
      <Route 
        path="/admin/database-backup" 
        element={
          <AdminProtectedRoute>
            <DatabaseBackup />
          </AdminProtectedRoute>
        } 
      />
      
      {/* Legacy admin routes - redirect to new paths */}
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/doctors" element={<Navigate to="/admin/doctors" replace />} />
      <Route path="/medicals" element={<Navigate to="/admin/medicals" replace />} />
      <Route path="/agencies" element={<Navigate to="/admin/agencies" replace />} />
      <Route path="/items" element={<Navigate to="/admin/items" replace />} />
      <Route path="/orders" element={<Navigate to="/admin/orders" replace />} />
      <Route path="/marketing" element={<Navigate to="/admin/marketing" replace />} />
      <Route path="/expenses" element={<Navigate to="/admin/expenses" replace />} />
      <Route path="/pending-items" element={<Navigate to="/admin/pending-items" replace />} />
      <Route path="/reminders" element={<Navigate to="/admin/reminders" replace />} />
      <Route path="/customers" element={<Navigate to="/admin/customers" replace />} />
      <Route path="/support" element={<Navigate to="/admin/support" replace />} />
      <Route path="/company-settings" element={<Navigate to="/admin/company-settings" replace />} />
      <Route path="/users" element={<Navigate to="/admin/users" replace />} />
      <Route path="/admin-profile" element={<Navigate to="/admin/profile" replace />} />
      <Route path="/email-logs" element={<Navigate to="/admin/email-logs" replace />} />
      <Route path="/whatsapp-logs" element={<Navigate to="/admin/whatsapp-logs" replace />} />
      <Route path="/settings" element={<Navigate to="/admin/smtp-settings" replace />} />
      <Route path="/database-backup" element={<Navigate to="/admin/database-backup" replace />} />
      
      {/* Catch-all - redirect to customer login */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
