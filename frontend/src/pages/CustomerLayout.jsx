import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Outlet, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { 
  LogOut,
  ChevronLeft,
  Stethoscope,
  Store,
  Building2,
  Download,
  BookOpen,
  X
} from 'lucide-react';
import BottomNav from '../components/BottomNav';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const CustomerLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [customer, setCustomer] = useState(null);
  const [cart, setCart] = useState([]);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  const handleBeforeInstall = useCallback((e) => {
    e.preventDefault();
    setInstallPrompt(e);
    const dismissed = localStorage.getItem('pwa_install_dismissed');
    if (!dismissed) setShowInstallBanner(true);
  }, []);

  useEffect(() => {
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, [handleBeforeInstall]);

  useEffect(() => {
    const token = localStorage.getItem('customerToken');
    const customerData = localStorage.getItem('customerData');
    
    if (!token || !customerData) {
      navigate('/login');
      return;
    }
    
    setCustomer(JSON.parse(customerData));
    fetchProfile(token);
    
    // Load cart from localStorage
    const savedCart = localStorage.getItem('customerCart');
    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart));
      } catch (e) {
        console.error('Failed to parse cart');
      }
    }
  }, [navigate]);

  const fetchProfile = async (token) => {
    try {
      const response = await axios.get(`${API_URL}/api/portal/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCustomer(response.data);
      localStorage.setItem('customerData', JSON.stringify(response.data));
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        handleLogout();
      }
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('customerToken');
    localStorage.removeItem('customerData');
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const roleIcons = {
    doctor: <Stethoscope className="w-5 h-5" />,
    medical: <Store className="w-5 h-5" />,
    agency: <Building2 className="w-5 h-5" />
  };

  const getPageTitle = () => {
    const path = location.pathname;
    if (path.includes('/dashboard')) return 'Home';
    if (path.includes('/items')) return 'Products';
    if (path.includes('/orders')) return 'My Orders';
    if (path.includes('/tasks')) return 'Tasks';
    if (path.includes('/support')) return 'Support';
    if (path.includes('/profile')) return 'Profile';
    return 'VMP Portal';
  };

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const result = await installPrompt.userChoice;
    if (result.outcome === 'accepted') {
      toast.success('App installed successfully!');
    }
    setInstallPrompt(null);
    setShowInstallBanner(false);
  };

  const dismissInstallBanner = () => {
    setShowInstallBanner(false);
    localStorage.setItem('pwa_install_dismissed', 'true');
  };

  if (!customer) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* PWA Install Banner */}
      {showInstallBanner && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-emerald-600 text-white px-4 py-3 flex items-center justify-between safe-area-pt" data-testid="pwa-install-banner">
          <div className="flex items-center gap-2 flex-1">
            <Download className="w-5 h-5 shrink-0" />
            <span className="text-sm font-medium">Install VMP CRM app for quick access</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleInstall} className="px-3 py-1 bg-white text-emerald-700 rounded-lg text-xs font-bold" data-testid="pwa-install-btn">Install</button>
            <button onClick={dismissInstallBanner} className="p-1 hover:bg-emerald-700 rounded-lg" data-testid="pwa-dismiss-btn"><X className="w-4 h-4" /></button>
          </div>
        </div>
      )}
      {/* Mobile Header - Glassmorphism */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200/50 safe-area-pt">
        <div className="flex items-center justify-between h-14 px-4 max-w-md mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-600 rounded-xl flex items-center justify-center text-white">
              {roleIcons[customer.role]}
            </div>
            <span className="font-semibold text-slate-800" style={{ fontFamily: 'Manrope, sans-serif' }}>
              {getPageTitle()}
            </span>
          </div>
          <button 
            onClick={handleLogout}
            className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 active:scale-95 transition-transform"
            data-testid="logout-btn-mobile"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex fixed top-0 left-0 h-full w-72 bg-gradient-to-b from-slate-900 to-slate-800 text-white flex-col z-50">
        {/* Logo & User */}
        <div className="p-6 border-b border-slate-700/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-600/20">
              {roleIcons[customer.role]}
            </div>
            <div>
              <p className="font-bold text-base" style={{ fontFamily: 'Manrope, sans-serif' }}>{customer.name}</p>
              <p className="text-sm text-emerald-400 capitalize">{customer.role}</p>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-3 font-mono">{customer.customer_code}</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {[
            { path: '/portal/dashboard', icon: 'LayoutDashboard', label: 'Dashboard' },
            { path: '/portal/items', icon: 'Package', label: 'Products' },
            { path: '/portal/orders', icon: 'ShoppingBag', label: 'My Orders' },
            { path: '/portal/tasks', icon: 'ListTodo', label: 'Tasks' },
            { path: '/portal/downloads', icon: 'Download', label: 'Downloads' },
            { path: '/portal/ledger', icon: 'BookOpen', label: 'Ledger' },
            { path: '/portal/support', icon: 'LifeBuoy', label: 'Support' },
            { path: '/portal/profile', icon: 'User', label: 'Profile' },
          ].map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = require('lucide-react')[item.icon];
            return (
              <a
                key={item.path}
                href={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                    : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </a>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-slate-700/50">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-colors"
            data-testid="logout-btn-desktop"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="md:ml-72 min-h-screen pt-14 pb-20 md:pt-0 md:pb-0">
        <div className="max-w-5xl mx-auto">
          <Outlet context={{ customer, setCustomer, cart, setCart }} />
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <BottomNav />
    </div>
  );
};

export default CustomerLayout;
