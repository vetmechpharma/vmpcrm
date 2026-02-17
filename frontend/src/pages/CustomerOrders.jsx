import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { toast } from 'sonner';
import { ShoppingBag, Package, Truck, MapPin, Calendar, Eye, Loader2 } from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const CustomerOrders = () => {
  const { customer } = useOutletContext();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const token = localStorage.getItem('customerToken');
      const response = await axios.get(`${API_URL}/api/customer/orders`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOrders(response.data || []);
    } catch (error) {
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      confirmed: 'bg-blue-100 text-blue-800 border-blue-300',
      ready_to_despatch: 'bg-purple-100 text-purple-800 border-purple-300',
      shipped: 'bg-indigo-100 text-indigo-800 border-indigo-300',
      delivered: 'bg-green-100 text-green-800 border-green-300',
      cancelled: 'bg-red-100 text-red-800 border-red-300'
    };
    return (
      <Badge className={`${styles[status] || 'bg-slate-100'} border`}>
        {status.replace(/_/g, ' ').toUpperCase()}
      </Badge>
    );
  };

  const calculateOrderTotal = (items) => {
    return items.reduce((total, item) => {
      const qty = typeof item.quantity === 'string' && item.quantity.includes('+')
        ? item.quantity.split('+').reduce((sum, q) => sum + parseInt(q.trim()), 0)
        : parseInt(item.quantity) || 0;
      return total + (item.rate * qty);
    }, 0);
  };

  const openDetail = (order) => {
    setSelectedOrder(order);
    setShowDetailModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">My Orders</h1>
        <p className="text-slate-500">Track and view your order history</p>
      </div>

      {orders.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ShoppingBag className="w-16 h-16 mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500 mb-4">You haven't placed any orders yet</p>
            <Button onClick={() => window.location.href = '/customer/items'}>
              Browse Products
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Card key={order.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-semibold text-slate-800">{order.order_number}</span>
                      {getStatusBadge(order.status)}
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-slate-500">
                      <span className="flex items-center gap-1">
                        <Package className="w-4 h-4" />
                        {order.items?.length || 0} items
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {new Date(order.created_at).toLocaleDateString()}
                      </span>
                      {order.transport_name && (
                        <span className="flex items-center gap-1">
                          <Truck className="w-4 h-4" />
                          {order.transport_name}
                        </span>
                      )}
                      {order.delivery_station && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {order.delivery_station}
                        </span>
                      )}
                    </div>
                    {order.tracking_number && (
                      <p className="mt-2 text-sm">
                        <span className="text-slate-500">Tracking:</span>{' '}
                        {order.tracking_url ? (
                          <a href={order.tracking_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                            {order.tracking_number}
                          </a>
                        ) : (
                          <span className="font-medium">{order.tracking_number}</span>
                        )}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm text-slate-500">Total</p>
                      <p className="text-lg font-bold text-slate-800">
                        ₹{calculateOrderTotal(order.items || []).toFixed(2)}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => openDetail(order)}>
                      <Eye className="w-4 h-4 mr-1" />
                      View
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Order Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Order Details - {selectedOrder?.order_number}</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Order Date</p>
                  <p className="font-medium">{new Date(selectedOrder.created_at).toLocaleString()}</p>
                </div>
                {getStatusBadge(selectedOrder.status)}
              </div>

              {selectedOrder.transport_name && (
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-sm text-slate-500 mb-1">Shipping Details</p>
                  <p className="font-medium">{selectedOrder.transport_name}</p>
                  {selectedOrder.tracking_number && (
                    <p className="text-sm">Tracking: {selectedOrder.tracking_number}</p>
                  )}
                  {selectedOrder.delivery_station && (
                    <p className="text-sm">Station: {selectedOrder.delivery_station}</p>
                  )}
                </div>
              )}

              <div>
                <p className="text-sm text-slate-500 mb-2">Items</p>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left p-3">Item</th>
                        <th className="text-center p-3">Qty</th>
                        <th className="text-right p-3">Rate</th>
                        <th className="text-right p-3">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedOrder.items || []).map((item, idx) => {
                        const qty = typeof item.quantity === 'string' && item.quantity.includes('+')
                          ? item.quantity.split('+').reduce((sum, q) => sum + parseInt(q.trim()), 0)
                          : parseInt(item.quantity) || 0;
                        return (
                          <tr key={idx} className="border-t">
                            <td className="p-3">
                              <p className="font-medium">{item.item_name}</p>
                              <p className="text-xs text-slate-500">{item.item_code}</p>
                            </td>
                            <td className="text-center p-3">{item.quantity}</td>
                            <td className="text-right p-3">₹{item.rate}</td>
                            <td className="text-right p-3 font-medium">₹{(item.rate * qty).toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-slate-50">
                      <tr className="border-t">
                        <td colSpan="3" className="p-3 text-right font-medium">Total</td>
                        <td className="p-3 text-right font-bold text-lg">
                          ₹{calculateOrderTotal(selectedOrder.items || []).toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CustomerOrders;
