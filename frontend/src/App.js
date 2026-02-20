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
import { PublicShowcase } from './pages/PublicShowcase';
import { Marketing } from './pages/Marketing';
import Customers from './pages/Customers';
import Support from './pages/Support';
import CustomerRegister from './pages/CustomerRegister';
import CustomerLogin from './pages/CustomerLogin';
import CustomerLayout from './pages/CustomerLayout';
import CustomerDashboard from './pages/CustomerDashboard';
import CustomerItems from './pages/CustomerItems';
import CustomerOrders from './pages/CustomerOrders';
import CustomerTasks from './pages/CustomerTasks';
import CustomerSupport from './pages/CustomerSupport';
import CustomerProfile from './pages/CustomerProfile';
import { Toaster } from './components/ui/sonner';
import './App.css';

// Protected Route wrapper
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-600 rounded-full animate-spin"></div>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <Layout>{children}</Layout>;
};

// Public Route wrapper (redirects to dashboard if already logged in)
const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-600 rounded-full animate-spin"></div>
      </div>
    );
  }
  
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  
  return children;
};

function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/showcase" element={<PublicShowcase />} />
      
      {/* Customer Portal Routes */}
      <Route path="/customer/register" element={<CustomerRegister />} />
      <Route path="/customer/login" element={<CustomerLogin />} />
      <Route path="/customer" element={<CustomerLayout />}>
        <Route path="dashboard" element={<CustomerDashboard />} />
        <Route path="items" element={<CustomerItems />} />
        <Route path="orders" element={<CustomerOrders />} />
        <Route path="tasks" element={<CustomerTasks />} />
        <Route path="support" element={<CustomerSupport />} />
        <Route path="profile" element={<CustomerProfile />} />
        <Route index element={<Navigate to="/customer/dashboard" replace />} />
      </Route>
      
      <Route 
        path="/login" 
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        } 
      />
      <Route 
        path="/" 
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/doctors" 
        element={
          <ProtectedRoute>
            <Doctors />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/medicals" 
        element={
          <ProtectedRoute>
            <Medicals />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/agencies" 
        element={
          <ProtectedRoute>
            <Agencies />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/items" 
        element={
          <ProtectedRoute>
            <Items />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/orders" 
        element={
          <ProtectedRoute>
            <Orders />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/expenses" 
        element={
          <ProtectedRoute>
            <Expenses />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/pending-items" 
        element={
          <ProtectedRoute>
            <PendingItems />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/reminders" 
        element={
          <ProtectedRoute>
            <Reminders />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/email-logs" 
        element={
          <ProtectedRoute>
            <EmailLogs />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/whatsapp-logs" 
        element={
          <ProtectedRoute>
            <WhatsAppLogs />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/users" 
        element={
          <ProtectedRoute>
            <Users />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/customers" 
        element={
          <ProtectedRoute>
            <Customers />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/support" 
        element={
          <ProtectedRoute>
            <Support />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/company-settings" 
        element={
          <ProtectedRoute>
            <CompanySettings />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/settings" 
        element={
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        } 
      />
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
