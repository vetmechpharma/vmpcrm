import { useState, useEffect } from 'react';
import { mrAPI, mrReportsAPI } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { Loader2, BarChart3, UserCog, MapPin, Calendar, Activity, ClipboardList } from 'lucide-react';
import { formatDate, formatDateTime } from '../lib/utils';

export const MRReports = () => {
  const [mrs, setMrs] = useState([]);
  const [reports, setReports] = useState({ visits: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [mrFilter, setMrFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => { fetchMRs(); fetchReports(); }, []);

  const fetchMRs = async () => {
    try {
      const res = await mrAPI.getAll();
      setMrs(res.data);
    } catch { /* silent */ }
  };

  const fetchReports = async () => {
    setLoading(true);
    try {
      const params = {};
      if (mrFilter) params.mr_id = mrFilter;
      if (dateFrom) params.from_date = dateFrom;
      if (dateTo) params.to_date = dateTo;
      const res = await mrReportsAPI.getReports(params);
      setReports(res.data);
    } catch { toast.error('Failed to fetch reports'); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-6" data-testid="mr-reports-page">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">MR Reports & Activity</h1>
          <p className="text-slate-500">Track Medical Representative field activity and visits</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-slate-500">Total MRs</p><p className="text-2xl font-bold text-indigo-600">{mrs.length}</p></div>
            <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center"><UserCog className="w-5 h-5 text-indigo-600" /></div>
          </div>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-slate-500">Active MRs</p><p className="text-2xl font-bold text-emerald-600">{mrs.filter(m => m.status === 'active').length}</p></div>
            <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center"><Activity className="w-5 h-5 text-emerald-600" /></div>
          </div>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-slate-500">Total Visits</p><p className="text-2xl font-bold text-blue-600">{reports.total}</p></div>
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center"><MapPin className="w-5 h-5 text-blue-600" /></div>
          </div>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-slate-500">States Covered</p><p className="text-2xl font-bold text-purple-600">{new Set(mrs.map(m => m.state)).size}</p></div>
            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center"><BarChart3 className="w-5 h-5 text-purple-600" /></div>
          </div>
        </CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-end">
        <div className="space-y-1">
          <label className="text-xs text-slate-500">Filter by MR</label>
          <Select value={mrFilter || 'all'} onValueChange={v => setMrFilter(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-48"><SelectValue placeholder="All MRs" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All MRs</SelectItem>
              {mrs.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-slate-500">From</label>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-slate-500">To</label>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-40" />
        </div>
        <Button onClick={fetchReports} variant="outline">Apply</Button>
      </div>

      {/* MR List with Territory */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2"><UserCog className="w-4 h-4" />MR Territory Overview</h3>
          {mrs.length > 0 ? (
            <div className="space-y-3">
              {mrs.map(mr => (
                <div key={mr.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg" data-testid={`mr-report-${mr.id}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${mr.status === 'active' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-500'}`}>
                      {mr.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{mr.name}</p>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <MapPin className="w-3 h-3" />{mr.state}
                        <span className="text-slate-300">|</span>
                        {(mr.districts || []).slice(0, 3).join(', ')}
                        {(mr.districts || []).length > 3 && ` +${mr.districts.length - 3}`}
                      </div>
                    </div>
                  </div>
                  <Badge className={mr.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}>{mr.status}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-slate-400 py-8">No MRs registered yet</p>
          )}
        </CardContent>
      </Card>

      {/* Activity Log */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2"><ClipboardList className="w-4 h-4" />Activity Log</h3>
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
          ) : reports.visits.length > 0 ? (
            <div className="space-y-2">
              {reports.visits.map(v => (
                <div key={v.id} className="p-3 border rounded-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-sm">{v.mr_name} visited {v.entity_name}</p>
                      <p className="text-xs text-slate-500">{v.notes}</p>
                    </div>
                    <span className="text-xs text-slate-400">{formatDateTime(v.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Activity className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-500">No Activity Yet</h3>
              <p className="text-sm text-slate-400">MR visit reports will appear here once MRs start using the app</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MRReports;
