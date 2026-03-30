import { useState, useEffect } from 'react';
import { doctorsAPI, emailAPI, tasksAPI, transportAPI, locationAPI, followupsAPI, paymentsAPI } from '../lib/api';
import WhatsAppDirectDialog from '../components/WhatsAppDirectDialog';
import { FollowUpDialog } from '../components/FollowUpDialog';
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
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../components/ui/table';
import { toast } from 'sonner';
import { 
  Plus, Search, Edit2, Trash2, Mail, Loader2, Users, Phone, Calendar,
  Clock, MessageSquare, CheckSquare, AlertTriangle, PhoneCall, Eye,
  RefreshCw, Key, History, ArrowRight, IndianRupee, MessageCircle
} from 'lucide-react';
import { LEAD_STATUSES, getStatusColor, formatDate, formatDateTime } from '../lib/utils';

const PRIORITIES = [
  { value: 'low', label: 'Low', color: 'bg-slate-100 text-slate-700' },
  { value: 'moderate', label: 'Moderate', color: 'bg-amber-100 text-amber-700' },
  { value: 'high', label: 'High', color: 'bg-red-100 text-red-700' },
];

export const Doctors = () => {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState([]);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [formLoading, setFormLoading] = useState(false);

  // Follow-up modal
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);

  // Notes and Tasks
  const [notes, setNotes] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [newTask, setNewTask] = useState({ title: '', description: '', due_date: '', priority: 'moderate' });
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [loadingFollowUps, setLoadingFollowUps] = useState(false);
  const [followUpHistory, setFollowUpHistory] = useState([]);

  const [formData, setFormData] = useState({
    name: '', reg_no: '', address: '', address_line_1: '', address_line_2: '',
    state: '', district: '', pincode: '', delivery_station: '', transport_id: '',
    email: '', phone: '', lead_status: 'Pipeline', dob: '', priority: 'moderate', follow_up_date: '',
  });

  const [states, setStates] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [transports, setTransports] = useState([]);
  const [emailData, setEmailData] = useState({ subject: '', body: '' });
  const [outstandingMap, setOutstandingMap] = useState({});

  useEffect(() => { fetchDoctors(); }, [search, statusFilter]);
  useEffect(() => { fetchStatesAndTransports(); fetchOutstandingBalances(); }, []);
  useEffect(() => {
    if (formData.state) fetchDistricts(formData.state);
    else setDistricts([]);
  }, [formData.state]);

  const fetchStatesAndTransports = async () => {
    try {
      const [statesRes, transportsRes] = await Promise.all([locationAPI.getStates(), transportAPI.getAll()]);
      setStates(statesRes.data.states || []);
      setTransports(transportsRes.data || []);
    } catch (error) { console.error('Failed to fetch states/transports'); }
  };

  const fetchOutstandingBalances = async () => {
    try {
      const res = await paymentsAPI.getOutstanding({ customer_type: 'doctor' });
      const map = {};
      (res.data || []).forEach(o => { map[o.customer_id] = o.outstanding; });
      setOutstandingMap(map);
    } catch { /* silent */ }
  };

  const fetchDistricts = async (state) => {
    try {
      const response = await locationAPI.getDistricts(state);
      setDistricts(response.data.districts || []);
    } catch (error) { setDistricts([]); }
  };

  const fetchDoctors = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (statusFilter !== 'all') params.status = statusFilter;
      const response = await doctorsAPI.getAll(params);
      setDoctors(response.data);
    } catch (error) { toast.error('Failed to fetch doctors'); }
    finally { setLoading(false); }
  };

  const fetchDoctorDetails = async (doctor) => {
    setSelectedDoctor(doctor);
    setShowDetailModal(true);
    setLoadingNotes(true);
    setLoadingFollowUps(true);
    try {
      const [notesRes, tasksRes, fuRes] = await Promise.all([
        doctorsAPI.getNotes(doctor.id),
        tasksAPI.getAll({ doctor_id: doctor.id }),
        followupsAPI.getHistory('doctor', doctor.id)
      ]);
      setNotes(notesRes.data);
      setTasks(tasksRes.data);
      setFollowUpHistory(fuRes.data);
    } catch (error) { console.error('Failed to fetch details'); }
    finally { setLoadingNotes(false); setLoadingFollowUps(false); }
  };

  const handleAddDoctor = async () => {
    if (!formData.name || !formData.phone) { toast.error('Name and phone are required'); return; }
    setFormLoading(true);
    try {
      await doctorsAPI.create(formData);
      toast.success('Doctor added successfully');
      setShowAddModal(false); resetForm(); fetchDoctors();
    } catch (error) { toast.error('Failed to add doctor'); }
    finally { setFormLoading(false); }
  };

  const handleEditDoctor = async () => {
    setFormLoading(true);
    try {
      await doctorsAPI.update(selectedDoctor.id, formData);
      toast.success('Doctor updated successfully');
      setShowEditModal(false); resetForm(); fetchDoctors();
    } catch (error) { toast.error('Failed to update doctor'); }
    finally { setFormLoading(false); }
  };

  const handleDeleteDoctor = async () => {
    setFormLoading(true);
    try {
      await doctorsAPI.delete(selectedDoctor.id);
      toast.success('Doctor deleted successfully');
      setShowDeleteModal(false); setSelectedDoctor(null); fetchDoctors();
    } catch (error) { toast.error('Failed to delete doctor'); }
    finally { setFormLoading(false); }
  };

  const handleSelectAll = (checked) => { setSelectedIds(checked ? doctors.map(d => d.id) : []); };
  const handleSelectOne = (id, checked) => { setSelectedIds(checked ? [...selectedIds, id] : selectedIds.filter(i => i !== id)); };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setBulkDeleting(true);
    try {
      const response = await doctorsAPI.bulkDelete(selectedIds);
      toast.success(response.data.message || `${selectedIds.length} doctor(s) deleted`);
      setShowBulkDeleteModal(false); setSelectedIds([]); fetchDoctors();
    } catch (error) { toast.error(error.response?.data?.detail || 'Failed to delete'); }
    finally { setBulkDeleting(false); }
  };

  // === Follow-up handlers ===
  const openFollowUpModal = (doctor) => {
    setSelectedDoctor(doctor);
    setShowFollowUpModal(true);
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    try {
      await doctorsAPI.addNote(selectedDoctor.id, { note: newNote });
      toast.success('Note added'); setNewNote('');
      const notesRes = await doctorsAPI.getNotes(selectedDoctor.id);
      setNotes(notesRes.data);
    } catch (error) { toast.error('Failed to add note'); }
  };

  const handleDeleteNote = async (noteId) => {
    try {
      await doctorsAPI.deleteNote(selectedDoctor.id, noteId);
      toast.success('Note deleted'); setNotes(notes.filter(n => n.id !== noteId));
    } catch (error) { toast.error('Failed to delete note'); }
  };

  const handleAddTask = async () => {
    if (!newTask.title.trim()) return;
    try {
      await tasksAPI.create({ ...newTask, doctor_id: selectedDoctor.id });
      toast.success('Task added');
      setNewTask({ title: '', description: '', due_date: '', priority: 'moderate' });
      const tasksRes = await tasksAPI.getAll({ doctor_id: selectedDoctor.id });
      setTasks(tasksRes.data);
    } catch (error) { toast.error('Failed to add task'); }
  };

  const handleToggleTask = async (task) => {
    try {
      const newStatus = task.status === 'pending' ? 'completed' : 'pending';
      await tasksAPI.update(task.id, { status: newStatus });
      setTasks(tasks.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
    } catch (error) { toast.error('Failed to update task'); }
  };

  const handleSendEmail = async () => {
    if (!emailData.subject || !emailData.body) { toast.error('Subject and body are required'); return; }
    setFormLoading(true);
    try {
      await emailAPI.send({ doctor_id: selectedDoctor.id, subject: emailData.subject, body: emailData.body });
      toast.success('Email sent'); setShowEmailModal(false); setEmailData({ subject: '', body: '' });
    } catch (error) { toast.error(error.response?.data?.detail || 'Failed to send email'); }
    finally { setFormLoading(false); }
  };

  const handleSendPortalAccess = async (doctor) => {
    try {
      toast.loading('Sending portal access...', { id: 'portal-access' });
      const response = await api.post(`/customers/${doctor.id}/send-new-password`);
      toast.dismiss('portal-access');
      if (response.data.password_sent) {
        toast.success(`Portal access sent to ${doctor.name} via WhatsApp!`);
        fetchDoctors();
      } else if (response.data.password) {
        toast.info(<div><p>{response.data.message}</p><p className="mt-2 font-mono bg-slate-100 p-2 rounded text-sm">Password: <strong>{response.data.password}</strong></p></div>, { duration: 15000 });
      }
    } catch (error) { toast.dismiss('portal-access'); toast.error(error.response?.data?.detail || 'Failed to send portal access'); }
  };

  const openEditModal = async (doctor) => {
    setSelectedDoctor(doctor);
    if (doctor.state) {
      try { const r = await locationAPI.getDistricts(doctor.state); setDistricts(r.data.districts || []); } catch (e) {}
    }
    setFormData({
      name: doctor.name, reg_no: doctor.reg_no, address: doctor.address || '',
      address_line_1: doctor.address_line_1 || '', address_line_2: doctor.address_line_2 || '',
      state: doctor.state || '', district: doctor.district || '', pincode: doctor.pincode || '',
      delivery_station: doctor.delivery_station || '', transport_id: doctor.transport_id || '',
      email: doctor.email, phone: doctor.phone, lead_status: doctor.lead_status,
      dob: doctor.dob || '', priority: doctor.priority || 'moderate', follow_up_date: doctor.follow_up_date || '',
    });
    setShowEditModal(true);
  };

  const resetForm = () => {
    setFormData({ name: '', reg_no: '', address: '', address_line_1: '', address_line_2: '', state: '', district: '', pincode: '', delivery_station: '', transport_id: '', email: '', phone: '', lead_status: 'Pipeline', dob: '', priority: 'moderate', follow_up_date: '', opening_balance: '' });
    setDistricts([]);
  };

  const getPriorityLabel = (p) => PRIORITIES.find(x => x.value === p)?.label || 'Moderate';
  const getPriorityColor = (p) => PRIORITIES.find(x => x.value === p)?.color || 'bg-amber-100 text-amber-700';

  const isFollowUpDue = (doctor) => {
    if (['Not Interested', 'Closed', 'Converted', 'Lost'].includes(doctor.lead_status)) return false;
    if (!doctor.follow_up_date) return false;
    return doctor.follow_up_date <= new Date().toISOString().split('T')[0];
  };

  const totalDoctors = doctors.length;
  const customerCount = doctors.filter(d => ['Customer', 'Converted'].includes(d.lead_status)).length;
  const pipelineCount = doctors.filter(d => d.lead_status === 'Pipeline').length;
  const followUpDueCount = doctors.filter(d => isFollowUpDue(d)).length;

  return (
    <div className="space-y-6" data-testid="doctors-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Doctors / Leads</h1>
          <p className="text-slate-600">Manage your doctor leads and follow-ups</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchDoctors} data-testid="refresh-btn"><RefreshCw className="w-4 h-4 mr-2" />Refresh</Button>
          <Button onClick={() => setShowAddModal(true)} data-testid="add-doctor-btn"><Plus className="w-4 h-4 mr-2" />Add Doctor</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Doctors', count: totalDoctors, color: 'bg-slate-100', textColor: 'text-slate-600', icon: Users },
          { label: 'Customers', count: customerCount, color: 'bg-green-100', textColor: 'text-green-600', icon: Users },
          { label: 'Pipeline', count: pipelineCount, color: 'bg-blue-100', textColor: 'text-blue-600', icon: Users },
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
            <Input placeholder="Search by name, phone, email..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" data-testid="search-input" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-48" data-testid="status-filter"><SelectValue placeholder="Filter by status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {LEAD_STATUSES.map((s) => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}
            </SelectContent>
          </Select>
          {selectedIds.length > 0 && (
            <Button variant="destructive" onClick={() => setShowBulkDeleteModal(true)} data-testid="bulk-delete-btn"><Trash2 className="w-4 h-4 mr-2" />Delete ({selectedIds.length})</Button>
          )}
        </div>
      </CardContent></Card>

      {/* Table */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Doctors List</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
          ) : doctors.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="w-12"><Checkbox checked={selectedIds.length === doctors.length && doctors.length > 0} onCheckedChange={handleSelectAll} data-testid="select-all-checkbox" /></TableHead>
                  <TableHead>Doctor</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead className="hidden md:table-cell">Follow-up</TableHead>
                  <TableHead className="hidden lg:table-cell">Last Contact</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {doctors.map((doctor) => (
                    <TableRow key={doctor.id} className={`${isFollowUpDue(doctor) ? 'bg-red-50' : ''} ${selectedIds.includes(doctor.id) ? 'bg-blue-50' : ''}`} data-testid={`doctor-row-${doctor.id}`}>
                      <TableCell><Checkbox checked={selectedIds.includes(doctor.id)} onCheckedChange={(c) => handleSelectOne(doctor.id, c)} data-testid={`select-doctor-${doctor.id}`} /></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0"><Users className="w-5 h-5 text-slate-600" /></div>
                          <div><p className="font-medium text-slate-900">{doctor.name}</p><p className="text-xs text-slate-500">{doctor.customer_code}</p></div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="flex items-center gap-1 text-sm"><Phone className="w-3 h-3 text-slate-400" />{doctor.phone}</p>
                          {doctor.email && <p className="flex items-center gap-1 text-xs text-slate-500"><Mail className="w-3 h-3" />{doctor.email}</p>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1">
                          <Badge className={getStatusColor(doctor.lead_status)}>{doctor.lead_status}</Badge>
                          {doctor.is_portal_customer && <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">Portal</Badge>}
                        </div>
                      </TableCell>
                      <TableCell><Badge className={getPriorityColor(doctor.priority)}>{getPriorityLabel(doctor.priority)}</Badge></TableCell>
                      <TableCell className="hidden md:table-cell">
                        {doctor.follow_up_date ? (
                          <div className="flex items-center gap-1 text-sm">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            <span className={isFollowUpDue(doctor) ? 'text-red-600 font-medium' : ''}>{formatDate(doctor.follow_up_date)}</span>
                            {isFollowUpDue(doctor) && <AlertTriangle className="w-3 h-3 text-red-500" />}
                          </div>
                        ) : <span className="text-slate-400 text-sm">Not set</span>}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {doctor.last_contact_date ? (
                          <div className="flex items-center gap-1 text-sm text-slate-500"><Clock className="w-3 h-3" />{formatDate(doctor.last_contact_date)}</div>
                        ) : <span className="text-slate-400 text-sm">Never</span>}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => fetchDoctorDetails(doctor)} title="View Details" className="h-8 w-8"><Eye className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => openFollowUpModal(doctor)} title="Add Follow-up" className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50" data-testid={`followup-btn-${doctor.id}`}><PhoneCall className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => openEditModal(doctor)} title="Edit" className="h-8 w-8"><Edit2 className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => { setSelectedDoctor(doctor); setShowEmailModal(true); }} title="Send Email" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"><Mail className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => { setSelectedDoctor(doctor); setShowWhatsAppModal(true); }} title="Send WhatsApp" className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50" data-testid={`wa-btn-${doctor.id}`}><MessageCircle className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => handleSendPortalAccess(doctor)} title="Portal Access" className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" data-testid={`send-portal-access-${doctor.id}`}><Key className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => { setSelectedDoctor(doctor); setShowDeleteModal(true); }} title="Delete" className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-600">No doctors found</h3>
              <p className="text-sm text-slate-400">Add your first doctor to get started</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ====== FOLLOW-UP MODAL ====== */}
      <FollowUpDialog
        open={showFollowUpModal}
        onClose={() => setShowFollowUpModal(false)}
        entity={selectedDoctor}
        entityType="doctor"
        onFollowUpSaved={fetchDoctors}
      />

      {/* Add/Edit Doctor Modal */}
      <Dialog open={showAddModal || showEditModal} onOpenChange={() => { setShowAddModal(false); setShowEditModal(false); resetForm(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{showEditModal ? 'Edit Doctor' : 'Add New Doctor'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2"><Label>Name *</Label><Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="Dr. John Smith" data-testid="doctor-name-input" /></div>
              <div className="space-y-2"><Label>Phone *</Label><Input value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} placeholder="9876543210" data-testid="doctor-phone-input" /></div>
              <div className="space-y-2"><Label>Reg. No</Label><Input value={formData.reg_no} onChange={(e) => setFormData({...formData, reg_no: e.target.value})} placeholder="REG123" /></div>
              <div className="col-span-2 space-y-2"><Label>Email</Label><Input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} placeholder="doctor@email.com" /></div>
              <div className="col-span-2 pt-2 border-t"><h4 className="text-sm font-medium text-slate-700 mb-3">Address Details</h4></div>
              <div className="col-span-2 space-y-2"><Label>Address Line 1</Label><Input value={formData.address_line_1} onChange={(e) => setFormData({...formData, address_line_1: e.target.value})} placeholder="Building/Street" /></div>
              <div className="col-span-2 space-y-2"><Label>Address Line 2</Label><Input value={formData.address_line_2} onChange={(e) => setFormData({...formData, address_line_2: e.target.value})} placeholder="Area/Landmark" /></div>
              <div className="space-y-2"><Label>State</Label>
                <Select value={formData.state} onValueChange={(v) => setFormData({...formData, state: v, district: ''})}><SelectTrigger><SelectValue placeholder="Select State" /></SelectTrigger><SelectContent className="max-h-60">{states.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}</SelectContent></Select>
              </div>
              <div className="space-y-2"><Label>District</Label>
                <Select value={formData.district} onValueChange={(v) => setFormData({...formData, district: v})} disabled={!formData.state}><SelectTrigger><SelectValue placeholder={formData.state ? "Select District" : "Select state first"} /></SelectTrigger><SelectContent className="max-h-60">{districts.map((d) => (<SelectItem key={d} value={d}>{d}</SelectItem>))}</SelectContent></Select>
              </div>
              <div className="space-y-2"><Label>Pincode</Label><Input value={formData.pincode} onChange={(e) => setFormData({...formData, pincode: e.target.value})} placeholder="600001" maxLength={6} /></div>
              <div className="col-span-2 pt-2 border-t"><h4 className="text-sm font-medium text-slate-700 mb-3">Delivery Preferences</h4></div>
              <div className="space-y-2"><Label>Delivery Station</Label><Input value={formData.delivery_station} onChange={(e) => setFormData({...formData, delivery_station: e.target.value})} placeholder="Station name" /></div>
              <div className="space-y-2"><Label>Preferred Transport</Label>
                <Select value={formData.transport_id || 'none'} onValueChange={(v) => setFormData({...formData, transport_id: v === 'none' ? '' : v})}><SelectTrigger><SelectValue placeholder="Select Transport" /></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem>{transports.map((t) => (<SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>))}</SelectContent></Select>
              </div>
              <div className="col-span-2 pt-2 border-t"><h4 className="text-sm font-medium text-slate-700 mb-3">Other Details</h4></div>
              <div className="space-y-2"><Label>Date of Birth</Label><Input type="date" value={formData.dob} onChange={(e) => setFormData({...formData, dob: e.target.value})} /></div>
              <div className="space-y-2"><Label>Opening Balance (₹)</Label><Input type="number" step="0.01" value={formData.opening_balance} onChange={(e) => setFormData({...formData, opening_balance: e.target.value})} placeholder="0.00" /></div>
              <div className="space-y-2"><Label>Lead Status</Label>
                <Select value={formData.lead_status} onValueChange={(v) => setFormData({...formData, lead_status: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{LEAD_STATUSES.map((s) => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}</SelectContent></Select>
              </div>
              <div className="space-y-2"><Label>Priority</Label>
                <Select value={formData.priority} onValueChange={(v) => setFormData({...formData, priority: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PRIORITIES.map((p) => (<SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>))}</SelectContent></Select>
              </div>
              <div className="space-y-2"><Label>Follow-up Date</Label><Input type="date" value={formData.follow_up_date} onChange={(e) => setFormData({...formData, follow_up_date: e.target.value})} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddModal(false); setShowEditModal(false); resetForm(); }}>Cancel</Button>
            <Button onClick={showEditModal ? handleEditDoctor : handleAddDoctor} disabled={formLoading}>
              {formLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {showEditModal ? 'Update' : 'Add'} Doctor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Doctor Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Users className="w-5 h-5" />{selectedDoctor?.name} - {selectedDoctor?.customer_code}</DialogTitle>
          </DialogHeader>
          {selectedDoctor && (
            <div className="space-y-6 py-4">
              {/* Ledger Balance - Prominent Display */}
              {outstandingMap[selectedDoctor.id] !== undefined && outstandingMap[selectedDoctor.id] !== 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between" data-testid="doctor-ledger-balance">
                  <div className="flex items-center gap-2">
                    <IndianRupee className="w-5 h-5 text-red-600" />
                    <span className="text-sm font-medium text-red-700">Outstanding Balance</span>
                  </div>
                  <span className="text-2xl font-bold text-red-600">
                    ₹{Math.abs(outstandingMap[selectedDoctor.id]).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    {outstandingMap[selectedDoctor.id] < 0 && <span className="text-sm ml-1">(Advance)</span>}
                  </span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-slate-500">Phone:</span> {selectedDoctor.phone}</div>
                <div><span className="text-slate-500">Email:</span> {selectedDoctor.email || 'N/A'}</div>
                <div><span className="text-slate-500">Status:</span> <Badge className={getStatusColor(selectedDoctor.lead_status)}>{selectedDoctor.lead_status}</Badge></div>
                <div><span className="text-slate-500">Priority:</span> <Badge className={getPriorityColor(selectedDoctor.priority || 'moderate')}>{getPriorityLabel(selectedDoctor.priority || 'moderate')}</Badge></div>
                <div><span className="text-slate-500">Last Contact:</span> {selectedDoctor.last_contact_date ? formatDate(selectedDoctor.last_contact_date) : 'Never'}</div>
                <div><span className="text-slate-500">Follow-up:</span> {selectedDoctor.follow_up_date ? formatDate(selectedDoctor.follow_up_date) : 'Not set'}</div>
              </div>

              {/* Follow-up History */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium flex items-center gap-2"><History className="w-4 h-4" /> Follow-up History</h4>
                  <Button size="sm" variant="outline" onClick={() => openFollowUpModal(selectedDoctor)} className="gap-1"><PhoneCall className="w-3 h-3" />Add Follow-up</Button>
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
                <div className="flex gap-2 mb-3">
                  <Input value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Add a note..." className="flex-1" />
                  <Button onClick={handleAddNote} size="sm">Add</Button>
                </div>
                {loadingNotes ? <Loader2 className="w-4 h-4 animate-spin" /> : notes.length > 0 ? (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {notes.map((note) => (
                      <div key={note.id} className="bg-slate-50 p-3 rounded-lg text-sm flex justify-between items-start">
                        <div><p>{note.note}</p><p className="text-xs text-slate-400 mt-1">{note.created_by} - {formatDate(note.created_at)}</p></div>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteNote(note.id)} className="text-red-500 h-6 w-6 p-0"><Trash2 className="w-3 h-3" /></Button>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-sm text-slate-400">No notes yet</p>}
              </div>

              {/* Tasks */}
              <div className="border-t pt-4">
                <h4 className="font-medium flex items-center gap-2 mb-3"><CheckSquare className="w-4 h-4" /> Tasks</h4>
                <div className="flex gap-2 mb-3">
                  <Input value={newTask.title} onChange={(e) => setNewTask({...newTask, title: e.target.value})} placeholder="Task title..." className="flex-1" />
                  <Input type="date" value={newTask.due_date} onChange={(e) => setNewTask({...newTask, due_date: e.target.value})} className="w-36" />
                  <Button onClick={handleAddTask} size="sm">Add</Button>
                </div>
                {tasks.length > 0 ? (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {tasks.map((task) => (
                      <div key={task.id} className={`p-3 rounded-lg text-sm flex justify-between items-center ${task.status === 'completed' ? 'bg-green-50' : 'bg-slate-50'}`}>
                        <div className="flex items-center gap-2">
                          <input type="checkbox" checked={task.status === 'completed'} onChange={() => handleToggleTask(task)} className="w-4 h-4" />
                          <span className={task.status === 'completed' ? 'line-through text-slate-400' : ''}>{task.title}</span>
                        </div>
                        {task.due_date && <span className="text-xs text-slate-500">{formatDate(task.due_date)}</span>}
                      </div>
                    ))}
                  </div>
                ) : <p className="text-sm text-slate-400">No tasks yet</p>}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Email Modal */}
      <Dialog open={showEmailModal} onOpenChange={setShowEmailModal}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Send Email to {selectedDoctor?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>Subject</Label><Input value={emailData.subject} onChange={(e) => setEmailData({...emailData, subject: e.target.value})} placeholder="Email subject" /></div>
            <div className="space-y-2"><Label>Body</Label><Textarea value={emailData.body} onChange={(e) => setEmailData({...emailData, body: e.target.value})} placeholder="Email body" rows={6} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEmailModal(false)}>Cancel</Button>
            <Button onClick={handleSendEmail} disabled={formLoading}>{formLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Send Email</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-red-600">Delete Doctor</DialogTitle></DialogHeader>
          <p className="py-4">Are you sure you want to delete <strong>{selectedDoctor?.name}</strong>? This will also delete all notes, tasks, and follow-up history.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
            <Button onClick={handleDeleteDoctor} disabled={formLoading} className="bg-red-600 hover:bg-red-700">{formLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Modal */}
      <Dialog open={showBulkDeleteModal} onOpenChange={setShowBulkDeleteModal}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-red-600 flex items-center gap-2"><AlertTriangle className="w-5 h-5" />Delete {selectedIds.length} Doctor(s)</DialogTitle></DialogHeader>
          <div className="py-4">
            <p className="text-slate-600 mb-3">Are you sure you want to delete <strong>{selectedIds.length}</strong> selected doctor(s)?</p>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3"><p className="text-sm text-red-700"><strong>Warning:</strong> This cannot be undone.</p></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkDeleteModal(false)}>Cancel</Button>
            <Button onClick={handleBulkDelete} disabled={bulkDeleting} className="bg-red-600 hover:bg-red-700">{bulkDeleting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Delete {selectedIds.length} Doctor(s)</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* WhatsApp Message Modal */}
      <WhatsAppDirectDialog
        open={showWhatsAppModal}
        onOpenChange={setShowWhatsAppModal}
        recipientName={selectedDoctor?.name}
        recipientPhone={selectedDoctor?.phone}
        recipientRole="doctors"
      />

    </div>
  );
};

export default Doctors;
