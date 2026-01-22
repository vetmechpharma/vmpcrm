import { useState, useEffect } from 'react';
import { ordersAPI } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { toast } from 'sonner';
import { 
  Loader2, 
  ShoppingCart, 
  RefreshCw, 
  Eye,
  MapPin,
  Monitor,
  Clock,
  User,
  Phone,
  Mail
} from 'lucide-react';
import { formatDateTime } from '../lib/utils';

const STATUS_CONFIG = {
  pending: { color: 'bg-amber-100 text-amber-700', label: 'Pending' },
  confirmed: { color: 'bg-blue-100 text-blue-700', label: 'Confirmed' },
  processing: { color: 'bg-purple-100 text-purple-700', label: 'Processing' },
  completed: { color: 'bg-emerald-100 text-emerald-700', label: 'Completed' },
  cancelled: { color: 'bg-red-100 text-red-700', label: 'Cancelled' },
};

export const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, [statusFilter]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      const response = await ordersAPI.getAll(params);
      setOrders(response.data);
    } catch (error) {
      toast.error('Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      await ordersAPI.updateStatus(orderId, newStatus);
      toast.success('Order status updated');
      fetchOrders();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const viewOrderDetails = (order) => {
    setSelectedOrder(order);
    setShowDetailModal(true);
  };

  return (
    <div className="space-y-6 animate-fade-in" data-testid="orders-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Orders</h1>
          <p className="text-slate-500 mt-1">Manage orders from product showcase</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Orders</SelectItem>
              {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                <SelectItem key={key} value={key}>{config.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={fetchOrders} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
          ) : orders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>Customer</th>
                    <th>Items</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => {
                    const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
                    return (
                      <tr key={order.id}>
                        <td>
                          <span className="font-mono font-medium">{order.order_number}</span>
                        </td>
                        <td>
                          <div>
                            <p className="font-medium text-slate-900">
                              {order.doctor_name || 'Unknown'}
                            </p>
                            <p className="text-sm text-slate-500">{order.doctor_phone}</p>
                          </div>
                        </td>
                        <td>
                          <span className="text-sm">{order.items?.length || 0} items</span>
                        </td>
                        <td>
                          <Select
                            value={order.status}
                            onValueChange={(value) => handleStatusChange(order.id, value)}
                          >
                            <SelectTrigger className="w-32 h-8">
                              <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                                <SelectItem key={key} value={key}>{config.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td>
                          <span className="text-sm text-slate-500">
                            {formatDateTime(order.created_at)}
                          </span>
                        </td>
                        <td>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => viewOrderDetails(order)}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            View
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <ShoppingCart className="w-16 h-16 mb-4" />
              <h3 className="text-lg font-medium">No orders yet</h3>
              <p className="text-sm">Orders from the public showcase will appear here</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Order Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Order Details - {selectedOrder?.order_number}</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-6">
              {/* Customer Info */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Customer Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <User className="w-4 h-4 text-slate-400" />
                    <span className="font-medium">{selectedOrder.doctor_name || 'Unknown'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-slate-400" />
                    <span>{selectedOrder.doctor_phone}</span>
                  </div>
                  {selectedOrder.doctor_email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="w-4 h-4 text-slate-400" />
                      <span>{selectedOrder.doctor_email}</span>
                    </div>
                  )}
                  {selectedOrder.doctor_address && (
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin className="w-4 h-4 text-slate-400 mt-0.5" />
                      <span>{selectedOrder.doctor_address}</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Order Items */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Order Items</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {selectedOrder.items?.map((item, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div>
                          <p className="font-medium">{item.item_name}</p>
                          <p className="text-sm text-slate-500">{item.item_code}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">Qty: {item.quantity}</p>
                          <p className="text-sm text-slate-500">₹{item.rate} / unit</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Device Info */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Submission Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span>Submitted: {formatDateTime(selectedOrder.created_at)}</span>
                  </div>
                  {selectedOrder.ip_address && (
                    <div className="flex items-center gap-2">
                      <Monitor className="w-4 h-4 text-slate-400" />
                      <span>IP: {selectedOrder.ip_address}</span>
                    </div>
                  )}
                  {selectedOrder.location && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-slate-400" />
                      <span>Location: {selectedOrder.location}</span>
                    </div>
                  )}
                  {selectedOrder.device_info && (
                    <div className="flex items-start gap-2">
                      <Monitor className="w-4 h-4 text-slate-400 mt-0.5" />
                      <span className="break-all">Device: {selectedOrder.device_info}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
