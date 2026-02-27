import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { dashboardAPI, remindersAPI } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
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
  Box,
  FileText,
  HelpCircle,
  MessageSquare,
  BarChart3,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Timer,
  XOctagon
} from 'lucide-react';

const LEAD_STATUS_CONFIG = {
  'Customer': { color: '#10b981', icon: UserCheck, bg: 'bg-emerald-50' },
  'Contacted': { color: '#3b82f6', icon: PhoneCall, bg: 'bg-blue-50' },
  'Pipeline': { color: '#f59e0b', icon: Clock, bg: 'bg-amber-50' },
  'Not Interested': { color: '#64748b', icon: XCircle, bg: 'bg-slate-50' },
  'Closed': { color: '#ef4444', icon: CheckCircle, bg: 'bg-red-50' },
};

const ORDER_STATUS_CONFIG = {
  'pending': { color: '#f59e0b', label: 'Pending', icon: Clock },
  'confirmed': { color: '#3b82f6', label: 'Confirmed', icon: CheckCircle2 },
  'ready_to_despatch': { color: '#8b5cf6', label: 'Ready', icon: Package },
  'shipped': { color: '#06b6d4', label: 'Shipped', icon: Truck },
  'delivered': { color: '#10b981', label: 'Delivered', icon: CheckCircle },
  'cancelled': { color: '#ef4444', label: 'Cancelled', icon: XOctagon },
};

const TICKET_STATUS_CONFIG = {
  'open': { color: '#f59e0b', label: 'Open', icon: AlertCircle },
  'in_progress': { color: '#3b82f6', label: 'In Progress', icon: Timer },
  'resolved': { color: '#10b981', label: 'Resolved', icon: CheckCircle2 },
  'closed': { color: '#64748b', label: 'Closed', icon: XCircle },
};

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
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-emerald-500 mx-auto mb-4" />
          <p className="text-slate-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const { customers, orders, pending_items, expenses, items, support_tickets } = stats || {};

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100" data-testid="dashboard-page">
      {/* Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 px-6 py-8">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.3) 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
        <div className="relative max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Business Dashboard</h1>
              <p className="text-emerald-100 text-sm">Complete overview of your operations</p>
            </div>
            <div className="flex gap-3">
              <Link to="/admin/orders">
                <Button variant="secondary" className="bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-sm">
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  Orders
                </Button>
              </Link>
              <Link to="/admin/doctors">
                <Button className="bg-white text-emerald-600 hover:bg-emerald-50">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Doctor
                </Button>
              </Link>
            </div>
          </div>

          {/* Quick Stats in Header */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{customers?.total_all || 0}</p>
                  <p className="text-emerald-100 text-xs">Total Customers</p>
                </div>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <ShoppingCart className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{orders?.total || 0}</p>
                  <p className="text-emerald-100 text-xs">Total Orders</p>
                </div>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <Package className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{items?.total || 0}</p>
                  <p className="text-emerald-100 text-xs">Total Items</p>
                </div>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <Receipt className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">₹{(expenses?.current_month_total || 0).toLocaleString()}</p>
                  <p className="text-emerald-100 text-xs">This Month Expenses</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        
        {/* Alert Banners */}
        <div className="space-y-4 mb-6">
          {/* Pending Items Alert */}
          {pending_items?.total_items > 0 && (
            <Link to="/admin/pending-items" className="block">
              <div className="relative overflow-hidden bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl p-4 shadow-lg hover:shadow-xl transition-all group">
                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                      <AlertTriangle className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-lg font-bold text-white">
                        {pending_items.total_items} Pending Items ({pending_items.total_quantity} qty)
                      </p>
                      <p className="text-orange-100 text-sm">Click to manage pending items</p>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-white" />
                </div>
              </div>
            </Link>
          )}

          {/* Today's Reminders Alert */}
          {todayReminders.total_count > 0 && (
            <Link to="/admin/reminders" className="block">
              <div className="relative overflow-hidden bg-gradient-to-r from-amber-500 to-yellow-500 rounded-xl p-4 shadow-lg hover:shadow-xl transition-all group">
                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                      <Bell className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-lg font-bold text-white">
                        {todayReminders.total_count} Reminder{todayReminders.total_count > 1 ? 's' : ''} Today
                      </p>
                      <p className="text-amber-100 text-sm">
                        {todayReminders.reminders.slice(0, 2).map(r => r.title).join(', ')}
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-white" />
                </div>
              </div>
            </Link>
          )}
        </div>

        {/* Section 1: Customers Stats */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-600" />
            Customers Overview
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
            {/* Doctors Card */}
            <Link to="/admin/doctors">
              <Card className="hover:shadow-md transition-shadow cursor-pointer border-blue-100 bg-blue-50/30">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Stethoscope className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">Doctors</p>
                        <p className="text-2xl font-bold text-blue-600">{customers?.doctors?.total || 0}</p>
                      </div>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="grid grid-cols-5 gap-1">
                    {Object.entries(customers?.doctors?.by_status || {}).map(([status, count]) => (
                      <div key={status} className="text-center">
                        <p className="text-xs font-bold" style={{ color: LEAD_STATUS_CONFIG[status]?.color }}>{count}</p>
                        <p className="text-[10px] text-slate-500 truncate">{status.split(' ')[0]}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* Medicals Card */}
            <Link to="/admin/medicals">
              <Card className="hover:shadow-md transition-shadow cursor-pointer border-emerald-100 bg-emerald-50/30">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                        <Store className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">Medicals</p>
                        <p className="text-2xl font-bold text-emerald-600">{customers?.medicals?.total || 0}</p>
                      </div>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="grid grid-cols-5 gap-1">
                    {Object.entries(customers?.medicals?.by_status || {}).map(([status, count]) => (
                      <div key={status} className="text-center">
                        <p className="text-xs font-bold" style={{ color: LEAD_STATUS_CONFIG[status]?.color }}>{count}</p>
                        <p className="text-[10px] text-slate-500 truncate">{status.split(' ')[0]}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* Agencies Card */}
            <Link to="/admin/agencies">
              <Card className="hover:shadow-md transition-shadow cursor-pointer border-purple-100 bg-purple-50/30">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">Agencies</p>
                        <p className="text-2xl font-bold text-purple-600">{customers?.agencies?.total || 0}</p>
                      </div>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="grid grid-cols-5 gap-1">
                    {Object.entries(customers?.agencies?.by_status || {}).map(([status, count]) => (
                      <div key={status} className="text-center">
                        <p className="text-xs font-bold" style={{ color: LEAD_STATUS_CONFIG[status]?.color }}>{count}</p>
                        <p className="text-[10px] text-slate-500 truncate">{status.split(' ')[0]}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>

          {/* Combined Lead Status */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Combined Lead Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 gap-4">
                {Object.entries(LEAD_STATUS_CONFIG).map(([status, config]) => {
                  const Icon = config.icon;
                  const count = customers?.combined_by_status?.[status] || 0;
                  return (
                    <div key={status} className={`text-center p-3 rounded-lg ${config.bg}`}>
                      <Icon className="w-6 h-6 mx-auto mb-1" style={{ color: config.color }} />
                      <p className="text-xl font-bold" style={{ color: config.color }}>{count}</p>
                      <p className="text-xs text-slate-600">{status}</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Section 2: Orders Stats */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-blue-600" />
            Orders Status
            <Badge variant="outline" className="ml-2">{orders?.recent_7_days || 0} this week</Badge>
          </h2>
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                {Object.entries(ORDER_STATUS_CONFIG).map(([status, config]) => {
                  const Icon = config.icon;
                  const count = orders?.by_status?.[status] || 0;
                  return (
                    <Link to="/admin/orders" key={status} className="text-center p-4 rounded-xl hover:bg-slate-50 transition-colors">
                      <div className="w-12 h-12 mx-auto mb-2 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${config.color}15` }}>
                        <Icon className="w-6 h-6" style={{ color: config.color }} />
                      </div>
                      <p className="text-2xl font-bold text-slate-800">{count}</p>
                      <p className="text-xs text-slate-500">{config.label}</p>
                    </Link>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Section 3 & 4: Pending Items & Expenses */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Pending Items */}
          <div>
            <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
              Pending Items (Qty-wise)
            </h2>
            <Card className="h-full">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-3xl font-bold text-orange-600">{pending_items?.total_quantity || 0}</p>
                    <p className="text-sm text-slate-500">Total Pending Qty</p>
                  </div>
                  <Badge variant="outline" className="text-orange-600 border-orange-200">
                    {pending_items?.total_items || 0} items
                  </Badge>
                </div>
                {pending_items?.by_item && Object.keys(pending_items.by_item).length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {Object.entries(pending_items.by_item).map(([item, qty]) => (
                      <div key={item} className="flex justify-between items-center p-2 bg-orange-50 rounded-lg">
                        <span className="text-sm text-slate-700 truncate flex-1 mr-2">{item}</span>
                        <Badge className="bg-orange-100 text-orange-700">{qty} qty</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 text-center py-4">No pending items</p>
                )}
                <Link to="/admin/pending-items">
                  <Button variant="outline" className="w-full mt-4 text-orange-600 border-orange-200 hover:bg-orange-50">
                    View All Pending Items <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>

          {/* Expenses */}
          <div>
            <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Receipt className="w-5 h-5 text-violet-600" />
              Expenses Overview
            </h2>
            <Card className="h-full">
              <CardContent className="p-4">
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-slate-500">This Month</p>
                    <p className="text-xl font-bold text-slate-800">₹{(expenses?.current_month_total || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Last Month</p>
                    <p className="text-xl font-bold text-slate-600">₹{(expenses?.previous_month_total || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Change</p>
                    <div className={`flex items-center gap-1 ${expenses?.change_percent >= 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {expenses?.change_percent >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                      <p className="text-xl font-bold">{expenses?.change_percent >= 0 ? '+' : ''}{expenses?.change_percent || 0}%</p>
                    </div>
                  </div>
                </div>
                {expenses?.by_category && Object.keys(expenses.by_category).length > 0 && (
                  <div>
                    <p className="text-xs text-slate-500 mb-2">By Category</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(expenses.by_category).slice(0, 6).map(([cat, amount]) => (
                        <Badge key={cat} variant="outline" className="text-xs">
                          {cat}: ₹{amount.toLocaleString()}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                <Link to="/admin/expenses">
                  <Button variant="outline" className="w-full mt-4 text-violet-600 border-violet-200 hover:bg-violet-50">
                    View All Expenses <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Section 5: Items Stats */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Package className="w-5 h-5 text-purple-600" />
            Items Statistics
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Items Overview */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" /> Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center mb-4">
                  <p className="text-4xl font-bold text-purple-600">{items?.total || 0}</p>
                  <p className="text-sm text-slate-500">Total Items</p>
                </div>
                {items?.by_main_category && Object.keys(items.by_main_category).length > 0 && (
                  <div>
                    <p className="text-xs text-slate-500 mb-2">By Main Category</p>
                    <div className="space-y-1">
                      {Object.entries(items.by_main_category).map(([cat, count]) => (
                        <div key={cat} className="flex justify-between items-center text-sm">
                          <span className="text-slate-600">{cat || 'Other'}</span>
                          <Badge variant="secondary">{count}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Most Ordered */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-emerald-600 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" /> Most Ordered
                </CardTitle>
              </CardHeader>
              <CardContent>
                {items?.most_ordered?.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {items.most_ordered.slice(0, 5).map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center p-2 bg-emerald-50 rounded-lg">
                        <span className="text-sm text-slate-700 truncate flex-1 mr-2">{item.item_name}</span>
                        <Badge className="bg-emerald-100 text-emerald-700">{item.order_count}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 text-center py-4">No order data</p>
                )}
              </CardContent>
            </Card>

            {/* Stale Items */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-red-600 flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> No Orders (30+ days)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center mb-3">
                  <p className="text-2xl font-bold text-red-600">{items?.stale_count || 0}</p>
                  <p className="text-xs text-slate-500">items need attention</p>
                </div>
                {items?.no_orders_30_days?.length > 0 ? (
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {items.no_orders_30_days.slice(0, 5).map((item, idx) => (
                      <div key={idx} className="text-xs text-slate-600 p-1 bg-red-50 rounded truncate">
                        {item.item_code} - {item.item_name}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-emerald-600 text-center py-2">All items ordered recently!</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Subcategory Stats */}
          {items?.by_subcategory && Object.keys(items.by_subcategory).length > 0 && (
            <Card className="mt-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">Items by Subcategory</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(items.by_subcategory).map(([subcat, count]) => (
                    <Badge key={subcat} variant="outline" className="text-sm py-1 px-3">
                      {subcat}: {count}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Section 6: Support Tickets */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-cyan-600" />
            Support Tickets
            <Badge variant="outline" className="ml-2">{support_tickets?.recent_7_days || 0} this week</Badge>
          </h2>
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(TICKET_STATUS_CONFIG).map(([status, config]) => {
                  const Icon = config.icon;
                  const count = support_tickets?.by_status?.[status] || 0;
                  return (
                    <Link to="/admin/support" key={status} className="text-center p-4 rounded-xl hover:bg-slate-50 transition-colors border">
                      <div className="w-12 h-12 mx-auto mb-2 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${config.color}15` }}>
                        <Icon className="w-6 h-6" style={{ color: config.color }} />
                      </div>
                      <p className="text-2xl font-bold text-slate-800">{count}</p>
                      <p className="text-xs text-slate-500">{config.label}</p>
                    </Link>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Links */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {[
                { to: '/doctors', icon: Stethoscope, label: 'Doctors', color: 'blue' },
                { to: '/medicals', icon: Store, label: 'Medicals', color: 'emerald' },
                { to: '/agencies', icon: Building2, label: 'Agencies', color: 'purple' },
                { to: '/items', icon: Package, label: 'Items', color: 'amber' },
                { to: '/orders', icon: ShoppingCart, label: 'Orders', color: 'cyan' },
                { to: '/support', icon: MessageSquare, label: 'Support', color: 'rose' },
              ].map((link) => (
                <Link key={link.to} to={link.to}>
                  <Button variant="outline" className={`w-full h-auto py-4 flex-col gap-2 hover:bg-${link.color}-50 hover:border-${link.color}-200`}>
                    <link.icon className={`w-6 h-6 text-${link.color}-600`} />
                    <span className="text-xs">{link.label}</span>
                  </Button>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
