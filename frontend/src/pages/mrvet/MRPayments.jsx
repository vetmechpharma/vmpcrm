import { useState, useEffect } from 'react';
import { mrAPI } from '../../context/MRAuthContext';
import { fetchWithOffline, CACHE_KEYS, getCachedCustomers } from '../../lib/offlineData';
import { Card, CardContent } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Textarea } from '../../components/ui/textarea';
import { toast } from 'sonner';
import {
  Loader2, IndianRupee, Plus, CheckCircle, XCircle, Clock, Search, User
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const STATUS_BADGE = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
};

export default function MRPayments() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    customer_id: '', customer_name: '', customer_type: '', customer_phone: '',
    amount: '', mode: 'cash', notes: '', date: new Date().toISOString().split('T')[0],
  });

  useEffect(() => { fetchRequests(); }, []);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('mr_token');
      const res = await fetch(`${API_URL}/api/mr/payment-requests`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) setRequests(await res.json());
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  const openForm = async () => {
    setForm({ customer_id: '', customer_name: '', customer_type: '', customer_phone: '',
      amount: '', mode: 'cash', notes: '', date: new Date().toISOString().split('T')[0] });
    setCustomerSearch('');
    setShowForm(true);
    try {
      const result = await fetchWithOffline(() => mrAPI.getCustomers({}), CACHE_KEYS.customers);
      setCustomers(result.data);
    } catch {
      setCustomers(getCachedCustomers());
    }
  };

  const selectCustomer = (c) => {
    setForm(f => ({ ...f, customer_id: c.id, customer_name: c.name, customer_type: c.entity_type || 'doctor', customer_phone: c.phone || '' }));
    setCustomerSearch('');
  };

  const handleSubmit = async () => {
    if (!form.customer_id) return toast.error('Select a customer');
    if (!form.amount || parseFloat(form.amount) <= 0) return toast.error('Enter a valid amount');
    setSaving(true);
    try {
      const token = localStorage.getItem('mr_token');
      const res = await fetch(`${API_URL}/api/mr/payment-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ ...form, amount: parseFloat(form.amount) }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail || 'Failed'); }
      toast.success('Payment request submitted for admin approval');
      setShowForm(false);
      fetchRequests();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const filteredCustomers = customers.filter(c => {
    if (!customerSearch) return false;
    const s = customerSearch.toLowerCase();
    return c.name?.toLowerCase().includes(s) || (c.phone || '').includes(customerSearch);
  });

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;

  return (
    <div className="space-y-4" data-testid="mr-payments-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Payments</h1>
          <p className="text-sm text-slate-500">Record payments for admin approval</p>
        </div>
        <Button onClick={openForm} className="gap-2" data-testid="record-payment-btn">
          <Plus className="w-4 h-4" /> Record Payment
        </Button>
      </div>

      {requests.length === 0 ? (
        <div className="text-center py-16">
          <IndianRupee className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500">No payment requests yet</p>
          <Button variant="outline" className="mt-3" onClick={openForm}>Record your first payment</Button>
        </div>
      ) : (
        <div className="space-y-2">
          {requests.map(r => (
            <Card key={r.id} data-testid={`payment-request-${r.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-800">{r.customer_name}</span>
                      <Badge className="text-[10px]" variant="outline">{r.customer_type}</Badge>
                    </div>
                    <div className="flex gap-3 mt-1 text-xs text-slate-500">
                      <span>{r.date}</span>
                      <span>Mode: {r.mode}</span>
                      {r.notes && <span className="truncate max-w-[150px]" title={r.notes}>{r.notes}</span>}
                    </div>
                    {r.status === 'rejected' && r.rejection_reason && (
                      <p className="text-xs text-red-500 mt-1">Reason: {r.rejection_reason}</p>
                    )}
                    {r.status === 'approved' && r.approved_by && (
                      <p className="text-xs text-emerald-600 mt-1">Approved by: {r.approved_by}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-slate-800">Rs.{Number(r.amount).toLocaleString('en-IN')}</p>
                    <Badge className={STATUS_BADGE[r.status] || 'bg-slate-100 text-slate-600'}>
                      {r.status === 'pending' && <Clock className="w-3 h-3 mr-1" />}
                      {r.status === 'approved' && <CheckCircle className="w-3 h-3 mr-1" />}
                      {r.status === 'rejected' && <XCircle className="w-3 h-3 mr-1" />}
                      {r.status}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Record Payment Form */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {/* Customer Selection */}
            <div>
              <Label>Customer <span className="text-red-500">*</span></Label>
              {form.customer_id ? (
                <div className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded-lg mt-1">
                  <User className="w-4 h-4 text-blue-600" />
                  <span className="font-medium text-sm flex-1">{form.customer_name}</span>
                  <Badge className="text-[10px]" variant="outline">{form.customer_type}</Badge>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setForm(f => ({ ...f, customer_id: '', customer_name: '' }))}>
                    <XCircle className="w-4 h-4 text-slate-400" />
                  </Button>
                </div>
              ) : (
                <div className="relative mt-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input placeholder="Search customer..." value={customerSearch}
                    onChange={e => setCustomerSearch(e.target.value)} className="pl-10"
                    data-testid="payment-customer-search" />
                  {filteredCustomers.length > 0 && (
                    <div className="absolute z-50 left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {filteredCustomers.slice(0, 8).map(c => (
                        <div key={c.id} className="p-2 hover:bg-slate-50 cursor-pointer text-sm border-b last:border-0"
                          onClick={() => selectCustomer(c)}>
                          <span className="font-medium">{c.name}</span>
                          <span className="text-slate-400 ml-2">{c.phone}</span>
                          <Badge className="ml-2 text-[10px]" variant="outline">{c.entity_type}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Amount (Rs.) <span className="text-red-500">*</span></Label>
                <Input type="number" min="0" step="0.01" value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="0.00" data-testid="payment-amount" />
              </div>
              <div>
                <Label>Date</Label>
                <Input type="date" value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
            </div>

            <div>
              <Label>Payment Mode</Label>
              <Select value={form.mode} onValueChange={v => setForm(f => ({ ...f, mode: v }))}>
                <SelectTrigger data-testid="payment-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Notes (optional)</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Any details about this payment..." rows={2} data-testid="payment-notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={saving} data-testid="submit-payment-btn">
              {saving ? 'Submitting...' : 'Submit for Approval'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
