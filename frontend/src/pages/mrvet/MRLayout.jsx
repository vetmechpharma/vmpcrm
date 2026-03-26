import { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useMRAuth } from '../../context/MRAuthContext';
import { usePWA } from '../../hooks/usePWA';
import { prefetchEssentialData } from '../../lib/offlineData';
import { Helmet } from 'react-helmet';
import {
  LayoutDashboard, Users, Layers, ClipboardList, CalendarCheck,
  LogOut, Menu, X, Stethoscope, ShoppingCart, RefreshCw, Wifi, WifiOff,
  Download, Cloud, CloudOff, Smartphone, IndianRupee, CreditCard
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';
import { useAutoSubscribe } from '../../hooks/usePushNotifications';

const navItems = [
  { path: '/mrvet/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/mrvet/customers', icon: Users, label: 'Customers' },
  { path: '/mrvet/outstanding', icon: IndianRupee, label: 'Outstanding' },
  { path: '/mrvet/visual-aids', icon: Layers, label: 'Visual Aids' },
  { path: '/mrvet/visits', icon: ClipboardList, label: 'Visits' },
  { path: '/mrvet/followups', icon: CalendarCheck, label: 'Follow-ups' },
  { path: '/mrvet/orders', icon: ShoppingCart, label: 'Orders' },
  { path: '/mrvet/payments', icon: CreditCard, label: 'Payments' },
];

export default function MRLayout() {
  const { mr, logout } = useMRAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [installBannerDismissed, setInstallBannerDismissed] = useState(
    () => sessionStorage.getItem('mr-install-dismissed') === 'true'
  );

  // Auto-subscribe MR to push notifications
  useAutoSubscribe('mr');
  const { isOnline, offlineCount, syncing, syncOfflineData, canInstall, installApp } = usePWA();

  // Pre-fetch and cache essential data for offline use
  useEffect(() => {
    if (mr && isOnline) {
      prefetchEssentialData().then(count => {
        if (count > 0) console.log('[MR] Offline data pre-cached');
      });
    }
  }, [mr, isOnline]);

  const handleLogout = () => { logout(); navigate('/mrvet/login'); };

  const handleSync = () => {
    if (offlineCount > 0) {
      syncOfflineData();
      toast.info('Syncing offline data...');
    } else {
      toast.info('Everything is up to date');
    }
  };

  const handleInstall = async () => {
    const ok = await installApp();
    if (ok) {
      toast.success('App installed successfully!');
      setInstallBannerDismissed(true);
      sessionStorage.setItem('mr-install-dismissed', 'true');
    }
  };

  const dismissBanner = () => {
    setInstallBannerDismissed(true);
    sessionStorage.setItem('mr-install-dismissed', 'true');
  };

  const showInstallBanner = canInstall && !installBannerDismissed;

  return (
    <div className="min-h-screen bg-slate-50" data-testid="mr-layout">
      <Helmet>
        <meta name="theme-color" content="#0c3c60" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/mr-icon-192.png" />
        <title>MR Field App</title>
      </Helmet>

      {/* Install Banner - prominent floating bar */}
      {showInstallBanner && (
        <div className="fixed top-0 left-0 right-0 z-[70] flex items-center justify-between px-4 py-2.5"
          style={{ background: 'linear-gradient(135deg, #0c3c60, #1e7a4d)' }}
          data-testid="mr-install-banner">
          <div className="flex items-center gap-3 text-white">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight">Install MR Field App</p>
              <p className="text-[11px] text-white/70">Works offline with faster access</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleInstall}
              className="px-4 py-1.5 bg-white text-[#0c3c60] rounded-lg text-sm font-semibold hover:bg-white/90 transition-colors"
              data-testid="mr-install-banner-btn">
              Install
            </button>
            <button onClick={dismissBanner} className="p-1 text-white/60 hover:text-white" data-testid="mr-install-banner-close">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Offline Banner */}
      {!isOnline && (
        <div className="fixed left-0 right-0 z-[60] bg-amber-500 text-white text-center py-1.5 text-sm font-medium flex items-center justify-center gap-2"
          style={{ top: showInstallBanner ? '52px' : '0' }}
          data-testid="offline-banner">
          <WifiOff className="w-4 h-4" />You are offline. Changes will sync when connected.
        </div>
      )}

      {/* Mobile overlay */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside className={cn(
        "fixed left-0 z-50 h-full w-[240px] transform transition-transform duration-200 lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )} style={{
        background: '#0c3c60',
        top: showInstallBanner ? '52px' : (!isOnline ? '36px' : '0'),
        height: showInstallBanner ? 'calc(100% - 52px)' : (!isOnline ? 'calc(100% - 36px)' : '100%'),
      }}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-14 px-4">
            <Link to="/mrvet/dashboard" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#1e7a4d' }}>
                <Stethoscope className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-white">MR Field App</span>
            </Link>
            <button className="lg:hidden text-white/60 hover:text-white" onClick={() => setSidebarOpen(false)}><X className="w-5 h-5" /></button>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navItems.map(item => {
              const active = location.pathname === item.path;
              return (
                <Link key={item.path} to={item.path}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    active ? "bg-[#1e7a4d] text-white shadow-[0_2px_8px_rgba(30,122,77,0.4)]" : "text-white/60 hover:text-white hover:bg-white/10"
                  )}
                  onClick={() => setSidebarOpen(false)}
                  data-testid={`mr-nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <item.icon className="w-[18px] h-[18px]" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Sync / Install */}
          <div className="px-3 pb-2 space-y-1">
            <button onClick={handleSync}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              data-testid="mr-sync-btn">
              {syncing ? <RefreshCw className="w-[18px] h-[18px] animate-spin" /> :
                isOnline ? <Cloud className="w-[18px] h-[18px]" /> : <CloudOff className="w-[18px] h-[18px]" />}
              <span>Sync Data</span>
              {offlineCount > 0 && (
                <span className="ml-auto bg-amber-500 text-white text-xs px-1.5 py-0.5 rounded-full">{offlineCount}</span>
              )}
            </button>
            {canInstall && (
              <button onClick={handleInstall}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold bg-[#1e7a4d] text-white hover:bg-[#1e7a4d]/90 transition-colors"
                data-testid="mr-install-btn">
                <Download className="w-[18px] h-[18px]" />
                <span>Install App</span>
              </button>
            )}
          </div>

          {/* User */}
          <div className="p-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
            <div className="flex items-center gap-3 mb-3 px-2">
              <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center text-white font-bold text-sm">
                {mr?.name?.charAt(0)?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{mr?.name}</p>
                <div className="flex items-center gap-1">
                  <p className="text-[11px] text-white/40">{mr?.state}</p>
                  {isOnline ? <Wifi className="w-3 h-3 text-emerald-400" /> : <WifiOff className="w-3 h-3 text-amber-400" />}
                </div>
              </div>
            </div>
            <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium bg-red-500/15 text-red-300 hover:bg-red-500/25 transition-colors" data-testid="mr-logout-btn">
              <LogOut className="w-4 h-4" />Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="lg:pl-[240px]" style={{
        paddingTop: showInstallBanner ? '52px' : (!isOnline ? '36px' : '0'),
      }}>
        <header className="sticky z-30 bg-white border-b h-14 flex items-center px-4 lg:px-6" style={{
          top: showInstallBanner ? '52px' : (!isOnline ? '36px' : '0'),
        }}>
          <button className="lg:hidden p-2 mr-2 rounded-md hover:bg-slate-100" onClick={() => setSidebarOpen(true)} data-testid="mr-mobile-menu">
            <Menu className="w-5 h-5 text-slate-600" />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            {!isOnline && (
              <span className="text-xs text-amber-600 font-medium flex items-center gap-1"><WifiOff className="w-3 h-3" />Offline</span>
            )}
            <span className="text-sm text-slate-500 hidden sm:inline">{mr?.state} - {(mr?.districts || []).slice(0, 2).join(', ')}</span>
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-sm font-bold" style={{ color: '#0c3c60' }}>
              {mr?.name?.charAt(0)?.toUpperCase()}
            </div>
          </div>
        </header>

        <main className="p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
