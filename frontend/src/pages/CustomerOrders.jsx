import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { 
  ShoppingBag, 
  Package, 
  Clock, 
  CheckCircle, 
  Truck,
  XCircle,
  ChevronRight,
  Calendar,
  MapPin,
  Loader2
} from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const CustomerOrders = () => {
  const { customer } = useOutletContext();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [activeTab, setActiveTab] = useState('active');

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
      console.error('Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  };

  const openOrderDetail = (order) => {
    setSelectedOrder(order);
    setShowDetail(true);
  };

  const getStatusConfig = (status) => {
    const configs = {
      pending: { 
        icon: Clock, 
        color: 'bg-amber-100 text-amber-700 border-amber-200',
        iconColor: 'text-amber-500',
        label: 'Pending'
      },
      confirmed: { 
        icon: CheckCircle, 
        color: 'bg-blue-100 text-blue-700 border-blue-200',
        iconColor: 'text-blue-500',
        label: 'Confirmed'
      },
      ready_to_despatch: { 
        icon: Package, 
        color: 'bg-purple-100 text-purple-700 border-purple-200',
        iconColor: 'text-purple-500',
        label: 'Ready to Ship'
      },
      shipped: { 
        icon: Truck, 
        color: 'bg-indigo-100 text-indigo-700 border-indigo-200',
        iconColor: 'text-indigo-500',
        label: 'Shipped'
      },
      delivered: { 
        icon: CheckCircle, 
        color: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        iconColor: 'text-emerald-500',
        label: 'Delivered'
      },
      cancelled: { 
        icon: XCircle, 
        color: 'bg-red-100 text-red-700 border-red-200',
        iconColor: 'text-red-500',
        label: 'Cancelled'
      }
    };
    return configs[status] || configs.pending;
  };

  const filteredOrders = orders.filter(order => {
    if (activeTab === 'active') {
      return !['delivered', 'cancelled'].includes(order.status);
    }
    if (activeTab === 'completed') {
      return order.status === 'delivered';
    }
    if (activeTab === 'cancelled') {
      return order.status === 'cancelled';
    }
    return true;
  });

  const tabs = [
    { id: 'active', label: 'Active' },
    { id: 'completed', label: 'Completed' },
    { id: 'cancelled', label: 'Cancelled' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="px-4 py-6 md:px-6 space-y-4">
      {/* Tabs */}
      <div className="flex gap-2 bg-slate-100 p-1 rounded-xl">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500'
            }`}
            data-testid={`tab-${tab.id}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardContent className="py-12 text-center">
            <ShoppingBag className="w-16 h-16 mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500">No {activeTab} orders</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const statusConfig = getStatusConfig(order.status);
            const StatusIcon = statusConfig.icon;
            
            return (
              <Card 
                key={order.id}
                className="rounded-2xl border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer active:scale-[0.98]"
                onClick={() => openOrderDetail(order)}
                data-testid={`order-${order.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold text-slate-800">
                        #{order.order_number || order.id.slice(-6).toUpperCase()}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                        <Calendar className="w-3 h-3" />
                        {new Date(order.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${statusConfig.color}`}>
                      <StatusIcon className="w-3 h-3" />
                      {statusConfig.label}
                    </span>
                  </div>
                  
                  {/* Items Preview */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex -space-x-2">
                      {(order.items || []).slice(0, 3).map((item, idx) => (
                        <div key={idx} className="w-8 h-8 bg-slate-100 rounded-lg border-2 border-white flex items-center justify-center">
                          <Package className="w-4 h-4 text-slate-400" />
                        </div>
                      ))}
                      {(order.items?.length || 0) > 3 && (
                        <div className="w-8 h-8 bg-slate-200 rounded-lg border-2 border-white flex items-center justify-center">
                          <span className="text-xs text-slate-600 font-medium">+{order.items.length - 3}</span>
                        </div>
                      )}
                    </div>
                    <span className="text-sm text-slate-500">
                      {order.items?.length || 0} items
                    </span>
                  </div>
                  
                  {/* Footer */}
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <p className="text-lg font-bold text-emerald-600">
                      ₹{order.total_amount?.toLocaleString()}
                    </p>
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Order Detail Modal */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-bold" style={{ fontFamily: 'Manrope, sans-serif' }}>
              Order Details
            </DialogTitle>
          </DialogHeader>
          
          {selectedOrder && (
            <div className="space-y-4">
              {/* Status */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-800">
                    #{selectedOrder.order_number || selectedOrder.id.slice(-6).toUpperCase()}
                  </p>
                  <p className="text-xs text-slate-500">
                    {new Date(selectedOrder.created_at).toLocaleString()}
                  </p>
                </div>
                {(() => {
                  const config = getStatusConfig(selectedOrder.status);
                  const Icon = config.icon;
                  return (
                    <span className={`px-3 py-1.5 rounded-full text-sm font-semibold flex items-center gap-1.5 ${config.color}`}>
                      <Icon className="w-4 h-4" />
                      {config.label}
                    </span>
                  );
                })()}
              </div>

              {/* Shipping Info */}
              {selectedOrder.shipping_address && (
                <div className="p-3 bg-slate-50 rounded-xl">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-slate-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-slate-800">Delivery Address</p>
                      <p className="text-sm text-slate-600">{selectedOrder.shipping_address}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Order Items */}
              <div>
                <p className="font-medium text-slate-800 mb-2">Items ({selectedOrder.items?.length || 0})</p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {(selectedOrder.items || []).map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                          <Package className="w-5 h-5 text-slate-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-800 line-clamp-1">
                            {item.item_name}
                          </p>
                          <p className="text-xs text-slate-500">
                            ₹{item.rate} × {item.quantity}
                          </p>
                        </div>
                      </div>
                      <p className="font-semibold text-slate-800">
                        ₹{(item.rate * item.quantity).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Order Summary */}
              <div className="pt-3 border-t space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Subtotal</span>
                  <span className="text-slate-800">₹{selectedOrder.subtotal?.toLocaleString() || selectedOrder.total_amount?.toLocaleString()}</span>
                </div>
                {selectedOrder.discount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Discount</span>
                    <span className="text-emerald-600">-₹{selectedOrder.discount?.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold pt-2 border-t">
                  <span className="text-slate-800">Total</span>
                  <span className="text-emerald-600">₹{selectedOrder.total_amount?.toLocaleString()}</span>
                </div>
              </div>

              {/* Payment Status */}
              {selectedOrder.payment_status && (
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                  <span className="text-sm text-slate-600">Payment</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    selectedOrder.payment_status === 'paid' 
                      ? 'bg-emerald-100 text-emerald-700' 
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    {selectedOrder.payment_status === 'paid' ? 'Paid' : 'Pending'}
                  </span>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CustomerOrders;
