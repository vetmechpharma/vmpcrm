import { useState, useEffect } from 'react';
import { mrAPI } from '../../context/MRAuthContext';
import { fetchWithOffline, CACHE_KEYS, getCachedCustomers } from '../../lib/offlineData';
import { Card, CardContent } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Loader2, Search, Phone, MapPin, Users, Store, Building } from 'lucide-react';

const typeIcons = { doctor: Users, medical: Store, agency: Building };
const typeColors = { doctor: { bg: 'bg-blue-50', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-700' }, medical: { bg: 'bg-emerald-50', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700' }, agency: { bg: 'bg-purple-50', text: 'text-purple-700', badge: 'bg-purple-100 text-purple-700' } };

export default function MRCustomers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  useEffect(() => { fetchCustomers(); }, [search, typeFilter]);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (typeFilter) params.entity_type = typeFilter;
      
      // For unfiltered requests, use the offline-aware fetch
      if (!search && !typeFilter) {
        const result = await fetchWithOffline(() => mrAPI.getCustomers(params), CACHE_KEYS.customers);
        setCustomers(result.data);
      } else {
        // For filtered requests, try API first then filter from cache
        try {
          const res = await mrAPI.getCustomers(params);
          setCustomers(res.data);
        } catch {
          // Offline with filters - filter from cached full list
          let cached = getCachedCustomers();
          if (search) {
            const s = search.toLowerCase();
            cached = cached.filter(c => c.name?.toLowerCase().includes(s) || (c.phone || '').includes(search));
          }
          if (typeFilter) {
            cached = cached.filter(c => c.entity_type === typeFilter);
          }
          setCustomers(cached);
        }
      }
    } catch {
      // Fallback to any cached data
      setCustomers(getCachedCustomers());
    }
    finally { setLoading(false); }
  };

  const groupByType = () => {
    const grouped = { doctor: [], medical: [], agency: [] };
    customers.forEach(c => { const t = c.entity_type; if (grouped[t]) grouped[t].push(c); });
    return grouped;
  };

  const grouped = groupByType();

  return (
    <div className="space-y-4" data-testid="mr-customers-page">
      <div>
        <h1 className="text-xl font-bold text-slate-800">My Customers</h1>
        <p className="text-sm text-slate-500">Customers in your assigned territory</p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="Search by name, phone..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" data-testid="mr-customer-search" />
        </div>
        <Select value={typeFilter || 'all'} onValueChange={v => setTypeFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All Types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="doctor">Doctors</SelectItem>
            <SelectItem value="medical">Medicals</SelectItem>
            <SelectItem value="agency">Agencies</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
      ) : customers.length > 0 ? (
        <div className="space-y-4">
          {['doctor', 'medical', 'agency'].map(type => {
            const list = grouped[type];
            if (!list.length || (typeFilter && typeFilter !== type)) return null;
            const Icon = typeIcons[type];
            const colors = typeColors[type];
            return (
              <div key={type}>
                <h3 className="text-sm font-semibold text-slate-600 mb-2 flex items-center gap-2">
                  <Icon className="w-4 h-4" />{type === 'doctor' ? 'Doctors' : type === 'medical' ? 'Medicals' : 'Agencies'} ({list.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {list.map(c => (
                    <Card key={c.id} className="hover:shadow-sm transition-shadow" data-testid={`mr-customer-${c.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-slate-800 text-sm">{c.name}</p>
                              <Badge className={`text-[10px] ${colors.badge}`}>{type}</Badge>
                            </div>
                            <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
                              {c.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{c.phone}</span>}
                              {c.district && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{c.district}</span>}
                            </div>
                          </div>
                          <a href={`tel:${c.phone}`} className="p-2 rounded-full bg-slate-50 hover:bg-slate-100">
                            <Phone className="w-4 h-4 text-slate-600" />
                          </a>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">No customers found in your territory</p>
        </div>
      )}
    </div>
  );
}
