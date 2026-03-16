import { useState, useEffect } from 'react';
import { mrAPI, mrReportsAPI } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import {
  Loader2, UserCog, MapPin, Activity, ClipboardList,
  ShoppingCart, AlertTriangle, TrendingUp, Calendar, Eye
} from 'lucide-react';
import { formatDate, formatDateTime } from '../lib/utils';

const outcomeLabels = {
  interested: 'Interested',
  follow_up_required: 'Follow-up',
  order_placed: 'Order Placed',
  not_interested: 'Not Interested',
  unavailable: 'Unavailable',
};

const outcomeBadge = {
  interested: 'bg-emerald-100 text-emerald-700',
  follow_up_required: 'bg-amber-100 text-amber-700',
  order_placed: 'bg-blue-100 text-blue-700',
  not_interested: 'bg-red-100 text-red-700',
  unavailable: 'bg-slate-100 text-slate-500',
};

export const MRReports = () => {
  const [data, setData] = useState({ summary: {}, mr_stats: [], visits: [], orders: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [mrFilter, setMrFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [mrs, setMrs] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => { fetchMRs(); fetchReports(); }, []);

  const fetchMRs = async () => {
    try { const res = await mrAPI.getAll(); setMrs(res.data); }
    catch { /* silent */ }
  };

  const fetchReports = async () => {
    setLoading(true);
    try {
      const params = {};
      if (mrFilter) params.mr_id = mrFilter;
      if (dateFrom) params.from_date = dateFrom;
      if (dateTo) params.to_date = dateTo;
      const res = await mrReportsAPI.getReports(params);
      setData(res.data);
    } catch { toast.error('Failed to fetch reports'); }
    finally { setLoading(false); }
  };

  const applyFilters = () => fetchReports();

  const s = data.summary || {};

  return (
    <div className="space-y-6" data-testid="mr-reports-page">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">MR Reports</h1>
          <p className="text-slate-500">Field activity, visits, and order analytics</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: 'Total MRs', value: s.total_mrs || 0, icon: UserCog, color: 'indigo' },
          { label: 'Active MRs', value: s.active_mrs || 0, icon: Activity, color: 'emerald' },
          { label: 'Total Visits', value: s.total_visits || 0, icon: MapPin, color: 'blue' },
          { label: "Today's Visits", value: s.today_visits || 0, icon: Calendar, color: 'teal' },
          { label: 'Total Orders', value: s.total_orders || 0, icon: ShoppingCart, color: 'purple' },
          { label: 'Pending Orders', value: s.pending_orders || 0, icon: AlertTriangle, color: 'amber' },
          { label: 'States', value: s.states_covered || 0, icon: TrendingUp, color: 'rose' },
        ].map(c => (
          <Card key={c.label}><CardContent className="p-4">
            <p className="text-xs text-slate-500 mb-1">{c.label}</p>
            <p className={`text-xl font-bold text-${c.color}-600`}>{c.value}</p>
          </CardContent></Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-end">
        <div className="space-y-1">
          <label className="text-xs text-slate-500">MR</label>
          <Select value={mrFilter || 'all'} onValueChange={v => setMrFilter(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-48" data-testid="mr-reports-filter-mr"><SelectValue placeholder="All MRs" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All MRs</SelectItem>
              {mrs.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-slate-500">From</label>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-40" data-testid="mr-reports-date-from" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-slate-500">To</label>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-40" data-testid="mr-reports-date-to" />
        </div>
        <Button onClick={applyFilters} variant="outline" data-testid="mr-reports-apply-btn">Apply</Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {[
          { key: 'overview', label: 'MR Overview' },
          { key: 'visits', label: 'Visit Log' },
          { key: 'orders', label: 'Orders' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
            data-testid={`mr-reports-tab-${tab.key}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
      ) : (
        <>
          {/* MR Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-3">
              {(data.mr_stats || []).length > 0 ? data.mr_stats.map(mr => (
                <Card key={mr.id} data-testid={`mr-stat-${mr.id}`}>
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                          mr.status === 'active' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-500'}`}>
                          {mr.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold">{mr.name}</p>
                            <Badge className={mr.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}>{mr.status}</Badge>
                          </div>
                          <p className="text-xs text-slate-500 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />{mr.state} - {(mr.districts || []).join(', ')}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-4 text-center">
                        <div className="min-w-[60px]">
                          <p className="text-lg font-bold text-blue-600">{mr.total_visits}</p>
                          <p className="text-[10px] text-slate-500">Visits</p>
                        </div>
                        <div className="min-w-[60px]">
                          <p className="text-lg font-bold text-teal-600">{mr.today_visits}</p>
                          <p className="text-[10px] text-slate-500">Today</p>
                        </div>
                        <div className="min-w-[60px]">
                          <p className="text-lg font-bold text-amber-600">{mr.pending_followups}</p>
                          <p className="text-[10px] text-slate-500">Follow-ups</p>
                        </div>
                        <div className="min-w-[60px]">
                          <p className="text-lg font-bold text-purple-600">{mr.total_orders}</p>
                          <p className="text-[10px] text-slate-500">Orders</p>
                        </div>
                        <div className="min-w-[60px]">
                          <p className="text-lg font-bold text-red-500">{mr.cancelled_orders}</p>
                          <p className="text-[10px] text-slate-500">Cancelled</p>
                        </div>
                      </div>
                    </div>

                    {/* Outcome breakdown */}
                    {Object.keys(mr.outcomes || {}).length > 0 && (
                      <div className="mt-3 pt-3 border-t flex flex-wrap gap-2">
                        {Object.entries(mr.outcomes).map(([key, count]) => (
                          <Badge key={key} className={outcomeBadge[key] || 'bg-slate-100 text-slate-500'}>
                            {outcomeLabels[key] || key}: {count}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )) : (
                <div className="text-center py-12">
                  <UserCog className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">No MR data available</p>
                </div>
              )}
            </div>
          )}

          {/* Visit Log Tab */}
          {activeTab === 'visits' && (
            <div className="space-y-2">
              {(data.visits || []).length > 0 ? data.visits.map(v => (
                <Card key={v.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{v.mr_name}</span>
                          <span className="text-slate-400">visited</span>
                          <span className="font-medium text-sm">{v.entity_name}</span>
                          <Badge className={outcomeBadge[v.outcome] || 'bg-slate-100 text-slate-500'}>
                            {outcomeLabels[v.outcome] || v.outcome}
                          </Badge>
                        </div>
                        {v.notes && <p className="text-xs text-slate-500 mt-1">{v.notes}</p>}
                        {v.next_follow_up_date && (
                          <p className="text-xs text-amber-600 mt-1">Follow-up: {v.next_follow_up_date}</p>
                        )}
                      </div>
                      <span className="text-xs text-slate-400 whitespace-nowrap">{v.visit_date}</span>
                    </div>
                  </CardContent>
                </Card>
              )) : (
                <div className="text-center py-12">
                  <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">No visits recorded yet</p>
                </div>
              )}
            </div>
          )}

          {/* Orders Tab */}
          {activeTab === 'orders' && (
            <div className="space-y-2">
              {(data.orders || []).length > 0 ? data.orders.map(o => (
                <Card key={o.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm font-semibold text-indigo-700">{o.order_number}</span>
                          <Badge className={{
                            pending: 'bg-amber-100 text-amber-700',
                            confirmed: 'bg-blue-100 text-blue-700',
                            dispatched: 'bg-purple-100 text-purple-700',
                            delivered: 'bg-emerald-100 text-emerald-700',
                            cancelled: 'bg-red-100 text-red-700',
                          }[o.status] || 'bg-slate-100'}>{o.status}</Badge>
                          {o.cancel_requested && <Badge className="bg-red-50 text-red-600">Cancel Req</Badge>}
                        </div>
                        <p className="text-sm text-slate-600 mt-1">{o.doctor_name}</p>
                        <p className="text-xs text-slate-400">
                          by <span className="text-indigo-600">{o.mr_name}</span> - {(o.items || []).length} item(s)
                        </p>
                      </div>
                      <span className="text-xs text-slate-400 whitespace-nowrap">{formatDate(o.created_at)}</span>
                    </div>
                  </CardContent>
                </Card>
              )) : (
                <div className="text-center py-12">
                  <ShoppingCart className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">No MR orders yet</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default MRReports;
