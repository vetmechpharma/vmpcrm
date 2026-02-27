import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { pendingItemsAPI } from '../lib/api';
import { 
  LayoutDashboard, 
  Users, 
  Settings, 
  Mail, 
  LogOut, 
  Menu, 
  X,
  ChevronRight,
  ChevronDown,
  Package,
  ShoppingCart,
  Building2,
  Clock,
  Store,
  Building,
  Receipt,
  Bell,
  MessageSquare,
  UserCog,
  UserCheck,
  LifeBuoy,
  Megaphone,
  Database,
  Key
} from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '../lib/utils';

const mainNavItems = [
  { path: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/admin/doctors', icon: Users, label: 'Doctors' },
  { path: '/admin/medicals', icon: Store, label: 'Medicals' },
  { path: '/admin/agencies', icon: Building, label: 'Agencies' },
  { path: '/admin/items', icon: Package, label: 'Items' },
  { path: '/admin/orders', icon: ShoppingCart, label: 'Orders' },
  { path: '/admin/marketing', icon: Megaphone, label: 'Marketing' },
  { path: '/admin/expenses', icon: Receipt, label: 'Expenses' },
  { path: '/admin/reminders', icon: Bell, label: 'Reminders' },
  { path: '/admin/pending-items', icon: Clock, label: 'Pending Items', showBadge: true },
  { path: '/admin/customers', icon: UserCheck, label: 'Portal Customers' },
  { path: '/admin/support', icon: LifeBuoy, label: 'Support Tickets' },
];

const companySubItems = [
  { path: '/admin/company-settings', icon: Building2, label: 'Company Details' },
  { path: '/admin/users', icon: UserCog, label: 'Users', adminOnly: true },
  { path: '/admin/profile', icon: Key, label: 'Admin Profile', adminOnly: true },
  { path: '/admin/email-logs', icon: Mail, label: 'Email Logs' },
  { path: '/admin/whatsapp-logs', icon: MessageSquare, label: 'WhatsApp Logs' },
  { path: '/admin/smtp-settings', icon: Settings, label: 'SMTP Settings' },
  { path: '/admin/database-backup', icon: Database, label: 'Database Backup', adminOnly: true },
];

export const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [companyExpanded, setCompanyExpanded] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  // Auto-expand company section if current path is a sub-item
  useEffect(() => {
    const isCompanySubPath = companySubItems.some(item => location.pathname === item.path);
    if (isCompanySubPath) {
      setCompanyExpanded(true);
    }
  }, [location.pathname]);

  useEffect(() => {
    const fetchPendingCount = async () => {
      try {
        const response = await pendingItemsAPI.getStats();
        setPendingCount(response.data.total_pending_items || 0);
      } catch (error) {
        console.error('Failed to fetch pending items count');
      }
    };
    fetchPendingCount();
    // Refresh every 30 seconds
    const interval = setInterval(fetchPendingCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  const renderNavItem = (item, isSubItem = false) => {
    const isActive = location.pathname === item.path;
    if (item.adminOnly && user?.role !== 'admin') return null;
    
    return (
      <Link
        key={item.path}
        to={item.path}
        data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
        className={cn(
          "sidebar-item",
          isActive && "active",
          isSubItem && "pl-10 text-sm"
        )}
        onClick={() => setSidebarOpen(false)}
      >
        <item.icon className={cn("w-5 h-5", isSubItem && "w-4 h-4")} />
        <span className="font-medium">{item.label}</span>
        {item.showBadge && pendingCount > 0 && (
          <span className="ml-auto bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
            {pendingCount}
          </span>
        )}
        {isActive && !item.showBadge && <ChevronRight className="w-4 h-4 ml-auto" />}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 left-0 z-50 h-full w-64 bg-white border-r border-slate-200 transform transition-transform duration-200 ease-in-out lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-6 border-b border-slate-200">
            <Link to="/admin" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">V</span>
              </div>
              <span className="font-bold text-lg text-slate-900">VMP CRM</span>
            </Link>
            <button 
              className="lg:hidden p-1 text-slate-500 hover:text-slate-700"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {/* Main nav items */}
            {mainNavItems.map((item) => renderNavItem(item))}
            
            {/* Company Section - Collapsible */}
            <div className="pt-2">
              <button
                onClick={() => setCompanyExpanded(!companyExpanded)}
                className={cn(
                  "sidebar-item w-full justify-between",
                  companySubItems.some(item => location.pathname === item.path) && "text-emerald-600"
                )}
                data-testid="nav-company-toggle"
              >
                <div className="flex items-center gap-3">
                  <Building2 className="w-5 h-5" />
                  <span className="font-medium">Company</span>
                </div>
                {companyExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>
              
              {/* Sub-items */}
              {companyExpanded && (
                <div className="mt-1 space-y-1 ml-2 border-l-2 border-slate-100">
                  {companySubItems.map((item) => renderNavItem(item, true))}
                </div>
              )}
            </div>
          </nav>

          {/* User info */}
          <div className="p-4 border-t border-slate-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                <span className="text-sm font-semibold text-slate-600">
                  {user?.name?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{user?.name}</p>
                <p className="text-xs text-slate-500 capitalize">{user?.role}</p>
              </div>
            </div>
            <Button 
              variant="outline" 
              className="w-full justify-start gap-2 text-slate-600"
              onClick={handleLogout}
              data-testid="logout-btn"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Header */}
        <header className="glass-header sticky top-0 z-30 h-16 flex items-center px-4 lg:px-8">
          <button 
            className="lg:hidden p-2 text-slate-600 hover:text-slate-900"
            onClick={() => setSidebarOpen(true)}
            data-testid="mobile-menu-btn"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex-1" />
          <div className="text-sm text-slate-500">
            Welcome, <span className="font-medium text-slate-700">{user?.name}</span>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
};
