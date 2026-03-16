import { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useMRAuth } from '../../context/MRAuthContext';
import {
  LayoutDashboard, Users, Layers, ClipboardList, CalendarCheck,
  LogOut, Menu, X, Stethoscope, RefreshCw
} from 'lucide-react';
import { cn } from '../../lib/utils';

const navItems = [
  { path: '/mrvet/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/mrvet/customers', icon: Users, label: 'Customers' },
  { path: '/mrvet/visual-aids', icon: Layers, label: 'Visual Aids' },
  { path: '/mrvet/visits', icon: ClipboardList, label: 'Visits' },
  { path: '/mrvet/followups', icon: CalendarCheck, label: 'Follow-ups' },
];

export default function MRLayout() {
  const { mr, logout } = useMRAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/mrvet/login'); };

  return (
    <div className="min-h-screen bg-slate-50" data-testid="mr-layout">
      {/* Mobile overlay */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 left-0 z-50 h-full w-[240px] transform transition-transform duration-200 lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )} style={{ background: '#1e3a5f' }}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-14 px-4">
            <Link to="/mrvet/dashboard" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)' }}>
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
                    active ? "bg-white/15 text-white" : "text-white/60 hover:text-white hover:bg-white/10"
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

          {/* User */}
          <div className="p-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
            <div className="flex items-center gap-3 mb-3 px-2">
              <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center text-white font-bold text-sm">
                {mr?.name?.charAt(0)?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{mr?.name}</p>
                <p className="text-[11px] text-white/40">{mr?.state}</p>
              </div>
            </div>
            <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium bg-red-500/15 text-red-300 hover:bg-red-500/25 transition-colors" data-testid="mr-logout-btn">
              <LogOut className="w-4 h-4" />Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="lg:pl-[240px]">
        <header className="sticky top-0 z-30 bg-white border-b h-14 flex items-center px-4 lg:px-6">
          <button className="lg:hidden p-2 mr-2 rounded-md hover:bg-slate-100" onClick={() => setSidebarOpen(true)} data-testid="mr-mobile-menu">
            <Menu className="w-5 h-5 text-slate-600" />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500 hidden sm:inline">{mr?.state} - {(mr?.districts || []).slice(0, 2).join(', ')}</span>
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-sm font-bold" style={{ color: '#1e3a5f' }}>
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
