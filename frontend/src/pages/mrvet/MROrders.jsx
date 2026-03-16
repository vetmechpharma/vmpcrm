import { useState, useEffect, useMemo } from 'react';
import { mrAPI } from '../../context/MRAuthContext';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Textarea } from '../../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { toast } from 'sonner';
import { Loader2, ShoppingCart, Plus, Minus, Search, Trash2, Send, X, Package } from 'lucide-react';
import { formatDate } from '../../lib/utils';

const statusColors = {
  pending: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-blue-100 text-blue-700',
  dispatched: 'bg-purple-100 text-purple-700',
  delivered: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700',
};

export default function MROrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelOrder, setCancelOrder] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  // Order form state
  const [customers, setCustomers] = useState([]);
  const [items, setItems] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [cart, setCart] = useState([]);
  const [itemSearch, setItemSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [step, setStep] = useState(1); // 1: customer, 2: items, 3: review

  useEffect(() => { fetchOrders(); }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try { const res = await mrAPI.getOrders(); setOrders(res.data); }
    catch { /* silent */ }
    finally { setLoading(false); }
  };

  const openOrderForm = async () => {
    setStep(1); setSelectedCustomer(null); setCart([]); setOrderNotes(''); setItemSearch(''); setCustomerSearch('');
    setShowOrderForm(true);
    try {
      const [custRes, itemRes] = await Promise.all([mrAPI.getCustomers({}), mrAPI.getItems({})]);
      setCustomers(custRes.data);
      setItems(itemRes.data);
    } catch { toast.error('Failed to load data'); }
  };

  const addToCart = (item) => {
    const existing = cart.find(c => c.item_id === item.id);
    if (existing) {
      setCart(cart.map(c => c.item_id === item.id ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      setCart([...cart, {
        item_id: item.id, item_code: item.item_code || '', item_name: item.name,
        quantity: 1, rate: item.role_pricing?.doctor || item.mrp || 0, mrp: item.mrp || 0,
      }]);
    }
  };

  const updateQty = (itemId, delta) => {
    setCart(cart.map(c => {
      if (c.item_id === itemId) {
        const newQty = Math.max(1, c.quantity + delta);
        return { ...c, quantity: newQty };
      }
      return c;
    }));
  };

  const removeFromCart = (itemId) => { setCart(cart.filter(c => c.item_id !== itemId)); };

  const filteredItems = useMemo(() => {
    if (!itemSearch) return items;
    const s = itemSearch.toLowerCase();
    return items.filter(i => i.name?.toLowerCase().includes(s) || (i.item_code || '').toLowerCase().includes(s));
  }, [items, itemSearch]);

  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return customers;
    const s = customerSearch.toLowerCase();
    return customers.filter(c => c.name?.toLowerCase().includes(s) || (c.phone || '').includes(customerSearch));
  }, [customers, customerSearch]);

  const submitOrder = async () => {
    if (!selectedCustomer || cart.length === 0) return;
    setFormLoading(true);
    try {
      const res = await mrAPI.createOrder({
        customer_id: selectedCustomer.id,
        customer_name: selectedCustomer.name,
        customer_phone: selectedCustomer.phone || '',
        customer_type: selectedCustomer.entity_type,
        items: cart,
        notes: orderNotes,
      });
      toast.success(`Order ${res.data.order_number} created`);
      setShowOrderForm(false);
      fetchOrders();
    } catch (e) { toast.error(e.response?.data?.detail || 'Order failed'); }
    finally { setFormLoading(false); }
  };

  const requestCancel = async () => {
    if (!cancelOrder) return;
    setFormLoading(true);
    try {
      await mrAPI.cancelOrder(cancelOrder.id, { reason: cancelReason });
      toast.success('Cancellation requested');
      setShowCancelModal(false); setCancelOrder(null); setCancelReason('');
      fetchOrders();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    finally { setFormLoading(false); }
  };

  return (
    <div className="space-y-4" data-testid="mr-orders-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Orders</h1>
          <p className="text-sm text-slate-500">Place and track orders for customers</p>
        </div>
        <Button onClick={openOrderForm} style={{ background: '#1e3a5f' }} data-testid="mr-new-order-btn">
          <ShoppingCart className="w-4 h-4 mr-2" />New Order
        </Button>
      </div>

      {/* Order History */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
      ) : orders.length > 0 ? (
        <div className="space-y-2">
          {orders.map(o => (
            <Card key={o.id} data-testid={`mr-order-${o.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-semibold" style={{ color: '#1e3a5f' }}>{o.order_number}</span>
                      <Badge className={statusColors[o.status] || 'bg-slate-100'}>{o.status}</Badge>
                      {o.cancel_requested && <Badge className="bg-red-50 text-red-600 border-red-200">Cancel Requested</Badge>}
                    </div>
                    <p className="text-sm text-slate-600 mt-1">{o.doctor_name}</p>
                    <p className="text-xs text-slate-400">{(o.items || []).length} item(s) - {formatDate(o.created_at)}</p>
                  </div>
                  {o.status === 'pending' && !o.cancel_requested && (
                    <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => { setCancelOrder(o); setShowCancelModal(true); }} data-testid={`mr-cancel-${o.id}`}>
                      <X className="w-3 h-3 mr-1" />Cancel
                    </Button>
                  )}
                </div>
                {/* Items summary */}
                <div className="mt-2 space-y-0.5">
                  {(o.items || []).slice(0, 3).map((item, i) => (
                    <p key={i} className="text-xs text-slate-500">{item.item_name} x {item.quantity}</p>
                  ))}
                  {(o.items || []).length > 3 && <p className="text-xs text-slate-400">+{o.items.length - 3} more</p>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <Package className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">No orders yet</p>
          <Button variant="outline" className="mt-4" onClick={openOrderForm}>Place Your First Order</Button>
        </div>
      )}

      {/* Order Form Dialog */}
      <Dialog open={showOrderForm} onOpenChange={setShowOrderForm}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {step === 1 && 'Select Customer'}
              {step === 2 && 'Add Products'}
              {step === 3 && 'Review Order'}
            </DialogTitle>
          </DialogHeader>

          {/* Step 1: Customer Selection */}
          {step === 1 && (
            <div className="space-y-3 py-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input placeholder="Search customer..." value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} className="pl-10" data-testid="mr-order-customer-search" />
              </div>
              <div className="max-h-64 overflow-y-auto border rounded-lg">
                {filteredCustomers.map(c => (
                  <button key={c.id} onClick={() => { setSelectedCustomer(c); setStep(2); }}
                    className="w-full text-left px-3 py-2.5 hover:bg-slate-50 border-b last:border-0" data-testid={`mr-order-select-customer-${c.id}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{c.name}</p>
                        <p className="text-xs text-slate-400">{c.phone} - {c.entity_type}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px]">{c.entity_type}</Badge>
                    </div>
                  </button>
                ))}
                {filteredCustomers.length === 0 && <p className="text-center text-sm text-slate-400 py-4">No customers found</p>}
              </div>
            </div>
          )}

          {/* Step 2: Product Selection */}
          {step === 2 && (
            <div className="space-y-3 py-2">
              <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg">
                <p className="text-sm"><strong>{selectedCustomer?.name}</strong> <span className="text-slate-400">({selectedCustomer?.entity_type})</span></p>
                <Button variant="ghost" size="sm" onClick={() => setStep(1)} className="ml-auto text-xs">Change</Button>
              </div>
              
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input placeholder="Search products..." value={itemSearch} onChange={e => setItemSearch(e.target.value)} className="pl-10" data-testid="mr-order-item-search" />
              </div>

              <div className="max-h-48 overflow-y-auto border rounded-lg">
                {filteredItems.slice(0, 30).map(item => {
                  const inCart = cart.find(c => c.item_id === item.id);
                  return (
                    <div key={item.id} className="flex items-center justify-between px-3 py-2 border-b last:border-0 hover:bg-slate-50">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.name}</p>
                        <p className="text-xs text-slate-400">{item.item_code} - MRP: ₹{item.mrp || 0}</p>
                      </div>
                      {inCart ? (
                        <div className="flex items-center gap-1">
                          <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => updateQty(item.id, -1)}><Minus className="w-3 h-3" /></Button>
                          <span className="text-sm font-medium w-6 text-center">{inCart.quantity}</span>
                          <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => updateQty(item.id, 1)}><Plus className="w-3 h-3" /></Button>
                        </div>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => addToCart(item)} data-testid={`mr-order-add-item-${item.id}`}>
                          <Plus className="w-3 h-3 mr-1" />Add
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>

              {cart.length > 0 && (
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-sm font-medium mb-2">Cart ({cart.length} items)</p>
                  {cart.map(c => (
                    <div key={c.item_id} className="flex items-center justify-between text-xs py-1">
                      <span className="truncate flex-1">{c.item_name} x {c.quantity}</span>
                      <button onClick={() => removeFromCart(c.item_id)} className="text-red-500 ml-2"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Review */}
          {step === 3 && (
            <div className="space-y-4 py-2">
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-500">Customer</p>
                <p className="font-medium text-sm">{selectedCustomer?.name} ({selectedCustomer?.entity_type})</p>
                {selectedCustomer?.phone && <p className="text-xs text-slate-400">{selectedCustomer.phone}</p>}
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Order Items</p>
                <div className="border rounded-lg">
                  {cart.map((c, i) => (
                    <div key={c.item_id} className="flex justify-between px-3 py-2 border-b last:border-0 text-sm">
                      <div>
                        <p className="font-medium">{c.item_name}</p>
                        <p className="text-xs text-slate-400">{c.item_code}</p>
                      </div>
                      <span className="text-slate-600">x {c.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Textarea value={orderNotes} onChange={e => setOrderNotes(e.target.value)} placeholder="Any special instructions..." rows={2} data-testid="mr-order-notes" />
              </div>
            </div>
          )}

          <DialogFooter className="flex gap-2">
            {step > 1 && <Button variant="outline" onClick={() => setStep(step - 1)}>Back</Button>}
            {step === 2 && (
              <Button onClick={() => setStep(3)} disabled={cart.length === 0} style={{ background: '#1e3a5f' }} data-testid="mr-order-review-btn">
                Review ({cart.length})
              </Button>
            )}
            {step === 3 && (
              <Button onClick={submitOrder} disabled={formLoading} style={{ background: '#1e3a5f' }} data-testid="mr-order-submit-btn">
                {formLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}Place Order
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Modal */}
      <Dialog open={showCancelModal} onOpenChange={setShowCancelModal}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-red-600">Request Cancellation</DialogTitle></DialogHeader>
          <div className="py-4 space-y-3">
            <p className="text-sm">Cancel order <strong>{cancelOrder?.order_number}</strong> for {cancelOrder?.doctor_name}?</p>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="Reason for cancellation..." rows={2} data-testid="mr-cancel-reason" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelModal(false)}>Close</Button>
            <Button onClick={requestCancel} disabled={formLoading} className="bg-red-600 hover:bg-red-700" data-testid="mr-cancel-submit-btn">
              {formLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Request Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
