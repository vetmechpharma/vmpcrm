import { useState, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { toast } from 'sonner';
import { 
  ShoppingBag, 
  ShoppingCart,
  Package, 
  Clock, 
  CheckCircle, 
  Truck,
  XCircle,
  ChevronRight,
  Calendar,
  MapPin,
  Loader2,
  Trash2,
  Plus,
  Send,
  ArrowLeft
} from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const CustomerOrders = () => {
  const { customer, cart, setCart } = useOutletContext();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [activeTab, setActiveTab] = useState('cart');
  const [orderNote, setOrderNote] = useState('');

  useEffect(() => {
    fetchOrders();
    // Load cart from localStorage if not in context
    if (!cart || cart.length === 0) {
      const savedCart = localStorage.getItem('customerCart');
      if (savedCart) {
        try {
          setCart(JSON.parse(savedCart));
        } catch (e) {
          console.error('Failed to parse cart');
        }
      }
    }
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

  const updateCartItem = (itemId, qtyText) => {
    const newCart = cart.map(item => {
      if (item.id === itemId) {
        return { ...item, quantity_text: qtyText };
      }
      return item;
    });
    setCart(newCart);
    localStorage.setItem('customerCart', JSON.stringify(newCart));
  };

  const removeFromCart = (itemId) => {
    const newCart = cart.filter(item => item.id !== itemId);
    setCart(newCart);
    localStorage.setItem('customerCart', JSON.stringify(newCart));
    toast.success('Item removed from cart');
  };

  const clearCart = () => {
    setCart([]);
    localStorage.removeItem('customerCart');
    toast.success('Cart cleared');
  };

  const submitOrder = async () => {
    if (!cart || cart.length === 0) {
      toast.error('Your cart is empty');
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem('customerToken');
      
      // Prepare order items
      const orderItems = cart.map(item => ({
        item_id: item.item_id || item.id,
        item_code: item.item_code,
        item_name: item.item_name,
        quantity: item.quantity_text || String(item.quantity),
        rate: item.rate,
        gst: item.gst || 0,
        amount: item.amount || (item.quantity * item.rate),
        offer: item.offer,
        special_offer: item.special_offer
      }));

      const orderData = {
        items: orderItems,
        notes: orderNote,
        customer_id: customer?.id,
        customer_name: customer?.name,
        customer_phone: customer?.phone,
        customer_type: customer?.role
      };

      const response = await axios.post(`${API_URL}/api/customer/orders`, orderData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Order placed successfully!');
      
      // Clear cart
      setCart([]);
      localStorage.removeItem('customerCart');
      setOrderNote('');
      
      // Refresh orders and switch to orders tab
      fetchOrders();
      setActiveTab('active');
      
    } catch (error) {
      console.error('Order submission error:', error);
      toast.error(error.response?.data?.detail || 'Failed to place order. Please try again.');
    } finally {
      setSubmitting(false);
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

  const cartTotal = cart?.reduce((sum, item) => {
    const qty = typeof item.quantity === 'number' ? item.quantity : 1;
    return sum + (qty * (item.rate || 0));
  }, 0) || 0;

  const tabs = [
    { id: 'cart', label: `Cart (${cart?.length || 0})`, icon: ShoppingCart },
    { id: 'active', label: 'Active', icon: Clock },
    { id: 'completed', label: 'Completed', icon: CheckCircle },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="px-3 py-4 md:px-6 space-y-4 pb-32" data-testid="customer-orders-page">
      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto">
        {tabs.map((tab) => {
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500'
              }`}
              data-testid={`tab-${tab.id}`}
            >
              <TabIcon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Cart Tab */}
      {activeTab === 'cart' && (
        <div className="space-y-4">
          {!cart || cart.length === 0 ? (
            <Card className="rounded-2xl border-0 shadow-sm">
              <CardContent className="py-12 text-center">
                <ShoppingCart className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                <p className="text-slate-500 mb-4">Your cart is empty</p>
                <Button 
                  onClick={() => navigate('/portal/items')}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Browse Products
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Cart Items */}
              <div className="space-y-2">
                {cart.map((item) => (
                  <Card key={item.id} className="rounded-xl border-0 shadow-sm">
                    <CardContent className="p-3">
                      <div className="flex gap-3">
                        <div className="w-14 h-14 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Package className="w-6 h-6 text-slate-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-slate-800 text-sm line-clamp-1">
                            {item.item_name}
                          </h4>
                          <p className="text-xs text-slate-400">{item.item_code}</p>
                          <div className="flex items-center justify-between mt-1.5">
                            <p className="font-semibold text-emerald-600">₹{item.rate}</p>
                            <input
                              type="text"
                              value={item.quantity_text || String(item.quantity)}
                              onChange={(e) => updateCartItem(item.id, e.target.value)}
                              className="w-20 h-7 px-2 text-xs text-center border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                              placeholder="Qty"
                            />
                          </div>
                          {item.offer && (
                            <p className="text-[10px] text-amber-600 mt-1">{item.offer}</p>
                          )}
                        </div>
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="text-red-400 hover:text-red-600 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Order Note */}
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1.5 block">
                  Order Notes (Optional)
                </label>
                <Textarea
                  value={orderNote}
                  onChange={(e) => setOrderNote(e.target.value)}
                  placeholder="Any special instructions for your order..."
                  className="h-20 text-sm resize-none"
                />
              </div>

              {/* Cart Summary - Items count only */}
              <Card className="rounded-xl border-0 shadow-sm bg-slate-50">
                <CardContent className="p-4">
                  <div className="flex justify-between text-sm font-medium">
                    <span className="text-slate-600">Total Items</span>
                    <span className="text-emerald-600 font-bold">{cart.length} items</span>
                  </div>
                </CardContent>
              </Card>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={clearCart}
                  className="flex-1 h-12 rounded-xl"
                >
                  Clear Cart
                </Button>
                <Button
                  onClick={submitOrder}
                  disabled={submitting || cart.length === 0}
                  className="flex-[2] h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700"
                >
                  {submitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Place Order
                    </>
                  )}
                </Button>
              </div>

              {/* Continue Shopping */}
              <button
                onClick={() => navigate('/portal/items')}
                className="w-full text-center text-sm text-emerald-600 font-medium py-2"
              >
                <ArrowLeft className="w-4 h-4 inline mr-1" />
                Continue Shopping
              </button>
            </>
          )}
        </div>
      )}

      {/* Orders Lists */}
      {activeTab !== 'cart' && (
        <>
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
                    className="rounded-xl border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer active:scale-[0.99]"
                    onClick={() => openOrderDetail(order)}
                    data-testid={`order-${order.id}`}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-semibold text-slate-800 text-sm">
                            #{order.order_number || order.id.slice(-6).toUpperCase()}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-500">
                            <Calendar className="w-3 h-3" />
                            {new Date(order.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-[10px] font-semibold flex items-center gap-1 ${statusConfig.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {statusConfig.label}
                        </span>
                      </div>
                      
                      {/* Items Preview */}
                      <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                        <Package className="w-3.5 h-3.5" />
                        <span>{order.items?.length || 0} items</span>
                      </div>
                      
                      {/* Footer */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                        <p className="text-sm text-slate-600">
                          {order.items?.length || 0} items
                        </p>
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Order Detail Modal */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl mx-4">
          <DialogHeader>
            <DialogTitle className="font-bold">Order Details</DialogTitle>
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
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${config.color}`}>
                      <Icon className="w-3.5 h-3.5" />
                      {config.label}
                    </span>
                  );
                })()}
              </div>

              {/* Order Items */}
              <div>
                <p className="text-sm font-medium text-slate-800 mb-2">Items</p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {(selectedOrder.items || []).map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
                          <Package className="w-4 h-4 text-slate-400" />
                        </div>
                        <div>
                          <p className="text-xs font-medium text-slate-800 line-clamp-1">
                            {item.item_name}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            ₹{item.rate} × {item.quantity}
                          </p>
                        </div>
                      </div>
                      <p className="text-sm font-semibold text-slate-800">
                        ₹{((item.rate || 0) * (parseInt(item.quantity) || 1)).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Order Notes */}
              {selectedOrder.notes && (
                <div className="p-3 bg-amber-50 rounded-lg">
                  <p className="text-xs text-amber-800">
                    <span className="font-medium">Notes:</span> {selectedOrder.notes}
                  </p>
                </div>
              )}

              {/* Order Summary - Items count only */}
              <div className="pt-3 border-t">
                <div className="flex justify-between text-sm font-medium">
                  <span className="text-slate-600">Total Items</span>
                  <span className="text-emerald-600 font-bold">{selectedOrder.items?.length || 0} items</span>
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
