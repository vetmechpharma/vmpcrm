import { useState, useEffect } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/card';
import { 
  ShoppingBag, 
  Package, 
  Clock, 
  CheckCircle, 
  ChevronRight,
  LifeBuoy,
  ListTodo,
  TrendingUp,
  Loader2,
  Bell,
  Download
} from 'lucide-react';
import axios from 'axios';
import { OffersCarousel } from '../components/OffersCarousel';
import { useAutoSubscribe } from '../hooks/usePushNotifications';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const CustomerDashboard = () => {
  const { customer } = useOutletContext();
  const [stats, setStats] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [canInstall, setCanInstall] = useState(false);

  // Auto-subscribe customer to push notifications
  useAutoSubscribe('customer');

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setCanInstall(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === 'accepted') {
      setCanInstall(false);
    }
    setDeferredPrompt(null);
  };

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('customerToken');
      const headers = { Authorization: `Bearer ${token}` };
      
      const [ordersRes, tasksRes, ticketsRes] = await Promise.all([
        axios.get(`${API_URL}/api/portal/orders`, { headers }),
        axios.get(`${API_URL}/api/portal/tasks`, { headers }),
        axios.get(`${API_URL}/api/customer/tickets`, { headers })
      ]);

      const orders = ordersRes.data || [];
      const tasks = tasksRes.data || [];
      const tickets = ticketsRes.data || [];

      setStats({
        totalOrders: orders.length,
        pendingOrders: orders.filter(o => !['delivered', 'cancelled'].includes(o.status)).length,
        completedOrders: orders.filter(o => o.status === 'delivered').length,
        pendingTasks: tasks.filter(t => t.status !== 'completed').length,
        openTickets: tickets.filter(t => t.status === 'open').length
      });

      setRecentOrders(orders.slice(0, 3));
    } catch (error) {
      console.error('Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-amber-100 text-amber-700',
      confirmed: 'bg-blue-100 text-blue-700',
      ready_to_despatch: 'bg-purple-100 text-purple-700',
      shipped: 'bg-indigo-100 text-indigo-700',
      delivered: 'bg-emerald-100 text-emerald-700',
      cancelled: 'bg-red-100 text-red-700'
    };
    return colors[status] || 'bg-slate-100 text-slate-700';
  };

  const formatStatus = (status) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="px-4 py-6 md:px-6 space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-br from-emerald-600 to-teal-600 rounded-2xl p-5 text-white shadow-lg shadow-emerald-600/20">
        <p className="text-emerald-100 text-sm">Welcome back,</p>
        <h1 className="text-xl font-bold mt-1" style={{ fontFamily: 'Poppins, sans-serif' }}>
          {customer?.name}
        </h1>
        <p className="text-emerald-200 text-sm mt-1 capitalize">{customer?.role} • {customer?.customer_code}</p>
      </div>

      {/* Current Offers */}
      <OffersCarousel role={customer?.role} />

      {/* Install App Card */}
      {canInstall && (
        <button
          onClick={handleInstallApp}
          className="w-full flex items-center gap-3 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-4 text-white shadow-lg shadow-blue-600/20 active:scale-[0.98] transition-transform"
          data-testid="dashboard-install-btn"
        >
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
            <Download className="w-5 h-5" />
          </div>
          <div className="text-left">
            <p className="font-semibold text-sm">Install App</p>
            <p className="text-blue-200 text-xs">Add to home screen for quick access</p>
          </div>
        </button>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link to="/portal/items" className="active:scale-95 transition-transform">
          <Card className="rounded-2xl border-0 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                <Package className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="font-semibold text-sm text-slate-800">Browse</p>
                <p className="text-xs text-slate-500">Products</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link to="/portal/orders" className="active:scale-95 transition-transform">
          <Card className="rounded-2xl border-0 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <ShoppingBag className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="font-semibold text-sm text-slate-800">Track</p>
                <p className="text-xs text-slate-500">Orders</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <ShoppingBag className="w-5 h-5 text-slate-400" />
              <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
              </span>
            </div>
            <p className="text-2xl font-bold text-slate-800">{stats?.totalOrders || 0}</p>
            <p className="text-xs text-slate-500">Total Orders</p>
          </CardContent>
        </Card>
        
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Clock className="w-5 h-5 text-amber-500" />
            </div>
            <p className="text-2xl font-bold text-slate-800">{stats?.pendingOrders || 0}</p>
            <p className="text-xs text-slate-500">In Progress</p>
          </CardContent>
        </Card>
        
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <ListTodo className="w-5 h-5 text-purple-500" />
            </div>
            <p className="text-2xl font-bold text-slate-800">{stats?.pendingTasks || 0}</p>
            <p className="text-xs text-slate-500">Tasks</p>
          </CardContent>
        </Card>
        
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <LifeBuoy className="w-5 h-5 text-blue-500" />
            </div>
            <p className="text-2xl font-bold text-slate-800">{stats?.openTickets || 0}</p>
            <p className="text-xs text-slate-500">Open Tickets</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-slate-800" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Recent Orders
          </h2>
          <Link to="/portal/orders" className="text-sm text-emerald-600 font-medium flex items-center gap-1">
            View All <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
        
        {recentOrders.length === 0 ? (
          <Card className="rounded-2xl border-0 shadow-sm">
            <CardContent className="py-8 text-center">
              <ShoppingBag className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500 text-sm">No orders yet</p>
              <Link 
                to="/portal/items" 
                className="inline-block mt-3 text-sm text-emerald-600 font-medium"
              >
                Browse Products
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {recentOrders.map((order) => (
              <Link 
                key={order.id} 
                to="/portal/orders"
                className="block active:scale-[0.98] transition-transform"
              >
                <Card className="rounded-2xl border-0 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-slate-800 text-sm">
                            #{order.order_number || order.id.slice(-6)}
                          </p>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                            {formatStatus(order.status)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 truncate">
                          {order.items?.length || 0} items • ₹{order.total_amount?.toLocaleString()}
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-400" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Help Section */}
      <Card className="rounded-2xl border-0 shadow-sm bg-slate-50">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <LifeBuoy className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-slate-800 text-sm">Need Help?</p>
              <p className="text-xs text-slate-500">Create a support ticket</p>
            </div>
            <Link 
              to="/portal/support"
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-full active:scale-95 transition-transform"
            >
              Get Help
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CustomerDashboard;
