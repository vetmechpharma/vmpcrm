import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingBag, 
  LifeBuoy, 
  User 
} from 'lucide-react';

const BottomNav = () => {
  const location = useLocation();
  
  const navItems = [
    { path: '/portal/dashboard', icon: LayoutDashboard, label: 'Home' },
    { path: '/portal/items', icon: Package, label: 'Products' },
    { path: '/portal/orders', icon: ShoppingBag, label: 'Orders' },
    { path: '/portal/support', icon: LifeBuoy, label: 'Support' },
    { path: '/portal/profile', icon: User, label: 'Profile' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-t border-slate-200/50 md:hidden safe-area-pb">
      <div className="flex items-center justify-around h-16 max-w-md mx-auto px-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center flex-1 h-full min-w-[60px] transition-colors ${
                isActive 
                  ? 'text-emerald-600' 
                  : 'text-slate-400 hover:text-slate-600'
              }`}
              data-testid={`nav-${item.label.toLowerCase()}`}
            >
              <div className={`p-1.5 rounded-xl transition-colors ${isActive ? 'bg-emerald-50' : ''}`}>
                <item.icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : ''}`} />
              </div>
              <span className={`text-[10px] mt-0.5 font-medium ${isActive ? 'font-semibold' : ''}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
