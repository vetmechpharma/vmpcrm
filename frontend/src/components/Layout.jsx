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
  Key,
  Search
} from 'lucide-react';
import { cn } from '../lib/utils';

const mainNavItems = [
  { path: '/admin', icon: LayoutDashboard, label: 'Dashboard', perm: null },
  { path: '/admin/doctors', icon: Users, label: 'Doctors', perm: 'doctors' },
  { path: '/admin/medicals', icon: Store, label: 'Medicals', perm: 'medicals' },
  { path: '/admin/agencies', icon: Building, label: 'Agencies', perm: 'agencies' },
  { path: '/admin/items', icon: Package, label: 'Items', perm: 'items' },
  { path: '/admin/orders', icon: ShoppingCart, label: 'Orders', perm: 'orders' },
  { path: '/admin/marketing', icon: Megaphone, label: 'Marketing', perm: 'marketing' },
  { path: '/admin/expenses', icon: Receipt, label: 'Expenses', perm: 'expenses' },
  { path: '/admin/reminders', icon: Bell, label: 'Reminders', perm: 'reminders' },
  { path: '/admin/pending-items', icon: Clock, label: 'Pending Items', perm: 'pending_items', showBadge: true },
  { path: '/admin/customers', icon: UserCheck, label: 'Portal Customers', perm: 'portal_customers' },
  { path: '/admin/support', icon: LifeBuoy, label: 'Support Tickets', perm: 'support' },
];

const companySubItems = [
  { path: '/admin/company-settings', icon: Building2, label: 'Company Details', perm: 'company_settings' },
  { path: '/admin/users', icon: UserCog, label: 'Users', adminOnly: true },
  { path: '/admin/profile', icon: Key, label: 'Admin Profile', adminOnly: true },
  { path: '/admin/email-logs', icon: Mail, label: 'Email Logs', perm: 'email_logs' },
  { path: '/admin/whatsapp-logs', icon: MessageSquare, label: 'WhatsApp Logs', perm: 'whatsapp_logs' },
  { path: '/admin/smtp-settings', icon: Settings, label: 'SMTP Settings', perm: 'smtp_settings' },
  { path: '/admin/database-backup', icon: Database, label: 'Database Backup', perm: 'backup' },
];

export const Layout = ({ children }) => {
  const { user, logout, hasPermission } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [companyExpanded, setCompanyExpanded] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const isCompanySubPath = companySubItems.some(item => location.pathname === item.path);
    if (isCompanySubPath) setCompanyExpanded(true);
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
    if (item.perm && !hasPermission(item.perm)) return null;
    
    return (
      <Link
        key={item.path}
        to={item.path}
        data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
        className={cn(
          "sidebar-nav-item",
          isActive && "active",
          isSubItem && "pl-12 text-sm"
        )}
        onClick={() => setSidebarOpen(false)}
      >
        <item.icon className={cn("w-[22px] h-[22px] shrink-0", isSubItem && "w-[18px] h-[18px]")} />
        <span className="font-medium truncate">{item.label}</span>
        {item.showBadge && pendingCount > 0 && (
          <span className="ml-auto bg-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
            {pendingCount}
          </span>
        )}
      </Link>
    );
  };

  return (
    <div className="min-h-screen" style={{ background: '#F8F7FA' }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 left-0 z-50 h-full w-[260px] transform transition-transform duration-200 ease-in-out lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )} style={{ background: 'var(--sidebar-bg)' }}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-6">
            <Link to="/admin" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#7367F0' }}>
                <span className="text-white font-bold text-sm">V</span>
              </div>
              <span className="font-bold text-lg text-white tracking-tight">VMP CRM</span>
            </Link>
            <button 
              className="lg:hidden p-1 text-slate-400 hover:text-white"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-2 space-y-0.5 overflow-y-auto scrollbar-hide">
            {mainNavItems.map((item) => renderNavItem(item))}
            
            {/* Company Section - only show if user has any company permissions */}
            {companySubItems.some(item => item.adminOnly ? user?.role === 'admin' : (!item.perm || hasPermission(item.perm))) && (
            <div className="pt-3 mt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#616272' }}>Company</p>
              <button
                onClick={() => setCompanyExpanded(!companyExpanded)}
                className={cn(
                  "sidebar-nav-item w-full justify-between",
                  companySubItems.some(item => location.pathname === item.path) && "text-white"
                )}
                data-testid="nav-company-toggle"
              >
                <div className="flex items-center gap-3">
                  <Building2 className="w-[22px] h-[22px] shrink-0" />
                  <span className="font-medium">Settings</span>
                </div>
                {companyExpanded ? (
                  <ChevronDown className="w-4 h-4 shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 shrink-0" />
                )}
              </button>
              
              {companyExpanded && (
                <div className="mt-0.5 space-y-0.5">
                  {companySubItems.map((item) => renderNavItem(item, true))}
                </div>
              )}
            </div>
            )}
          </nav>

          {/* User info */}
          <div className="p-4" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: '#7367F0' }}>
                <span className="text-sm font-semibold text-white">
                  {user?.name?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{user?.name}</p>
                <p className="text-xs capitalize" style={{ color: '#616272' }}>{user?.role}</p>
              </div>
            </div>
            <button 
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors"
              style={{ background: 'rgba(234,84,85,0.15)', color: '#EA5455' }}
              onClick={handleLogout}
              data-testid="logout-btn"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-[260px]">
        {/* Floating Header */}
        <header className="floating-header sticky top-0 z-30 mx-4 lg:mx-6 mt-4 mb-4 h-14 flex items-center px-5">
          <button 
            className="lg:hidden p-2 mr-2 rounded-md hover:bg-slate-100"
            onClick={() => setSidebarOpen(true)}
            data-testid="mobile-menu-btn"
            style={{ color: '#5D596C' }}
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 flex-1">
            <Search className="w-4 h-4" style={{ color: '#B4B2B7' }} />
            <span className="text-sm" style={{ color: '#B4B2B7' }}>Search...</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'rgba(115,103,240,0.15)' }}>
              <span className="text-sm font-semibold" style={{ color: '#7367F0' }}>
                {user?.name?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="hidden md:block">
              <p className="text-sm font-medium" style={{ color: '#434050' }}>{user?.name}</p>
              <p className="text-xs capitalize" style={{ color: '#8D8A94' }}>{user?.role}</p>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="px-4 lg:px-6 pb-8">
          {children}
        </main>
      </div>
    </div>
  );
};
