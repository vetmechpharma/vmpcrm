import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { dashboardAPI, pendingItemsAPI } from '../lib/api';
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
  Loader2,
  Package,
  AlertTriangle
} from 'lucide-react';
import { getStatusColor, formatDate } from '../lib/utils';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

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
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  const chartData = stats ? Object.entries(stats.by_status).map(([name, value]) => ({
    name,
    value,
    color: STATUS_COLORS[name] || '#64748b',
  })) : [];

  return (
    <div className="space-y-8 animate-fade-in" data-testid="dashboard-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 mt-1">Overview of your doctor leads</p>
        </div>
        <Link to="/doctors">
          <Button data-testid="add-doctor-btn">
            <Plus className="w-4 h-4 mr-2" />
            Add Doctor
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="card-hover" data-testid="stat-total-doctors">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Total Doctors</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">{stats?.total_doctors || 0}</p>
              </div>
              <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-slate-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover" data-testid="stat-customers">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Customers</p>
                <p className="text-3xl font-bold text-emerald-600 mt-1">{stats?.by_status?.Customer || 0}</p>
              </div>
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                <UserCheck className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover" data-testid="stat-pipeline">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">In Pipeline</p>
                <p className="text-3xl font-bold text-amber-600 mt-1">{stats?.by_status?.Pipeline || 0}</p>
              </div>
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                <Clock className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover" data-testid="stat-emails">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Emails (7 days)</p>
                <p className="text-3xl font-bold text-blue-600 mt-1">{stats?.recent_emails || 0}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Mail className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Items Alert */}
      {pendingStats.total_pending_items > 0 && (
        <Link to="/pending-items">
          <Card className="bg-orange-50 border-orange-200 cursor-pointer hover:shadow-md transition-shadow" data-testid="pending-items-alert">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                    <AlertTriangle className="w-6 h-6 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-orange-700">
                      {pendingStats.total_pending_items} Pending Item{pendingStats.total_pending_items > 1 ? 's' : ''} 
                    </p>
                    <p className="text-sm text-orange-600">
                      {pendingStats.doctors_with_pending} doctor{pendingStats.doctors_with_pending > 1 ? 's' : ''} waiting for stock - Follow up required!
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-orange-600" />
              </div>
            </CardContent>
          </Card>
        </Link>
      )}

      {/* Charts and Recent */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution Chart */}
        <Card data-testid="status-chart">
          <CardHeader>
            <CardTitle className="text-lg">Lead Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 && chartData.some(d => d.value > 0) ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, value }) => value > 0 ? `${name}: ${value}` : ''}
                    labelLine={false}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                <Users className="w-12 h-12 mb-2" />
                <p>No data available</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Status Breakdown */}
        <Card data-testid="status-breakdown">
          <CardHeader>
            <CardTitle className="text-lg">Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(STATUS_COLORS).map(([status, color]) => {
                const Icon = STATUS_ICONS[status];
                const count = stats?.by_status?.[status] || 0;
                const total = stats?.total_doctors || 1;
                const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
                
                return (
                  <div key={status} className="flex items-center gap-4">
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${color}20` }}
                    >
                      <Icon className="w-5 h-5" style={{ color }} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-slate-700">{status}</span>
                        <span className="text-sm text-slate-500">{count} ({percentage}%)</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%`, backgroundColor: color }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Doctors */}
      <Card data-testid="recent-doctors">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Recent Doctors</CardTitle>
          <Link to="/doctors">
            <Button variant="ghost" size="sm">
              View All <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {stats?.recent_doctors?.length > 0 ? (
            <div className="space-y-3">
              {stats.recent_doctors.map((doctor) => (
                <div 
                  key={doctor.id}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center">
                      <span className="text-sm font-semibold text-slate-600">
                        {doctor.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{doctor.name}</p>
                      <p className="text-sm text-slate-500">{doctor.customer_code}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={getStatusColor(doctor.lead_status)}>
                      {doctor.lead_status}
                    </Badge>
                    <span className="text-sm text-slate-400">{formatDate(doctor.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400">
              <Users className="w-12 h-12 mx-auto mb-2" />
              <p>No doctors added yet</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
