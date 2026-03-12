import { useState, useEffect } from 'react';
import { agenciesAPI, emailAPI, tasksAPI, transportAPI, locationAPI, followupsAPI, paymentsAPI } from '../lib/api';
import api from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { Checkbox } from '../components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { toast } from 'sonner';
import { 
  Plus, Search, Edit2, Trash2, Mail, Loader2, Phone, Calendar, Clock,
  MessageSquare, CheckSquare, AlertTriangle, PhoneCall, Eye, Building,
  RefreshCw, Key, History, ArrowRight, IndianRupee
} from 'lucide-react';
import { LEAD_STATUSES, getStatusColor, formatDate, formatDateTime } from '../lib/utils';

const PRIORITIES = [
  { value: 'low', label: 'Low', color: 'bg-slate-100 text-slate-700' },
  { value: 'moderate', label: 'Moderate', color: 'bg-amber-100 text-amber-700' },
  { value: 'high', label: 'High', color: 'bg-red-100 text-red-700' },
];

export const Agencies = () => {
  const [agencies, setAgencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState([]);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedAgency, setSelectedAgency] = useState(null);
  const [formLoading, setFormLoading] = useState(false);

  // Follow-up
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [followUpData, setFollowUpData] = useState({ notes: '', new_status: '', next_follow_up_date: '', next_follow_up_time: '' });
  const [followUpHistory, setFollowUpHistory] = useState([]);
  const [loadingFollowUps, setLoadingFollowUps] = useState(false);
  const [followUpSubmitting, setFollowUpSubmitting] = useState(false);

  const [notes, setNotes] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [newTask, setNewTask] = useState({ title: '', description: '', due_date: '', priority: 'moderate' });
  const [loadingNotes, setLoadingNotes] = useState(false);

  const [formData, setFormData] = useState({
    name: '', proprietor_name: '', gst_number: '', drug_license: '',
    address: '', address_line_1: '', address_line_2: '', state: '', district: '',
    pincode: '', delivery_station: '', transport_id: '', email: '', phone: '',
    alternate_phone: '', lead_status: 'Pipeline', priority: 'moderate',
    follow_up_date: '', birthday: '', anniversary: '', opening_balance: '',
  });

  const [states, setStates] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [transports, setTransports] = useState([]);
  const [outstandingMap, setOutstandingMap] = useState({});

  useEffect(() => { fetchAgencies(); }, [search, statusFilter]);
  useEffect(() => { fetchStatesAndTransports(); fetchOutstandingBalances(); }, []);
  useEffect(() => {
    if (formData.state) fetchDistricts(formData.state);
    else setDistricts([]);
  }, [formData.state]);

  const fetchStatesAndTransports = async () => {
    try {
      const [statesRes, transportsRes] = await Promise.all([locationAPI.getStates(), transportAPI.getAll()]);
      setStates(statesRes.data.states || []); setTransports(transportsRes.data || []);
    } catch (e) { console.error('Failed to fetch states/transports'); }
  };

  const fetchOutstandingBalances = async () => {
    try {
      const res = await paymentsAPI.getOutstanding({ customer_type: 'agency' });
      const map = {};
      (res.data || []).forEach(o => { map[o.customer_id] = o.outstanding; });
      setOutstandingMap(map);
    } catch { /* silent */ }
  };

  const fetchDistricts = async (state) => {
    try { const r = await locationAPI.getDistricts(state); setDistricts(r.data.districts || []); }
    catch (e) { setDistricts([]); }
  };

  const fetchAgencies = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (statusFilter !== 'all') params.status = statusFilter;
      const response = await agenciesAPI.getAll(params);
      setAgencies(response.data);
    } catch (e) { toast.error('Failed to fetch agencies'); }
    finally { setLoading(false); }
  };

  const fetchAgencyDetails = async (agency) => {
    setSelectedAgency(agency);
    setShowDetailModal(true);
    setLoadingNotes(true); setLoadingFollowUps(true);
    try {
      const [notesRes, tasksRes, fuRes] = await Promise.all([
        agenciesAPI.getNotes(agency.id),
        tasksAPI.getAll({ agency_id: agency.id }),
        followupsAPI.getHistory('agency', agency.id)
      ]);
      setNotes(notesRes.data); setTasks(tasksRes.data); setFollowUpHistory(fuRes.data);
    } catch (e) { console.error('Failed to fetch details'); }
    finally { setLoadingNotes(false); setLoadingFollowUps(false); }
  };

  const handleAddAgency = async () => {
    if (!formData.name || !formData.phone) { toast.error('Name and phone are required'); return; }
    setFormLoading(true);
    try { await agenciesAPI.create(formData); toast.success('Agency added'); setShowAddModal(false); resetForm(); fetchAgencies(); }
    catch (e) { toast.error('Failed to add agency'); }
    finally { setFormLoading(false); }
  };

  const handleEditAgency = async () => {
    setFormLoading(true);
    try { await agenciesAPI.update(selectedAgency.id, formData); toast.success('Agency updated'); setShowEditModal(false); resetForm(); fetchAgencies(); }
    catch (e) { toast.error('Failed to update agency'); }
    finally { setFormLoading(false); }
  };

  const handleDeleteAgency = async () => {
    setFormLoading(true);
    try { await agenciesAPI.delete(selectedAgency.id); toast.success('Agency deleted'); setShowDeleteModal(false); setSelectedAgency(null); fetchAgencies(); }
    catch (e) { toast.error('Failed to delete agency'); }
    finally { setFormLoading(false); }
  };

  const handleSelectAll = (checked) => { setSelectedIds(checked ? agencies.map(a => a.id) : []); };
  const handleSelectOne = (id, checked) => { setSelectedIds(checked ? [...selectedIds, id] : selectedIds.filter(i => i !== id)); };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setBulkDeleting(true);
    try { const r = await agenciesAPI.bulkDelete(selectedIds); toast.success(r.data.message || `${selectedIds.length} deleted`); setShowBulkDeleteModal(false); setSelectedIds([]); fetchAgencies(); }
    catch (e) { toast.error(e.response?.data?.detail || 'Failed to delete'); }
    finally { setBulkDeleting(false); }
  };

  // Follow-up handlers
  const openFollowUpModal = async (agency) => {
    setSelectedAgency(agency);
    setFollowUpData({ notes: '', new_status: agency.lead_status || 'Contacted', next_follow_up_date: '', next_follow_up_time: '' });
    setShowFollowUpModal(true);
    setLoadingFollowUps(true);
    try { const r = await followupsAPI.getHistory('agency', agency.id); setFollowUpHistory(r.data); }
    catch (e) { setFollowUpHistory([]); }
    finally { setLoadingFollowUps(false); }
  };

  const handleSubmitFollowUp = async () => {
    if (!followUpData.notes.trim()) { toast.error('Please add follow-up notes'); return; }
    setFollowUpSubmitting(true);
    try {
      await followupsAPI.create({
        entity_type: 'agency', entity_id: selectedAgency.id, notes: followUpData.notes,
        new_status: followUpData.new_status || null, next_follow_up_date: followUpData.next_follow_up_date || null,
        next_follow_up_time: followUpData.next_follow_up_time || null,
      });
      toast.success('Follow-up recorded'); setShowFollowUpModal(false); fetchAgencies();
    } catch (e) { toast.error('Failed to save follow-up'); }
    finally { setFollowUpSubmitting(false); }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    try { await agenciesAPI.addNote(selectedAgency.id, { note: newNote }); toast.success('Note added'); setNewNote(''); const r = await agenciesAPI.getNotes(selectedAgency.id); setNotes(r.data); }
    catch (e) { toast.error('Failed to add note'); }
  };

  const handleDeleteNote = async (noteId) => {
    try { await agenciesAPI.deleteNote(selectedAgency.id, noteId); toast.success('Note deleted'); setNotes(notes.filter(n => n.id !== noteId)); }
    catch (e) { toast.error('Failed to delete note'); }
  };

  const handleAddTask = async () => {
    if (!newTask.title.trim()) return;
    try { await tasksAPI.create({ ...newTask, agency_id: selectedAgency.id }); toast.success('Task added'); setNewTask({ title: '', description: '', due_date: '', priority: 'moderate' }); const r = await tasksAPI.getAll({ agency_id: selectedAgency.id }); setTasks(r.data); }
    catch (e) { toast.error('Failed to add task'); }
  };

  const handleToggleTask = async (task) => {
    try { const ns = task.status === 'pending' ? 'completed' : 'pending'; await tasksAPI.update(task.id, { status: ns }); setTasks(tasks.map(t => t.id === task.id ? { ...t, status: ns } : t)); }
    catch (e) { toast.error('Failed to update task'); }
  };

  const handleSendPortalAccess = async (agency) => {
    try {
      toast.loading('Sending portal access...', { id: 'portal-access' });
      const r = await api.post(`/customers/${agency.id}/send-new-password`);
      toast.dismiss('portal-access');
      if (r.data.password_sent) { toast.success(`Portal access sent to ${agency.name}`); fetchAgencies(); }
      else if (r.data.password) { toast.info(<div><p>{r.data.message}</p><p className="mt-2 font-mono bg-slate-100 p-2 rounded text-sm">Password: <strong>{r.data.password}</strong></p></div>, { duration: 15000 }); }
    } catch (e) { toast.dismiss('portal-access'); toast.error(e.response?.data?.detail || 'Failed'); }
  };

  const openEditModal = async (agency) => {
    setSelectedAgency(agency);
    if (agency.state) { try { const r = await locationAPI.getDistricts(agency.state); setDistricts(r.data.districts || []); } catch (e) {} }
    setFormData({
      name: agency.name, proprietor_name: agency.proprietor_name || '', gst_number: agency.gst_number || '',
      drug_license: agency.drug_license || '', address: agency.address || '', address_line_1: agency.address_line_1 || '',
      address_line_2: agency.address_line_2 || '', state: agency.state || '', district: agency.district || '',
      pincode: agency.pincode || '', delivery_station: agency.delivery_station || '', transport_id: agency.transport_id || '',
      email: agency.email || '', phone: agency.phone, alternate_phone: agency.alternate_phone || '',
      lead_status: agency.lead_status, priority: agency.priority || 'moderate', follow_up_date: agency.follow_up_date || '',
      birthday: agency.birthday || '', anniversary: agency.anniversary || '',
    });
    setShowEditModal(true);
  };

  const resetForm = () => {
    setFormData({ name: '', proprietor_name: '', gst_number: '', drug_license: '', address: '', address_line_1: '', address_line_2: '', state: '', district: '', pincode: '', delivery_station: '', transport_id: '', email: '', phone: '', alternate_phone: '', lead_status: 'Pipeline', priority: 'moderate', follow_up_date: '', birthday: '', anniversary: '', opening_balance: '' });
    setDistricts([]);
  };

  const getPriorityLabel = (p) => PRIORITIES.find(x => x.value === p)?.label || 'Moderate';
  const getPriorityColor = (p) => PRIORITIES.find(x => x.value === p)?.color || 'bg-amber-100 text-amber-700';

  const isFollowUpDue = (a) => {
    if (['Not Interested', 'Closed', 'Converted', 'Lost'].includes(a.lead_status)) return false;
    if (!a.follow_up_date) return false;
    return a.follow_up_date <= new Date().toISOString().split('T')[0];
  };

  const totalAgencies = agencies.length;
  const customerCount = agencies.filter(a => ['Customer', 'Converted'].includes(a.lead_status)).length;
  const pipelineCount = agencies.filter(a => a.lead_status === 'Pipeline').length;
  const followUpDueCount = agencies.filter(a => isFollowUpDue(a)).length;

  return (
    <div className="space-y-6" data-testid="agencies-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Agencies</h1>
          <p className="text-slate-600">Manage agency leads and follow-ups</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchAgencies}><RefreshCw className="w-4 h-4 mr-2" />Refresh</Button>
          <Button onClick={() => setShowAddModal(true)} data-testid="add-agency-btn"><Plus className="w-4 h-4 mr-2" />Add Agency</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Agencies', count: totalAgencies, color: 'bg-slate-100', textColor: 'text-slate-600', icon: Building },
          { label: 'Customers', count: customerCount, color: 'bg-green-100', textColor: 'text-green-600', icon: Building },
          { label: 'Pipeline', count: pipelineCount, color: 'bg-blue-100', textColor: 'text-blue-600', icon: Building },
          { label: 'Follow-up Due', count: followUpDueCount, color: 'bg-red-100', textColor: 'text-red-600', icon: AlertTriangle },
        ].map(s => (
          <Card key={s.label}><CardContent className="p-4"><div className="flex items-center gap-3">
            <div className={`w-10 h-10 ${s.color} rounded-lg flex items-center justify-center`}><s.icon className={`w-5 h-5 ${s.textColor}`} /></div>
            <div><p className={`text-2xl font-bold ${s.textColor}`}>{s.count}</p><p className="text-sm text-slate-500">{s.label}</p></div>
          </div></CardContent></Card>
        ))}
      </div>

      {/* Filters */}
      <Card><CardContent className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <Input placeholder="Search by name, phone, GST..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" data-testid="search-input" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-48" data-testid="status-filter"><SelectValue placeholder="Filter by status" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All Statuses</SelectItem>{LEAD_STATUSES.map((s) => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}</SelectContent>
          </Select>
          {selectedIds.length > 0 && (<Button variant="destructive" onClick={() => setShowBulkDeleteModal(true)} data-testid="bulk-delete-btn"><Trash2 className="w-4 h-4 mr-2" />Delete ({selectedIds.length})</Button>)}
        </div>
      </CardContent></Card>

      {/* Table */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Agencies List</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
          ) : agencies.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="w-12"><Checkbox checked={selectedIds.length === agencies.length && agencies.length > 0} onCheckedChange={handleSelectAll} /></TableHead>
                  <TableHead>Agency</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead className="hidden md:table-cell">Follow-up</TableHead>
                  <TableHead className="hidden lg:table-cell">Last Contact</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {agencies.map((agency) => (
                    <TableRow key={agency.id} className={`${isFollowUpDue(agency) ? 'bg-red-50' : ''} ${selectedIds.includes(agency.id) ? 'bg-blue-50' : ''}`} data-testid={`agency-row-${agency.id}`}>
                      <TableCell><Checkbox checked={selectedIds.includes(agency.id)} onCheckedChange={(c) => handleSelectOne(agency.id, c)} /></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0"><Building className="w-5 h-5 text-slate-600" /></div>
                          <div><p className="font-medium text-slate-900">{agency.name}</p><p className="text-xs text-slate-500">{agency.customer_code}{agency.proprietor_name ? ` - ${agency.proprietor_name}` : ''}</p></div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="flex items-center gap-1 text-sm"><Phone className="w-3 h-3 text-slate-400" />{agency.phone}</p>
                          {agency.email && <p className="flex items-center gap-1 text-xs text-slate-500"><Mail className="w-3 h-3" />{agency.email}</p>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1">
                          <Badge className={getStatusColor(agency.lead_status)}>{agency.lead_status}</Badge>
                          {agency.is_portal_customer && <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">Portal</Badge>}
                        </div>
                      </TableCell>
                      <TableCell><Badge className={getPriorityColor(agency.priority)}>{getPriorityLabel(agency.priority)}</Badge></TableCell>
                      <TableCell className="hidden md:table-cell">
                        {agency.follow_up_date ? (
                          <div className="flex items-center gap-1 text-sm">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            <span className={isFollowUpDue(agency) ? 'text-red-600 font-medium' : ''}>{formatDate(agency.follow_up_date)}</span>
                            {isFollowUpDue(agency) && <AlertTriangle className="w-3 h-3 text-red-500" />}
                          </div>
                        ) : <span className="text-slate-400 text-sm">Not set</span>}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {agency.last_contact_date ? <div className="flex items-center gap-1 text-sm text-slate-500"><Clock className="w-3 h-3" />{formatDate(agency.last_contact_date)}</div> : <span className="text-slate-400 text-sm">Never</span>}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => fetchAgencyDetails(agency)} title="View Details" className="h-8 w-8"><Eye className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => openFollowUpModal(agency)} title="Add Follow-up" className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50" data-testid={`followup-btn-${agency.id}`}><PhoneCall className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => openEditModal(agency)} title="Edit" className="h-8 w-8"><Edit2 className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => handleSendPortalAccess(agency)} title="Portal Access" className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"><Key className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => { setSelectedAgency(agency); setShowDeleteModal(true); }} title="Delete" className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12"><Building className="w-12 h-12 text-slate-300 mx-auto mb-4" /><h3 className="text-lg font-medium text-slate-600">No agencies found</h3></div>
          )}
        </CardContent>
      </Card>

      {/* Follow-Up Modal */}
      <Dialog open={showFollowUpModal} onOpenChange={setShowFollowUpModal}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><PhoneCall className="w-5 h-5 text-green-600" />Follow-up: {selectedAgency?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2 text-sm bg-slate-50 p-3 rounded-lg">
              <span className="text-slate-500">Current Status:</span>
              <Badge className={getStatusColor(selectedAgency?.lead_status)}>{selectedAgency?.lead_status}</Badge>
              {selectedAgency?.follow_up_date && <span className="text-slate-500 ml-2">| Follow-up: {formatDate(selectedAgency?.follow_up_date)}</span>}
            </div>
            <div className="space-y-2"><Label>What happened? *</Label><Textarea value={followUpData.notes} onChange={(e) => setFollowUpData({...followUpData, notes: e.target.value})} placeholder="e.g., Called and they asked to call back after 2 days..." rows={3} data-testid="followup-notes-input" /></div>
            <div className="space-y-2"><Label>Update Lead Status</Label>
              <Select value={followUpData.new_status} onValueChange={(v) => setFollowUpData({...followUpData, new_status: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{LEAD_STATUSES.map((s) => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}</SelectContent></Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Next Follow-up Date</Label><Input type="date" value={followUpData.next_follow_up_date} onChange={(e) => setFollowUpData({...followUpData, next_follow_up_date: e.target.value})} data-testid="followup-date-input" /></div>
              <div className="space-y-2"><Label>Time (Optional)</Label><Input type="time" value={followUpData.next_follow_up_time} onChange={(e) => setFollowUpData({...followUpData, next_follow_up_time: e.target.value})} /></div>
            </div>
            <div className="border-t pt-4">
              <h4 className="font-medium flex items-center gap-2 mb-3 text-sm"><History className="w-4 h-4" /> Follow-up History</h4>
              {loadingFollowUps ? <Loader2 className="w-4 h-4 animate-spin" /> : followUpHistory.length > 0 ? (
                <div className="space-y-3 max-h-48 overflow-y-auto">
                  {followUpHistory.map((fu) => (
                    <div key={fu.id} className={`p-3 rounded-lg text-sm border-l-4 ${fu.status === 'open' ? 'border-l-green-500 bg-green-50' : 'border-l-slate-300 bg-slate-50'}`}>
                      <div className="flex items-start justify-between gap-2"><p className="text-slate-800 flex-1">{fu.notes}</p><Badge variant="outline" className={fu.status === 'open' ? 'text-green-600 border-green-300' : 'text-slate-400 border-slate-200'}>{fu.status}</Badge></div>
                      <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                        <span>{fu.created_by}</span><span>{formatDateTime(fu.created_at)}</span>
                        {fu.new_status && <span className="flex items-center gap-1"><ArrowRight className="w-3 h-3" /><Badge className={`${getStatusColor(fu.new_status)} text-[10px]`}>{fu.new_status}</Badge></span>}
                        {fu.next_follow_up_date && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Next: {formatDate(fu.next_follow_up_date)}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-slate-400">No follow-up history yet</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFollowUpModal(false)}>Cancel</Button>
            <Button onClick={handleSubmitFollowUp} disabled={followUpSubmitting} data-testid="followup-submit-btn">{followUpSubmitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Save Follow-up</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Modal */}
      <Dialog open={showAddModal || showEditModal} onOpenChange={() => { setShowAddModal(false); setShowEditModal(false); resetForm(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{showEditModal ? 'Edit Agency' : 'Add New Agency'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2"><Label>Name *</Label><Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="Agency Name" data-testid="agency-name-input" /></div>
              <div className="space-y-2"><Label>Phone *</Label><Input value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} placeholder="9876543210" data-testid="agency-phone-input" /></div>
              <div className="space-y-2"><Label>Alternate Phone</Label><Input value={formData.alternate_phone} onChange={(e) => setFormData({...formData, alternate_phone: e.target.value})} /></div>
              <div className="space-y-2"><Label>Proprietor Name</Label><Input value={formData.proprietor_name} onChange={(e) => setFormData({...formData, proprietor_name: e.target.value})} /></div>
              <div className="space-y-2"><Label>Email</Label><Input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} /></div>
              <div className="space-y-2"><Label>GST Number</Label><Input value={formData.gst_number} onChange={(e) => setFormData({...formData, gst_number: e.target.value})} /></div>
              <div className="space-y-2"><Label>Drug License</Label><Input value={formData.drug_license} onChange={(e) => setFormData({...formData, drug_license: e.target.value})} /></div>
              <div className="col-span-2 pt-2 border-t"><h4 className="text-sm font-medium text-slate-700 mb-3">Address</h4></div>
              <div className="col-span-2 space-y-2"><Label>Address Line 1</Label><Input value={formData.address_line_1} onChange={(e) => setFormData({...formData, address_line_1: e.target.value})} /></div>
              <div className="col-span-2 space-y-2"><Label>Address Line 2</Label><Input value={formData.address_line_2} onChange={(e) => setFormData({...formData, address_line_2: e.target.value})} /></div>
              <div className="space-y-2"><Label>State</Label><Select value={formData.state} onValueChange={(v) => setFormData({...formData, state: v, district: ''})}><SelectTrigger><SelectValue placeholder="Select State" /></SelectTrigger><SelectContent className="max-h-60">{states.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}</SelectContent></Select></div>
              <div className="space-y-2"><Label>District</Label><Select value={formData.district} onValueChange={(v) => setFormData({...formData, district: v})} disabled={!formData.state}><SelectTrigger><SelectValue placeholder={formData.state ? "Select District" : "Select state first"} /></SelectTrigger><SelectContent className="max-h-60">{districts.map((d) => (<SelectItem key={d} value={d}>{d}</SelectItem>))}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Pincode</Label><Input value={formData.pincode} onChange={(e) => setFormData({...formData, pincode: e.target.value})} maxLength={6} /></div>
              <div className="space-y-2"><Label>Delivery Station</Label><Input value={formData.delivery_station} onChange={(e) => setFormData({...formData, delivery_station: e.target.value})} /></div>
              <div className="space-y-2"><Label>Transport</Label><Select value={formData.transport_id || 'none'} onValueChange={(v) => setFormData({...formData, transport_id: v === 'none' ? '' : v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem>{transports.map((t) => (<SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>))}</SelectContent></Select></div>
              <div className="col-span-2 pt-2 border-t"><h4 className="text-sm font-medium text-slate-700 mb-3">Lead & Follow-up</h4></div>
              <div className="space-y-2"><Label>Lead Status</Label><Select value={formData.lead_status} onValueChange={(v) => setFormData({...formData, lead_status: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{LEAD_STATUSES.map((s) => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Priority</Label><Select value={formData.priority} onValueChange={(v) => setFormData({...formData, priority: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PRIORITIES.map((p) => (<SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>))}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Follow-up Date</Label><Input type="date" value={formData.follow_up_date} onChange={(e) => setFormData({...formData, follow_up_date: e.target.value})} /></div>
              <div className="space-y-2"><Label>Birthday</Label><Input type="date" value={formData.birthday} onChange={(e) => setFormData({...formData, birthday: e.target.value})} /></div>
              <div className="space-y-2"><Label>Opening Balance (₹)</Label><Input type="number" step="0.01" value={formData.opening_balance} onChange={(e) => setFormData({...formData, opening_balance: e.target.value})} placeholder="0.00" /></div>
              <div className="space-y-2"><Label>Anniversary</Label><Input type="date" value={formData.anniversary} onChange={(e) => setFormData({...formData, anniversary: e.target.value})} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddModal(false); setShowEditModal(false); resetForm(); }}>Cancel</Button>
            <Button onClick={showEditModal ? handleEditAgency : handleAddAgency} disabled={formLoading}>{formLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}{showEditModal ? 'Update' : 'Add'} Agency</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Building className="w-5 h-5" />{selectedAgency?.name} - {selectedAgency?.customer_code}</DialogTitle></DialogHeader>
          {selectedAgency && (
            <div className="space-y-6 py-4">
              {/* Ledger Balance - Prominent Display */}
              {outstandingMap[selectedAgency.id] !== undefined && outstandingMap[selectedAgency.id] !== 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between" data-testid="agency-ledger-balance">
                  <div className="flex items-center gap-2">
                    <IndianRupee className="w-5 h-5 text-red-600" />
                    <span className="text-sm font-medium text-red-700">Outstanding Balance</span>
                  </div>
                  <span className="text-2xl font-bold text-red-600">
                    ₹{Math.abs(outstandingMap[selectedAgency.id]).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    {outstandingMap[selectedAgency.id] < 0 && <span className="text-sm ml-1">(Advance)</span>}
                  </span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-slate-500">Phone:</span> {selectedAgency.phone}</div>
                <div><span className="text-slate-500">Proprietor:</span> {selectedAgency.proprietor_name || 'N/A'}</div>
                <div><span className="text-slate-500">Status:</span> <Badge className={getStatusColor(selectedAgency.lead_status)}>{selectedAgency.lead_status}</Badge></div>
                <div><span className="text-slate-500">Priority:</span> <Badge className={getPriorityColor(selectedAgency.priority || 'moderate')}>{getPriorityLabel(selectedAgency.priority || 'moderate')}</Badge></div>
                <div><span className="text-slate-500">Last Contact:</span> {selectedAgency.last_contact_date ? formatDate(selectedAgency.last_contact_date) : 'Never'}</div>
                <div><span className="text-slate-500">Follow-up:</span> {selectedAgency.follow_up_date ? formatDate(selectedAgency.follow_up_date) : 'Not set'}</div>
              </div>
              {/* Follow-up History */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium flex items-center gap-2"><History className="w-4 h-4" /> Follow-up History</h4>
                  <Button size="sm" variant="outline" onClick={() => openFollowUpModal(selectedAgency)} className="gap-1"><PhoneCall className="w-3 h-3" />Add Follow-up</Button>
                </div>
                {loadingFollowUps ? <Loader2 className="w-4 h-4 animate-spin" /> : followUpHistory.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {followUpHistory.map((fu) => (
                      <div key={fu.id} className={`p-3 rounded-lg text-sm border-l-4 ${fu.status === 'open' ? 'border-l-green-500 bg-green-50' : 'border-l-slate-300 bg-slate-50'}`}>
                        <p className="text-slate-800">{fu.notes}</p>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500 flex-wrap">
                          <span>{fu.created_by} - {formatDateTime(fu.created_at)}</span>
                          {fu.new_status && <Badge className={`${getStatusColor(fu.new_status)} text-[10px]`}>{fu.new_status}</Badge>}
                          {fu.next_follow_up_date && <span>Next: {formatDate(fu.next_follow_up_date)}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-sm text-slate-400">No follow-up history yet</p>}
              </div>
              {/* Notes */}
              <div className="border-t pt-4">
                <h4 className="font-medium flex items-center gap-2 mb-3"><MessageSquare className="w-4 h-4" /> Notes</h4>
                <div className="flex gap-2 mb-3"><Input value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Add a note..." className="flex-1" /><Button onClick={handleAddNote} size="sm">Add</Button></div>
                {loadingNotes ? <Loader2 className="w-4 h-4 animate-spin" /> : notes.length > 0 ? (
                  <div className="space-y-2 max-h-40 overflow-y-auto">{notes.map((note) => (
                    <div key={note.id} className="bg-slate-50 p-3 rounded-lg text-sm flex justify-between items-start">
                      <div><p>{note.note}</p><p className="text-xs text-slate-400 mt-1">{note.created_by} - {formatDate(note.created_at)}</p></div>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteNote(note.id)} className="text-red-500 h-6 w-6 p-0"><Trash2 className="w-3 h-3" /></Button>
                    </div>
                  ))}</div>
                ) : <p className="text-sm text-slate-400">No notes yet</p>}
              </div>
              {/* Tasks */}
              <div className="border-t pt-4">
                <h4 className="font-medium flex items-center gap-2 mb-3"><CheckSquare className="w-4 h-4" /> Tasks</h4>
                <div className="flex gap-2 mb-3"><Input value={newTask.title} onChange={(e) => setNewTask({...newTask, title: e.target.value})} placeholder="Task title..." className="flex-1" /><Input type="date" value={newTask.due_date} onChange={(e) => setNewTask({...newTask, due_date: e.target.value})} className="w-36" /><Button onClick={handleAddTask} size="sm">Add</Button></div>
                {tasks.length > 0 ? (
                  <div className="space-y-2 max-h-40 overflow-y-auto">{tasks.map((task) => (
                    <div key={task.id} className={`p-3 rounded-lg text-sm flex justify-between items-center ${task.status === 'completed' ? 'bg-green-50' : 'bg-slate-50'}`}>
                      <div className="flex items-center gap-2"><input type="checkbox" checked={task.status === 'completed'} onChange={() => handleToggleTask(task)} className="w-4 h-4" /><span className={task.status === 'completed' ? 'line-through text-slate-400' : ''}>{task.title}</span></div>
                      {task.due_date && <span className="text-xs text-slate-500">{formatDate(task.due_date)}</span>}
                    </div>
                  ))}</div>
                ) : <p className="text-sm text-slate-400">No tasks yet</p>}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="max-w-md"><DialogHeader><DialogTitle className="text-red-600">Delete Agency</DialogTitle></DialogHeader>
          <p className="py-4">Are you sure you want to delete <strong>{selectedAgency?.name}</strong>?</p>
          <DialogFooter><Button variant="outline" onClick={() => setShowDeleteModal(false)}>Cancel</Button><Button onClick={handleDeleteAgency} disabled={formLoading} className="bg-red-600 hover:bg-red-700">{formLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Delete</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete */}
      <Dialog open={showBulkDeleteModal} onOpenChange={setShowBulkDeleteModal}>
        <DialogContent className="max-w-md"><DialogHeader><DialogTitle className="text-red-600 flex items-center gap-2"><AlertTriangle className="w-5 h-5" />Delete {selectedIds.length} Agency(s)</DialogTitle></DialogHeader>
          <div className="py-4"><p className="text-slate-600 mb-3">Delete <strong>{selectedIds.length}</strong> selected agency(s)?</p><div className="bg-red-50 border border-red-200 rounded-lg p-3"><p className="text-sm text-red-700"><strong>Warning:</strong> This cannot be undone.</p></div></div>
          <DialogFooter><Button variant="outline" onClick={() => setShowBulkDeleteModal(false)}>Cancel</Button><Button onClick={handleBulkDelete} disabled={bulkDeleting} className="bg-red-600 hover:bg-red-700">{bulkDeleting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Delete {selectedIds.length} Agency(s)</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Agencies;
