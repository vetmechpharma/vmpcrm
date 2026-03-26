import { useState, useEffect } from 'react';
import { mrAPI } from '../../context/MRAuthContext';
import { fetchWithOffline, CACHE_KEYS, getCachedCustomers } from '../../lib/offlineData';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Textarea } from '../../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { toast } from 'sonner';
import { Loader2, Plus, ClipboardList, Search, Phone, Calendar } from 'lucide-react';
import { formatDate } from '../../lib/utils';

const OUTCOMES = [
  { value: 'interested', label: 'Interested', color: 'bg-blue-100 text-blue-700' },
  { value: 'not_interested', label: 'Not Interested', color: 'bg-slate-100 text-slate-600' },
  { value: 'order_placed', label: 'Order Placed', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'follow_up_required', label: 'Follow-up Required', color: 'bg-orange-100 text-orange-700' },
];

export default function MRVisits() {
  const [visits, setVisits] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [searchCustomer, setSearchCustomer] = useState('');

  const [form, setForm] = useState({
    entity_type: '', entity_id: '', entity_name: '', visit_date: new Date().toISOString().slice(0, 10),
    notes: '', outcome: '', next_follow_up_date: '', next_follow_up_notes: '',
  });

  useEffect(() => { fetchVisits(); }, []);

  const fetchVisits = async () => {
    setLoading(true);
    try {
      const result = await fetchWithOffline(() => mrAPI.getVisits(), CACHE_KEYS.visits);
      setVisits(result.data);
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  const fetchCustomers = async () => {
    try {
      const result = await fetchWithOffline(() => mrAPI.getCustomers({}), CACHE_KEYS.customers);
      setCustomers(result.data);
    } catch {
      setCustomers(getCachedCustomers());
    }
  };

  const openNewVisit = () => {
    setForm({ entity_type: '', entity_id: '', entity_name: '', visit_date: new Date().toISOString().slice(0, 10), notes: '', outcome: '', next_follow_up_date: '', next_follow_up_notes: '' });
    fetchCustomers();
    setShowModal(true);
  };

  const selectCustomer = (c) => {
    setForm({ ...form, entity_type: c.entity_type, entity_id: c.id, entity_name: c.name });
    setSearchCustomer('');
  };

  const handleSave = async () => {
    if (!form.entity_id) { toast.error('Select a customer'); return; }
    if (!form.outcome) { toast.error('Select an outcome'); return; }
    setFormLoading(true);
    try {
      await mrAPI.createVisit(form);
      toast.success('Visit recorded');
      setShowModal(false);
      fetchVisits();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to save'); }
    finally { setFormLoading(false); }
  };

  const outcomeBadge = (o) => OUTCOMES.find(x => x.value === o) || { label: o, color: 'bg-slate-100 text-slate-600' };
  const filteredCustomers = customers.filter(c => !searchCustomer || c.name.toLowerCase().includes(searchCustomer.toLowerCase()) || (c.phone || '').includes(searchCustomer));

  return (
    <div className="space-y-4" data-testid="mr-visits-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Visit Log</h1>
          <p className="text-sm text-slate-500">Record and track your field visits</p>
        </div>
        <Button onClick={openNewVisit} style={{ background: '#1e3a5f' }} data-testid="mr-new-visit-btn"><Plus className="w-4 h-4 mr-2" />New Visit</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
      ) : visits.length > 0 ? (
        <div className="space-y-2">
          {visits.map(v => {
            const ob = outcomeBadge(v.outcome);
            return (
              <Card key={v.id} data-testid={`mr-visit-${v.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm text-slate-800">{v.entity_name}</p>
                        <Badge variant="outline" className="text-[10px]">{v.entity_type}</Badge>
                        <Badge className={`text-[10px] ${ob.color}`}>{ob.label}</Badge>
                      </div>
                      {v.notes && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{v.notes}</p>}
                      {v.next_follow_up_date && (
                        <p className="text-xs text-orange-600 mt-1 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />Follow-up: {v.next_follow_up_date}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-slate-400 whitespace-nowrap ml-3">{formatDate(v.visit_date)}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16">
          <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">No visits recorded yet</p>
          <Button variant="outline" className="mt-4" onClick={openNewVisit}>Record Your First Visit</Button>
        </div>
      )}

      {/* New Visit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Record Visit</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            {/* Customer Selection */}
            <div className="space-y-2">
              <Label>Customer *</Label>
              {form.entity_id ? (
                <div className="flex items-center justify-between bg-slate-50 rounded-lg p-3">
                  <div>
                    <p className="font-medium text-sm">{form.entity_name}</p>
                    <Badge variant="outline" className="text-[10px] mt-1">{form.entity_type}</Badge>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setForm({ ...form, entity_id: '', entity_name: '', entity_type: '' })}>Change</Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input placeholder="Search customer..." value={searchCustomer} onChange={e => setSearchCustomer(e.target.value)} className="pl-10" data-testid="mr-visit-customer-search" />
                  </div>
                  <div className="max-h-40 overflow-y-auto border rounded-lg">
                    {filteredCustomers.slice(0, 20).map(c => (
                      <button key={c.id} onClick={() => selectCustomer(c)} className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b last:border-0 text-sm" data-testid={`mr-visit-select-${c.id}`}>
                        <span className="font-medium">{c.name}</span>
                        <span className="text-xs text-slate-400 ml-2">({c.entity_type})</span>
                        {c.phone && <span className="text-xs text-slate-400 ml-1">- {c.phone}</span>}
                      </button>
                    ))}
                    {filteredCustomers.length === 0 && <p className="text-center text-sm text-slate-400 py-3">No customers found</p>}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Visit Date</Label>
              <Input type="date" value={form.visit_date} onChange={e => setForm({ ...form, visit_date: e.target.value })} />
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Visit details, discussion points..." rows={3} data-testid="mr-visit-notes" />
            </div>

            <div className="space-y-2">
              <Label>Outcome *</Label>
              <div className="grid grid-cols-2 gap-2">
                {OUTCOMES.map(o => (
                  <button key={o.value} onClick={() => setForm({ ...form, outcome: o.value })}
                    className={`p-2.5 rounded-lg border text-sm font-medium transition-colors ${form.outcome === o.value ? 'ring-2 ring-offset-1 ring-slate-400 ' + o.color : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                    data-testid={`mr-visit-outcome-${o.value}`}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            {form.outcome === 'follow_up_required' && (
              <div className="space-y-3 p-3 bg-orange-50 rounded-lg border border-orange-100">
                <div className="space-y-2">
                  <Label>Follow-up Date</Label>
                  <Input type="date" value={form.next_follow_up_date} onChange={e => setForm({ ...form, next_follow_up_date: e.target.value })} data-testid="mr-visit-followup-date" />
                </div>
                <div className="space-y-2">
                  <Label>Follow-up Notes</Label>
                  <Input value={form.next_follow_up_notes} onChange={e => setForm({ ...form, next_follow_up_notes: e.target.value })} placeholder="What to follow up on..." />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={formLoading} style={{ background: '#1e3a5f' }} data-testid="mr-visit-save-btn">
              {formLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Save Visit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
