import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { dashboardAPI, remindersAPI } from '../lib/api';
import { 
  Users, 
  UserCheck, 
  PhoneCall, 
  Clock, 
  XCircle, 
  CheckCircle,
  Plus,
  ArrowRight,
  ArrowUpRight,
  Loader2,
  Package,
  AlertTriangle,
  TrendingUp,
  ShoppingCart,
  Truck,
  Receipt,
  TrendingDown,
  Bell,
  Store,
  Building2,
  Stethoscope,
  BarChart3,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Timer,
  XOctagon,
  HelpCircle,
  MessageSquare
} from 'lucide-react';

const LEAD_STATUS_CONFIG = {
  'Customer': { color: '#28C76F', icon: UserCheck },
  'Contacted': { color: '#00CFE8', icon: PhoneCall },
  'Pipeline': { color: '#FF9F43', icon: Clock },
  'Not Interested': { color: '#A8AAAE', icon: XCircle },
  'Closed': { color: '#EA5455', icon: CheckCircle },
};

const ORDER_STATUS_CONFIG = {
  'pending': { color: '#FF9F43', label: 'Pending', icon: Clock },
  'confirmed': { color: '#00CFE8', label: 'Confirmed', icon: CheckCircle2 },
  'ready_to_despatch': { color: '#7367F0', label: 'Ready', icon: Package },
  'shipped': { color: '#00CFE8', label: 'Shipped', icon: Truck },
  'delivered': { color: '#28C76F', label: 'Delivered', icon: CheckCircle },
  'cancelled': { color: '#EA5455', label: 'Cancelled', icon: XOctagon },
};

const TICKET_STATUS_CONFIG = {
  'open': { color: '#FF9F43', label: 'Open', icon: AlertCircle },
  'in_progress': { color: '#00CFE8', label: 'In Progress', icon: Timer },
  'resolved': { color: '#28C76F', label: 'Resolved', icon: CheckCircle2 },
  'closed': { color: '#A8AAAE', label: 'Closed', icon: XCircle },
};

// Reusable stat widget matching Materialize template
const StatWidget = ({ icon: Icon, value, label, color, link }) => (
  <Link to={link || '#'} className="mat-card block p-5 group">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-2xl font-bold" style={{ color: '#434050' }}>{value}</p>
        <p className="text-sm mt-1" style={{ color: '#8D8A94' }}>{label}</p>
      </div>
      <div className="w-11 h-11 rounded-lg flex items-center justify-center" style={{ background: `${color}26` }}>
        <Icon className="w-6 h-6" style={{ color }} />
      </div>
    </div>
  </Link>
);

// Section header
const SectionHeader = ({ icon: Icon, title, color, badge, action }) => (
  <div className="flex items-center justify-between mb-5">
    <div className="flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-md flex items-center justify-center" style={{ background: `${color}26` }}>
        <Icon className="w-4.5 h-4.5" style={{ color }} />
      </div>
      <h2 className="text-base font-semibold" style={{ color: '#434050' }}>{title}</h2>
      {badge && (
        <span className="text-xs font-medium px-2.5 py-0.5 rounded-full" style={{ background: `${color}18`, color }}>
          {badge}
        </span>
      )}
    </div>
    {action}
  </div>
);

export const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [todayReminders, setTodayReminders] = useState({ reminders: [], total_count: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    fetchTodayReminders();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await dashboardAPI.getComprehensiveStats();
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTodayReminders = async () => {
    try {
      const response = await remindersAPI.getToday();
      setTodayReminders(response.data);
    } catch (error) {
      console.error('Failed to fetch reminders:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin mx-auto mb-3" style={{ color: '#7367F0' }} />
          <p style={{ color: '#8D8A94' }}>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const { customers, orders, pending_items, expenses, items, support_tickets } = stats || {};

  return (
    <div data-testid="dashboard-page" className="animate-fade-in">
      {/* Top Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatWidget icon={Users} value={customers?.total_all || 0} label="Total Customers" color="#7367F0" link="/admin/doctors" />
        <StatWidget icon={ShoppingCart} value={orders?.total || 0} label="Total Orders" color="#00CFE8" link="/admin/orders" />
        <StatWidget icon={Package} value={items?.total || 0} label="Total Items" color="#28C76F" link="/admin/items" />
        <StatWidget icon={Receipt} value={`₹${(expenses?.current_month_total || 0).toLocaleString()}`} label="This Month Expenses" color="#FF9F43" link="/admin/expenses" />
      </div>

      {/* Alert Banners */}
      {(pending_items?.total_items > 0 || todayReminders.total_count > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {pending_items?.total_items > 0 && (
            <Link to="/admin/pending-items" className="mat-card block overflow-hidden group">
              <div className="flex items-center gap-4 p-5" style={{ background: 'linear-gradient(135deg, #FF9F43 0%, #FFB976 100%)' }}>
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-lg font-bold text-white">
                    {pending_items.total_items} Pending Items
                  </p>
                  <p className="text-white/70 text-sm">{pending_items.total_quantity} qty total</p>
                </div>
                <ArrowRight className="w-5 h-5 text-white/70 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          )}
          {todayReminders.total_count > 0 && (
            <Link to="/admin/reminders" className="mat-card block overflow-hidden group">
              <div className="flex items-center gap-4 p-5" style={{ background: 'linear-gradient(135deg, #7367F0 0%, #9E95F5 100%)' }}>
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                  <Bell className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-lg font-bold text-white">
                    {todayReminders.total_count} Reminder{todayReminders.total_count > 1 ? 's' : ''} Today
                  </p>
                  <p className="text-white/70 text-sm truncate">
                    {todayReminders.reminders.slice(0, 2).map(r => r.title).join(', ')}
                  </p>
                </div>
                <ArrowRight className="w-5 h-5 text-white/70 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          )}
        </div>
      )}

      {/* Customers Section */}
      <div className="mb-6">
        <SectionHeader icon={Users} title="Customers Overview" color="#7367F0" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          {[
            { key: 'doctors', label: 'Doctors', icon: Stethoscope, color: '#7367F0', link: '/admin/doctors' },
            { key: 'medicals', label: 'Medicals', icon: Store, color: '#28C76F', link: '/admin/medicals' },
            { key: 'agencies', label: 'Agencies', icon: Building2, color: '#00CFE8', link: '/admin/agencies' },
          ].map((cat) => (
            <Link key={cat.key} to={cat.link} className="mat-card block p-5 group">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${cat.color}26` }}>
                    <cat.icon className="w-5 h-5" style={{ color: cat.color }} />
                  </div>
                  <div>
                    <p className="font-semibold" style={{ color: '#434050' }}>{cat.label}</p>
                    <p className="text-xl font-bold" style={{ color: cat.color }}>{customers?.[cat.key]?.total || 0}</p>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: '#8D8A94' }} />
              </div>
              <div className="grid grid-cols-5 gap-1">
                {Object.entries(customers?.[cat.key]?.by_status || {}).map(([status, count]) => (
                  <div key={status} className="text-center py-1.5 rounded-md" style={{ background: '#F8F7FA' }}>
                    <p className="text-xs font-bold" style={{ color: LEAD_STATUS_CONFIG[status]?.color }}>{count}</p>
                    <p className="text-[10px]" style={{ color: '#B4B2B7' }}>{status.split(' ')[0]}</p>
                  </div>
                ))}
              </div>
            </Link>
          ))}
        </div>

        {/* Combined Status */}
        <div className="mat-card p-5">
          <p className="text-sm font-medium mb-3" style={{ color: '#5D596C' }}>Combined Lead Status</p>
          <div className="grid grid-cols-5 gap-3">
            {Object.entries(LEAD_STATUS_CONFIG).map(([status, config]) => {
              const Icon = config.icon;
              const count = customers?.combined_by_status?.[status] || 0;
              return (
                <div key={status} className="text-center p-3 rounded-lg" style={{ background: `${config.color}12` }}>
                  <Icon className="w-5 h-5 mx-auto mb-1" style={{ color: config.color }} />
                  <p className="text-lg font-bold" style={{ color: config.color }}>{count}</p>
                  <p className="text-xs" style={{ color: '#8D8A94' }}>{status}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Orders Section */}
      <div className="mb-6">
        <SectionHeader 
          icon={ShoppingCart} 
          title="Orders Status" 
          color="#00CFE8" 
          badge={`${orders?.recent_7_days || 0} this week`}
        />
        <div className="mat-card p-5">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            {Object.entries(ORDER_STATUS_CONFIG).map(([status, config]) => {
              const Icon = config.icon;
              const count = orders?.by_status?.[status] || 0;
              return (
                <Link to="/admin/orders" key={status} className="text-center p-4 rounded-xl hover:shadow-sm transition-shadow cursor-pointer" style={{ background: '#F8F7FA' }}>
                  <div className="w-11 h-11 mx-auto mb-2 rounded-lg flex items-center justify-center" style={{ background: `${config.color}26` }}>
                    <Icon className="w-5 h-5" style={{ color: config.color }} />
                  </div>
                  <p className="text-xl font-bold" style={{ color: '#434050' }}>{count}</p>
                  <p className="text-xs" style={{ color: '#8D8A94' }}>{config.label}</p>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Pending Items & Expenses */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Pending Items */}
        <div className="mat-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-md flex items-center justify-center" style={{ background: '#FF9F4326' }}>
                <AlertTriangle className="w-4 h-4" style={{ color: '#FF9F43' }} />
              </div>
              <p className="font-semibold text-sm" style={{ color: '#434050' }}>Pending Items</p>
            </div>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: '#FF9F4318', color: '#FF9F43' }}>
              {pending_items?.total_items || 0} items
            </span>
          </div>
          <div className="flex items-baseline gap-2 mb-4">
            <p className="text-3xl font-bold" style={{ color: '#FF9F43' }}>{pending_items?.total_quantity || 0}</p>
            <p className="text-sm" style={{ color: '#8D8A94' }}>total qty</p>
          </div>
          {pending_items?.by_item && Object.keys(pending_items.by_item).length > 0 ? (
            <div className="space-y-2 max-h-44 overflow-y-auto">
              {Object.entries(pending_items.by_item).map(([item, qty]) => (
                <div key={item} className="flex justify-between items-center p-2.5 rounded-lg" style={{ background: '#F8F7FA' }}>
                  <span className="text-sm truncate flex-1 mr-2" style={{ color: '#5D596C' }}>{item}</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#FF9F4326', color: '#FF9F43' }}>{qty}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-center py-4" style={{ color: '#B4B2B7' }}>No pending items</p>
          )}
          <Link to="/admin/pending-items" className="block mt-4">
            <button className="w-full py-2 rounded-md text-sm font-medium transition-colors" style={{ background: '#FF9F4318', color: '#FF9F43' }}>
              View All <ArrowRight className="w-3.5 h-3.5 inline ml-1" />
            </button>
          </Link>
        </div>

        {/* Expenses */}
        <div className="mat-card p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-md flex items-center justify-center" style={{ background: '#7367F026' }}>
              <Receipt className="w-4 h-4" style={{ color: '#7367F0' }} />
            </div>
            <p className="font-semibold text-sm" style={{ color: '#434050' }}>Expenses Overview</p>
          </div>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <p className="text-xs mb-1" style={{ color: '#8D8A94' }}>This Month</p>
              <p className="text-xl font-bold" style={{ color: '#434050' }}>₹{(expenses?.current_month_total || 0).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs mb-1" style={{ color: '#8D8A94' }}>Last Month</p>
              <p className="text-xl font-bold" style={{ color: '#5D596C' }}>₹{(expenses?.previous_month_total || 0).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs mb-1" style={{ color: '#8D8A94' }}>Change</p>
              <div className="flex items-center gap-1">
                {expenses?.change_percent >= 0 ? 
                  <TrendingUp className="w-4 h-4" style={{ color: '#EA5455' }} /> : 
                  <TrendingDown className="w-4 h-4" style={{ color: '#28C76F' }} />
                }
                <p className="text-xl font-bold" style={{ color: expenses?.change_percent >= 0 ? '#EA5455' : '#28C76F' }}>
                  {expenses?.change_percent >= 0 ? '+' : ''}{expenses?.change_percent || 0}%
                </p>
              </div>
            </div>
          </div>
          {expenses?.by_category && Object.keys(expenses.by_category).length > 0 && (
            <div>
              <p className="text-xs mb-2" style={{ color: '#8D8A94' }}>By Category</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(expenses.by_category).slice(0, 6).map(([cat, amount]) => (
                  <span key={cat} className="text-xs px-2.5 py-1 rounded-full" style={{ background: '#F8F7FA', color: '#5D596C' }}>
                    {cat}: ₹{amount.toLocaleString()}
                  </span>
                ))}
              </div>
            </div>
          )}
          <Link to="/admin/expenses" className="block mt-4">
            <button className="w-full py-2 rounded-md text-sm font-medium transition-colors" style={{ background: '#7367F018', color: '#7367F0' }}>
              View All <ArrowRight className="w-3.5 h-3.5 inline ml-1" />
            </button>
          </Link>
        </div>
      </div>

      {/* Items Statistics */}
      <div className="mb-6">
        <SectionHeader icon={Package} title="Items Statistics" color="#28C76F" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Overview */}
          <div className="mat-card p-5">
            <p className="text-sm font-medium flex items-center gap-2 mb-4" style={{ color: '#5D596C' }}>
              <BarChart3 className="w-4 h-4" /> Overview
            </p>
            <div className="text-center mb-4">
              <p className="text-4xl font-bold" style={{ color: '#28C76F' }}>{items?.total || 0}</p>
              <p className="text-sm" style={{ color: '#8D8A94' }}>Total Items</p>
            </div>
            {items?.by_main_category && Object.keys(items.by_main_category).length > 0 && (
              <div className="space-y-2">
                {Object.entries(items.by_main_category).map(([cat, count]) => (
                  <div key={cat} className="flex justify-between items-center text-sm">
                    <span style={{ color: '#5D596C' }}>{cat || 'Other'}</span>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: '#F8F7FA', color: '#5D596C' }}>{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Most Ordered */}
          <div className="mat-card p-5">
            <p className="text-sm font-medium flex items-center gap-2 mb-4" style={{ color: '#28C76F' }}>
              <TrendingUp className="w-4 h-4" /> Most Ordered
            </p>
            {items?.most_ordered?.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {items.most_ordered.slice(0, 5).map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center p-2.5 rounded-lg" style={{ background: '#28C76F12' }}>
                    <span className="text-sm truncate flex-1 mr-2" style={{ color: '#5D596C' }}>{item.item_name}</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#28C76F26', color: '#28C76F' }}>{item.order_count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-center py-4" style={{ color: '#B4B2B7' }}>No order data</p>
            )}
          </div>

          {/* Stale Items */}
          <div className="mat-card p-5">
            <p className="text-sm font-medium flex items-center gap-2 mb-4" style={{ color: '#EA5455' }}>
              <Calendar className="w-4 h-4" /> No Orders (30+ days)
            </p>
            <div className="text-center mb-3">
              <p className="text-3xl font-bold" style={{ color: '#EA5455' }}>{items?.stale_count || 0}</p>
              <p className="text-xs" style={{ color: '#8D8A94' }}>items need attention</p>
            </div>
            {items?.no_orders_30_days?.length > 0 ? (
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {items.no_orders_30_days.slice(0, 5).map((item, idx) => (
                  <div key={idx} className="text-xs p-2 rounded-lg truncate" style={{ background: '#EA545512', color: '#5D596C' }}>
                    {item.item_code} - {item.item_name}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-center py-2" style={{ color: '#28C76F' }}>All items ordered recently!</p>
            )}
          </div>
        </div>

        {/* Subcategory */}
        {items?.by_subcategory && Object.keys(items.by_subcategory).length > 0 && (
          <div className="mat-card p-5 mt-4">
            <p className="text-sm font-medium mb-3" style={{ color: '#5D596C' }}>Items by Subcategory</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(items.by_subcategory).map(([subcat, count]) => (
                <span key={subcat} className="text-sm py-1 px-3 rounded-full" style={{ background: '#F8F7FA', color: '#5D596C' }}>
                  {subcat}: {count}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Support Tickets */}
      <div className="mb-6">
        <SectionHeader 
          icon={HelpCircle} 
          title="Support Tickets" 
          color="#FF9F43" 
          badge={`${support_tickets?.recent_7_days || 0} this week`} 
        />
        <div className="mat-card p-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(TICKET_STATUS_CONFIG).map(([status, config]) => {
              const Icon = config.icon;
              const count = support_tickets?.by_status?.[status] || 0;
              return (
                <Link to="/admin/support" key={status} className="text-center p-4 rounded-xl transition-shadow cursor-pointer" style={{ background: '#F8F7FA' }}>
                  <div className="w-11 h-11 mx-auto mb-2 rounded-lg flex items-center justify-center" style={{ background: `${config.color}26` }}>
                    <Icon className="w-5 h-5" style={{ color: config.color }} />
                  </div>
                  <p className="text-xl font-bold" style={{ color: '#434050' }}>{count}</p>
                  <p className="text-xs" style={{ color: '#8D8A94' }}>{config.label}</p>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mat-card p-5">
        <p className="text-sm font-medium mb-4" style={{ color: '#5D596C' }}>Quick Actions</p>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {[
            { to: '/admin/doctors', icon: Stethoscope, label: 'Doctors', color: '#7367F0' },
            { to: '/admin/medicals', icon: Store, label: 'Medicals', color: '#28C76F' },
            { to: '/admin/agencies', icon: Building2, label: 'Agencies', color: '#00CFE8' },
            { to: '/admin/items', icon: Package, label: 'Items', color: '#FF9F43' },
            { to: '/admin/orders', icon: ShoppingCart, label: 'Orders', color: '#7367F0' },
            { to: '/admin/support', icon: MessageSquare, label: 'Support', color: '#EA5455' },
          ].map((link) => (
            <Link key={link.to} to={link.to}>
              <div className="flex flex-col items-center gap-2 p-4 rounded-lg transition-shadow hover:shadow-sm cursor-pointer" style={{ background: '#F8F7FA' }}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${link.color}26` }}>
                  <link.icon className="w-5 h-5" style={{ color: link.color }} />
                </div>
                <span className="text-xs font-medium" style={{ color: '#5D596C' }}>{link.label}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
