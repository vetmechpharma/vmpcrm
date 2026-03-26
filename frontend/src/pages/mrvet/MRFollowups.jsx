import { useState, useEffect } from 'react';
import { mrAPI } from '../../context/MRAuthContext';
import { fetchWithOffline, CACHE_KEYS } from '../../lib/offlineData';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { toast } from 'sonner';
import { Loader2, CalendarCheck, Calendar, CheckCircle, AlertTriangle, Clock } from 'lucide-react';
import { formatDate } from '../../lib/utils';

export default function MRFollowups() {
  const [followups, setFollowups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('today');
  const [completing, setCompleting] = useState(null);

  useEffect(() => { fetchFollowups(); }, [tab]);

  const fetchFollowups = async () => {
    setLoading(true);
    try {
      const result = await fetchWithOffline(
        () => mrAPI.getFollowups({ filter_type: tab }),
        `${CACHE_KEYS.followups}_${tab}`
      );
      setFollowups(result.data);
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  const markDone = async (visitId) => {
    setCompleting(visitId);
    try {
      await mrAPI.updateVisit(visitId, { follow_up_done: true });
      toast.success('Follow-up completed');
      fetchFollowups();
    } catch { toast.error('Failed to update'); }
    finally { setCompleting(null); }
  };

  const tabs = [
    { id: 'today', label: 'Today', icon: Calendar },
    { id: 'overdue', label: 'Overdue', icon: AlertTriangle },
    { id: 'upcoming', label: 'Upcoming', icon: Clock },
  ];

  return (
    <div className="space-y-4" data-testid="mr-followups-page">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Follow-ups</h1>
        <p className="text-sm text-slate-500">Manage your scheduled follow-ups</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {tabs.map(t => (
          <Button key={t.id} variant={tab === t.id ? 'default' : 'outline'} size="sm"
            onClick={() => setTab(t.id)}
            style={tab === t.id ? { background: '#1e3a5f' } : {}}
            data-testid={`mr-followup-tab-${t.id}`}>
            <t.icon className="w-3.5 h-3.5 mr-1.5" />{t.label}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
      ) : followups.length > 0 ? (
        <div className="space-y-2">
          {followups.map(f => (
            <Card key={f.id} className={tab === 'overdue' ? 'border-orange-200' : ''} data-testid={`mr-followup-${f.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm text-slate-800">{f.entity_name}</p>
                      <Badge variant="outline" className="text-[10px]">{f.entity_type}</Badge>
                    </div>
                    {f.next_follow_up_notes && <p className="text-xs text-slate-500 mt-1">{f.next_follow_up_notes}</p>}
                    {f.notes && <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">Last visit: {f.notes}</p>}
                    <p className={`text-xs mt-1.5 flex items-center gap-1 ${tab === 'overdue' ? 'text-red-600 font-medium' : 'text-slate-500'}`}>
                      <Calendar className="w-3 h-3" />{formatDate(f.next_follow_up_date)}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" className="gap-1.5 text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                    onClick={() => markDone(f.id)} disabled={completing === f.id} data-testid={`mr-followup-done-${f.id}`}>
                    {completing === f.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}Done
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <CalendarCheck className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">{tab === 'today' ? 'No follow-ups for today' : tab === 'overdue' ? 'No overdue follow-ups' : 'No upcoming follow-ups'}</p>
        </div>
      )}
    </div>
  );
}
