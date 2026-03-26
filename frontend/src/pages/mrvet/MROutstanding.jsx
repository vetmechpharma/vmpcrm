import { useState, useEffect, useMemo } from 'react';
import { mrAPI } from '../../context/MRAuthContext';
import { fetchWithOffline, CACHE_KEYS, getCachedOutstanding, getCacheTimestamp } from '../../lib/offlineData';
import { Card, CardContent } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { toast } from 'sonner';
import {
  Loader2, Search, IndianRupee, Users, Store, Building,
  RefreshCw, WifiOff, Clock, TrendingUp, TrendingDown, Phone
} from 'lucide-react';
import { Button } from '../../components/ui/button';

const TYPE_CONFIG = {
  doctor: { label: 'Doctors', icon: Users, color: '#3b82f6', bg: 'bg-blue-50', badge: 'bg-blue-100 text-blue-700', border: 'border-blue-200' },
  medical: { label: 'Medicals', icon: Store, color: '#10b981', bg: 'bg-emerald-50', badge: 'bg-emerald-100 text-emerald-700', border: 'border-emerald-200' },
  agency: { label: 'Agencies', icon: Building, color: '#8b5cf6', bg: 'bg-purple-50', badge: 'bg-purple-100 text-purple-700', border: 'border-purple-200' },
};

export default function MROutstanding() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [fromCache, setFromCache] = useState(false);
  const [lastSynced, setLastSynced] = useState(null);

  useEffect(() => { fetchOutstanding(); }, []);

  const fetchOutstanding = async (forceRefresh = false) => {
    if (forceRefresh) setRefreshing(true); else setLoading(true);
    try {
      const result = await fetchWithOffline(() => mrAPI.getOutstanding(), CACHE_KEYS.outstanding);
      setData(result.data);
      setFromCache(result.fromCache);
      if (result.fromCache) {
        const ts = getCacheTimestamp(CACHE_KEYS.outstanding);
        setLastSynced(ts ? new Date(ts) : null);
        toast.info('Showing offline cached data');
      } else {
        setLastSynced(new Date());
      }
    } catch {
      const cached = getCachedOutstanding();
      if (cached) {
        setData(cached);
        setFromCache(true);
        const ts = getCacheTimestamp(CACHE_KEYS.outstanding);
        setLastSynced(ts ? new Date(ts) : null);
      } else {
        toast.error('No data available. Connect to internet to sync.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const customers = useMemo(() => {
    if (!data?.customers) return [];
    let list = data.customers;
    if (activeTab !== 'all') list = list.filter(c => c.customer_type === activeTab);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(c =>
        c.customer_name?.toLowerCase().includes(s) ||
        (c.customer_phone || '').includes(search) ||
        (c.customer_code || '').toLowerCase().includes(s) ||
        (c.district || '').toLowerCase().includes(s)
      );
    }
    return list;
  }, [data, activeTab, search]);

  const totals = data?.totals || { doctor: 0, medical: 0, agency: 0, grand_total: 0 };

  const formatTimeAgo = (date) => {
    if (!date) return 'Never';
    const mins = Math.floor((Date.now() - date.getTime()) / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  if (loading) return (
    <div className="flex justify-center py-20">
      <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
    </div>
  );

  return (
    <div className="space-y-4" data-testid="mr-outstanding-page">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Outstanding</h1>
          <p className="text-sm text-slate-500">Customer balance details</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {fromCache && (
            <Badge className="bg-amber-100 text-amber-700 gap-1 text-xs" data-testid="offline-badge">
              <WifiOff className="w-3 h-3" />Offline
            </Badge>
          )}
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <Clock className="w-3 h-3" />
            <span data-testid="last-synced">{formatTimeAgo(lastSynced)}</span>
          </div>
          <Button size="sm" variant="outline" onClick={() => fetchOutstanding(true)}
            disabled={refreshing} className="h-8" data-testid="refresh-btn">
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { key: 'grand_total', label: 'Total Outstanding', icon: IndianRupee, color: '#1e3a5f', bg: '#e8f0f8' },
          ...Object.entries(TYPE_CONFIG).map(([key, cfg]) => ({ key, label: cfg.label, icon: cfg.icon, color: cfg.color, bg: cfg.bg.replace('bg-', '').replace('-50', '') })),
        ].map(card => {
          const val = totals[card.key] || 0;
          return (
            <Card key={card.key} className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setActiveTab(card.key === 'grand_total' ? 'all' : card.key)}
              data-testid={`summary-${card.key}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: card.color + '15' }}>
                    <card.icon className="w-5 h-5" style={{ color: card.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-500 truncate">{card.label}</p>
                    <p className="text-lg font-bold" style={{ color: val > 0 ? '#dc2626' : '#16a34a' }} data-testid={`total-${card.key}`}>
                      {val >= 0 ? '' : '-'}Rs.{Math.abs(val).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1 shrink-0">
          {[
            { key: 'all', label: 'All' },
            ...Object.entries(TYPE_CONFIG).map(([k, v]) => ({ key: k, label: v.label })),
          ].map(tab => (
            <button key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
              data-testid={`tab-${tab.key}`}>
              {tab.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="Search by name, phone, code, district..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="pl-10" data-testid="outstanding-search" />
        </div>
      </div>

      {/* Customer List */}
      <div className="space-y-2" data-testid="customer-list">
        {customers.length > 0 ? customers.map(c => {
          const cfg = TYPE_CONFIG[c.customer_type] || TYPE_CONFIG.doctor;
          const isPositive = c.outstanding > 0;
          return (
            <Card key={c.customer_id} className={`border-l-4 ${cfg.border}`} data-testid={`customer-${c.customer_id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-800 text-sm">{c.customer_name}</span>
                      <Badge className={`text-[10px] ${cfg.badge}`}>{c.customer_type}</Badge>
                      {c.customer_code && <span className="text-xs text-slate-400 font-mono">{c.customer_code}</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
                      {c.customer_phone && (
                        <a href={`tel:${c.customer_phone}`} className="flex items-center gap-1 hover:text-blue-600">
                          <Phone className="w-3 h-3" />{c.customer_phone}
                        </a>
                      )}
                      {c.district && <span>{c.district}</span>}
                    </div>
                    {/* Breakdown */}
                    <div className="flex gap-4 mt-2 text-xs text-slate-500">
                      <span>Invoiced: <strong className="text-slate-700">Rs.{c.total_invoiced.toLocaleString('en-IN')}</strong></span>
                      <span>Paid: <strong className="text-emerald-600">Rs.{c.total_paid.toLocaleString('en-IN')}</strong></span>
                      {c.opening_balance !== 0 && <span>Opening: Rs.{c.opening_balance.toLocaleString('en-IN')}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`flex items-center gap-1 ${isPositive ? 'text-red-600' : 'text-emerald-600'}`}>
                      {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                      <span className="text-lg font-bold" data-testid={`balance-${c.customer_id}`}>
                        Rs.{Math.abs(c.outstanding).toLocaleString('en-IN')}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">{isPositive ? 'To Collect' : 'Advance'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        }) : (
          <div className="text-center py-12">
            <IndianRupee className="w-12 h-12 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">
              {search ? 'No matching customers found' : 'No outstanding balances'}
            </p>
          </div>
        )}
      </div>

      {/* Count footer */}
      {customers.length > 0 && (
        <p className="text-xs text-slate-400 text-center" data-testid="customer-count">
          Showing {customers.length} customer{customers.length !== 1 ? 's' : ''}
          {fromCache && ' (from last sync)'}
        </p>
      )}
    </div>
  );
}
