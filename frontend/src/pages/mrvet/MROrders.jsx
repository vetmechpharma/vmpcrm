import { useState, useEffect } from 'react';
import { mrAPI } from '../../context/MRAuthContext';
import { fetchWithOffline, CACHE_KEYS, getCachedCustomers, getCachedItems, getCachedOrders } from '../../lib/offlineData';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Textarea } from '../../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { toast } from 'sonner';
import {
  Loader2, ShoppingCart, Plus, Search, Trash2, Send, X, Package,
  User, AlertTriangle
} from 'lucide-react';
import { formatDate } from '../../lib/utils';

const statusColors = {
  pending: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-blue-100 text-blue-700',
  dispatched: 'bg-purple-100 text-purple-700',
  delivered: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700',
};

const typeColors = {
  doctor: 'bg-blue-100 text-blue-700',
  medical: 'bg-emerald-100 text-emerald-700',
  agency: 'bg-purple-100 text-purple-700',
};

export default function MROrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [saving, setSaving] = useState(false);

  // Order form state
  const [customers, setCustomers] = useState([]);
  const [items, setItems] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [orderItems, setOrderItems] = useState([]);
  const [itemSearch, setItemSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [customerPendingItems, setCustomerPendingItems] = useState([]);

  useEffect(() => { fetchOrders(); }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const result = await fetchWithOffline(() => mrAPI.getOrders(), CACHE_KEYS.orders);
      setOrders(result.data);
      if (result.fromCache) toast.info('Showing offline orders data');
    } catch { setOrders(getCachedOrders()); }
    finally { setLoading(false); }
  };

  const openOrderForm = async () => {
    setSelectedCustomer(null);
    setOrderItems([]);
    setOrderNotes('');
    setItemSearch('');
    setCustomerSearch('');
    setCustomerPendingItems([]);
    setShowOrderForm(true);
    try {
      const [custResult, itemResult] = await Promise.all([
        fetchWithOffline(() => mrAPI.getCustomers({}), CACHE_KEYS.customers),
        fetchWithOffline(() => mrAPI.getItems({}), CACHE_KEYS.items),
      ]);
      setCustomers(custResult.data);
      setItems(itemResult.data);
      if (custResult.fromCache || itemResult.fromCache) {
        toast.info('Using offline cached data');
      }
    } catch {
      // Last resort: try raw localStorage cache
      const cachedCust = getCachedCustomers();
      const cachedItems = getCachedItems();
      if (cachedCust.length > 0 || cachedItems.length > 0) {
        setCustomers(cachedCust);
        setItems(cachedItems);
        toast.info('Using offline cached data');
      } else {
        toast.error('No data available offline. Please connect to internet first.');
      }
    }
  };

  const selectCustomer = (customer) => {
    setSelectedCustomer(customer);
    setCustomerSearch('');
    // Fetch pending items for this customer
    if (customer.phone) {
      mrAPI.getPendingItems(customer.phone)
        .then(res => setCustomerPendingItems(res.data || []))
        .catch(() => setCustomerPendingItems([]));
    }
  };

  const clearCustomer = () => {
    setSelectedCustomer(null);
    setCustomerPendingItems([]);
  };

  // Get the role-based rate for the selected customer type
  const getRoleRate = (item) => {
    if (!selectedCustomer) return item.rate || 0;
    const cType = selectedCustomer.entity_type || 'doctor';
    if (cType === 'medical') return item.rate_medicals || item.rate || 0;
    if (cType === 'agency') return item.rate_agencies || item.rate || 0;
    return item.rate_doctors || item.rate || 0;
  };

  // Item management - same pattern as CRM
  const addItemToOrder = (item) => {
    const existingIdx = orderItems.findIndex(i => i.item_id === item.id);
    if (existingIdx >= 0) {
      const updated = [...orderItems];
      const currentQty = String(updated[existingIdx].quantity);
      const parts = currentQty.split('+').map(p => parseInt(p.trim()) || 0);
      const newQty = (parts[0] || 0) + 1;
      updated[existingIdx].quantity = parts[1] ? `${newQty}+${parts[1]}` : String(newQty);
      updated[existingIdx].outOfStock = false;
      setOrderItems(updated);
    } else {
      const roleRate = getRoleRate(item);
      const cType = selectedCustomer?.entity_type || 'doctor';
      setOrderItems([...orderItems, {
        item_id: item.id,
        item_code: item.item_code || '',
        item_name: item.name || item.item_name || '',
        quantity: '1',
        mrp: item.mrp || 0,
        rate: roleRate,
        defaultRate: roleRate,
        gst: item.gst || 0,
        outOfStock: false,
        previousQty: '1',
        offer: item[`offer_${cType}s`] || item.offer_doctors || item.offer || '',
        special_offer: item[`special_offer_${cType}s`] || item.special_offer_doctors || item.special_offer || '',
      }]);
    }
    setItemSearch('');
  };

  const addPendingItemToOrder = (pendingItem) => {
    const fullItem = items.find(i => i.id === pendingItem.item_id);
    if (fullItem) {
      addItemToOrder(fullItem);
      setTimeout(() => {
        setOrderItems(prev => {
          const updated = [...prev];
          const idx = updated.findIndex(i => i.item_id === pendingItem.item_id);
          if (idx >= 0) updated[idx].quantity = String(pendingItem.quantity);
          return updated;
        });
      }, 0);
    } else {
      setOrderItems(prev => [...prev, {
        item_id: pendingItem.item_id,
        item_code: pendingItem.item_code,
        item_name: pendingItem.item_name,
        quantity: String(pendingItem.quantity),
        mrp: 0, rate: 0, defaultRate: 0, gst: 0,
        outOfStock: false, previousQty: String(pendingItem.quantity),
        offer: '', special_offer: '',
      }]);
    }
    toast.success(`Added pending item: ${pendingItem.item_name}`);
  };

  const updateItemQty = (index, qty) => {
    const qtyStr = String(qty).trim();
    const updated = [...orderItems];
    if (qtyStr === '' || qtyStr === '0') {
      updated[index].quantity = qtyStr;
      updated[index].outOfStock = true;
    } else {
      updated[index].quantity = qtyStr;
      updated[index].outOfStock = false;
    }
    setOrderItems(updated);
  };

  const updateItemRate = (index, rate) => {
    const updated = [...orderItems];
    updated[index].rate = parseFloat(rate) || 0;
    setOrderItems(updated);
  };

  const markOutOfStock = (index) => {
    const updated = [...orderItems];
    updated[index].outOfStock = true;
    updated[index].previousQty = updated[index].quantity;
    updated[index].quantity = '0';
    setOrderItems(updated);
  };

  const restoreItem = (index) => {
    const updated = [...orderItems];
    updated[index].outOfStock = false;
    updated[index].quantity = updated[index].previousQty || '1';
    setOrderItems(updated);
  };

  const removeItem = (index) => { setOrderItems(orderItems.filter((_, i) => i !== index)); };

  const filteredItems = items.filter(item =>
    (item.name || item.item_name || '').toLowerCase().includes(itemSearch.toLowerCase()) ||
    (item.item_code || '').toLowerCase().includes(itemSearch.toLowerCase())
  );

  const filteredCustomers = customers.filter(c => {
    if (!customerSearch) return true;
    const s = customerSearch.toLowerCase();
    return c.name?.toLowerCase().includes(s) || (c.phone || '').includes(customerSearch);
  });

  const submitOrder = async () => {
    if (!selectedCustomer) { toast.error('Select a customer'); return; }
    const availableItems = orderItems.filter(i => !i.outOfStock && i.quantity !== '0' && i.quantity !== '');
    if (availableItems.length === 0) { toast.error('Add at least one available item'); return; }

    setSaving(true);
    try {
      const res = await mrAPI.createOrder({
        customer_id: selectedCustomer.id,
        customer_name: selectedCustomer.name,
        customer_phone: selectedCustomer.phone || '',
        customer_type: selectedCustomer.entity_type,
        items: availableItems.map(i => ({
          item_id: i.item_id, item_code: i.item_code, item_name: i.item_name,
          quantity: String(i.quantity), mrp: i.mrp, rate: i.rate,
        })),
        notes: orderNotes,
      });
      let msg = `Order ${res.data.order_number} created!`;
      const oosCount = orderItems.filter(i => i.outOfStock).length;
      if (oosCount > 0) msg += ` ${oosCount} item(s) marked out of stock.`;
      toast.success(msg);
      setShowOrderForm(false);
      fetchOrders();
    } catch (e) { toast.error(e.response?.data?.detail || 'Order failed'); }
    finally { setSaving(false); }
  };

  const requestCancel = async () => {
    if (!cancelTarget) return;
    setSaving(true);
    try {
      await mrAPI.cancelOrder(cancelTarget.id, { reason: cancelReason });
      toast.success('Cancellation requested');
      setShowCancelModal(false); setCancelTarget(null); setCancelReason('');
      fetchOrders();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-4" data-testid="mr-orders-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Orders</h1>
          <p className="text-sm text-slate-500">Place and track customer orders</p>
        </div>
        <Button onClick={openOrderForm} style={{ background: '#1e3a5f' }} data-testid="mr-new-order-btn">
          <Plus className="w-4 h-4 mr-2" />New Order
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
                    {o.notes && <p className="text-xs text-slate-500 mt-1 line-clamp-1">Notes: {o.notes}</p>}
                  </div>
                  {o.status === 'pending' && !o.cancel_requested && (
                    <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => { setCancelTarget(o); setShowCancelModal(true); }} data-testid={`mr-cancel-${o.id}`}>
                      <X className="w-3 h-3 mr-1" />Cancel
                    </Button>
                  )}
                </div>
                {/* Items list */}
                <div className="mt-2 pt-2 border-t space-y-0.5">
                  {(o.items || []).map((item, i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="text-slate-600">{item.item_name} <span className="text-slate-400">({item.item_code})</span></span>
                      <span className="text-slate-500 font-medium">x {item.quantity}</span>
                    </div>
                  ))}
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

      {/* ========== ORDER FORM DIALOG ========== */}
      <Dialog open={showOrderForm} onOpenChange={setShowOrderForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Plus className="w-5 h-5" />Create New Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">

            {/* ---- Customer Selection ---- */}
            <div className="space-y-3">
              <h4 className="font-medium flex items-center gap-2"><User className="w-4 h-4" />Select Customer</h4>

              {selectedCustomer ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium">{selectedCustomer.name}</p>
                        <p className="text-sm text-slate-600">{selectedCustomer.phone}</p>
                        <Badge className={typeColors[selectedCustomer.entity_type] || 'bg-slate-100 text-slate-700'}>
                          {selectedCustomer.entity_type}
                        </Badge>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={clearCustomer}>Change</Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input placeholder="Search by name or phone..." value={customerSearch}
                      onChange={e => setCustomerSearch(e.target.value)} className="pl-10" data-testid="mr-order-customer-search" />
                  </div>
                  <div className="border rounded-lg max-h-48 overflow-y-auto">
                    {filteredCustomers.slice(0, 15).map(c => (
                      <div key={c.id} className="p-3 hover:bg-slate-50 cursor-pointer flex items-center justify-between border-b last:border-0"
                        onClick={() => selectCustomer(c)} data-testid={`mr-order-select-${c.id}`}>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center">
                            <User className="w-4 h-4 text-slate-600" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{c.name}</p>
                            <p className="text-xs text-slate-500">{c.phone} {c.district && `- ${c.district}`}</p>
                          </div>
                        </div>
                        <Badge className={typeColors[c.entity_type] || 'bg-slate-100'}>{c.entity_type}</Badge>
                      </div>
                    ))}
                    {filteredCustomers.length === 0 && <p className="text-center text-sm text-slate-400 py-4">No customers found</p>}
                  </div>
                </>
              )}
            </div>

            {/* ---- Pending Items for Customer ---- */}
            {customerPendingItems.length > 0 && (
              <div className="space-y-3 border-t pt-4">
                <h4 className="font-medium flex items-center gap-2 text-amber-700">
                  <AlertTriangle className="w-4 h-4" /> Previous Pending Items ({customerPendingItems.length})
                </h4>
                <p className="text-xs text-amber-600">These items were out of stock in previous orders. Add them to fulfill now.</p>
                <div className="border border-amber-200 rounded-lg bg-amber-50 divide-y divide-amber-200 max-h-48 overflow-y-auto">
                  {customerPendingItems.map((pItem) => {
                    const alreadyAdded = orderItems.some(i => i.item_id === pItem.item_id);
                    return (
                      <div key={pItem.id} className="p-3 flex items-center justify-between" data-testid={`mr-pending-item-${pItem.id}`}>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-slate-800">{pItem.item_name}</p>
                          <p className="text-xs text-slate-500">{pItem.item_code} | Qty: {pItem.quantity} | Order: {pItem.original_order_number}</p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={alreadyAdded}
                          onClick={() => addPendingItemToOrder(pItem)}
                          className={alreadyAdded ? 'text-slate-400' : 'text-green-600 border-green-300 hover:bg-green-50'}
                          data-testid={`mr-add-pending-${pItem.id}`}
                        >
                          {alreadyAdded ? 'Added' : <><Plus className="w-3 h-3 mr-1" />Add</>}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ---- Add Items ---- */}
            <div className="space-y-3 border-t pt-4">
              <h4 className="font-medium flex items-center gap-2"><Package className="w-4 h-4" />Order Items</h4>

              {/* Item Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input value={itemSearch} onChange={e => setItemSearch(e.target.value)}
                  placeholder="Search items by name or code..." className="pl-10" data-testid="mr-order-item-search" />
              </div>

              {/* Search Results */}
              {itemSearch && (
                <div className="border rounded-lg max-h-48 overflow-y-auto">
                  {filteredItems.length > 0 ? filteredItems.slice(0, 10).map(item => {
                    const cType = selectedCustomer?.entity_type || 'doctor';
                    const roleRate = getRoleRate(item);
                    const offer = item[`offer_${cType}s`] || item.offer_doctors || item.offer || '';
                    const special = item[`special_offer_${cType}s`] || item.special_offer_doctors || item.special_offer || '';
                    return (
                      <div key={item.id} className="p-3 hover:bg-slate-50 cursor-pointer flex justify-between items-center border-b last:border-0"
                        onClick={() => addItemToOrder(item)} data-testid={`mr-order-add-${item.id}`}>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{item.name || item.item_name}</p>
                          <p className="text-xs text-slate-500">
                            {item.item_code} | MRP: ₹{item.mrp || 0}
                            {roleRate > 0 && <span className="text-blue-600 font-medium"> | Rate: ₹{roleRate}</span>}
                          </p>
                          {(offer || special) && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {offer && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium">{offer}</span>}
                              {special && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-medium">{special}</span>}
                            </div>
                          )}
                        </div>
                        <Plus className="w-4 h-4 text-green-600 shrink-0 ml-2" />
                      </div>
                    );
                  }) : (
                    <p className="p-3 text-sm text-slate-400 text-center">No items found</p>
                  )}
                </div>
              )}

              {/* Selected Items */}
              <div className="space-y-3">
                {orderItems.length > 0 ? (
                  <>
                    {/* Helper text */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-sm text-blue-700">
                        Enter qty as number (10) or with free scheme (10+5). Mark items "Out of Stock" to track for follow-up.
                      </p>
                    </div>

                    {orderItems.map((item, index) => (
                      <div key={index} className={`p-4 rounded-lg border ${item.outOfStock ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}
                        data-testid={`mr-order-item-${index}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-800">{item.item_name}</p>
                            <p className="text-sm text-slate-500">{item.item_code}</p>
                            <div className="flex gap-3 mt-1 text-xs text-slate-600">
                              {item.mrp > 0 && <span>MRP: ₹{item.mrp} (fixed)</span>}
                              {item.gst > 0 && <span>GST: {item.gst}%</span>}
                              {item.defaultRate > 0 && <span className="text-blue-600 font-medium">Default Rate: ₹{item.defaultRate}</span>}
                            </div>
                            {(item.offer || item.special_offer) && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {item.offer && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium">{item.offer}</span>}
                                {item.special_offer && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-medium">{item.special_offer}</span>}
                              </div>
                            )}
                          </div>
                          {!item.outOfStock ? (
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <div className="space-y-1">
                                <Label className="text-xs text-slate-500">Rate (₹)</Label>
                                <Input type="number" value={item.rate || ''}
                                  onChange={e => updateItemRate(index, e.target.value)}
                                  className="w-20 h-9 text-center" placeholder="Rate"
                                  min="0" step="0.01"
                                  data-testid={`mr-order-rate-${index}`} />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs text-slate-500">Qty (e.g. 10+5)</Label>
                                <Input type="text" value={item.quantity}
                                  onChange={e => updateItemQty(index, e.target.value)}
                                  className="w-24 h-9 text-center" placeholder="10 or 10+5"
                                  data-testid={`mr-order-qty-${index}`} />
                              </div>
                              <Button variant="outline" size="sm"
                                onClick={() => markOutOfStock(index)}
                                className="text-orange-600 border-orange-300 hover:bg-orange-50 h-9">
                                Out of Stock
                              </Button>
                              <Button variant="ghost" size="icon" className="h-9 w-9 text-red-500"
                                onClick={() => removeItem(index)} title="Remove item">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Badge className="bg-red-100 text-red-700">Out of Stock</Badge>
                              <Button variant="outline" size="sm"
                                onClick={() => restoreItem(index)}
                                className="text-green-600 border-green-300 hover:bg-green-50">
                                Restore
                              </Button>
                              <Button variant="ghost" size="icon" className="h-9 w-9 text-red-500"
                                onClick={() => removeItem(index)} title="Remove">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                        {item.outOfStock && (
                          <div className="mt-3 pt-3 border-t border-red-200">
                            <p className="text-sm text-red-600 flex items-center gap-1">
                              <AlertTriangle className="w-4 h-4" />
                              This item will be tracked as pending for customer follow-up
                            </p>
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Summary */}
                    <div className="p-3 bg-slate-100 rounded-lg">
                      <p className="text-sm text-slate-600">
                        <strong>{orderItems.filter(i => !i.outOfStock && i.quantity !== '0' && i.quantity !== '').length}</strong> available item(s)
                        {orderItems.filter(i => i.outOfStock).length > 0 && (
                          <>, <strong className="text-orange-600">{orderItems.filter(i => i.outOfStock).length}</strong> out of stock (will be tracked)</>
                        )}
                      </p>
                    </div>
                  </>
                ) : (
                  <p className="text-center py-8 text-slate-400">Search and add items above</p>
                )}
              </div>
            </div>

            {/* ---- Notes ---- */}
            <div className="space-y-2 border-t pt-4">
              <Label>Order Notes</Label>
              <Textarea value={orderNotes} onChange={e => setOrderNotes(e.target.value)}
                placeholder="Any special instructions, delivery notes, etc." rows={3} data-testid="mr-order-notes" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOrderForm(false)}>Cancel</Button>
            <Button onClick={submitOrder} disabled={saving || !selectedCustomer || orderItems.length === 0}
              style={{ background: '#1e3a5f' }} data-testid="mr-order-submit-btn">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}Place Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Modal */}
      <Dialog open={showCancelModal} onOpenChange={setShowCancelModal}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-red-600">Request Cancellation</DialogTitle></DialogHeader>
          <div className="py-4 space-y-3">
            <p className="text-sm">Cancel order <strong>{cancelTarget?.order_number}</strong> for {cancelTarget?.doctor_name}?</p>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)}
                placeholder="Reason for cancellation..." rows={2} data-testid="mr-cancel-reason" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelModal(false)}>Close</Button>
            <Button onClick={requestCancel} disabled={saving} className="bg-red-600 hover:bg-red-700" data-testid="mr-cancel-submit-btn">
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Request Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
