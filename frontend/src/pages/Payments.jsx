import { useState, useEffect, useCallback } from 'react';
import { paymentsAPI, doctorsAPI, medicalsAPI, agenciesAPI } from '../lib/api';
import api from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Separator } from '../components/ui/separator';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import {
  IndianRupee, Plus, Search, Trash2, Loader2, FileText, Download,
  Users, ArrowUpDown, Filter, Calendar, CreditCard, Wallet, BookOpen,
  Edit2, MessageCircle, Send, Phone, MapPin
} from 'lucide-react';

const PAYMENT_MODES = ['Cash', 'UPI', 'GPay', 'Netbanking', 'Cheque', 'Credit'];

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
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
        {[{ key: 'outstanding', label: 'Outstanding', icon: IndianRupee },
          { key: 'payments', label: 'Payment History', icon: CreditCard },
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

          {/* Outstanding list */}
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b">
                  <th className="text-left p-3 font-medium">Customer</th>
                  <th className="text-center p-3 font-medium">Type</th>
                  <th className="text-right p-3 font-medium">Invoiced</th>
                  <th className="text-right p-3 font-medium">Paid</th>
                  <th className="text-right p-3 font-medium">Outstanding</th>
                  <th className="text-center p-3 font-medium">Contact & Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOutstanding.map(o => (
                  <tr key={o.customer_id} className="border-b hover:bg-slate-50" data-testid={`outstanding-${o.customer_id}`}>
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
                            <a href={`tel:${o.customer_phone}`} title="Call customer">
                              <Button variant="outline" size="sm" className="text-green-600 border-green-300 hover:bg-green-50 h-8" data-testid={`call-${o.customer_id}`}>
                                <Phone className="w-3.5 h-3.5" />
                              </Button>
                            </a>
                            <a href={`https://wa.me/91${o.customer_phone?.replace(/\D/g, '').slice(-10)}?text=${encodeURIComponent(`Dear ${o.customer_name},\n\nThis is a payment reminder. Your outstanding balance is ₹${o.outstanding.toLocaleString('en-IN')}.\n\nPlease arrange the payment at your earliest convenience.\n\nThank you.`)}`} target="_blank" rel="noreferrer" title="WhatsApp reminder">
                              <Button variant="outline" size="sm" className="text-emerald-600 border-emerald-300 hover:bg-emerald-50 h-8" data-testid={`wa-${o.customer_id}`}>
                                <MessageCircle className="w-3.5 h-3.5" />
                              </Button>
                            </a>
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
                <a href={`https://wa.me/91${ledgerCustomer.phone?.replace(/\D/g, '').slice(-10)}?text=${encodeURIComponent(`Dear ${ledgerCustomer?.name},\n\nThis is a payment reminder regarding your outstanding balance.\n\nPlease arrange the payment at your earliest convenience.\n\nThank you.`)}`} target="_blank" rel="noreferrer">
                  <Button size="sm" variant="outline" className="text-emerald-600 border-emerald-300 hover:bg-emerald-50" data-testid="ledger-wa-reminder-btn">
                    <MessageCircle className="w-3 h-3 mr-1" />Remind
                  </Button>
                </a>
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
