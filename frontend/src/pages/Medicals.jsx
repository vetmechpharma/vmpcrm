import { useState, useEffect } from 'react';
import { medicalsAPI, emailAPI, tasksAPI } from '../lib/api';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { toast } from 'sonner';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Mail, 
  Loader2,
  Phone,
  MapPin,
  Calendar,
  Clock,
  MessageSquare,
  CheckSquare,
  AlertTriangle,
  PhoneCall,
  Eye,
  Store,
  FileText,
  RefreshCw
} from 'lucide-react';
import { LEAD_STATUSES, getStatusColor, formatDate } from '../lib/utils';

const PRIORITIES = [
  { value: 'low', label: 'Low', color: 'bg-slate-100 text-slate-700' },
  { value: 'moderate', label: 'Moderate', color: 'bg-amber-100 text-amber-700' },
  { value: 'high', label: 'High', color: 'bg-red-100 text-red-700' },
];

export const Medicals = () => {
  const [medicals, setMedicals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedMedical, setSelectedMedical] = useState(null);
  const [formLoading, setFormLoading] = useState(false);

  // Notes and Tasks
  const [notes, setNotes] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [newTask, setNewTask] = useState({ title: '', description: '', due_date: '', priority: 'moderate' });
  const [loadingNotes, setLoadingNotes] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    proprietor_name: '',
    gst_number: '',
    drug_license: '',
    address: '',
    state: '',
    district: '',
    pincode: '',
    email: '',
    phone: '',
    alternate_phone: '',
    lead_status: 'Pipeline',
    priority: 'moderate',
    follow_up_date: '',
  });

  const [emailData, setEmailData] = useState({
    subject: '',
    body: '',
  });

  useEffect(() => {
    fetchMedicals();
  }, [search, statusFilter]);

  const fetchMedicals = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (statusFilter !== 'all') params.status = statusFilter;
      
      const response = await medicalsAPI.getAll(params);
      setMedicals(response.data);
    } catch (error) {
      toast.error('Failed to fetch medicals');
    } finally {
      setLoading(false);
    }
  };

  const fetchMedicalDetails = async (medical) => {
    setSelectedMedical(medical);
    setShowDetailModal(true);
    setLoadingNotes(true);
    
    try {
      const [notesRes, tasksRes] = await Promise.all([
        medicalsAPI.getNotes(medical.id),
        tasksAPI.getAll({ medical_id: medical.id })
      ]);
      setNotes(notesRes.data);
      setTasks(tasksRes.data);
    } catch (error) {
      console.error('Failed to fetch details');
    } finally {
      setLoadingNotes(false);
    }
  };

  const handleAddMedical = async () => {
    if (!formData.name || !formData.phone) {
      toast.error('Name and phone are required');
      return;
    }
    
    setFormLoading(true);
    try {
      await medicalsAPI.create(formData);
      toast.success('Medical added successfully');
      setShowAddModal(false);
      resetForm();
      fetchMedicals();
    } catch (error) {
      toast.error('Failed to add medical');
    } finally {
      setFormLoading(false);
    }
  };

  const handleEditMedical = async () => {
    setFormLoading(true);
    try {
      await medicalsAPI.update(selectedMedical.id, formData);
      toast.success('Medical updated successfully');
      setShowEditModal(false);
      resetForm();
      fetchMedicals();
    } catch (error) {
      toast.error('Failed to update medical');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteMedical = async () => {
    setFormLoading(true);
    try {
      await medicalsAPI.delete(selectedMedical.id);
      toast.success('Medical deleted successfully');
      setShowDeleteModal(false);
      setSelectedMedical(null);
      fetchMedicals();
    } catch (error) {
      toast.error('Failed to delete medical');
    } finally {
      setFormLoading(false);
    }
  };

  const handleMarkContacted = async (medical) => {
    try {
      await medicalsAPI.updateContact(medical.id);
      toast.success('Contact updated! Follow-up set for 25 days');
      fetchMedicals();
    } catch (error) {
      toast.error('Failed to update contact');
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    
    try {
      await medicalsAPI.addNote(selectedMedical.id, { note: newNote });
      toast.success('Note added');
      setNewNote('');
      const notesRes = await medicalsAPI.getNotes(selectedMedical.id);
      setNotes(notesRes.data);
    } catch (error) {
      toast.error('Failed to add note');
    }
  };

  const handleDeleteNote = async (noteId) => {
    try {
      await medicalsAPI.deleteNote(selectedMedical.id, noteId);
      toast.success('Note deleted');
      setNotes(notes.filter(n => n.id !== noteId));
    } catch (error) {
      toast.error('Failed to delete note');
    }
  };

  const handleAddTask = async () => {
    if (!newTask.title.trim()) return;
    
    try {
      await tasksAPI.create({ ...newTask, medical_id: selectedMedical.id });
      toast.success('Task added');
      setNewTask({ title: '', description: '', due_date: '', priority: 'moderate' });
      const tasksRes = await tasksAPI.getAll({ medical_id: selectedMedical.id });
      setTasks(tasksRes.data);
    } catch (error) {
      toast.error('Failed to add task');
    }
  };

  const handleToggleTask = async (task) => {
    try {
      const newStatus = task.status === 'pending' ? 'completed' : 'pending';
      await tasksAPI.update(task.id, { status: newStatus });
      setTasks(tasks.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
    } catch (error) {
      toast.error('Failed to update task');
    }
  };

  const handleSendEmail = async () => {
    if (!emailData.subject || !emailData.body) {
      toast.error('Subject and body are required');
      return;
    }
    
    setFormLoading(true);
    try {
      // For medicals, we'd need a dedicated email endpoint or use generic one
      toast.info('Email functionality for medicals coming soon');
      setShowEmailModal(false);
      setEmailData({ subject: '', body: '' });
    } catch (error) {
      toast.error('Failed to send email');
    } finally {
      setFormLoading(false);
    }
  };

  const openEditModal = (medical) => {
    setSelectedMedical(medical);
    setFormData({
      name: medical.name,
      proprietor_name: medical.proprietor_name || '',
      gst_number: medical.gst_number || '',
      drug_license: medical.drug_license || '',
      address: medical.address || '',
      state: medical.state || '',
      district: medical.district || '',
      pincode: medical.pincode || '',
      email: medical.email || '',
      phone: medical.phone,
      alternate_phone: medical.alternate_phone || '',
      lead_status: medical.lead_status,
      priority: medical.priority || 'moderate',
      follow_up_date: medical.follow_up_date || '',
    });
    setShowEditModal(true);
  };

  const openEmailModal = (medical) => {
    setSelectedMedical(medical);
    setShowEmailModal(true);
  };

  const openDeleteModal = (medical) => {
    setSelectedMedical(medical);
    setShowDeleteModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      proprietor_name: '',
      gst_number: '',
      drug_license: '',
      address: '',
      state: '',
      district: '',
      pincode: '',
      email: '',
      phone: '',
      alternate_phone: '',
      lead_status: 'Pipeline',
      priority: 'moderate',
      follow_up_date: '',
    });
  };

  const getPriorityLabel = (priority) => {
    if (!priority || typeof priority !== 'string') return 'Moderate';
    const found = PRIORITIES.find(p => p.value === priority);
    return found ? found.label : 'Moderate';
  };

  const getPriorityColor = (priority) => {
    if (!priority || typeof priority !== 'string') return 'bg-amber-100 text-amber-700';
    const found = PRIORITIES.find(p => p.value === priority);
    return found ? found.color : 'bg-amber-100 text-amber-700';
  };

  const isFollowUpDue = (medical) => {
    if (medical.lead_status === 'Not Interested' || medical.lead_status === 'Closed') return false;
    if (!medical.follow_up_date) return false;
    const today = new Date().toISOString().split('T')[0];
    return medical.follow_up_date <= today;
  };

  const getFullAddress = (medical) => {
    const parts = [medical.address, medical.district, medical.state, medical.pincode].filter(Boolean);
    return parts.join(', ') || 'N/A';
  };

  return (
    <div className="space-y-6" data-testid="medicals-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Medicals</h1>
          <p className="text-slate-500">Manage your medical store contacts</p>
        </div>
        <Button onClick={() => setShowAddModal(true)} className="gap-2" data-testid="add-medical-btn">
          <Plus className="w-4 h-4" />
          Add Medical
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                placeholder="Search by name, phone, GST..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
                data-testid="search-input"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48" data-testid="status-filter">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {LEAD_STATUSES.map((status) => (
                  <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Medicals List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        </div>
      ) : medicals.length > 0 ? (
        <div className="grid gap-4">
          {medicals.map((medical) => (
            <Card key={medical.id} className={`card-hover ${isFollowUpDue(medical) ? 'border-l-4 border-l-red-500' : ''}`} data-testid={`medical-card-${medical.id}`}>
              <CardContent className="pt-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <Store className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-slate-800">{medical.name}</h3>
                        <Badge variant="outline" className="text-xs">{medical.customer_code}</Badge>
                        <Badge className={getStatusColor(medical.lead_status)}>{medical.lead_status}</Badge>
                        {medical.priority && (
                          <Badge className={getPriorityColor(medical.priority)}>
                            {getPriorityLabel(medical.priority)}
                          </Badge>
                        )}
                        {isFollowUpDue(medical) && (
                          <Badge className="bg-red-500 text-white animate-pulse">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Follow-up Due
                          </Badge>
                        )}
                      </div>
                      {medical.proprietor_name && (
                        <p className="text-sm text-slate-600">Prop: {medical.proprietor_name}</p>
                      )}
                      <div className="flex flex-wrap gap-4 text-sm text-slate-500">
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {medical.phone}
                        </span>
                        {medical.gst_number && (
                          <span className="flex items-center gap-1">
                            <FileText className="w-3 h-3" />
                            GST: {medical.gst_number}
                          </span>
                        )}
                        {medical.last_contact_date && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Last: {formatDate(medical.last_contact_date)}
                          </span>
                        )}
                        {medical.follow_up_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Follow-up: {formatDate(medical.follow_up_date)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button variant="outline" size="sm" onClick={() => fetchMedicalDetails(medical)} title="View Details">
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleMarkContacted(medical)} title="Mark Contacted">
                      <PhoneCall className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openEditModal(medical)} title="Edit">
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openEmailModal(medical)} title="Send Email">
                      <Mail className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openDeleteModal(medical)} className="text-red-600 hover:text-red-700" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-16">
            <div className="flex flex-col items-center text-slate-400">
              <Store className="w-16 h-16 mb-4" />
              <h3 className="text-lg font-medium">No medicals found</h3>
              <p className="text-sm">Add your first medical store to get started</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Medical Modal */}
      <Dialog open={showAddModal || showEditModal} onOpenChange={() => { setShowAddModal(false); setShowEditModal(false); resetForm(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{showEditModal ? 'Edit Medical' : 'Add New Medical'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label>Medical Name *</Label>
                <Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="ABC Medical Store" data-testid="medical-name-input" />
              </div>
              <div className="space-y-2">
                <Label>Proprietor Name</Label>
                <Input value={formData.proprietor_name} onChange={(e) => setFormData({...formData, proprietor_name: e.target.value})} placeholder="John Doe" />
              </div>
              <div className="space-y-2">
                <Label>Phone *</Label>
                <Input value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} placeholder="9876543210" data-testid="medical-phone-input" />
              </div>
              <div className="space-y-2">
                <Label>Alternate Phone</Label>
                <Input value={formData.alternate_phone} onChange={(e) => setFormData({...formData, alternate_phone: e.target.value})} placeholder="9876543211" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} placeholder="medical@email.com" />
              </div>
              <div className="space-y-2">
                <Label>GST Number</Label>
                <Input value={formData.gst_number} onChange={(e) => setFormData({...formData, gst_number: e.target.value})} placeholder="22AAAAA0000A1Z5" />
              </div>
              <div className="space-y-2">
                <Label>Drug License</Label>
                <Input value={formData.drug_license} onChange={(e) => setFormData({...formData, drug_license: e.target.value})} placeholder="DL123456" />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Address</Label>
                <Input value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} placeholder="123 Main Street" />
              </div>
              <div className="space-y-2">
                <Label>State</Label>
                <Input value={formData.state} onChange={(e) => setFormData({...formData, state: e.target.value})} placeholder="Karnataka" />
              </div>
              <div className="space-y-2">
                <Label>District</Label>
                <Input value={formData.district} onChange={(e) => setFormData({...formData, district: e.target.value})} placeholder="Bangalore" />
              </div>
              <div className="space-y-2">
                <Label>Pincode</Label>
                <Input value={formData.pincode} onChange={(e) => setFormData({...formData, pincode: e.target.value})} placeholder="560001" />
              </div>
              <div className="space-y-2">
                <Label>Lead Status</Label>
                <Select value={formData.lead_status} onValueChange={(v) => setFormData({...formData, lead_status: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LEAD_STATUSES.map((status) => (
                      <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={formData.priority} onValueChange={(v) => setFormData({...formData, priority: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Follow-up Date</Label>
                <Input type="date" value={formData.follow_up_date} onChange={(e) => setFormData({...formData, follow_up_date: e.target.value})} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddModal(false); setShowEditModal(false); resetForm(); }}>Cancel</Button>
            <Button onClick={showEditModal ? handleEditMedical : handleAddMedical} disabled={formLoading}>
              {formLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {showEditModal ? 'Update' : 'Add'} Medical
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Medical Detail Modal with Notes & Tasks */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Store className="w-5 h-5" />
              {selectedMedical?.name} - {selectedMedical?.customer_code}
            </DialogTitle>
          </DialogHeader>
          {selectedMedical && (
            <div className="space-y-6 py-4">
              {/* Medical Info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-slate-500">Proprietor:</span> {selectedMedical.proprietor_name || 'N/A'}</div>
                <div><span className="text-slate-500">Phone:</span> {selectedMedical.phone}</div>
                <div><span className="text-slate-500">Alternate:</span> {selectedMedical.alternate_phone || 'N/A'}</div>
                <div><span className="text-slate-500">Email:</span> {selectedMedical.email || 'N/A'}</div>
                <div><span className="text-slate-500">GST:</span> {selectedMedical.gst_number || 'N/A'}</div>
                <div><span className="text-slate-500">Drug License:</span> {selectedMedical.drug_license || 'N/A'}</div>
                <div className="col-span-2"><span className="text-slate-500">Address:</span> {getFullAddress(selectedMedical)}</div>
                <div><span className="text-slate-500">Status:</span> <Badge className={getStatusColor(selectedMedical.lead_status)}>{selectedMedical.lead_status}</Badge></div>
                <div><span className="text-slate-500">Priority:</span> <Badge className={getPriorityColor(selectedMedical.priority || 'moderate')}>{getPriorityLabel(selectedMedical.priority || 'moderate')}</Badge></div>
                <div><span className="text-slate-500">Last Contact:</span> {selectedMedical.last_contact_date ? formatDate(selectedMedical.last_contact_date) : 'Never'}</div>
                <div><span className="text-slate-500">Follow-up:</span> {selectedMedical.follow_up_date ? formatDate(selectedMedical.follow_up_date) : 'Not set'}</div>
              </div>

              {/* Notes Section */}
              <div className="border-t pt-4">
                <h4 className="font-medium flex items-center gap-2 mb-3">
                  <MessageSquare className="w-4 h-4" /> Notes
                </h4>
                <div className="flex gap-2 mb-3">
                  <Input value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Add a note..." className="flex-1" />
                  <Button onClick={handleAddNote} size="sm">Add</Button>
                </div>
                {loadingNotes ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : notes.length > 0 ? (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {notes.map((note) => (
                      <div key={note.id} className="bg-slate-50 p-3 rounded-lg text-sm flex justify-between items-start">
                        <div>
                          <p>{note.note}</p>
                          <p className="text-xs text-slate-400 mt-1">{note.created_by} - {formatDate(note.created_at)}</p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteNote(note.id)} className="text-red-500 h-6 w-6 p-0">
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">No notes yet</p>
                )}
              </div>

              {/* Tasks Section */}
              <div className="border-t pt-4">
                <h4 className="font-medium flex items-center gap-2 mb-3">
                  <CheckSquare className="w-4 h-4" /> Tasks
                </h4>
                <div className="flex gap-2 mb-3">
                  <Input value={newTask.title} onChange={(e) => setNewTask({...newTask, title: e.target.value})} placeholder="Task title..." className="flex-1" />
                  <Input type="date" value={newTask.due_date} onChange={(e) => setNewTask({...newTask, due_date: e.target.value})} className="w-36" />
                  <Select value={newTask.priority} onValueChange={(v) => setNewTask({...newTask, priority: v})}>
                    <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map((p) => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={handleAddTask} size="sm">Add</Button>
                </div>
                {tasks.length > 0 ? (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {tasks.map((task) => (
                      <div key={task.id} className={`p-3 rounded-lg text-sm flex justify-between items-center ${task.status === 'completed' ? 'bg-green-50' : 'bg-slate-50'}`}>
                        <div className="flex items-center gap-2">
                          <input type="checkbox" checked={task.status === 'completed'} onChange={() => handleToggleTask(task)} className="w-4 h-4" />
                          <span className={task.status === 'completed' ? 'line-through text-slate-400' : ''}>{task.title}</span>
                          <Badge className={getPriorityColor(task.priority)} variant="outline">{getPriorityLabel(task.priority)}</Badge>
                        </div>
                        {task.due_date && <span className="text-xs text-slate-500">{formatDate(task.due_date)}</span>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">No tasks yet</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Email Modal */}
      <Dialog open={showEmailModal} onOpenChange={setShowEmailModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send Email to {selectedMedical?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Subject</Label>
              <Input value={emailData.subject} onChange={(e) => setEmailData({...emailData, subject: e.target.value})} placeholder="Email subject" />
            </div>
            <div className="space-y-2">
              <Label>Body</Label>
              <Textarea value={emailData.body} onChange={(e) => setEmailData({...emailData, body: e.target.value})} placeholder="Email body" rows={6} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEmailModal(false)}>Cancel</Button>
            <Button onClick={handleSendEmail} disabled={formLoading}>
              {formLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Send Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600">Delete Medical</DialogTitle>
          </DialogHeader>
          <p className="py-4">Are you sure you want to delete <strong>{selectedMedical?.name}</strong>? This will also delete all notes and tasks.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
            <Button onClick={handleDeleteMedical} disabled={formLoading} className="bg-red-600 hover:bg-red-700">
              {formLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Medicals;
