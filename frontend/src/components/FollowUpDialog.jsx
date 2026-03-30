import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Loader2, PhoneCall, History, Calendar, ArrowRight } from 'lucide-react';
import { followupsAPI } from '../lib/api';
import { toast } from 'sonner';

const LEAD_STATUSES = [
  { value: 'Pipeline', label: 'Pipeline' },
  { value: 'Contacted', label: 'Contacted' },
  { value: 'Customer', label: 'Customer' },
  { value: 'Not Interested', label: 'Not Interested' },
  { value: 'Closed', label: 'Closed' },
];

const getStatusColor = (status) => {
  const colors = {
    'Pipeline': 'bg-blue-100 text-blue-700',
    'Contacted': 'bg-amber-100 text-amber-700',
    'Customer': 'bg-green-100 text-green-700',
    'Not Interested': 'bg-red-100 text-red-700',
    'Closed': 'bg-slate-100 text-slate-600',
  };
  return colors[status] || 'bg-slate-100 text-slate-600';
};

const formatDate = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
const formatDateTime = (d) => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

export const FollowUpDialog = ({
  open,
  onClose,
  entity,
  entityType,
  onFollowUpSaved,
}) => {
  const [followUpData, setFollowUpData] = useState({
    notes: '', new_status: entity?.lead_status || 'Contacted',
    next_follow_up_date: '', next_follow_up_time: '',
  });
  const [followUpHistory, setFollowUpHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const loadHistory = async () => {
    if (!entity?.id || loaded) return;
    setLoading(true);
    try {
      const res = await followupsAPI.getHistory(entityType, entity.id);
      setFollowUpHistory(res.data);
    } catch { setFollowUpHistory([]); }
    finally { setLoading(false); setLoaded(true); }
  };

  useEffect(() => {
    if (open && !loaded) {
      loadHistory();
    }
  }, [open, loaded, entity?.id]);

  const handleSubmit = async () => {
    if (!followUpData.notes.trim()) { toast.error('Please add follow-up notes'); return; }
    setSubmitting(true);
    try {
      await followupsAPI.create({
        entity_type: entityType,
        entity_id: entity.id,
        notes: followUpData.notes,
        new_status: followUpData.new_status,
        next_follow_up_date: followUpData.next_follow_up_date || null,
        next_follow_up_time: followUpData.next_follow_up_time || null,
      });
      toast.success('Follow-up saved');
      setFollowUpData({ notes: '', new_status: entity?.lead_status || 'Contacted', next_follow_up_date: '', next_follow_up_time: '' });
      setLoaded(false);
      onFollowUpSaved?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save follow-up');
    } finally { setSubmitting(false); }
  };

  const handleOpenChange = (isOpen) => {
    if (!isOpen) {
      setLoaded(false);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PhoneCall className="w-5 h-5 text-green-600" />
            Follow-up: {entity?.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex items-center gap-2 text-sm bg-slate-50 p-3 rounded-lg">
            <span className="text-slate-500">Current Status:</span>
            <Badge className={getStatusColor(entity?.lead_status)}>{entity?.lead_status}</Badge>
            {entity?.follow_up_date && (
              <span className="text-slate-500 ml-2">| Follow-up: {formatDate(entity?.follow_up_date)}</span>
            )}
          </div>

          <div className="space-y-2">
            <Label>What happened? *</Label>
            <Textarea
              value={followUpData.notes}
              onChange={(e) => setFollowUpData({...followUpData, notes: e.target.value})}
              placeholder="e.g., Called and they asked to call back after 2 days..."
              rows={3}
              data-testid="followup-notes-input"
            />
          </div>

          <div className="space-y-2">
            <Label>Update Lead Status</Label>
            <Select value={followUpData.new_status} onValueChange={(v) => setFollowUpData({...followUpData, new_status: v})}>
              <SelectTrigger data-testid="followup-status-select"><SelectValue /></SelectTrigger>
              <SelectContent>
                {LEAD_STATUSES.map((s) => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Next Follow-up Date</Label>
              <Input type="date" value={followUpData.next_follow_up_date} onChange={(e) => setFollowUpData({...followUpData, next_follow_up_date: e.target.value})} data-testid="followup-date-input" />
            </div>
            <div className="space-y-2">
              <Label>Time (Optional)</Label>
              <Input type="time" value={followUpData.next_follow_up_time} onChange={(e) => setFollowUpData({...followUpData, next_follow_up_time: e.target.value})} />
            </div>
          </div>

          <div className="border-t pt-4">
            <h4 className="font-medium flex items-center gap-2 mb-3 text-sm">
              <History className="w-4 h-4" /> Follow-up History
            </h4>
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : followUpHistory.length > 0 ? (
              <div className="space-y-3 max-h-48 overflow-y-auto">
                {followUpHistory.map((fu) => (
                  <div key={fu.id} className={`p-3 rounded-lg text-sm border-l-4 ${fu.status === 'open' ? 'border-l-green-500 bg-green-50' : 'border-l-slate-300 bg-slate-50'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-slate-800 flex-1">{fu.notes}</p>
                      <Badge variant="outline" className={fu.status === 'open' ? 'text-green-600 border-green-300' : 'text-slate-400 border-slate-200'}>
                        {fu.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                      <span>{fu.created_by}</span>
                      <span>{formatDateTime(fu.created_at)}</span>
                      {fu.new_status && (
                        <span className="flex items-center gap-1"><ArrowRight className="w-3 h-3" /><Badge className={`${getStatusColor(fu.new_status)} text-[10px]`}>{fu.new_status}</Badge></span>
                      )}
                      {fu.next_follow_up_date && (
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Next: {formatDate(fu.next_follow_up_date)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">No follow-up history yet</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting} data-testid="followup-submit-btn">
            {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Save Follow-up
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
