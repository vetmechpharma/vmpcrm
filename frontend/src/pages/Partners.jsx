import { useState, useEffect, useCallback } from 'react';
import { partnersAPI } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { toast } from 'sonner';
import {
  Plus, Trash2, Edit2, Loader2, Users, Phone, Send, Eye, Clock,
  FileText, IndianRupee, TrendingUp, Calendar, MessageCircle, BarChart3
} from 'lucide-react';

const REPORT_TYPES = [
  { key: 'outstanding', label: 'Outstanding Report', desc: 'Doctors, Medicals, Agencies outstanding with totals', icon: IndianRupee, color: 'text-red-600 bg-red-50 border-red-200' },
  { key: 'orders_expenses', label: 'Orders & Expenses', desc: 'Order status counts + expense breakdown by category', icon: BarChart3, color: 'text-blue-600 bg-blue-50 border-blue-200' },
  { key: 'top_performers', label: 'Top Performers', desc: 'Top 5 items by qty, Top 5 customers by invoice value', icon: TrendingUp, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
];

export const Partners = () => {
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingPartner, setEditingPartner] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '' });
  const [saving, setSaving] = useState(false);

  // Reports
  const [selectedReport, setSelectedReport] = useState('outstanding');
  const [period, setPeriod] = useState('week');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [previewMessages, setPreviewMessages] = useState([]);
  const [previewing, setPreviewing] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendingAll, setSendingAll] = useState(false);
  const [history, setHistory] = useState([]);

  const fetchPartners = useCallback(async () => {
    try {
      const res = await partnersAPI.getAll();
      setPartners(res.data);
    } catch { toast.error('Failed to load partners'); }
    finally { setLoading(false); }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await partnersAPI.getHistory();
      setHistory(res.data);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchPartners(); fetchHistory(); }, []);

  const handleSave = async () => {
    if (!form.name || !form.phone) { toast.error('Name and phone required'); return; }
    setSaving(true);
    try {
      if (editingPartner) {
        await partnersAPI.update(editingPartner.id, form);
        toast.success('Partner updated');
      } else {
        await partnersAPI.create(form);
        toast.success('Partner added');
      }
      setShowAddDialog(false);
      setEditingPartner(null);
      setForm({ name: '', phone: '' });
      fetchPartners();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this partner?')) return;
    try {
      await partnersAPI.delete(id);
      toast.success('Partner deleted');
      fetchPartners();
    } catch { toast.error('Failed to delete'); }
  };

  const handlePreview = async () => {
    setPreviewing(true);
    setPreviewMessages([]);
    try {
      const res = await partnersAPI.previewReport({
        report_type: selectedReport,
        period,
        from_date: period === 'custom' ? fromDate : undefined,
        to_date: period === 'custom' ? toDate : undefined,
      });
      setPreviewMessages(res.data.messages || []);
    } catch (e) { toast.error(e.response?.data?.detail || 'Preview failed'); }
    finally { setPreviewing(false); }
  };

  const handleSend = async (reportType) => {
    const activeCount = partners.filter(p => p.active !== false).length;
    if (activeCount === 0) { toast.error('No active partners to send to'); return; }
    if (!window.confirm(`Send ${reportType === 'all' ? 'ALL reports' : reportType + ' report'} to ${activeCount} partner(s)?`)) return;
    if (reportType === 'all') setSendingAll(true);
    else setSending(reportType);
    try {
      const res = await partnersAPI.sendReport({
        report_type: reportType,
        period,
        from_date: period === 'custom' ? fromDate : undefined,
        to_date: period === 'custom' ? toDate : undefined,
      });
      toast.success(res.data.message);
      fetchHistory();
    } catch (e) { toast.error(e.response?.data?.detail || 'Send failed'); }
    finally { setSending(false); setSendingAll(false); }
  };

  return (
    <div className="space-y-6" data-testid="partners-page">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Partner Reports</h1>
          <p className="text-sm text-slate-500">Manage partners and send business reports via WhatsApp</p>
        </div>
        <Button onClick={() => { setForm({ name: '', phone: '' }); setEditingPartner(null); setShowAddDialog(true); }} data-testid="add-partner-btn">
          <Plus className="w-4 h-4 mr-2" /> Add Partner
        </Button>
      </div>

      {/* Partners List */}
      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2"><Users className="w-4 h-4" /> Partners ({partners.length})</h2>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
        ) : partners.length === 0 ? (
          <Card><CardContent className="p-6 text-center text-slate-400">No partners added yet. Add partners to send reports.</CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {partners.map(p => (
              <Card key={p.id} className={`border ${p.active === false ? 'opacity-50' : ''}`} data-testid={`partner-${p.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-slate-800">{p.name}</p>
                      <p className="text-sm text-slate-500 flex items-center gap-1 mt-0.5"><Phone className="w-3 h-3" /> {p.phone}</p>
                      {p.active === false && <Badge className="mt-1 bg-red-100 text-red-600 text-[10px]">Inactive</Badge>}
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setEditingPartner(p); setForm({ name: p.name, phone: p.phone }); setShowAddDialog(true); }}>
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500" onClick={() => handleDelete(p.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Reports Section */}
      <div className="border-t pt-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2"><FileText className="w-4 h-4" /> Send Reports</h2>

        {/* Period Selection */}
        <div className="flex gap-2 flex-wrap items-end mb-4">
          <div className="flex gap-1 bg-slate-50 p-1 rounded-lg border">
            {[['week', 'This Week'], ['month', 'This Month'], ['custom', 'Custom']].map(([v, l]) => (
              <Button key={v} variant={period === v ? 'default' : 'ghost'} size="sm" className="text-xs" onClick={() => setPeriod(v)}>{l}</Button>
            ))}
          </div>
          {period === 'custom' && (
            <>
              <div><Label className="text-xs">From</Label><Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-36 h-8 text-xs" /></div>
              <div><Label className="text-xs">To</Label><Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-36 h-8 text-xs" /></div>
            </>
          )}
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-8" onClick={() => handleSend('all')} disabled={sendingAll || partners.length === 0} data-testid="send-all-btn">
            {sendingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Send className="w-3.5 h-3.5 mr-1" />}
            Send All Reports
          </Button>
        </div>

        {/* Report Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {REPORT_TYPES.map(rt => (
            <Card key={rt.key} className={`border ${rt.color.split(' ').slice(1).join(' ')} cursor-pointer hover:shadow-md transition-shadow`}
              onClick={() => { setSelectedReport(rt.key); handlePreviewForType(rt.key); }} data-testid={`report-card-${rt.key}`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${rt.color.split(' ').slice(1, 3).join(' ')}`}>
                    <rt.icon className={`w-5 h-5 ${rt.color.split(' ')[0]}`} />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-slate-800">{rt.label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{rt.desc}</p>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={(e) => { e.stopPropagation(); setSelectedReport(rt.key); handlePreviewForType(rt.key); }} data-testid={`preview-${rt.key}`}>
                    <Eye className="w-3 h-3 mr-1" /> Preview
                  </Button>
                  <Button size="sm" className="h-7 text-xs flex-1 bg-emerald-600 hover:bg-emerald-700" disabled={sending === rt.key || partners.length === 0}
                    onClick={(e) => { e.stopPropagation(); handleSend(rt.key); }} data-testid={`send-${rt.key}`}>
                    {sending === rt.key ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <MessageCircle className="w-3 h-3 mr-1" />}
                    Send
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Preview Area */}
        {(previewing || previewMessages.length > 0) && (
          <div className="mt-4 border rounded-lg p-4 bg-slate-50">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">Preview</h3>
            {previewing ? (
              <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin" /></div>
            ) : (
              <div className="space-y-3">
                {previewMessages.map((msg, i) => (
                  <div key={i} className="bg-white border rounded-lg p-3 font-mono text-xs whitespace-pre-wrap text-slate-700 leading-relaxed max-h-64 overflow-y-auto" data-testid={`preview-msg-${i}`}>
                    {msg}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Send History */}
      {history.length > 0 && (
        <div className="border-t pt-4">
          <h2 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2"><Clock className="w-4 h-4" /> Recent Send History</h2>
          <div className="space-y-1">
            {history.slice(0, 10).map(h => (
              <div key={h.id} className="flex items-center gap-3 text-xs text-slate-600 py-1 border-b border-slate-100">
                <span className="text-slate-400 w-36">{h.sent_at ? new Date(h.sent_at).toLocaleString('en-IN') : '-'}</span>
                <Badge variant="outline" className="text-[10px]">{h.trigger || 'manual'}</Badge>
                <span>{h.message_count} message(s)</span>
                <span className="text-emerald-600">{h.partners_sent} sent</span>
                {h.partners_failed > 0 && <span className="text-red-500">{h.partners_failed} failed</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add/Edit Partner Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editingPartner ? 'Edit Partner' : 'Add Partner'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Partner name" data-testid="partner-name-input" />
            </div>
            <div className="space-y-2">
              <Label>Phone Number *</Label>
              <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="10-digit phone" data-testid="partner-phone-input" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} data-testid="save-partner-btn">
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}{editingPartner ? 'Update' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  // Helper for preview
  function handlePreviewForType(type) {
    setSelectedReport(type);
    setPreviewing(true);
    setPreviewMessages([]);
    partnersAPI.previewReport({
      report_type: type,
      period,
      from_date: period === 'custom' ? fromDate : undefined,
      to_date: period === 'custom' ? toDate : undefined,
    }).then(res => {
      setPreviewMessages(res.data.messages || []);
    }).catch(e => {
      toast.error(e.response?.data?.detail || 'Preview failed');
    }).finally(() => setPreviewing(false));
  }
};

export default Partners;
