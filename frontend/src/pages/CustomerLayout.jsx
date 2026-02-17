import { useState, useEffect } from 'react';
import { useNavigate, Link, Outlet } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingBag, 
  ListTodo, 
  LifeBuoy, 
  User, 
  LogOut,
  Menu,
  X,
  Stethoscope,
  Store,
  Building2
} from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const CustomerLayout = () => {
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('customerToken');
    const customerData = localStorage.getItem('customerData');
    
    if (!token || !customerData) {
      navigate('/customer/login');
      return;
    }
    
    setCustomer(JSON.parse(customerData));
    fetchProfile(token);
  }, [navigate]);

  const fetchProfile = async (token) => {
    try {
      const response = await axios.get(`${API_URL}/api/customer/profile`, {
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
    navigate('/customer/login');
  };

  const roleIcons = {
    doctor: <Stethoscope className="w-5 h-5" />,
    medical: <Store className="w-5 h-5" />,
    agency: <Building2 className="w-5 h-5" />
  };

  const navItems = [
    { path: '/customer/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/customer/items', icon: Package, label: 'Products' },
    { path: '/customer/orders', icon: ShoppingBag, label: 'My Orders' },
    { path: '/customer/tasks', icon: ListTodo, label: 'Tasks' },
    { path: '/customer/support', icon: LifeBuoy, label: 'Support' },
    { path: '/customer/profile', icon: User, label: 'Profile' },
  ];

  if (!customer) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 bg-white border-b z-50 px-4 py-3 flex items-center justify-between">
        <button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-slate-100 rounded-lg">
          <Menu className="w-6 h-6" />
        </button>
        <span className="font-semibold text-slate-800">VMP CRM</span>
        <div className="w-10" />
      </div>

      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/50 z-50" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 h-full w-64 bg-slate-900 text-white z-50 transform transition-transform lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              {roleIcons[customer.role]}
            </div>
            <div>
              <p className="font-semibold text-sm">{customer.name}</p>
              <p className="text-xs text-slate-400 capitalize">{customer.role}</p>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1 hover:bg-slate-700 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="p-4 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                location.pathname === item.path
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-700">
          <Button 
            variant="ghost" 
            className="w-full justify-start text-slate-300 hover:text-white hover:bg-slate-800"
            onClick={handleLogout}
          >
            <LogOut className="w-5 h-5 mr-3" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 pt-16 lg:pt-0 min-h-screen">
        <Outlet context={{ customer, setCustomer }} />
      </main>
    </div>
  );
};

export default CustomerLayout;
