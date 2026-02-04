import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { dashboardAPI, pendingItemsAPI, expensesAPI } from '../lib/api';
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
  Mail,
  Plus,
  ArrowRight,
  ArrowUpRight,
  Loader2,
  Package,
  AlertTriangle,
  TrendingUp,
  ShoppingCart,
  Truck,
  Calendar,
  Receipt,
  TrendingDown
} from 'lucide-react';
import { getStatusColor, formatDate } from '../lib/utils';

const STATUS_COLORS = {
  'Customer': '#10b981',
  'Contacted': '#3b82f6',
  'Pipeline': '#f59e0b',
  'Not Interested': '#64748b',
  'Closed': '#ef4444',
};

const STATUS_ICONS = {
  'Customer': UserCheck,
  'Contacted': PhoneCall,
  'Pipeline': Clock,
  'Not Interested': XCircle,
  'Closed': CheckCircle,
};

export const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [pendingStats, setPendingStats] = useState({ total_pending_items: 0, doctors_with_pending: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    fetchPendingStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await dashboardAPI.getStats();
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingStats = async () => {
    try {
      const response = await pendingItemsAPI.getStats();
      setPendingStats(response.data);
    } catch (error) {
      console.error('Failed to fetch pending stats:', error);
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

  const totalOrders = stats?.total_orders || 0;
  const totalDoctors = stats?.total_doctors || 0;
  const customers = stats?.by_status?.Customer || 0;
  const pipeline = stats?.by_status?.Pipeline || 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100" data-testid="dashboard-page">
      {/* Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 px-6 py-8 md:py-12">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.3) 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
        <div className="relative max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
                Welcome back! 👋
              </h1>
              <p className="text-emerald-100 text-sm md:text-base">
                Here's what's happening with your business today
              </p>
            </div>
            <div className="flex gap-3">
              <Link to="/orders">
                <Button variant="secondary" className="bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-sm">
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  Orders
                </Button>
              </Link>
              <Link to="/doctors">
                <Button className="bg-white text-emerald-600 hover:bg-emerald-50">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Doctor
                </Button>
              </Link>
            </div>
          </div>

          {/* Quick Stats in Header */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{totalDoctors}</p>
                  <p className="text-emerald-100 text-xs">Total Doctors</p>
                </div>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <UserCheck className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{customers}</p>
                  <p className="text-emerald-100 text-xs">Customers</p>
                </div>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <ShoppingCart className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{totalOrders}</p>
                  <p className="text-emerald-100 text-xs">Total Orders</p>
                </div>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <Clock className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{pipeline}</p>
                  <p className="text-emerald-100 text-xs">In Pipeline</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8 -mt-4">
        {/* Pending Items Alert */}
        {pendingStats.total_pending_items > 0 && (
          <Link to="/pending-items" className="block mb-6">
            <div className="relative overflow-hidden bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl p-5 shadow-lg shadow-orange-500/20 hover:shadow-xl hover:shadow-orange-500/30 transition-all group" data-testid="pending-items-alert">
              <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
              <div className="absolute right-8 bottom-0 w-20 h-20 bg-white/10 rounded-full -mb-10"></div>
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center">
                    <AlertTriangle className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-white">
                      {pendingStats.total_pending_items} Pending Item{pendingStats.total_pending_items > 1 ? 's' : ''} 
                    </p>
                    <p className="text-orange-100 text-sm">
                      {pendingStats.doctors_with_pending} doctor{pendingStats.doctors_with_pending > 1 ? 's' : ''} waiting for stock
                    </p>
                  </div>
                </div>
                <div className="bg-white/20 rounded-full p-2 group-hover:bg-white/30 transition-colors">
                  <ArrowRight className="w-5 h-5 text-white" />
                </div>
              </div>
            </div>
          </Link>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* Lead Status Card */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden" data-testid="status-breakdown">
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">Lead Status Overview</h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {Object.entries(STATUS_COLORS).map(([status, color]) => {
                  const Icon = STATUS_ICONS[status];
                  const count = stats?.by_status?.[status] || 0;
                  const total = stats?.total_doctors || 1;
                  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
                  
                  return (
                    <div 
                      key={status} 
                      className="relative group cursor-pointer"
                    >
                      <div 
                        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ backgroundColor: `${color}10` }}
                      />
                      <div className="relative p-4 text-center">
                        <div 
                          className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center transition-transform group-hover:scale-110"
                          style={{ backgroundColor: `${color}15` }}
                        >
                          <Icon className="w-6 h-6" style={{ color }} />
                        </div>
                        <p className="text-2xl font-bold text-slate-800">{count}</p>
                        <p className="text-xs text-slate-500 mt-1">{status}</p>
                        <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${percentage}%`, backgroundColor: color }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Quick Actions Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">Quick Actions</h3>
            </div>
            <div className="p-4 space-y-2">
              <Link to="/doctors" className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors group">
                <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Users className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-slate-700 text-sm">Manage Doctors</p>
                  <p className="text-xs text-slate-400">{totalDoctors} doctors</p>
                </div>
                <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 transition-colors" />
              </Link>
              
              <Link to="/orders" className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors group">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <ShoppingCart className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-slate-700 text-sm">View Orders</p>
                  <p className="text-xs text-slate-400">{totalOrders} orders</p>
                </div>
                <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
              </Link>
              
              <Link to="/items" className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors group">
                <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Package className="w-5 h-5 text-purple-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-slate-700 text-sm">Manage Items</p>
                  <p className="text-xs text-slate-400">Products catalog</p>
                </div>
                <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-purple-600 transition-colors" />
              </Link>
              
              <Link to="/showcase" className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors group">
                <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Truck className="w-5 h-5 text-amber-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-slate-700 text-sm">Product Showcase</p>
                  <p className="text-xs text-slate-400">Public ordering page</p>
                </div>
                <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-amber-600 transition-colors" />
              </Link>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Doctors */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden" data-testid="recent-doctors">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">Recent Doctors</h3>
              <Link to="/doctors">
                <Button variant="ghost" size="sm" className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50">
                  View All <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
            <div className="divide-y divide-slate-100">
              {stats?.recent_doctors?.length > 0 ? (
                stats.recent_doctors.slice(0, 5).map((doctor, index) => (
                  <div 
                    key={doctor.id}
                    className="px-6 py-4 hover:bg-slate-50 transition-colors flex items-center gap-4"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                      {doctor.name?.charAt(0)?.toUpperCase() || 'D'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-800 truncate">{doctor.name}</p>
                      <p className="text-xs text-slate-400 truncate">{doctor.mobile}</p>
                    </div>
                    <Badge 
                      variant="secondary"
                      className="text-xs"
                      style={{ 
                        backgroundColor: `${STATUS_COLORS[doctor.status] || '#64748b'}15`,
                        color: STATUS_COLORS[doctor.status] || '#64748b'
                      }}
                    >
                      {doctor.status}
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="px-6 py-12 text-center">
                  <Users className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                  <p className="text-slate-400">No doctors added yet</p>
                  <Link to="/doctors">
                    <Button variant="link" className="text-emerald-600 mt-2">
                      Add your first doctor
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Recent Activity / Tips Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">Activity Summary</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl">
                <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800">{customers} Active Customers</p>
                  <p className="text-sm text-slate-500">
                    {totalDoctors > 0 ? Math.round((customers / totalDoctors) * 100) : 0}% conversion rate
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl">
                <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center">
                  <Mail className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800">{stats?.recent_emails || 0} Emails Sent</p>
                  <p className="text-sm text-slate-500">In the last 7 days</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl">
                <div className="w-12 h-12 bg-amber-500 rounded-xl flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800">{pipeline} In Pipeline</p>
                  <p className="text-sm text-slate-500">Potential customers to follow up</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
