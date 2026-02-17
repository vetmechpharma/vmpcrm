import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Package, ShoppingBag, ListTodo, LifeBuoy, Clock, CheckCircle } from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const CustomerDashboard = () => {
  const { customer } = useOutletContext();
  const [stats, setStats] = useState({
    ordersCount: 0,
    pendingOrders: 0,
    tasksCount: 0,
    openTickets: 0
  });
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('customerToken');
      const [ordersRes, tasksRes, ticketsRes] = await Promise.all([
        axios.get(`${API_URL}/api/customer/orders`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_URL}/api/customer/tasks`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_URL}/api/customer/tickets`, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      const orders = ordersRes.data || [];
      const tasks = tasksRes.data || [];
      const tickets = ticketsRes.data || [];

      setStats({
        ordersCount: orders.length,
        pendingOrders: orders.filter(o => o.status === 'pending').length,
        tasksCount: tasks.filter(t => t.status !== 'completed').length,
        openTickets: tickets.filter(t => t.status !== 'closed' && t.status !== 'resolved').length
      });

      setRecentOrders(orders.slice(0, 5));
    } catch (error) {
      console.error('Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      confirmed: 'bg-blue-100 text-blue-800',
      ready_to_despatch: 'bg-purple-100 text-purple-800',
      shipped: 'bg-indigo-100 text-indigo-800',
      delivered: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    return <Badge className={colors[status] || 'bg-slate-100'}>{status.replace(/_/g, ' ')}</Badge>;
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Welcome, {customer?.name}!</h1>
        <p className="text-slate-500">Here's an overview of your account</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <ShoppingBag className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.ordersCount}</p>
                <p className="text-sm text-slate-500">Total Orders</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.pendingOrders}</p>
                <p className="text-sm text-slate-500">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <ListTodo className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.tasksCount}</p>
                <p className="text-sm text-slate-500">Active Tasks</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <LifeBuoy className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.openTickets}</p>
                <p className="text-sm text-slate-500">Open Tickets</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Orders</CardTitle>
        </CardHeader>
        <CardContent>
          {recentOrders.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <ShoppingBag className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p>No orders yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <p className="font-medium">{order.order_number}</p>
                    <p className="text-sm text-slate-500">
                      {order.items?.length || 0} items • {new Date(order.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  {getStatusBadge(order.status)}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CustomerDashboard;
