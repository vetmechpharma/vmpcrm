import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { mrAPI } from '../../context/MRAuthContext';
import { useMRAuth } from '../../context/MRAuthContext';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Loader2, Users, ClipboardList, CalendarCheck, Layers, AlertTriangle, MapPin } from 'lucide-react';

export default function MRDashboard() {
  const { mr } = useMRAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    mrAPI.getDashboard()
      .then(res => setStats(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;

  const cards = [
    { label: 'Customers', value: stats?.total_customers || 0, icon: Users, color: '#1e3a5f', bg: '#e8f0f8', onClick: () => navigate('/mrvet/customers') },
    { label: "Today's Visits", value: stats?.today_visits || 0, icon: ClipboardList, color: '#16a34a', bg: '#dcfce7', onClick: () => navigate('/mrvet/visits') },
    { label: 'Pending Follow-ups', value: stats?.pending_followups || 0, icon: CalendarCheck, color: '#ea580c', bg: '#ffedd5', onClick: () => navigate('/mrvet/followups') },
    { label: 'Active Decks', value: stats?.active_decks || 0, icon: Layers, color: '#7c3aed', bg: '#ede9fe', onClick: () => navigate('/mrvet/visual-aids') },
  ];

  return (
    <div className="space-y-6" data-testid="mr-dashboard">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Welcome, {mr?.name}</h1>
        <p className="text-slate-500 flex items-center gap-1 mt-1"><MapPin className="w-3.5 h-3.5" />{mr?.state} - {(mr?.districts || []).join(', ')}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(c => (
          <Card key={c.label} className="cursor-pointer hover:shadow-md transition-shadow" onClick={c.onClick} data-testid={`mr-stat-${c.label.toLowerCase().replace(/\s+/g, '-')}`}>
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500">{c.label}</p>
                  <p className="text-2xl font-bold mt-1" style={{ color: c.color }}>{c.value}</p>
                </div>
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: c.bg }}>
                  <c.icon className="w-5 h-5" style={{ color: c.color }} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="font-semibold text-slate-700 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => navigate('/mrvet/visual-aids')} data-testid="mr-quick-presentation">
              <Layers className="w-5 h-5" style={{ color: '#7c3aed' }} />
              <span className="text-xs">Start Presentation</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => navigate('/mrvet/visits')} data-testid="mr-quick-visit">
              <ClipboardList className="w-5 h-5" style={{ color: '#16a34a' }} />
              <span className="text-xs">Record Visit</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => navigate('/mrvet/followups')} data-testid="mr-quick-followups">
              <CalendarCheck className="w-5 h-5" style={{ color: '#ea580c' }} />
              <span className="text-xs">Follow-ups</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => navigate('/mrvet/customers')} data-testid="mr-quick-customers">
              <Users className="w-5 h-5" style={{ color: '#1e3a5f' }} />
              <span className="text-xs">My Customers</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Overdue alerts */}
      {(stats?.overdue_followups || 0) > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
              <div>
                <p className="font-medium text-orange-800">You have {stats.overdue_followups} overdue follow-up(s)</p>
                <p className="text-sm text-orange-600">Please complete them as soon as possible</p>
              </div>
              <Button variant="outline" size="sm" className="ml-auto border-orange-300 text-orange-700" onClick={() => navigate('/mrvet/followups')}>View</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Territory Summary */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="font-semibold text-slate-700 mb-4">Territory Summary</h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-xl font-bold" style={{ color: '#1e3a5f' }}>{stats?.doctors || 0}</p>
              <p className="text-xs text-slate-500 mt-1">Doctors</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-xl font-bold" style={{ color: '#1e3a5f' }}>{stats?.medicals || 0}</p>
              <p className="text-xs text-slate-500 mt-1">Medicals</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-xl font-bold" style={{ color: '#1e3a5f' }}>{stats?.agencies || 0}</p>
              <p className="text-xs text-slate-500 mt-1">Agencies</p>
            </div>
          </div>
          <p className="text-xs text-slate-400 text-center mt-3">Total visits: {stats?.total_visits || 0}</p>
        </CardContent>
      </Card>
    </div>
  );
}
