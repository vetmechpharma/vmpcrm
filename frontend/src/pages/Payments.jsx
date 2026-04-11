import { useState, useEffect, useCallback, useMemo } from 'react';
import { paymentsAPI, doctorsAPI, medicalsAPI, agenciesAPI, ordersAPI } from '../lib/api';
import api from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Separator } from '../components/ui/separator';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { exportToCSV, printTable, getDatePreset } from '../lib/exportUtils';
import {
  IndianRupee, Plus, Search, Trash2, Loader2, FileText, Download,
  Users, ArrowUpDown, Filter, Calendar, CreditCard, Wallet, BookOpen,
  Edit2, MessageCircle, Send, Phone, MapPin, Eye, Printer, ArrowLeft
} from 'lucide-react';

const PAYMENT_MODES = ['Cash', 'UPI', 'GPay', 'Netbanking', 'Cheque', 'Credit'];

// ============== CUSTOMER LEDGER TAB ==============
const CustomerLedgerTab = () => {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedType, setSelectedType] = useState('');
  const [ledger, setLedger] = useState(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [showObDialog, setShowObDialog] = useState(false);
  const [obAmount, setObAmount] = useState('');
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const searchCustomers = useCallback(async () => {
    if (!search.trim()) return;
    setLoading(true);
    try {
      const [docRes, medRes, agRes] = await Promise.all([
        doctorsAPI.getAll({ search: search.trim() }),
        medicalsAPI.getAll({ search: search.trim() }),
        agenciesAPI.getAll({ search: search.trim() })
      ]);
      const docs = (docRes.data?.doctors || docRes.data || []).map(d => ({ ...d, _type: 'doctor' }));
      const meds = (medRes.data?.medicals || medRes.data || []).map(m => ({ ...m, _type: 'medical' }));
      const ags = (agRes.data?.agencies || agRes.data || []).map(a => ({ ...a, _type: 'agency' }));
      setCustomers([...docs, ...meds, ...ags]);
    } catch { toast.error('Search failed'); }
    finally { setLoading(false); }
  }, [search]);

  const fetchLedger = useCallback(async (cust, type) => {
    setLedgerLoading(true);
    try {
      const params = {};
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;
      const res = await paymentsAPI.getLedger(type, cust.id, params);
      setLedger(res.data);
    } catch { toast.error('Failed to load ledger'); }
    finally { setLedgerLoading(false); }
  }, [fromDate, toDate]);

  const selectCustomer = (cust) => {
    setSelectedCustomer(cust);
    setSelectedType(cust._type);
    fetchLedger(cust, cust._type);
  };

  useEffect(() => {
    if (selectedCustomer && selectedType) fetchLedger(selectedCustomer, selectedType);
  }, [fromDate, toDate]);

  const handleSaveOb = async () => {
    try {
      await paymentsAPI.updateOpeningBalance(selectedType, selectedCustomer.id, { opening_balance: parseFloat(obAmount) || 0 });
      toast.success('Opening balance updated');
      setShowObDialog(false);
      fetchLedger(selectedCustomer, selectedType);
    } catch { toast.error('Failed to update'); }
  };

  const viewDetail = async (entry) => {
    if (entry.type === 'opening_balance') return;
    setDetailLoading(true);
    setShowDetailDialog(true);
    try {
      if (entry.type === 'invoice' || entry.type === 'order') {
        const res = await api.get(`/orders?search=${encodeURIComponent(entry.order_number || entry.ref_id)}`);
        const orders = res.data?.orders || res.data || [];
        const order = orders.find(o => o.id === entry.ref_id || o.order_number === entry.order_number);
        setDetailData(order ? { ...order, _view: 'order' } : null);
      } else if (entry.type === 'payment') {
        setDetailData({ _view: 'payment', date: entry.date, description: entry.description, amount: entry.credit, ref_id: entry.ref_id });
      } else if (entry.type === 'sales_return') {
        setDetailData({ _view: 'sales_return', date: entry.date, description: entry.description, amount: entry.credit, ref_id: entry.ref_id });
      }
    } catch { setDetailData(null); }
    finally { setDetailLoading(false); }
  };

  const handleExport = () => {
    if (!ledger) return;
    const headers = ['Date', 'Description', 'Type', 'Debit', 'Credit', 'Balance'];
    const rows = ledger.entries.map(e => [e.date, e.description, e.type, e.debit || '', e.credit || '', e.balance]);
    const name = ledger.customer?.name || 'customer';
    exportToCSV(headers, rows, `ledger_${name.replace(/\s/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
  };
  const handlePrint = () => {
    if (!ledger) return;
    const headers = ['Date', 'Description', 'Type', 'Debit', 'Credit', 'Balance'];
    const rows = ledger.entries.map(e => [e.date, e.description, e.type, e.debit > 0 ? `₹${e.debit.toFixed(2)}` : '', e.credit > 0 ? `₹${e.credit.toFixed(2)}` : '', `₹${e.balance.toFixed(2)}`]);
    const sub = [ledger.customer?.name, ledger.customer?.phone, fromDate && toDate ? `${fromDate} to ${toDate}` : ''].filter(Boolean).join(' | ');
    printTable(`Customer Ledger - ${ledger.customer?.name}`, headers, rows, sub);
  };

  // If no customer selected, show search
  if (!selectedCustomer) {
    return (
      <div className="space-y-4">
        <div className="flex gap-2 max-w-lg">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customer name, phone, or code..."
              className="pl-9" onKeyDown={e => e.key === 'Enter' && searchCustomers()} data-testid="cl-search" />
          </div>
          <Button onClick={searchCustomers} disabled={loading} data-testid="cl-search-btn">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
          </Button>
        </div>

        {customers.length > 0 && (
          <div className="border rounded-lg overflow-auto max-h-[60vh]">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="text-left p-3 font-medium">Name</th>
                  <th className="text-left p-3 font-medium">Phone</th>
                  <th className="text-left p-3 font-medium">Code</th>
                  <th className="text-left p-3 font-medium">Type</th>
                  <th className="text-center p-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {customers.map(c => (
                  <tr key={`${c._type}-${c.id}`} className="border-t hover:bg-blue-50 cursor-pointer" onClick={() => selectCustomer(c)}>
                    <td className="p-3 font-medium">{c.name}</td>
                    <td className="p-3 text-slate-500">{c.phone}</td>
                    <td className="p-3 text-slate-400 text-xs">{c.customer_code || '-'}</td>
                    <td className="p-3"><Badge variant="outline" className="text-xs capitalize">{c._type}</Badge></td>
                    <td className="p-3 text-center">
                      <Button size="sm" variant="outline" className="h-7 text-xs" data-testid={`cl-view-${c.id}`}>
                        <Eye className="w-3.5 h-3.5 mr-1" /> View Ledger
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {customers.length === 0 && search && !loading && (
          <p className="text-center py-8 text-slate-400">No customers found. Try a different search.</p>
        )}
      </div>
    );
  }

  // Customer ledger view
  return (
    <div className="space-y-4">
      {/* Header with back button */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button size="sm" variant="ghost" onClick={() => { setSelectedCustomer(null); setLedger(null); }} data-testid="cl-back-btn">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <div className="flex-1">
          <h3 className="font-semibold text-lg">{selectedCustomer.name}</h3>
          <p className="text-xs text-slate-500">{selectedCustomer.phone} | {selectedCustomer.customer_code || ''} | <span className="capitalize">{selectedType}</span></p>
        </div>
        <Button size="sm" variant="outline" onClick={() => { setObAmount(ledger?.customer?.opening_balance || 0); setShowObDialog(true); }} data-testid="cl-edit-ob-btn">
          <Edit2 className="w-3.5 h-3.5 mr-1" /> Opening Balance
        </Button>
      </div>

      {/* Summary cards */}
      {ledger && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card><CardContent className="p-3 text-center">
            <div className="text-xs text-slate-500">Opening Bal</div>
            <div className="text-lg font-bold">{ledger.customer?.opening_balance > 0 ? `₹${ledger.customer.opening_balance.toFixed(2)}` : '₹0.00'}</div>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <div className="text-xs text-slate-500">Total Debit</div>
            <div className="text-lg font-bold text-red-600">₹{ledger.total_debit?.toFixed(2)}</div>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <div className="text-xs text-slate-500">Total Credit</div>
            <div className="text-lg font-bold text-green-600">₹{ledger.total_credit?.toFixed(2)}</div>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <div className="text-xs text-slate-500">Closing Balance</div>
            <div className={`text-lg font-bold ${ledger.closing_balance > 0 ? 'text-red-600' : 'text-green-600'}`}>₹{ledger.closing_balance?.toFixed(2)}</div>
          </CardContent></Card>
        </div>
      )}

      {/* Filters + Export */}
      <div className="flex flex-wrap gap-2 items-end">
        <div>
          <Label className="text-xs">From</Label>
          <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-36 h-8 text-xs" />
        </div>
        <div>
          <Label className="text-xs">To</Label>
          <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-36 h-8 text-xs" />
        </div>
        {[['week','Week'],['month','Month'],['year','Year']].map(([k,l]) => (
          <Button key={k} size="sm" variant="outline" className="h-8 text-xs px-2" onClick={() => {
            const p = getDatePreset(k); setFromDate(p.from); setToDate(p.to);
          }}>{l}</Button>
        ))}
        <Button size="sm" variant="ghost" className="h-8 text-xs px-2" onClick={() => { setFromDate(''); setToDate(''); }}>Clear</Button>
        {ledger && (
          <>
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={handleExport} data-testid="cl-export-csv">
              <Download className="w-3.5 h-3.5" /> CSV
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={handlePrint} data-testid="cl-print">
              <Printer className="w-3.5 h-3.5" /> Print
            </Button>
          </>
        )}
      </div>

      {/* Ledger Table */}
      {ledgerLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : ledger ? (
        <div className="border rounded-lg overflow-auto max-h-[55vh]">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 sticky top-0">
              <tr>
                <th className="text-left p-3 font-medium">Date</th>
                <th className="text-left p-3 font-medium">Description</th>
                <th className="text-center p-3 font-medium">Type</th>
                <th className="text-right p-3 font-medium text-red-600">Debit</th>
                <th className="text-right p-3 font-medium text-green-600">Credit</th>
                <th className="text-right p-3 font-medium">Balance</th>
                <th className="text-center p-3 font-medium w-14">View</th>
              </tr>
            </thead>
            <tbody>
              {ledger.entries.map((entry, idx) => (
                <tr key={idx} className={`border-t hover:bg-blue-50 ${entry.type !== 'opening_balance' ? 'cursor-pointer' : ''}`}
                  onClick={() => entry.type !== 'opening_balance' && viewDetail(entry)} data-testid={`cl-row-${idx}`}>
                  <td className="p-3 text-slate-500">{entry.date || '-'}</td>
                  <td className="p-3">{entry.description}</td>
                  <td className="p-3 text-center">
                    <Badge variant="outline" className={`text-[10px] capitalize ${
                      entry.type === 'invoice' || entry.type === 'order' ? 'border-red-200 text-red-700 bg-red-50' :
                      entry.type === 'payment' ? 'border-green-200 text-green-700 bg-green-50' :
                      entry.type === 'sales_return' ? 'border-blue-200 text-blue-700 bg-blue-50' :
                      'border-slate-200'
                    }`}>
                      {entry.type === 'invoice' ? 'Invoice' : entry.type === 'order' ? 'Order' : entry.type === 'payment' ? 'Payment' : entry.type === 'sales_return' ? 'Return' : 'OB'}
                    </Badge>
                  </td>
                  <td className="p-3 text-right text-red-600">{entry.debit > 0 ? `₹${entry.debit.toFixed(2)}` : ''}</td>
                  <td className="p-3 text-right text-green-600">{entry.credit > 0 ? `₹${entry.credit.toFixed(2)}` : ''}</td>
                  <td className={`p-3 text-right font-medium ${entry.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>₹{entry.balance.toFixed(2)}</td>
                  <td className="p-3 text-center">
                    {entry.type !== 'opening_balance' && <Eye className="w-3.5 h-3.5 text-slate-400 mx-auto" />}
                  </td>
                </tr>
              ))}
              {ledger.entries.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-slate-400">No transactions</td></tr>}
            </tbody>
            {ledger.entries.length > 0 && (
              <tfoot className="bg-slate-100 font-semibold border-t-2">
                <tr>
                  <td className="p-3" colSpan={3}>Totals</td>
                  <td className="p-3 text-right text-red-600">₹{ledger.total_debit?.toFixed(2)}</td>
                  <td className="p-3 text-right text-green-600">₹{ledger.total_credit?.toFixed(2)}</td>
                  <td className={`p-3 text-right font-bold ${ledger.closing_balance > 0 ? 'text-red-600' : 'text-green-600'}`}>₹{ledger.closing_balance?.toFixed(2)}</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      ) : null}

      {/* Opening Balance Dialog */}
      <Dialog open={showObDialog} onOpenChange={setShowObDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Edit Opening Balance</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-slate-500">Set manual opening balance for <strong>{selectedCustomer?.name}</strong></p>
            <div>
              <Label>Amount (positive = customer owes, negative = credit)</Label>
              <Input type="number" value={obAmount} onChange={e => setObAmount(e.target.value)} data-testid="cl-ob-input" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveOb} data-testid="cl-ob-save">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transaction Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-auto">
          <DialogHeader><DialogTitle>Transaction Detail</DialogTitle></DialogHeader>
          {detailLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : detailData ? (
            <div className="space-y-3 text-sm">
              {detailData._view === 'order' ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label className="text-xs text-slate-500">Order Number</Label><p className="font-medium">{detailData.order_number}</p></div>
                    <div><Label className="text-xs text-slate-500">Status</Label><p><Badge className="capitalize">{detailData.status}</Badge></p></div>
                    <div><Label className="text-xs text-slate-500">Invoice Number</Label><p>{detailData.invoice_number || '-'}</p></div>
                    <div><Label className="text-xs text-slate-500">Invoice Date</Label><p>{detailData.invoice_date || '-'}</p></div>
                    <div><Label className="text-xs text-slate-500">Invoice Value</Label><p className="font-semibold text-red-600">₹{detailData.invoice_value || detailData.total_amount || 0}</p></div>
                    <div><Label className="text-xs text-slate-500">Created</Label><p>{(detailData.created_at || '').split('T')[0]}</p></div>
                  </div>
                  {detailData.items && detailData.items.length > 0 && (
                    <>
                      <Separator />
                      <Label className="text-xs text-slate-500">Items</Label>
                      <div className="border rounded overflow-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-slate-50">
                            <tr>
                              <th className="text-left p-2">Item</th>
                              <th className="text-right p-2">Qty</th>
                              <th className="text-right p-2">Rate</th>
                              <th className="text-right p-2">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detailData.items.map((item, i) => (
                              <tr key={i} className="border-t">
                                <td className="p-2">{item.item_name || item.item_id}</td>
                                <td className="p-2 text-right">{item.dispatch_quantity || item.quantity}</td>
                                <td className="p-2 text-right">₹{item.rate || 0}</td>
                                <td className="p-2 text-right font-medium">₹{((item.dispatch_quantity || item.quantity || 0) * (item.rate || 0)).toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </>
              ) : detailData._view === 'payment' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs text-slate-500">Date</Label><p className="font-medium">{detailData.date}</p></div>
                  <div><Label className="text-xs text-slate-500">Amount</Label><p className="font-semibold text-green-600">₹{detailData.amount?.toFixed(2)}</p></div>
                  <div className="col-span-2"><Label className="text-xs text-slate-500">Details</Label><p>{detailData.description}</p></div>
                </div>
              ) : detailData._view === 'sales_return' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs text-slate-500">Date</Label><p className="font-medium">{detailData.date}</p></div>
                  <div><Label className="text-xs text-slate-500">Credit Amount</Label><p className="font-semibold text-blue-600">₹{detailData.amount?.toFixed(2)}</p></div>
                  <div className="col-span-2"><Label className="text-xs text-slate-500">Description</Label><p>{detailData.description}</p></div>
                </div>
              ) : <p className="text-slate-400">No details available</p>}
            </div>
          ) : <p className="text-center py-4 text-slate-400">No detail found</p>}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export const Payments = () => {
  const [activeTab, setActiveTab] = useState('outstanding');
  const [outstanding, setOutstanding] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');
  const [search, setSearch] = useState('');

  // Payment form
  const [showPayForm, setShowPayForm] = useState(false);
  const [payForm, setPayForm] = useState({ customer_id: '', customer_name: '', customer_type: 'doctor', customer_phone: '', amount: '', mode: 'Cash', date: new Date().toISOString().slice(0, 10), notes: '', invoice_number: '' });
  const [saving, setSaving] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState([]);
  const [searchingCustomer, setSearchingCustomer] = useState(false);
  const [filterMode, setFilterMode] = useState('');
  const [paySearch, setPaySearch] = useState('');
  const [sendingWA, setSendingWA] = useState(null);
  const [sendingReminder, setSendingReminder] = useState(null);
  const [selectedOutstanding, setSelectedOutstanding] = useState([]);
  const [bulkSending, setBulkSending] = useState(false);

  // MR Payment Requests
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectingId, setRejectingId] = useState(null);

  // Ledger
  const [showLedger, setShowLedger] = useState(false);
  const [ledger, setLedger] = useState(null);
  const [ledgerCustomer, setLedgerCustomer] = useState(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sendingLedgerWA, setSendingLedgerWA] = useState(false);

  const fetchOutstanding = useCallback(async () => {
    setLoading(true);
    try {
      const params = filterType ? { customer_type: filterType } : {};
      const res = await paymentsAPI.getOutstanding(params);
      setOutstanding(res.data);
    } catch { toast.error('Failed to load outstanding'); }
    finally { setLoading(false); }
  }, [filterType]);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterType) params.customer_type = filterType;
      if (dateFrom) params.from_date = dateFrom;
      if (dateTo) params.to_date = dateTo;
      const res = await paymentsAPI.getAll(params);
      setPayments(res.data);
    } catch { toast.error('Failed to load payments'); }
    finally { setLoading(false); }
  }, [filterType, dateFrom, dateTo]);

  useEffect(() => {
    if (activeTab === 'outstanding') fetchOutstanding();
    else if (activeTab === 'payments') fetchPayments();
    else if (activeTab === 'approvals') fetchPendingRequests();
  }, [activeTab, fetchOutstanding, fetchPayments]);

  // Fetch pending requests count on mount
  useEffect(() => { fetchPendingRequests(); }, []);

  const fetchPendingRequests = async () => {
    setLoadingRequests(true);
    try {
      const res = await api.get('/payment-requests');
      setPendingRequests(res.data);
    } catch { toast.error('Failed to load payment requests'); }
    finally { setLoadingRequests(false); }
  };

  const handlePaymentAction = async (requestId, action, reason = '') => {
    try {
      await api.post(`/payment-requests/${requestId}/approve`, { action, reason });
      toast.success(action === 'approve' ? 'Payment approved and recorded!' : 'Payment request rejected');
      fetchPendingRequests();
      setRejectingId(null);
      setRejectReason('');
    } catch { toast.error('Action failed'); }
  };

  const searchCustomers = async (q) => {
    setCustomerSearch(q);
    if (q.length < 2) { setCustomerResults([]); return; }
    setSearchingCustomer(true);
    try {
      const [docs, meds, ags] = await Promise.all([
        doctorsAPI.getAll().then(r => r.data.map(d => ({ ...d, type: 'doctor' }))),
        medicalsAPI.getAll().then(r => r.data.map(m => ({ ...m, type: 'medical' }))),
        agenciesAPI.getAll().then(r => r.data.map(a => ({ ...a, type: 'agency' }))),
      ]);
      const all = [...docs, ...meds, ...ags];
      const filtered = all.filter(c =>
        c.name.toLowerCase().includes(q.toLowerCase()) ||
        c.phone?.includes(q) ||
        c.customer_code?.toLowerCase().includes(q.toLowerCase())
      );
      setCustomerResults(filtered.slice(0, 10));
    } catch { /* empty */ }
    finally { setSearchingCustomer(false); }
  };

  const selectCustomer = (c) => {
    setPayForm(prev => ({
      ...prev,
      customer_id: c.id,
      customer_name: c.name,
      customer_type: c.type,
      customer_phone: c.phone || '',
    }));
    setCustomerSearch(c.name);
    setCustomerResults([]);
  };

  const savePayment = async () => {
    if (!payForm.customer_id || !payForm.amount) {
      toast.error('Select customer and enter amount');
      return;
    }
    setSaving(true);
    try {
      let result;
      if (editingPayment) {
        result = await paymentsAPI.update(editingPayment.id, { amount: parseFloat(payForm.amount), mode: payForm.mode, date: payForm.date, notes: payForm.notes });
        toast.success('Payment updated');
      } else {
        result = await paymentsAPI.create({ ...payForm, amount: parseFloat(payForm.amount) });
        toast.success('Payment recorded');
      }
      setShowPayForm(false);
      setEditingPayment(null);
      setPayForm({ customer_id: '', customer_name: '', customer_type: 'doctor', customer_phone: '', amount: '', mode: 'Cash', date: new Date().toISOString().slice(0, 10), notes: '', invoice_number: '' });
      setCustomerSearch('');
      if (activeTab === 'outstanding') fetchOutstanding();
      else fetchPayments();
      
      // Auto-send WhatsApp for new payments
      if (!editingPayment && result?.data?.id) {
        sendWhatsAppReceipt(result.data.id);
      }
    } catch { toast.error('Failed to save payment'); }
    finally { setSaving(false); }
  };

  const editPayment = (p) => {
    setEditingPayment(p);
    setPayForm({
      customer_id: p.customer_id,
      customer_name: p.customer_name,
      customer_type: p.customer_type,
      customer_phone: p.customer_phone || '',
      amount: String(p.amount),
      mode: p.mode || 'Cash',
      date: p.date || new Date().toISOString().slice(0, 10),
      notes: p.notes || '',
      invoice_number: p.invoice_number || '',
    });
    setCustomerSearch(p.customer_name);
    setShowPayForm(true);
  };

  const sendWhatsAppReceipt = async (paymentId) => {
    setSendingWA(paymentId);
    try {
      const res = await paymentsAPI.sendWhatsApp(paymentId);
      toast.success(`Receipt sent via WhatsApp (Balance: ₹${res.data.balance?.toLocaleString('en-IN')})`);
    } catch (e) {
      const msg = e.response?.data?.detail || 'WhatsApp send failed';
      toast.error(msg);
    }
    finally { setSendingWA(null); }
  };

  const sendPaymentReminder = async (customer) => {
    setSendingReminder(customer.customer_id);
    try {
      await paymentsAPI.sendReminder({
        customer_phone: customer.customer_phone,
        customer_name: customer.customer_name,
        customer_email: customer.customer_email || '',
        outstanding: customer.outstanding
      });
      toast.success(`Outstanding sent to ${customer.customer_name}`);
    } catch (e) {
      const msg = e.response?.data?.detail || 'Failed to send reminder';
      toast.error(msg);
    } finally { setSendingReminder(null); }
  };

  const bulkSendOutstanding = async () => {
    const selected = filteredOutstanding.filter(o => selectedOutstanding.includes(o.customer_id) && o.customer_phone);
    if (selected.length === 0) { toast.error('No customers with phone selected'); return; }
    setBulkSending(true);
    let sent = 0, failed = 0;
    for (const o of selected) {
      try {
        await paymentsAPI.sendReminder({
          customer_phone: o.customer_phone,
          customer_name: o.customer_name,
          customer_email: o.customer_email || '',
          outstanding: o.outstanding
        });
        sent++;
      } catch { failed++; }
    }
    setBulkSending(false);
    setSelectedOutstanding([]);
    if (sent > 0) toast.success(`Outstanding sent to ${sent} customer(s)`);
    if (failed > 0) toast.error(`Failed for ${failed} customer(s)`);
  };

  const toggleSelectAll = () => {
    if (selectedOutstanding.length === filteredOutstanding.length) {
      setSelectedOutstanding([]);
    } else {
      setSelectedOutstanding(filteredOutstanding.map(o => o.customer_id));
    }
  };

  const toggleSelect = (id) => {
    setSelectedOutstanding(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const sendLedgerReminder = async () => {
    if (!ledgerCustomer?.phone) return;
    setSendingReminder('ledger');
    try {
      const balance = ledger?.balance || 0;
      await paymentsAPI.sendReminder({
        customer_phone: ledgerCustomer.phone,
        customer_name: ledgerCustomer.name,
        outstanding: Math.abs(balance)
      });
      toast.success(`Payment reminder sent to ${ledgerCustomer.name}`);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to send reminder');
    } finally { setSendingReminder(null); }
  };

  const deletePayment = async (id) => {
    if (!window.confirm('Delete this payment?')) return;
    try {
      await paymentsAPI.delete(id);
      toast.success('Payment deleted');
      fetchPayments();
    } catch { toast.error('Failed to delete'); }
  };

  const openLedger = async (customerId, customerType, customerName, customerPhone) => {
    setLedgerCustomer({ id: customerId, type: customerType, name: customerName, phone: customerPhone || '' });
    setShowLedger(true);
    setLedgerLoading(true);
    try {
      const params = {};
      if (dateFrom) params.from_date = dateFrom;
      if (dateTo) params.to_date = dateTo;
      const res = await paymentsAPI.getLedger(customerType, customerId, params);
      setLedger(res.data);
    } catch { toast.error('Failed to load ledger'); }
    finally { setLedgerLoading(false); }
  };

  const refreshLedger = async () => {
    if (!ledgerCustomer) return;
    setLedgerLoading(true);
    try {
      const params = {};
      if (dateFrom) params.from_date = dateFrom;
      if (dateTo) params.to_date = dateTo;
      const res = await paymentsAPI.getLedger(ledgerCustomer.type, ledgerCustomer.id, params);
      setLedger(res.data);
    } catch { toast.error('Failed to refresh'); }
    finally { setLedgerLoading(false); }
  };

  const exportLedgerPDF = async () => {
    if (!ledgerCustomer) return;
    try {
      const params = {};
      if (dateFrom) params.from_date = dateFrom;
      if (dateTo) params.to_date = dateTo;
      const res = await paymentsAPI.exportLedgerPDF(ledgerCustomer.type, ledgerCustomer.id, params);
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ledger_${ledgerCustomer.name.replace(/\s/g, '_')}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Ledger PDF downloaded');
    } catch { toast.error('Export failed'); }
  };

  const sendLedgerWhatsApp = async () => {
    if (!ledgerCustomer) return;
    setSendingLedgerWA(true);
    try {
      const params = {};
      if (dateFrom) params.from_date = dateFrom;
      if (dateTo) params.to_date = dateTo;
      const res = await paymentsAPI.sendLedgerWhatsApp(ledgerCustomer.type, ledgerCustomer.id, params);
      toast.success(`Ledger sent via WhatsApp (Balance: ₹${res.data.balance?.toLocaleString('en-IN')})`);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to send ledger via WhatsApp');
    }
    finally { setSendingLedgerWA(false); }
  };

  const filteredOutstanding = outstanding.filter(o =>
    !search || o.customer_name.toLowerCase().includes(search.toLowerCase()) ||
    o.customer_code?.toLowerCase().includes(search.toLowerCase())
  );

  const typeLabel = (t) => ({ doctor: 'Doctor', medical: 'Medical', agency: 'Agency' }[t] || t);
  const typeBg = (t) => ({ doctor: 'bg-blue-100 text-blue-700', medical: 'bg-emerald-100 text-emerald-700', agency: 'bg-purple-100 text-purple-700' }[t] || 'bg-gray-100');

  return (
    <div className="space-y-4" data-testid="payments-page">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Payments & Ledger</h1>
          <p className="text-sm text-slate-500">Track payments, outstanding dues, and customer ledgers</p>
        </div>
        <Button onClick={() => setShowPayForm(true)} data-testid="add-payment-btn">
          <Plus className="w-4 h-4 mr-2" /> Record Payment
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit flex-wrap">
        {[{ key: 'outstanding', label: 'Outstanding', icon: IndianRupee },
          { key: 'payments', label: 'Payment History', icon: CreditCard },
          { key: 'customer-ledger', label: 'Customer Ledger', icon: BookOpen },
          { key: 'approvals', label: 'MR Approvals', icon: Users }].map(tab => (
          <Button key={tab.key} variant={activeTab === tab.key ? 'default' : 'ghost'} size="sm"
            onClick={() => setActiveTab(tab.key)} data-testid={`tab-${tab.key}`}>
            <tab.icon className="w-4 h-4 mr-1" />{tab.label}
            {tab.key === 'approvals' && pendingRequests.filter(r => r.status === 'pending').length > 0 && (
              <span className="ml-1.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px]">{pendingRequests.filter(r => r.status === 'pending').length}</span>
            )}
          </Button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="flex gap-1 bg-slate-50 p-1 rounded-lg border">
          {['', 'doctor', 'medical', 'agency'].map(t => (
            <Button key={t} variant={filterType === t ? 'default' : 'ghost'} size="sm"
              onClick={() => setFilterType(t)} className="text-xs">
              {t ? typeLabel(t) : 'All'}
            </Button>
          ))}
        </div>
        {activeTab === 'outstanding' && (
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input placeholder="Search customer..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="pl-10" data-testid="search-outstanding" />
          </div>
        )}
        {activeTab === 'payments' && (
          <>
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input placeholder="Search by name..." value={paySearch} onChange={(e) => setPaySearch(e.target.value)}
                className="pl-10" data-testid="search-payments" />
            </div>
            <div className="flex gap-1 bg-slate-50 p-1 rounded-lg border">
              {['', ...PAYMENT_MODES].map(m => (
                <Button key={m} variant={filterMode === m ? 'default' : 'ghost'} size="sm"
                  onClick={() => setFilterMode(m)} className="text-xs" data-testid={`filter-mode-${m || 'all'}`}>
                  {m || 'All Modes'}
                </Button>
              ))}
            </div>
            <div className="flex gap-2 items-center">
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-36" />
              <span className="text-sm text-slate-400">to</span>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-36" />
            </div>
          </>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
      ) : activeTab === 'outstanding' ? (
        <div className="space-y-2">
          {/* Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            {['doctor', 'medical', 'agency'].map(t => {
              const total = outstanding.filter(o => o.customer_type === t).reduce((s, o) => s + o.outstanding, 0);
              return (
                <Card key={t} className="p-3">
                  <div className="flex justify-between items-center">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${typeBg(t)}`}>{typeLabel(t)}s</span>
                    <span className="font-bold text-lg text-slate-900">₹{total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Bulk action bar */}
          {selectedOutstanding.length > 0 && (
            <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <span className="text-sm font-medium text-emerald-800">{selectedOutstanding.length} selected</span>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={bulkSendOutstanding} disabled={bulkSending} data-testid="bulk-send-wa-btn">
                {bulkSending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <MessageCircle className="w-3.5 h-3.5 mr-1" />}
                Send Outstanding via WhatsApp
              </Button>
              <Button size="sm" variant="outline" onClick={() => setSelectedOutstanding([])} data-testid="clear-selection-btn">Clear</Button>
            </div>
          )}

          {/* Outstanding list */}
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b">
                  <th className="p-3 w-10">
                    <input type="checkbox" checked={filteredOutstanding.length > 0 && selectedOutstanding.length === filteredOutstanding.length}
                      onChange={toggleSelectAll} className="rounded border-slate-300 w-4 h-4" data-testid="select-all-outstanding" />
                  </th>
                  <th className="text-left p-3 font-medium">Customer</th>
                  <th className="text-center p-3 font-medium">Type</th>
                  <th className="text-right p-3 font-medium">Invoiced</th>
                  <th className="text-right p-3 font-medium">Paid</th>
                  <th className="text-right p-3 font-medium">Outstanding</th>
                  <th className="text-center p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOutstanding.map(o => (
                  <tr key={o.customer_id} className={`border-b hover:bg-slate-50 ${selectedOutstanding.includes(o.customer_id) ? 'bg-emerald-50/50' : ''}`} data-testid={`outstanding-${o.customer_id}`}>
                    <td className="p-3">
                      <input type="checkbox" checked={selectedOutstanding.includes(o.customer_id)}
                        onChange={() => toggleSelect(o.customer_id)} className="rounded border-slate-300 w-4 h-4" data-testid={`check-${o.customer_id}`} />
                    </td>
                    <td className="p-3">
                      <p className="font-medium">{o.customer_name}</p>
                      <p className="text-xs text-slate-400">{o.customer_code}</p>
                      {o.customer_phone && (
                        <p className="text-xs text-slate-500 mt-0.5">{o.customer_phone}</p>
                      )}
                      {o.city && <p className="text-[10px] text-slate-400 flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" />{o.city}</p>}
                    </td>
                    <td className="p-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded ${typeBg(o.customer_type)}`}>{typeLabel(o.customer_type)}</span>
                    </td>
                    <td className="p-3 text-right">₹{(o.opening_balance + o.total_invoiced).toLocaleString('en-IN')}</td>
                    <td className="p-3 text-right text-emerald-600">₹{o.total_paid.toLocaleString('en-IN')}</td>
                    <td className="p-3 text-right font-bold text-red-600">₹{o.outstanding.toLocaleString('en-IN')}</td>
                    <td className="p-3">
                      <div className="flex gap-1 justify-center flex-wrap">
                        {o.customer_phone && (
                          <>
                            <a href={`tel:${o.customer_phone}`} title="Call">
                              <Button variant="outline" size="sm" className="text-green-600 border-green-300 hover:bg-green-50 h-8" data-testid={`call-${o.customer_id}`}>
                                <Phone className="w-3.5 h-3.5" />
                              </Button>
                            </a>
                            <Button variant="outline" size="sm" className="text-emerald-600 border-emerald-300 hover:bg-emerald-50 h-8"
                              onClick={() => sendPaymentReminder(o)} disabled={sendingReminder === o.customer_id}
                              title="Send Outstanding via WhatsApp" data-testid={`wa-${o.customer_id}`}>
                              {sendingReminder === o.customer_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageCircle className="w-3.5 h-3.5" />}
                            </Button>
                          </>
                        )}
                        <Button variant="outline" size="sm" onClick={() => openLedger(o.customer_id, o.customer_type, o.customer_name, o.customer_phone)} data-testid={`ledger-${o.customer_id}`} className="h-8">
                          <BookOpen className="w-3 h-3 mr-1" />Ledger
                        </Button>
                        <Button size="sm" className="h-8" onClick={() => {
                          setPayForm(prev => ({ ...prev, customer_id: o.customer_id, customer_name: o.customer_name, customer_type: o.customer_type, customer_phone: o.customer_phone }));
                          setCustomerSearch(o.customer_name);
                          setShowPayForm(true);
                        }}>
                          <Plus className="w-3 h-3 mr-1" />Pay
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredOutstanding.length === 0 && (
              <p className="text-center py-8 text-slate-400">No outstanding dues</p>
            )}
          </div>
        </div>
      ) : activeTab === 'payments' ? (
        /* Payment History */
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b">
                <th className="text-left p-3 font-medium">Date</th>
                <th className="text-left p-3 font-medium">Customer</th>
                <th className="text-center p-3 font-medium">Mode</th>
                <th className="text-right p-3 font-medium">Amount</th>
                <th className="text-left p-3 font-medium">Notes</th>
                <th className="text-center p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {payments
                .filter(p => !filterMode || p.mode === filterMode)
                .filter(p => !paySearch || p.customer_name?.toLowerCase().includes(paySearch.toLowerCase()))
                .map(p => (
                <tr key={p.id} className="border-b hover:bg-slate-50" data-testid={`payment-${p.id}`}>
                  <td className="p-3">{p.date}</td>
                  <td className="p-3">
                    <p className="font-medium">{p.customer_name}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${typeBg(p.customer_type)}`}>{typeLabel(p.customer_type)}</span>
                    {p.mr_name && <p className="text-xs text-indigo-500 mt-0.5">via MR: {p.mr_name}</p>}
                  </td>
                  <td className="p-3 text-center"><span className="px-2 py-0.5 bg-slate-100 rounded text-xs font-medium">{p.mode}</span></td>
                  <td className="p-3 text-right font-bold text-emerald-600">₹{parseFloat(p.amount).toLocaleString('en-IN')}</td>
                  <td className="p-3 text-slate-500 text-xs max-w-[150px] truncate">{p.notes || '-'}</td>
                  <td className="p-3 text-center">
                    <div className="flex gap-1 justify-center">
                      <Button variant="ghost" size="sm" title="Edit" onClick={() => editPayment(p)} data-testid={`edit-payment-${p.id}`}>
                        <Edit2 className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="sm" title="Send WhatsApp Receipt" className="text-green-600"
                        onClick={() => sendWhatsAppReceipt(p.id)} disabled={sendingWA === p.id} data-testid={`wa-payment-${p.id}`}>
                        {sendingWA === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <MessageCircle className="w-3 h-3" />}
                      </Button>
                      <Button variant="ghost" size="sm" className="text-red-500" title="Delete" onClick={() => deletePayment(p.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {payments.length === 0 && <p className="text-center py-8 text-slate-400">No payments recorded</p>}
        </div>
      ) : activeTab === 'customer-ledger' ? (
        <CustomerLedgerTab />
      ) : activeTab === 'approvals' ? (
        <div className="space-y-3">
          {loadingRequests ? (
            <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
          ) : pendingRequests.length === 0 ? (
            <p className="text-center py-16 text-slate-400">No payment requests from MRs</p>
          ) : (
            pendingRequests.map(req => (
              <Card key={req.id} className="border-l-4 border-indigo-200" data-testid={`approval-${req.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-800">{req.customer_name}</span>
                        <Badge className="text-[10px]" variant="outline">{req.customer_type}</Badge>
                        <Badge className={req.status === 'pending' ? 'bg-amber-100 text-amber-700' : req.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}>
                          {req.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-indigo-600 font-medium mt-1">Recorded by MR: {req.mr_name}</p>
                      <div className="flex gap-3 mt-1 text-xs text-slate-500">
                        <span>{req.date}</span>
                        <span>Mode: {req.mode}</span>
                        {req.customer_phone && <span>Phone: {req.customer_phone}</span>}
                      </div>
                      {req.notes && <p className="text-xs text-slate-500 mt-1">Notes: {req.notes}</p>}
                      {req.status === 'approved' && <p className="text-xs text-emerald-600 mt-1">Approved by: {req.approved_by}</p>}
                      {req.status === 'rejected' && req.rejection_reason && <p className="text-xs text-red-500 mt-1">Reason: {req.rejection_reason}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xl font-bold text-slate-800">Rs.{Number(req.amount).toLocaleString('en-IN')}</p>
                      {req.status === 'pending' && (
                        <div className="flex gap-2 mt-2">
                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-8"
                            onClick={() => handlePaymentAction(req.id, 'approve')} data-testid={`approve-${req.id}`}>
                            Approve
                          </Button>
                          {rejectingId === req.id ? (
                            <div className="flex gap-1">
                              <Input placeholder="Reason" value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                                className="h-8 text-xs w-24" />
                              <Button size="sm" variant="destructive" className="h-8"
                                onClick={() => handlePaymentAction(req.id, 'reject', rejectReason)}>
                                Reject
                              </Button>
                            </div>
                          ) : (
                            <Button size="sm" variant="outline" className="h-8 text-red-600 border-red-200 hover:bg-red-50"
                              onClick={() => setRejectingId(req.id)} data-testid={`reject-${req.id}`}>
                              Reject
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      ) : null}

      {/* Record Payment Dialog */}
      <Dialog open={showPayForm} onOpenChange={(open) => { setShowPayForm(open); if (!open) setEditingPayment(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Wallet className="w-5 h-5" />{editingPayment ? 'Edit Payment' : 'Record Payment'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Customer search */}
            <div className="space-y-2">
              <Label>Customer *</Label>
              <div className="relative">
                <Input value={customerSearch} onChange={e => searchCustomers(e.target.value)}
                  placeholder="Search by name, phone, code..." data-testid="payment-customer-search" />
                {searchingCustomer && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin" />}
                {customerResults.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {customerResults.map(c => (
                      <div key={c.id} className="p-2 hover:bg-slate-50 cursor-pointer flex justify-between items-center"
                        onClick={() => selectCustomer(c)}>
                        <div>
                          <p className="text-sm font-medium">{c.name}</p>
                          <p className="text-xs text-slate-400">{c.phone} | {c.customer_code}</p>
                        </div>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${typeBg(c.type)}`}>{typeLabel(c.type)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {payForm.customer_name && (
                <p className="text-xs text-emerald-600">Selected: {payForm.customer_name} ({typeLabel(payForm.customer_type)})</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input type="date" value={payForm.date} onChange={e => setPayForm(p => ({ ...p, date: e.target.value }))} data-testid="payment-date" />
              </div>
              <div className="space-y-2">
                <Label>Amount (₹) *</Label>
                <Input type="number" value={payForm.amount} onChange={e => setPayForm(p => ({ ...p, amount: e.target.value }))}
                  placeholder="0.00" data-testid="payment-amount" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Payment Mode</Label>
              <div className="flex gap-1 flex-wrap">
                {PAYMENT_MODES.map(m => (
                  <Button key={m} variant={payForm.mode === m ? 'default' : 'outline'} size="sm" className="text-xs"
                    onClick={() => setPayForm(p => ({ ...p, mode: m }))} data-testid={`mode-${m.toLowerCase()}`}>{m}</Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Input value={payForm.notes} onChange={e => setPayForm(p => ({ ...p, notes: e.target.value }))} placeholder="e.g., Against Inv# 1234" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowPayForm(false); setEditingPayment(null); }}>Cancel</Button>
            {editingPayment && (
              <Button variant="outline" className="text-green-600" onClick={() => { savePayment().then(() => sendWhatsAppReceipt(editingPayment.id)); }} disabled={saving}>
                <MessageCircle className="w-4 h-4 mr-1" />Save & Send WhatsApp
              </Button>
            )}
            <Button onClick={savePayment} disabled={saving} data-testid="save-payment-btn">
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}{editingPayment ? 'Update' : 'Save'} Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ledger Dialog */}
      <Dialog open={showLedger} onOpenChange={setShowLedger}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              Ledger: {ledgerCustomer?.name}
              {ledgerCustomer?.phone && (
                <span className="text-sm font-normal text-slate-500 ml-2">({ledgerCustomer.phone})</span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="flex gap-2 items-center mb-3 flex-wrap">
            {ledgerCustomer?.phone && (
              <>
                <a href={`tel:${ledgerCustomer.phone}`}>
                  <Button size="sm" variant="outline" className="text-green-600 border-green-300 hover:bg-green-50" data-testid="ledger-call-btn">
                    <Phone className="w-3 h-3 mr-1" />Call
                  </Button>
                </a>
                <Button size="sm" variant="outline" className="text-emerald-600 border-emerald-300 hover:bg-emerald-50"
                  onClick={sendLedgerReminder} disabled={sendingReminder === 'ledger'} data-testid="ledger-wa-reminder-btn">
                  {sendingReminder === 'ledger' ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <MessageCircle className="w-3 h-3 mr-1" />}Remind
                </Button>
                <div className="h-6 w-px bg-slate-200" />
              </>
            )}
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-36" />
            <span className="text-sm text-slate-400">to</span>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-36" />
            <Button size="sm" variant="outline" onClick={refreshLedger}><Filter className="w-3 h-3 mr-1" />Filter</Button>
            <Button size="sm" variant="outline" onClick={exportLedgerPDF}><Download className="w-3 h-3 mr-1" />PDF</Button>
            <Button size="sm" variant="outline" className="text-green-600 border-green-300 hover:bg-green-50" onClick={sendLedgerWhatsApp} disabled={sendingLedgerWA} data-testid="ledger-whatsapp-btn">
              {sendingLedgerWA ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Send className="w-3 h-3 mr-1" />}WhatsApp
            </Button>
          </div>

          {ledgerLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : ledger ? (
            <div>
              <table className="w-full text-sm border">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="p-2 text-left border">Date</th>
                    <th className="p-2 text-left border">Description</th>
                    <th className="p-2 text-right border">Debit (₹)</th>
                    <th className="p-2 text-right border">Credit (₹)</th>
                    <th className="p-2 text-right border">Balance (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.entries.map((e, i) => (
                    <tr key={i} className={`border ${e.type === 'opening_balance' ? 'bg-amber-50' : e.type === 'payment' ? 'bg-emerald-50' : ''}`}>
                      <td className="p-2 border text-xs">{e.date || '-'}</td>
                      <td className="p-2 border text-xs">{e.description}</td>
                      <td className="p-2 border text-right text-xs">{e.debit ? e.debit.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : ''}</td>
                      <td className="p-2 border text-right text-xs text-emerald-600">{e.credit ? e.credit.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : ''}</td>
                      <td className="p-2 border text-right text-xs font-medium">{e.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-800 text-white font-bold">
                    <td colSpan={2} className="p-2 border text-right">TOTALS</td>
                    <td className="p-2 border text-right">{ledger.total_debit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="p-2 border text-right">{ledger.total_credit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="p-2 border text-right">{ledger.closing_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Payments;
