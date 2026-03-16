import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { dashboardAPI, remindersAPI, ordersAPI } from '../lib/api';
import { 
  Users, UserCheck, PhoneCall, Clock, XCircle, CheckCircle,
  ArrowRight, ArrowUp, ArrowDown, Loader2, Package,
  AlertTriangle, TrendingUp, ShoppingCart, Truck, Receipt,
  TrendingDown, Bell, Store, Building2, Stethoscope, BarChart3,
  Calendar, AlertCircle, CheckCircle2, Timer, XOctagon,
  HelpCircle, MessageSquare, Eye
} from 'lucide-react';
import { formatDate } from '../lib/utils';

const COLORS = {
  primary: '#1e7a4d',
  success: '#28C76F',
  warning: '#FF9F43',
  danger: '#EA5455',
  info: '#00CFE8',
  secondary: '#A8AAAE',
  dark: '#0c3c60',
  body: '#555',
  muted: '#777',
  light: '#999',
  bg: '#f4f6f9',
};

const LEAD_STATUS_CONFIG = {
  'Customer': { color: COLORS.success, icon: UserCheck },
  'Contacted': { color: COLORS.info, icon: PhoneCall },
  'Pipeline': { color: COLORS.warning, icon: Clock },
  'Not Interested': { color: COLORS.secondary, icon: XCircle },
  'Closed': { color: COLORS.danger, icon: CheckCircle },
};

const ORDER_STATUS_CONFIG = {
  'pending': { color: COLORS.warning, label: 'Pending', icon: Clock },
  'confirmed': { color: COLORS.info, label: 'Confirmed', icon: CheckCircle2 },
  'ready_to_despatch': { color: COLORS.primary, label: 'Ready', icon: Package },
  'shipped': { color: '#4B4DED', label: 'Shipped', icon: Truck },
  'delivered': { color: COLORS.success, label: 'Delivered', icon: CheckCircle },
  'cancelled': { color: COLORS.danger, label: 'Cancelled', icon: XOctagon },
};

const TICKET_STATUS_CONFIG = {
  'open': { color: COLORS.warning, label: 'Open', icon: AlertCircle },
  'in_progress': { color: COLORS.info, label: 'In Progress', icon: Timer },
  'resolved': { color: COLORS.success, label: 'Resolved', icon: CheckCircle2 },
  'closed': { color: COLORS.secondary, label: 'Closed', icon: XCircle },
};

// Cuba-style stat card with arrow
const StatCard = ({ icon: Icon, value, label, color, change, link }) => (
  <Link to={link || '#'} className="mat-card block p-6 group relative overflow-hidden">
    <div className="flex items-start justify-between relative z-10">
      <div>
        <p className="text-2xl font-bold" style={{ color: COLORS.dark }}>{value}</p>
        <p className="text-[13px] mt-1.5" style={{ color: COLORS.muted }}>{label}</p>
        {change !== undefined && (
          <div className="flex items-center gap-1 mt-2">
            {change >= 0 ? (
              <ArrowUp className="w-3.5 h-3.5" style={{ color: COLORS.success }} />
            ) : (
              <ArrowDown className="w-3.5 h-3.5" style={{ color: COLORS.danger }} />
            )}
            <span className="text-xs font-semibold" style={{ color: change >= 0 ? COLORS.success : COLORS.danger }}>
              {change >= 0 ? '+' : ''}{change}%
            </span>
          </div>
        )}
      </div>
      <div className="w-[50px] h-[50px] rounded-xl flex items-center justify-center" style={{ background: `${color}20` }}>
        <Icon className="w-6 h-6" style={{ color }} />
      </div>
    </div>
    {/* Background accent */}
    <div className="absolute -right-4 -bottom-4 w-24 h-24 rounded-full opacity-[0.07]" style={{ background: color }} />
  </Link>
);

export const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [todayReminders, setTodayReminders] = useState({ reminders: [], total_count: 0 });
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchStats(), fetchTodayReminders(), fetchRecentOrders()]).finally(() => setLoading(false));
  }, []);

  const fetchStats = async () => {
    try {
      const response = await dashboardAPI.getComprehensiveStats();
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch stats');
    }
  };

  const fetchTodayReminders = async () => {
    try {
      const response = await remindersAPI.getToday();
      setTodayReminders(response.data);
    } catch (error) {
      console.error('Failed to fetch reminders');
    }
  };

  const fetchRecentOrders = async () => {
    try {
      const response = await ordersAPI.getAll();
      setRecentOrders((response.data || []).slice(0, 6));
    } catch (error) {
      console.error('Failed to fetch orders');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin" style={{ color: COLORS.primary }} />
      </div>
    );
  }

  const { customers, orders, pending_items, expenses, items, support_tickets } = stats || {};
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  return (
    <div data-testid="dashboard-page" className="animate-fade-in space-y-6">
      {/* Welcome Banner - Cuba Style */}
      <div className="mat-card overflow-hidden" style={{ background: `linear-gradient(135deg, ${COLORS.primary} 0%, #9E95F5 100%)` }}>
        <div className="flex items-center justify-between px-7 py-6">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1" style={{ fontFamily: 'Manrope, sans-serif' }}>
              {greeting}, {user?.name || 'Admin'}!
            </h2>
            <p className="text-white/75 text-sm">Here's what's happening in your business today</p>
            <div className="flex items-center gap-4 mt-4">
              <div className="bg-white/20 backdrop-blur-sm rounded-xl px-4 py-2">
                <p className="text-white/70 text-[10px] uppercase tracking-wider">Orders Today</p>
                <p className="text-white text-xl font-bold">{orders?.recent_7_days || 0}</p>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-xl px-4 py-2">
                <p className="text-white/70 text-[10px] uppercase tracking-wider">Revenue</p>
                <p className="text-white text-xl font-bold">₹{(expenses?.current_month_total || 0).toLocaleString()}</p>
              </div>
              {todayReminders.total_count > 0 && (
                <Link to="/admin/reminders" className="bg-white/20 backdrop-blur-sm rounded-xl px-4 py-2 hover:bg-white/30 transition-colors">
                  <p className="text-white/70 text-[10px] uppercase tracking-wider">Reminders</p>
                  <p className="text-white text-xl font-bold">{todayReminders.total_count}</p>
                </Link>
              )}
            </div>
          </div>
          <div className="hidden lg:block text-right">
            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mb-2 ml-auto">
              <span className="text-3xl font-bold text-white">{user?.name?.charAt(0)}</span>
            </div>
            <p className="text-white/60 text-xs">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          </div>
        </div>
      </div>

      {/* Main Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard icon={Users} value={customers?.total_all || 0} label="Total Customers" color={COLORS.primary} change={12} link="/admin/doctors" />
        <StatCard icon={ShoppingCart} value={orders?.total || 0} label="Total Orders" color={COLORS.info} change={8} link="/admin/orders" />
        <StatCard icon={Package} value={items?.total || 0} label="Total Items" color={COLORS.success} link="/admin/items" />
        <StatCard icon={Receipt} value={`₹${(expenses?.current_month_total || 0).toLocaleString()}`} label="Monthly Expenses" color={COLORS.warning} change={expenses?.change_percent} link="/admin/expenses" />
      </div>

      {/* Pending Items Alert */}
      {pending_items?.total_items > 0 && (
        <Link to="/admin/pending-items" className="mat-card block overflow-hidden group">
          <div className="flex items-center gap-5 p-5" style={{ background: `linear-gradient(135deg, ${COLORS.warning} 0%, #FFB976 100%)` }}>
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
              <AlertTriangle className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xl font-bold text-white">{pending_items.total_items} Pending Items</p>
              <p className="text-white/70 text-sm">{pending_items.total_quantity} total quantity needs attention</p>
            </div>
            <ArrowRight className="w-5 h-5 text-white/70 group-hover:translate-x-1 transition-transform shrink-0" />
          </div>
        </Link>
      )}

      {/* Customers Overview */}
      <div>
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-2 h-6 rounded-full" style={{ background: COLORS.primary }} />
          <h3 className="page-title-cuba text-lg">Customers Overview</h3>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {[
            { key: 'doctors', label: 'Doctors', icon: Stethoscope, color: COLORS.primary, link: '/admin/doctors' },
            { key: 'medicals', label: 'Medicals', icon: Store, color: COLORS.success, link: '/admin/medicals' },
            { key: 'agencies', label: 'Agencies', icon: Building2, color: COLORS.info, link: '/admin/agencies' },
          ].map((cat) => (
            <Link key={cat.key} to={cat.link} className="mat-card block p-6 group">
              <div className="flex items-center gap-4 mb-5">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `${cat.color}20` }}>
                  <cat.icon className="w-6 h-6" style={{ color: cat.color }} />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider font-semibold" style={{ color: COLORS.muted }}>{cat.label}</p>
                  <p className="text-3xl font-bold" style={{ color: cat.color }}>{customers?.[cat.key]?.total || 0}</p>
                </div>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {Object.entries(customers?.[cat.key]?.by_status || {}).map(([status, count]) => (
                  <div key={status} className="text-center py-2 rounded-lg" style={{ background: COLORS.bg }}>
                    <p className="text-sm font-bold" style={{ color: LEAD_STATUS_CONFIG[status]?.color }}>{count}</p>
                    <p className="text-[9px] uppercase tracking-wider" style={{ color: COLORS.light }}>{status.split(' ')[0]}</p>
                  </div>
                ))}
              </div>
            </Link>
          ))}
        </div>

        {/* Combined Status Bar */}
        <div className="mat-card p-6 mt-5">
          <p className="text-sm font-semibold mb-4" style={{ color: COLORS.body }}>Combined Lead Pipeline</p>
          <div className="grid grid-cols-5 gap-4">
            {Object.entries(LEAD_STATUS_CONFIG).map(([status, config]) => {
              const Icon = config.icon;
              const count = customers?.combined_by_status?.[status] || 0;
              return (
                <div key={status} className="text-center p-4 rounded-xl transition-shadow hover:shadow-sm" style={{ background: `${config.color}10` }}>
                  <div className="w-10 h-10 mx-auto mb-2 rounded-full flex items-center justify-center" style={{ background: `${config.color}20` }}>
                    <Icon className="w-5 h-5" style={{ color: config.color }} />
                  </div>
                  <p className="text-xl font-bold" style={{ color: config.color }}>{count}</p>
                  <p className="text-[11px]" style={{ color: COLORS.muted }}>{status}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Orders Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-6 rounded-full" style={{ background: COLORS.info }} />
            <h3 className="page-title-cuba text-lg">Orders</h3>
            <span className="text-xs font-semibold px-3 py-1 rounded-full" style={{ background: `${COLORS.info}15`, color: COLORS.info }}>
              {orders?.recent_7_days || 0} this week
            </span>
          </div>
          <Link to="/admin/orders" className="text-sm font-medium flex items-center gap-1 hover:underline" style={{ color: COLORS.primary }}>
            View All <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Order Status Grid */}
        <div className="mat-card p-6 mb-5">
          <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
            {Object.entries(ORDER_STATUS_CONFIG).map(([status, config]) => {
              const Icon = config.icon;
              const count = orders?.by_status?.[status] || 0;
              return (
                <Link to="/admin/orders" key={status} className="text-center p-4 rounded-xl transition-all hover:scale-[1.02]" style={{ background: COLORS.bg }}>
                  <div className="w-12 h-12 mx-auto mb-2.5 rounded-xl flex items-center justify-center" style={{ background: `${config.color}20` }}>
                    <Icon className="w-5 h-5" style={{ color: config.color }} />
                  </div>
                  <p className="text-2xl font-bold" style={{ color: COLORS.dark }}>{count}</p>
                  <p className="text-[11px] font-medium" style={{ color: COLORS.muted }}>{config.label}</p>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Recent Orders Table */}
        {recentOrders.length > 0 && (
          <div className="mat-card overflow-hidden">
            <div className="p-5 pb-3 flex items-center justify-between">
              <p className="text-sm font-semibold" style={{ color: COLORS.dark }}>Recent Orders</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: COLORS.bg }}>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: COLORS.body }}>Order</th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: COLORS.body }}>Customer</th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: COLORS.body }}>Items</th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: COLORS.body }}>Date</th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: COLORS.body }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => {
                  const sc = ORDER_STATUS_CONFIG[order.status] || ORDER_STATUS_CONFIG.pending;
                  return (
                    <tr key={order.id} className="border-b border-[#EFEFEF] hover:bg-[#FAFAFA] transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-[13px]" style={{ color: COLORS.primary }}>{order.order_number}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-[13px]" style={{ color: COLORS.dark }}>{order.doctor_name}</p>
                        <p className="text-[11px]" style={{ color: COLORS.light }}>{order.doctor_phone}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-[13px]" style={{ color: COLORS.body }}>{order.items?.length || 0} items</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-[13px]" style={{ color: COLORS.body }}>{formatDate(order.created_at)}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold" style={{ background: `${sc.color}15`, color: sc.color }}>
                          {sc.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Two Column - Expenses & Pending Items */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Expenses */}
        <div className="mat-card p-6">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-2 h-6 rounded-full" style={{ background: COLORS.danger }} />
            <p className="text-sm font-semibold" style={{ color: COLORS.dark }}>Expenses Overview</p>
          </div>
          <div className="grid grid-cols-3 gap-5 mb-5">
            <div className="p-4 rounded-xl" style={{ background: COLORS.bg }}>
              <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: COLORS.muted }}>This Month</p>
              <p className="text-xl font-bold" style={{ color: COLORS.dark }}>₹{(expenses?.current_month_total || 0).toLocaleString()}</p>
            </div>
            <div className="p-4 rounded-xl" style={{ background: COLORS.bg }}>
              <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: COLORS.muted }}>Last Month</p>
              <p className="text-xl font-bold" style={{ color: COLORS.body }}>₹{(expenses?.previous_month_total || 0).toLocaleString()}</p>
            </div>
            <div className="p-4 rounded-xl" style={{ background: COLORS.bg }}>
              <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: COLORS.muted }}>Change</p>
              <div className="flex items-center gap-1.5">
                {expenses?.change_percent >= 0 ?
                  <ArrowUp className="w-4 h-4" style={{ color: COLORS.danger }} /> :
                  <ArrowDown className="w-4 h-4" style={{ color: COLORS.success }} />
                }
                <p className="text-xl font-bold" style={{ color: expenses?.change_percent >= 0 ? COLORS.danger : COLORS.success }}>
                  {Math.abs(expenses?.change_percent || 0)}%
                </p>
              </div>
            </div>
          </div>
          {expenses?.by_category && Object.keys(expenses.by_category).length > 0 && (
            <div className="space-y-2.5">
              {Object.entries(expenses.by_category).slice(0, 5).map(([cat, amount], idx) => {
                const colors = [COLORS.primary, COLORS.success, COLORS.warning, COLORS.danger, COLORS.info];
                const c = colors[idx % colors.length];
                return (
                  <div key={cat} className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full" style={{ background: c }} />
                    <span className="text-[13px] flex-1" style={{ color: COLORS.body }}>{cat}</span>
                    <span className="text-[13px] font-semibold" style={{ color: COLORS.dark }}>₹{amount.toLocaleString()}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pending Items */}
        <div className="mat-card p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-2 h-6 rounded-full" style={{ background: COLORS.warning }} />
              <p className="text-sm font-semibold" style={{ color: COLORS.dark }}>Pending Items</p>
            </div>
            <span className="text-xs font-semibold px-3 py-1 rounded-full" style={{ background: `${COLORS.warning}15`, color: COLORS.warning }}>
              {pending_items?.total_items || 0} items
            </span>
          </div>
          <div className="text-center mb-5">
            <p className="text-4xl font-bold" style={{ color: COLORS.warning }}>{pending_items?.total_quantity || 0}</p>
            <p className="text-xs" style={{ color: COLORS.muted }}>total quantity pending</p>
          </div>
          {pending_items?.by_item && Object.keys(pending_items.by_item).length > 0 ? (
            <div className="space-y-2.5 max-h-52 overflow-y-auto">
              {Object.entries(pending_items.by_item).map(([item, qty]) => (
                <div key={item} className="flex justify-between items-center p-3 rounded-xl" style={{ background: COLORS.bg }}>
                  <span className="text-[13px] truncate flex-1 mr-3" style={{ color: COLORS.body }}>{item}</span>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: `${COLORS.warning}20`, color: COLORS.warning }}>{qty}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-center py-6" style={{ color: COLORS.light }}>No pending items</p>
          )}
        </div>
      </div>

      {/* Items & Support Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Items Stats */}
        <div className="mat-card p-6">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-2 h-6 rounded-full" style={{ background: COLORS.success }} />
            <p className="text-sm font-semibold" style={{ color: COLORS.dark }}>Items Statistics</p>
          </div>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center p-4 rounded-xl" style={{ background: `${COLORS.success}10` }}>
              <Package className="w-5 h-5 mx-auto mb-1.5" style={{ color: COLORS.success }} />
              <p className="text-xl font-bold" style={{ color: COLORS.success }}>{items?.total || 0}</p>
              <p className="text-[10px] uppercase" style={{ color: COLORS.muted }}>Total</p>
            </div>
            <div className="text-center p-4 rounded-xl" style={{ background: `${COLORS.primary}10` }}>
              <TrendingUp className="w-5 h-5 mx-auto mb-1.5" style={{ color: COLORS.primary }} />
              <p className="text-xl font-bold" style={{ color: COLORS.primary }}>{items?.most_ordered?.length || 0}</p>
              <p className="text-[10px] uppercase" style={{ color: COLORS.muted }}>Top Sellers</p>
            </div>
            <div className="text-center p-4 rounded-xl" style={{ background: `${COLORS.danger}10` }}>
              <AlertTriangle className="w-5 h-5 mx-auto mb-1.5" style={{ color: COLORS.danger }} />
              <p className="text-xl font-bold" style={{ color: COLORS.danger }}>{items?.stale_count || 0}</p>
              <p className="text-[10px] uppercase" style={{ color: COLORS.muted }}>No Orders</p>
            </div>
          </div>
          {items?.most_ordered?.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: COLORS.muted }}>Top Ordered Items</p>
              {items.most_ordered.slice(0, 4).map((item, idx) => (
                <div key={idx} className="flex justify-between items-center p-2.5 rounded-lg" style={{ background: COLORS.bg }}>
                  <span className="text-[13px] truncate flex-1 mr-2" style={{ color: COLORS.body }}>{item.item_name}</span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: `${COLORS.success}20`, color: COLORS.success }}>{item.order_count} orders</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Support Tickets */}
        <div className="mat-card p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-2 h-6 rounded-full" style={{ background: COLORS.warning }} />
              <p className="text-sm font-semibold" style={{ color: COLORS.dark }}>Support Tickets</p>
            </div>
            <span className="text-xs font-semibold px-3 py-1 rounded-full" style={{ background: `${COLORS.warning}15`, color: COLORS.warning }}>
              {support_tickets?.recent_7_days || 0} this week
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {Object.entries(TICKET_STATUS_CONFIG).map(([status, config]) => {
              const Icon = config.icon;
              const count = support_tickets?.by_status?.[status] || 0;
              return (
                <Link to="/admin/support" key={status} className="text-center p-5 rounded-xl transition-all hover:scale-[1.02]" style={{ background: COLORS.bg }}>
                  <div className="w-12 h-12 mx-auto mb-2.5 rounded-full flex items-center justify-center" style={{ background: `${config.color}20` }}>
                    <Icon className="w-5 h-5" style={{ color: config.color }} />
                  </div>
                  <p className="text-2xl font-bold" style={{ color: COLORS.dark }}>{count}</p>
                  <p className="text-[11px] font-medium" style={{ color: COLORS.muted }}>{config.label}</p>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mat-card p-6">
        <p className="text-sm font-semibold mb-5" style={{ color: COLORS.dark }}>Quick Actions</p>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
          {[
            { to: '/admin/doctors', icon: Stethoscope, label: 'Doctors', color: COLORS.primary },
            { to: '/admin/medicals', icon: Store, label: 'Medicals', color: COLORS.success },
            { to: '/admin/agencies', icon: Building2, label: 'Agencies', color: COLORS.info },
            { to: '/admin/items', icon: Package, label: 'Items', color: COLORS.warning },
            { to: '/admin/orders', icon: ShoppingCart, label: 'Orders', color: '#4B4DED' },
            { to: '/admin/support', icon: MessageSquare, label: 'Support', color: COLORS.danger },
          ].map((link) => (
            <Link key={link.to} to={link.to}>
              <div className="flex flex-col items-center gap-2.5 p-4 rounded-xl transition-all hover:scale-[1.03] hover:shadow-sm" style={{ background: COLORS.bg }}>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: `${link.color}20` }}>
                  <link.icon className="w-5 h-5" style={{ color: link.color }} />
                </div>
                <span className="text-xs font-semibold" style={{ color: COLORS.body }}>{link.label}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
