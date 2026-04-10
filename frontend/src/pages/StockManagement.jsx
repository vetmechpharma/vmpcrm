import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { stockAPI, itemsAPI } from '../lib/api';
import {
  Package, Plus, Trash2, Edit2, Search, ArrowUpCircle, ArrowDownCircle,
  FileText, Users, BarChart3, Loader2, X, ChevronDown, ChevronUp
} from 'lucide-react';

// ============== SUPPLIER MANAGEMENT ==============
const SuppliersTab = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', mobile: '', address: '', gst_number: '' });

  const fetchSuppliers = useCallback(async () => {
    try {
      const res = await stockAPI.getSuppliers();
      setSuppliers(res.data);
    } catch { toast.error('Failed to load suppliers'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchSuppliers(); }, [fetchSuppliers]);

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Name is required');
    try {
      if (editing) {
        await stockAPI.updateSupplier(editing.id, form);
        toast.success('Supplier updated');
      } else {
        await stockAPI.createSupplier(form);
        toast.success('Supplier added');
      }
      setShowDialog(false);
      setEditing(null);
      setForm({ name: '', mobile: '', address: '', gst_number: '' });
      fetchSuppliers();
    } catch (e) { toast.error(e.response?.data?.detail || 'Error'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this supplier?')) return;
    try {
      await stockAPI.deleteSupplier(id);
      toast.success('Supplier deleted');
      fetchSuppliers();
    } catch (e) { toast.error(e.response?.data?.detail || 'Cannot delete'); }
  };

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold" data-testid="suppliers-title">Suppliers ({suppliers.length})</h3>
        <Button size="sm" onClick={() => { setEditing(null); setForm({ name: '', mobile: '', address: '', gst_number: '' }); setShowDialog(true); }} data-testid="add-supplier-btn">
          <Plus className="w-4 h-4 mr-1" /> Add Supplier
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left p-3 font-medium">Name</th>
              <th className="text-left p-3 font-medium">Mobile</th>
              <th className="text-left p-3 font-medium">GST</th>
              <th className="text-left p-3 font-medium">Status</th>
              <th className="text-right p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map(s => (
              <tr key={s.id} className="border-t hover:bg-slate-50">
                <td className="p-3 font-medium">{s.name}</td>
                <td className="p-3 text-slate-600">{s.mobile || '-'}</td>
                <td className="p-3 text-slate-600">{s.gst_number || '-'}</td>
                <td className="p-3"><Badge variant={s.status === 'active' ? 'default' : 'secondary'}>{s.status}</Badge></td>
                <td className="p-3 text-right">
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(s); setForm({ name: s.name, mobile: s.mobile || '', address: s.address || '', gst_number: s.gst_number || '' }); setShowDialog(true); }}>
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" className="text-red-500" onClick={() => handleDelete(s.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </td>
              </tr>
            ))}
            {suppliers.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-400">No suppliers added yet</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit Supplier' : 'Add Supplier'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} data-testid="supplier-name-input" /></div>
            <div><Label>Mobile</Label><Input value={form.mobile} onChange={e => setForm({...form, mobile: e.target.value})} data-testid="supplier-mobile-input" /></div>
            <div><Label>Address</Label><Input value={form.address} onChange={e => setForm({...form, address: e.target.value})} /></div>
            <div><Label>GST Number</Label><Input value={form.gst_number} onChange={e => setForm({...form, gst_number: e.target.value.toUpperCase()})} /></div>
          </div>
          <DialogFooter><Button onClick={handleSave} data-testid="save-supplier-btn">{editing ? 'Update' : 'Add'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ============== OPENING BALANCE ==============
const OpeningBalanceTab = () => {
  const [items, setItems] = useState([]);
  const [balances, setBalances] = useState({});
  const [balanceDate, setBalanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [itemDates, setItemDates] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [itemsRes, balRes] = await Promise.all([itemsAPI.getAll(), stockAPI.getOpeningBalances()]);
        setItems(itemsRes.data.sort((a, b) => (a.item_name || '').localeCompare(b.item_name || '')));
        const balMap = {};
        const dateMap = {};
        balRes.data.forEach(b => { 
          balMap[b.item_id] = b.quantity; 
          dateMap[b.item_id] = b.date || new Date().toISOString().split('T')[0];
        });
        setBalances(balMap);
        setItemDates(dateMap);
      } catch { toast.error('Failed to load data'); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const itemsToSave = Object.entries(balances)
        .filter(([_, qty]) => qty > 0)
        .map(([item_id, quantity]) => ({ item_id, quantity, date: itemDates[item_id] || balanceDate }));
      await stockAPI.setOpeningBalanceBulk({ items: itemsToSave, date: balanceDate });
      toast.success(`Opening balance saved for ${itemsToSave.length} items`);
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  const filtered = items.filter(i => 
    !search || (i.item_name || '').toLowerCase().includes(search.toLowerCase()) || (i.item_code || '').toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <Label className="text-xs">Balance Date</Label>
          <Input type="date" value={balanceDate} onChange={e => setBalanceDate(e.target.value)} className="w-40" data-testid="balance-date-input" />
        </div>
        <div className="flex-1 min-w-[200px]">
          <Label className="text-xs">Search Items</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search items..." className="pl-9" />
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving} data-testid="save-opening-balance-btn">
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} Save All
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden max-h-[60vh] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 sticky top-0">
            <tr>
              <th className="text-left p-3 font-medium">Item</th>
              <th className="text-left p-3 font-medium">Code</th>
              <th className="text-center p-3 font-medium w-40">Date</th>
              <th className="text-right p-3 font-medium w-32">Opening Qty</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(item => (
              <tr key={item.id} className="border-t hover:bg-slate-50">
                <td className="p-3">{item.item_name}</td>
                <td className="p-3 text-slate-500">{item.item_code}</td>
                <td className="p-3 text-center">
                  <Input
                    type="date"
                    value={itemDates[item.id] || balanceDate}
                    onChange={e => setItemDates({...itemDates, [item.id]: e.target.value})}
                    className="w-36 text-center mx-auto"
                  />
                </td>
                <td className="p-3 text-right">
                  <Input
                    type="number"
                    min="0"
                    value={balances[item.id] || ''}
                    onChange={e => setBalances({...balances, [item.id]: parseFloat(e.target.value) || 0})}
                    className="w-24 text-right ml-auto"
                    placeholder="0"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ============== PURCHASE ENTRY ==============
const PurchaseTab = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    supplier_id: '', date: new Date().toISOString().split('T')[0], invoice_no: '', notes: '',
    items: [{ item_id: '', quantity: '', purchase_rate: '' }]
  });
  const [returnForm, setReturnForm] = useState({
    supplier_id: '', date: new Date().toISOString().split('T')[0], notes: '',
    items: [{ item_id: '', quantity: '', rate: '' }]
  });

  const fetchData = useCallback(async () => {
    try {
      const [supRes, itemRes, purRes] = await Promise.all([
        stockAPI.getSuppliers(), itemsAPI.getAll(), stockAPI.getPurchases()
      ]);
      setSuppliers(supRes.data.filter(s => s.status === 'active'));
      setAllItems(itemRes.data.sort((a, b) => (a.item_name || '').localeCompare(b.item_name || '')));
      setPurchases(purRes.data);
    } catch { toast.error('Failed to load data'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const addItem = (formType) => {
    if (formType === 'purchase') {
      setForm({...form, items: [...form.items, { item_id: '', quantity: '', purchase_rate: '' }]});
    } else {
      setReturnForm({...returnForm, items: [...returnForm.items, { item_id: '', quantity: '', rate: '' }]});
    }
  };

  const removeItem = (idx, formType) => {
    if (formType === 'purchase') {
      const newItems = form.items.filter((_, i) => i !== idx);
      setForm({...form, items: newItems.length ? newItems : [{ item_id: '', quantity: '', purchase_rate: '' }]});
    } else {
      const newItems = returnForm.items.filter((_, i) => i !== idx);
      setReturnForm({...returnForm, items: newItems.length ? newItems : [{ item_id: '', quantity: '', rate: '' }]});
    }
  };

  const updateItem = (idx, field, value, formType) => {
    if (formType === 'purchase') {
      const newItems = [...form.items];
      newItems[idx] = {...newItems[idx], [field]: value};
      setForm({...form, items: newItems});
    } else {
      const newItems = [...returnForm.items];
      newItems[idx] = {...newItems[idx], [field]: value};
      setReturnForm({...returnForm, items: newItems});
    }
  };

  const handleSavePurchase = async () => {
    if (!form.supplier_id) return toast.error('Select a supplier');
    const validItems = form.items.filter(i => i.item_id && i.quantity > 0);
    if (!validItems.length) return toast.error('Add at least one item');
    setSaving(true);
    try {
      await stockAPI.createPurchase({...form, items: validItems});
      toast.success('Purchase recorded');
      setShowForm(false);
      setForm({ supplier_id: '', date: new Date().toISOString().split('T')[0], invoice_no: '', notes: '', items: [{ item_id: '', quantity: '', purchase_rate: '' }] });
      fetchData();
    } catch (e) { toast.error(e.response?.data?.detail || 'Error'); }
    finally { setSaving(false); }
  };

  const handleSaveReturn = async () => {
    if (!returnForm.supplier_id) return toast.error('Select a supplier');
    const validItems = returnForm.items.filter(i => i.item_id && i.quantity > 0);
    if (!validItems.length) return toast.error('Add at least one item');
    setSaving(true);
    try {
      await stockAPI.createPurchaseReturn({...returnForm, items: validItems});
      toast.success('Purchase return recorded');
      setShowReturnForm(false);
      setReturnForm({ supplier_id: '', date: new Date().toISOString().split('T')[0], notes: '', items: [{ item_id: '', quantity: '', rate: '' }] });
      fetchData();
    } catch (e) { toast.error(e.response?.data?.detail || 'Error'); }
    finally { setSaving(false); }
  };

  const supplierMap = {};
  suppliers.forEach(s => { supplierMap[s.id] = s.name; });

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button size="sm" onClick={() => setShowForm(true)} data-testid="add-purchase-btn">
          <ArrowDownCircle className="w-4 h-4 mr-1" /> New Purchase
        </Button>
        <Button size="sm" variant="outline" onClick={() => setShowReturnForm(true)} data-testid="purchase-return-btn">
          <ArrowUpCircle className="w-4 h-4 mr-1" /> Purchase Return
        </Button>
      </div>

      {/* Purchase History */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left p-3 font-medium">Date</th>
              <th className="text-left p-3 font-medium">Supplier</th>
              <th className="text-left p-3 font-medium">Invoice</th>
              <th className="text-left p-3 font-medium">Item</th>
              <th className="text-right p-3 font-medium">Qty</th>
              <th className="text-right p-3 font-medium">Rate</th>
              <th className="text-left p-3 font-medium">Type</th>
            </tr>
          </thead>
          <tbody>
            {purchases.map(p => (
              <tr key={p.id} className="border-t hover:bg-slate-50">
                <td className="p-3">{p.date}</td>
                <td className="p-3">{supplierMap[p.supplier_id] || p.supplier_id}</td>
                <td className="p-3 text-slate-500">{p.invoice_no || '-'}</td>
                <td className="p-3">{allItems.find(i => i.id === p.item_id)?.item_name || p.item_id}</td>
                <td className="p-3 text-right font-medium">{p.quantity}</td>
                <td className="p-3 text-right">{p.rate || '-'}</td>
                <td className="p-3">
                  <Badge variant={p.type === 'purchase' ? 'default' : 'destructive'}>
                    {p.type === 'purchase' ? 'Purchase' : 'Return'}
                  </Badge>
                </td>
              </tr>
            ))}
            {purchases.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-slate-400">No purchases yet</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Purchase Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Purchase Entry</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Supplier *</Label>
                <Select value={form.supplier_id} onValueChange={v => setForm({...form, supplier_id: v})}>
                  <SelectTrigger data-testid="purchase-supplier-select"><SelectValue placeholder="Select supplier" /></SelectTrigger>
                  <SelectContent>
                    {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Date</Label><Input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Invoice No</Label><Input value={form.invoice_no} onChange={e => setForm({...form, invoice_no: e.target.value})} /></div>
              <div><Label>Notes</Label><Input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
            </div>
            <div>
              <Label className="mb-2 block">Items</Label>
              {form.items.map((item, idx) => (
                <div key={idx} className="flex gap-2 mb-2 items-end">
                  <div className="flex-1">
                    <Select value={item.item_id} onValueChange={v => updateItem(idx, 'item_id', v, 'purchase')}>
                      <SelectTrigger><SelectValue placeholder="Select item" /></SelectTrigger>
                      <SelectContent>
                        {allItems.map(i => <SelectItem key={i.id} value={i.id}>{i.item_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <Input type="number" placeholder="Qty" className="w-20" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value, 'purchase')} />
                  <Input type="number" placeholder="Rate" className="w-24" value={item.purchase_rate} onChange={e => updateItem(idx, 'purchase_rate', e.target.value, 'purchase')} />
                  <Button size="sm" variant="ghost" onClick={() => removeItem(idx, 'purchase')}><X className="w-4 h-4" /></Button>
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={() => addItem('purchase')}><Plus className="w-4 h-4 mr-1" /> Add Item</Button>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSavePurchase} disabled={saving} data-testid="save-purchase-btn">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} Save Purchase
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Purchase Return Dialog */}
      <Dialog open={showReturnForm} onOpenChange={setShowReturnForm}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Purchase Return</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Supplier *</Label>
                <Select value={returnForm.supplier_id} onValueChange={v => setReturnForm({...returnForm, supplier_id: v})}>
                  <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                  <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Date</Label><Input type="date" value={returnForm.date} onChange={e => setReturnForm({...returnForm, date: e.target.value})} /></div>
            </div>
            <div><Label>Notes</Label><Input value={returnForm.notes} onChange={e => setReturnForm({...returnForm, notes: e.target.value})} /></div>
            <div>
              <Label className="mb-2 block">Items</Label>
              {returnForm.items.map((item, idx) => (
                <div key={idx} className="flex gap-2 mb-2 items-end">
                  <div className="flex-1">
                    <Select value={item.item_id} onValueChange={v => updateItem(idx, 'item_id', v, 'return')}>
                      <SelectTrigger><SelectValue placeholder="Select item" /></SelectTrigger>
                      <SelectContent>{allItems.map(i => <SelectItem key={i.id} value={i.id}>{i.item_name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <Input type="number" placeholder="Qty" className="w-20" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value, 'return')} />
                  <Input type="number" placeholder="Rate" className="w-24" value={item.rate} onChange={e => updateItem(idx, 'rate', e.target.value, 'return')} />
                  <Button size="sm" variant="ghost" onClick={() => removeItem(idx, 'return')}><X className="w-4 h-4" /></Button>
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={() => addItem('return')}><Plus className="w-4 h-4 mr-1" /> Add Item</Button>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveReturn} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} Save Return
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ============== SALES RETURN ==============
const SalesReturnTab = () => {
  const [allItems, setAllItems] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerOrders, setCustomerOrders] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [form, setForm] = useState({
    order_id: '', customer_name: '', customer_phone: '', date: new Date().toISOString().split('T')[0], notes: '',
    items: [{ item_id: '', quantity: '', rate: '', gst_percent: 0, sold_rate: 0, sold_qty: 0, order_number: '' }]
  });

  useEffect(() => {
    const load = async () => {
      try {
        const [itemRes] = await Promise.all([itemsAPI.getAll()]);
        setAllItems(itemRes.data.sort((a, b) => (a.item_name || '').localeCompare(b.item_name || '')));
      } catch { /* ignore */ }
    };
    load();
  }, []);

  const searchCustomer = async () => {
    if (!customerSearch.trim()) return;
    setSearchLoading(true);
    try {
      const params = /^\d+$/.test(customerSearch.trim()) 
        ? { phone: customerSearch.trim() } 
        : { name: customerSearch.trim() };
      const res = await stockAPI.getCustomerOrders(params);
      setCustomerOrders(res.data.orders || []);
      if (res.data.orders?.length > 0) {
        const first = res.data.orders[0];
        setForm(f => ({...f, customer_name: first.customer_name, customer_phone: first.customer_phone}));
      } else {
        toast.info('No orders found for this customer');
      }
    } catch { toast.error('Search failed'); }
    finally { setSearchLoading(false); }
  };

  const addOrderItemToReturn = (orderItem) => {
    const itemMaster = allItems.find(i => i.id === orderItem.item_id);
    const gstPct = itemMaster?.gst || 0;
    const newItem = { 
      item_id: orderItem.item_id, 
      quantity: '', 
      rate: orderItem.rate || '', 
      gst_percent: gstPct,
      sold_rate: orderItem.rate || 0, 
      sold_qty: orderItem.quantity || 0, 
      order_number: orderItem.order_number || '' 
    };
    const items = form.items[0]?.item_id ? [...form.items, newItem] : [newItem];
    setForm({...form, items, order_id: orderItem.order_id || form.order_id});
  };

  // Group orders by item for display  
  const itemPurchaseHistory = {};
  customerOrders.forEach(o => {
    if (!itemPurchaseHistory[o.item_id]) itemPurchaseHistory[o.item_id] = { item_name: o.item_name, purchases: [] };
    itemPurchaseHistory[o.item_id].purchases.push(o);
  });

  // Calculate totals
  const calculateItemTotal = (item) => {
    const qty = parseFloat(item.quantity) || 0;
    const rate = parseFloat(item.rate) || 0;
    const gst = parseFloat(item.gst_percent) || 0;
    const base = qty * rate;
    const gstAmt = Math.round(base * gst / 100 * 100) / 100;
    return { base, gstAmt, total: Math.round((base + gstAmt) * 100) / 100 };
  };

  const grandTotal = form.items.reduce((sum, item) => sum + calculateItemTotal(item).total, 0);

  const handleSave = async () => {
    const validItems = form.items.filter(i => i.item_id && parseFloat(i.quantity) > 0);
    if (!validItems.length) return toast.error('Add at least one item with quantity');
    setSaving(true);
    try {
      const res = await stockAPI.createSalesReturn({...form, items: validItems});
      toast.success(res.data.message || 'Sales return recorded');
      setShowForm(false);
      setCustomerOrders([]);
      setCustomerSearch('');
      setForm({ order_id: '', customer_name: '', customer_phone: '', date: new Date().toISOString().split('T')[0], notes: '', items: [{ item_id: '', quantity: '', rate: '', gst_percent: 0, sold_rate: 0, sold_qty: 0, order_number: '' }] });
    } catch (e) { toast.error(e.response?.data?.detail || 'Error'); }
    finally { setSaving(false); }
  };

  const addItem = () => setForm({...form, items: [...form.items, { item_id: '', quantity: '', rate: '', gst_percent: 0, sold_rate: 0, sold_qty: 0, order_number: '' }]});
  const removeItem = (idx) => {
    const newItems = form.items.filter((_, i) => i !== idx);
    setForm({...form, items: newItems.length ? newItems : [{ item_id: '', quantity: '', rate: '', gst_percent: 0, sold_rate: 0, sold_qty: 0, order_number: '' }]});
  };
  const updateItem = (idx, field, value) => {
    const newItems = [...form.items];
    newItems[idx] = {...newItems[idx], [field]: value};
    // Auto-fill GST from item master when item selected
    if (field === 'item_id') {
      const itemMaster = allItems.find(i => i.id === value);
      if (itemMaster) newItems[idx].gst_percent = itemMaster.gst || 0;
    }
    setForm({...form, items: newItems});
  };

  return (
    <div className="space-y-4">
      <Button size="sm" onClick={() => setShowForm(true)} data-testid="sales-return-btn">
        <ArrowUpCircle className="w-4 h-4 mr-1" /> New Sales Return
      </Button>

      <Dialog open={showForm} onOpenChange={v => { setShowForm(v); if (!v) { setCustomerOrders([]); setCustomerSearch(''); } }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Sales Return — Credit Note</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {/* Customer Search */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
              <Label className="text-blue-800 font-medium">Search Customer (by name or phone)</Label>
              <div className="flex gap-2">
                <Input 
                  value={customerSearch} 
                  onChange={e => setCustomerSearch(e.target.value)} 
                  placeholder="Enter customer name or phone..."
                  onKeyDown={e => e.key === 'Enter' && searchCustomer()}
                  className="flex-1"
                  data-testid="sales-return-customer-search"
                />
                <Button size="sm" onClick={searchCustomer} disabled={searchLoading}>
                  {searchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {/* Customer Order History grouped by item */}
            {Object.keys(itemPurchaseHistory).length > 0 && (
              <div className="border rounded-lg overflow-hidden max-h-52 overflow-y-auto">
                <div className="bg-slate-50 px-3 py-2 font-medium text-sm sticky top-0 border-b">
                  Purchase History — Click to add for return (shows sold rate & qty)
                </div>
                {Object.entries(itemPurchaseHistory).map(([itemId, data]) => {
                  const totalQty = data.purchases.reduce((s, p) => s + (p.quantity || 0), 0);
                  return (
                    <div key={itemId} className="border-b last:border-0">
                      <div className="px-3 py-2 bg-slate-50/50 flex justify-between">
                        <span className="font-medium text-sm">{data.item_name}</span>
                        <span className="text-xs text-slate-600">Total bought: <strong>{totalQty}</strong> pcs in {data.purchases.length} order(s)</span>
                      </div>
                      {data.purchases.map((p, i) => (
                        <div key={i} className="px-3 py-1.5 flex items-center justify-between hover:bg-green-50 cursor-pointer text-sm"
                          onClick={() => addOrderItemToReturn(p)}>
                          <span className="text-slate-600">
                            {p.date} — #{p.order_number} — <strong>{p.quantity} pcs</strong> @ <span className="text-blue-700 font-semibold">₹{p.rate}</span>
                            {p.status && <span className="ml-1 text-[10px] px-1 py-0.5 rounded bg-slate-200">{p.status}</span>}
                          </span>
                          <Plus className="w-4 h-4 text-green-600 shrink-0" />
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div><Label>Customer Name</Label><Input value={form.customer_name} onChange={e => setForm({...form, customer_name: e.target.value})} /></div>
              <div><Label>Customer Phone</Label><Input value={form.customer_phone} onChange={e => setForm({...form, customer_phone: e.target.value})} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Order ID</Label><Input value={form.order_id} onChange={e => setForm({...form, order_id: e.target.value})} placeholder="Related order (optional)" /></div>
              <div><Label>Date</Label><Input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} /></div>
            </div>
            <div><Label>Notes</Label><Input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
            
            {/* Items with GST & Amount calculation */}
            <div>
              <Label className="mb-2 block font-medium">Return Items</Label>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left p-2 font-medium">Item</th>
                      <th className="text-center p-2 font-medium w-24">Sold Info</th>
                      <th className="text-center p-2 font-medium w-20">Ret. Qty</th>
                      <th className="text-center p-2 font-medium w-24">Rate</th>
                      <th className="text-center p-2 font-medium w-16">GST%</th>
                      <th className="text-right p-2 font-medium w-24">Amount</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.items.map((item, idx) => {
                      const calc = calculateItemTotal(item);
                      return (
                        <tr key={idx} className="border-t">
                          <td className="p-2">
                            <Select value={item.item_id} onValueChange={v => updateItem(idx, 'item_id', v)}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select item" /></SelectTrigger>
                              <SelectContent>{allItems.map(i => <SelectItem key={i.id} value={i.id}>{i.item_name}</SelectItem>)}</SelectContent>
                            </Select>
                          </td>
                          <td className="p-2 text-center">
                            {item.sold_rate > 0 ? (
                              <div className="text-[10px] leading-tight">
                                <div className="text-blue-700 font-semibold">₹{item.sold_rate} × {item.sold_qty}</div>
                                {item.order_number && <div className="text-slate-400">#{item.order_number}</div>}
                              </div>
                            ) : <span className="text-slate-300 text-xs">—</span>}
                          </td>
                          <td className="p-2"><Input type="number" min="0" className="w-20 h-8 text-center text-xs" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} placeholder="Qty" /></td>
                          <td className="p-2"><Input type="number" className="w-24 h-8 text-center text-xs" value={item.rate} onChange={e => updateItem(idx, 'rate', e.target.value)} placeholder="Rate" /></td>
                          <td className="p-2"><Input type="number" className="w-16 h-8 text-center text-xs" value={item.gst_percent} onChange={e => updateItem(idx, 'gst_percent', e.target.value)} /></td>
                          <td className="p-2 text-right">
                            {calc.total > 0 && (
                              <div className="text-xs">
                                <div className="font-semibold">₹{calc.total.toFixed(2)}</div>
                                {calc.gstAmt > 0 && <div className="text-[10px] text-slate-400">GST: ₹{calc.gstAmt.toFixed(2)}</div>}
                              </div>
                            )}
                          </td>
                          <td className="p-2"><Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => removeItem(idx)}><X className="w-3 h-3" /></Button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between mt-2">
                <Button size="sm" variant="outline" onClick={addItem}><Plus className="w-4 h-4 mr-1" /> Add Item</Button>
                {grandTotal > 0 && (
                  <div className="text-right p-2 bg-green-50 border border-green-200 rounded-lg">
                    <span className="text-sm text-green-800 font-medium">Credit Note Total: </span>
                    <span className="text-lg font-bold text-green-700">₹{grandTotal.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} Save Return {grandTotal > 0 ? `(₹${grandTotal.toFixed(2)})` : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ============== STOCK STATUS REPORT ==============
const StockStatusTab = () => {
  const [stock, setStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('item_name');
  const [sortDir, setSortDir] = useState(1);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await stockAPI.getStockStatus();
        setStock(res.data);
      } catch { toast.error('Failed to load stock'); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  const toggleSort = (field) => {
    if (sortField === field) setSortDir(-sortDir);
    else { setSortField(field); setSortDir(1); }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return null;
    return sortDir === 1 ? <ChevronUp className="w-3 h-3 inline" /> : <ChevronDown className="w-3 h-3 inline" />;
  };

  const filtered = stock
    .filter(s => !search || s.item_name.toLowerCase().includes(search.toLowerCase()) || s.item_code.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const av = a[sortField], bv = b[sortField];
      if (typeof av === 'string') return av.localeCompare(bv) * sortDir;
      return ((av || 0) - (bv || 0)) * sortDir;
    });

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search items..." className="pl-9" />
      </div>

      <div className="border rounded-lg overflow-auto max-h-[65vh]">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 sticky top-0">
            <tr>
              <th className="text-left p-3 font-medium cursor-pointer" onClick={() => toggleSort('item_name')}>Item <SortIcon field="item_name" /></th>
              <th className="text-right p-3 font-medium cursor-pointer" onClick={() => toggleSort('opening_balance')}>Opening <SortIcon field="opening_balance" /></th>
              <th className="text-right p-3 font-medium cursor-pointer" onClick={() => toggleSort('purchased')}>Purchased <SortIcon field="purchased" /></th>
              <th className="text-right p-3 font-medium">Pur.Return</th>
              <th className="text-right p-3 font-medium cursor-pointer" onClick={() => toggleSort('sold')}>Sold <SortIcon field="sold" /></th>
              <th className="text-right p-3 font-medium">Sales Return</th>
              <th className="text-right p-3 font-medium cursor-pointer" onClick={() => toggleSort('closing_balance')}>Closing <SortIcon field="closing_balance" /></th>
              <th className="text-right p-3 font-medium">Purchase Rate</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(s => (
              <tr key={s.item_id} className={`border-t hover:bg-slate-50 ${s.closing_balance <= 0 ? 'bg-red-50' : ''}`}>
                <td className="p-3">
                  <div className="font-medium">{s.item_name}</div>
                  <div className="text-xs text-slate-400">{s.item_code}</div>
                </td>
                <td className="p-3 text-right">{s.opening_balance}</td>
                <td className="p-3 text-right text-green-600">+{s.purchased}</td>
                <td className="p-3 text-right text-orange-500">{s.purchase_returned > 0 ? `-${s.purchase_returned}` : '0'}</td>
                <td className="p-3 text-right text-red-500">{s.sold > 0 ? `-${s.sold}` : '0'}</td>
                <td className="p-3 text-right text-blue-500">{s.sales_returned > 0 ? `+${s.sales_returned}` : '0'}</td>
                <td className={`p-3 text-right font-bold ${s.closing_balance <= 0 ? 'text-red-600' : 'text-green-700'}`}>
                  {s.closing_balance}
                </td>
                <td className="p-3 text-right text-slate-600">{s.last_purchase_rate || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-4 text-xs text-slate-500">
        <span>Total Items: {filtered.length}</span>
        <span className="text-red-500">Zero Stock: {filtered.filter(s => s.closing_balance <= 0).length}</span>
      </div>
    </div>
  );
};

// ============== ITEM LEDGER ==============
const ItemLedgerTab = () => {
  const [allItems, setAllItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState('');
  const [ledger, setLedger] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    itemsAPI.getAll().then(res => setAllItems(res.data.sort((a, b) => (a.item_name || '').localeCompare(b.item_name || ''))));
  }, []);

  const fetchLedger = async (itemId) => {
    if (!itemId) return;
    setLoading(true);
    try {
      const res = await stockAPI.getItemLedger(itemId);
      setLedger(res.data);
    } catch { toast.error('Failed to load ledger'); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <div className="max-w-xs">
        <Label className="text-xs">Select Item</Label>
        <Select value={selectedItem} onValueChange={v => { setSelectedItem(v); fetchLedger(v); }}>
          <SelectTrigger data-testid="item-ledger-select"><SelectValue placeholder="Choose item..." /></SelectTrigger>
          <SelectContent>
            {allItems.map(i => <SelectItem key={i.id} value={i.id}>{i.item_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading && <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>}

      {ledger && !loading && (
        <>
          <div className="flex gap-4">
            <Card className="flex-1"><CardContent className="p-4 text-center">
              <div className="text-xs text-slate-500">Opening</div>
              <div className="text-xl font-bold">{ledger.opening_balance}</div>
            </CardContent></Card>
            <Card className="flex-1"><CardContent className="p-4 text-center">
              <div className="text-xs text-slate-500">Closing</div>
              <div className={`text-xl font-bold ${ledger.closing_balance <= 0 ? 'text-red-600' : 'text-green-700'}`}>{ledger.closing_balance}</div>
            </CardContent></Card>
          </div>

          <div className="border rounded-lg overflow-auto max-h-[50vh]">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="text-left p-3 font-medium">Date</th>
                  <th className="text-left p-3 font-medium">Description</th>
                  <th className="text-right p-3 font-medium text-green-600">Credit</th>
                  <th className="text-right p-3 font-medium text-red-600">Debit</th>
                  <th className="text-right p-3 font-medium">Rate</th>
                  <th className="text-right p-3 font-medium">Balance</th>
                </tr>
              </thead>
              <tbody>
                {ledger.ledger.map((entry, idx) => (
                  <tr key={idx} className="border-t hover:bg-slate-50">
                    <td className="p-3 text-slate-500">{entry.date || '-'}</td>
                    <td className="p-3">{entry.description}</td>
                    <td className="p-3 text-right text-green-600">{entry.credit > 0 ? `+${entry.credit}` : ''}</td>
                    <td className="p-3 text-right text-red-600">{entry.debit > 0 ? `-${entry.debit}` : ''}</td>
                    <td className="p-3 text-right text-slate-500">{entry.rate || ''}</td>
                    <td className="p-3 text-right font-medium">{entry.balance}</td>
                  </tr>
                ))}
                {ledger.ledger.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-400">No transactions</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

// ============== USER LEDGER ==============
const UserLedgerTab = () => {
  const [search, setSearch] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!search.trim()) return toast.error('Enter customer name or phone');
    setLoading(true);
    try {
      const isPhone = /^\d+$/.test(search.trim());
      const params = isPhone ? { customer_phone: search.trim() } : { customer_name: search.trim() };
      const res = await stockAPI.getUserLedger(params);
      setData(res.data);
    } catch { toast.error('Failed to load data'); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 max-w-md">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Customer name or phone..." className="pl-9"
            onKeyDown={e => e.key === 'Enter' && handleSearch()} data-testid="user-ledger-search" />
        </div>
        <Button onClick={handleSearch} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
        </Button>
      </div>

      {data && (
        <>
          {/* Item-wise summary */}
          {data.item_totals && Object.keys(data.item_totals).length > 0 && (
            <div className="border rounded-lg p-4 bg-blue-50">
              <h3 className="font-medium text-sm text-blue-800 mb-2">Item-wise Total Purchased</h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(data.item_totals).map(([itemId, qty]) => {
                  const itemName = data.orders.find(o => o.item_id === itemId)?.item_name || itemId;
                  return (
                    <span key={itemId} className="px-2 py-1 bg-white border rounded text-sm">
                      {itemName}: <strong>{qty}</strong>
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          <div className="border rounded-lg overflow-auto max-h-[60vh]">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="text-left p-3 font-medium">Date</th>
                  <th className="text-left p-3 font-medium">Order</th>
                  <th className="text-left p-3 font-medium">Customer</th>
                  <th className="text-left p-3 font-medium">Item</th>
                  <th className="text-right p-3 font-medium">Qty</th>
                  <th className="text-right p-3 font-medium">Rate</th>
                </tr>
              </thead>
              <tbody>
                {data.orders.map((o, idx) => (
                  <tr key={idx} className="border-t hover:bg-slate-50">
                    <td className="p-3 text-slate-500">{(o.date || '').split('T')[0]}</td>
                    <td className="p-3">{o.order_number || '-'}</td>
                    <td className="p-3">{o.customer_name}</td>
                    <td className="p-3">{o.item_name}</td>
                    <td className="p-3 text-right font-medium">{o.quantity}</td>
                    <td className="p-3 text-right">{o.rate || '-'}</td>
                  </tr>
                ))}
                {(!data.orders || data.orders.length === 0) && <tr><td colSpan={6} className="p-8 text-center text-slate-400">No dispatched orders found</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

// ============== MAIN PAGE ==============
const StockManagement = () => {
  return (
    <div className="space-y-6" data-testid="stock-management-page">
      <div className="flex items-center gap-3">
        <Package className="w-6 h-6 text-indigo-600" />
        <h1 className="text-2xl font-bold text-slate-800">Stock & Inventory</h1>
      </div>

      <Tabs defaultValue="status" className="w-full">
        <TabsList className="grid grid-cols-7 w-full">
          <TabsTrigger value="status" data-testid="tab-stock-status"><BarChart3 className="w-4 h-4 mr-1 hidden sm:inline" /> Status</TabsTrigger>
          <TabsTrigger value="opening" data-testid="tab-opening-balance">Opening</TabsTrigger>
          <TabsTrigger value="purchase" data-testid="tab-purchases">Purchase</TabsTrigger>
          <TabsTrigger value="sales-return" data-testid="tab-sales-return">Sales Return</TabsTrigger>
          <TabsTrigger value="item-ledger" data-testid="tab-item-ledger"><FileText className="w-4 h-4 mr-1 hidden sm:inline" /> Item Ledger</TabsTrigger>
          <TabsTrigger value="user-ledger" data-testid="tab-user-ledger"><Users className="w-4 h-4 mr-1 hidden sm:inline" /> User Ledger</TabsTrigger>
          <TabsTrigger value="suppliers" data-testid="tab-suppliers">Suppliers</TabsTrigger>
        </TabsList>

        <TabsContent value="status"><Card><CardContent className="p-4"><StockStatusTab /></CardContent></Card></TabsContent>
        <TabsContent value="opening"><Card><CardContent className="p-4"><OpeningBalanceTab /></CardContent></Card></TabsContent>
        <TabsContent value="purchase"><Card><CardContent className="p-4"><PurchaseTab /></CardContent></Card></TabsContent>
        <TabsContent value="sales-return"><Card><CardContent className="p-4"><SalesReturnTab /></CardContent></Card></TabsContent>
        <TabsContent value="item-ledger"><Card><CardContent className="p-4"><ItemLedgerTab /></CardContent></Card></TabsContent>
        <TabsContent value="user-ledger"><Card><CardContent className="p-4"><UserLedgerTab /></CardContent></Card></TabsContent>
        <TabsContent value="suppliers"><Card><CardContent className="p-4"><SuppliersTab /></CardContent></Card></TabsContent>
      </Tabs>
    </div>
  );
};

export { SuppliersTab, OpeningBalanceTab, PurchaseTab, SalesReturnTab, StockStatusTab, ItemLedgerTab, UserLedgerTab };
export default StockManagement;
