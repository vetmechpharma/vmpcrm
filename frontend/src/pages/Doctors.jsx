import { useState, useEffect } from 'react';
import { doctorsAPI, emailAPI, tasksAPI } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Mail, 
  Loader2,
  Users,
  Phone,
  MapPin,
  Calendar,
  Clock,
  MessageSquare,
  CheckSquare,
  AlertTriangle,
  PhoneCall,
  Eye
} from 'lucide-react';
import { LEAD_STATUSES, getStatusColor, formatDate } from '../lib/utils';

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
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
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
    reg_no: '',
    address: '',
    email: '',
    phone: '',
    lead_status: 'Pipeline',
    dob: '',
    priority: 'moderate',
    follow_up_date: '',
  });

  const [emailData, setEmailData] = useState({
    subject: '',
    body: '',
  });

  useEffect(() => {
    fetchDoctors();
  }, [search, statusFilter]);

  const fetchDoctors = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (statusFilter !== 'all') params.status = statusFilter;
      
      const response = await doctorsAPI.getAll(params);
      setDoctors(response.data);
    } catch (error) {
      toast.error('Failed to fetch doctors');
    } finally {
      setLoading(false);
    }
  };

  const fetchDoctorDetails = async (doctor) => {
    setSelectedDoctor(doctor);
    setShowDetailModal(true);
    setLoadingNotes(true);
    
    try {
      const [notesRes, tasksRes] = await Promise.all([
        doctorsAPI.getNotes(doctor.id),
        tasksAPI.getAll({ doctor_id: doctor.id })
      ]);
      setNotes(notesRes.data);
      setTasks(tasksRes.data);
    } catch (error) {
      console.error('Failed to fetch details');
    } finally {
      setLoadingNotes(false);
    }
  };

  const handleAddDoctor = async () => {
    if (!formData.name || !formData.phone) {
      toast.error('Name and phone are required');
      return;
    }
    
    setFormLoading(true);
    try {
      await doctorsAPI.create(formData);
      toast.success('Doctor added successfully');
      setShowAddModal(false);
      resetForm();
      fetchDoctors();
    } catch (error) {
      toast.error('Failed to add doctor');
    } finally {
      setFormLoading(false);
    }
  };

  const handleEditDoctor = async () => {
    setFormLoading(true);
    try {
      await doctorsAPI.update(selectedDoctor.id, formData);
      toast.success('Doctor updated successfully');
      setShowEditModal(false);
      resetForm();
      fetchDoctors();
    } catch (error) {
      toast.error('Failed to update doctor');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteDoctor = async () => {
    setFormLoading(true);
    try {
      await doctorsAPI.delete(selectedDoctor.id);
      toast.success('Doctor deleted successfully');
      setShowDeleteModal(false);
      setSelectedDoctor(null);
      fetchDoctors();
    } catch (error) {
      toast.error('Failed to delete doctor');
    } finally {
      setFormLoading(false);
    }
  };

  const handleMarkContacted = async (doctor) => {
    try {
      await doctorsAPI.updateContact(doctor.id);
      toast.success('Contact updated! Follow-up set for 25 days');
      fetchDoctors();
    } catch (error) {
      toast.error('Failed to update contact');
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    
    try {
      await doctorsAPI.addNote(selectedDoctor.id, { note: newNote });
      toast.success('Note added');
      setNewNote('');
      const notesRes = await doctorsAPI.getNotes(selectedDoctor.id);
      setNotes(notesRes.data);
    } catch (error) {
      toast.error('Failed to add note');
    }
  };

  const handleDeleteNote = async (noteId) => {
    try {
      await doctorsAPI.deleteNote(selectedDoctor.id, noteId);
      toast.success('Note deleted');
      setNotes(notes.filter(n => n.id !== noteId));
    } catch (error) {
      toast.error('Failed to delete note');
    }
  };

  const handleAddTask = async () => {
    if (!newTask.title.trim()) return;
    
    try {
      await tasksAPI.create({ ...newTask, doctor_id: selectedDoctor.id });
      toast.success('Task added');
      setNewTask({ title: '', description: '', due_date: '', priority: 'moderate' });
      const tasksRes = await tasksAPI.getAll({ doctor_id: selectedDoctor.id });
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
      await emailAPI.send({
        doctor_id: selectedDoctor.id,
        subject: emailData.subject,
        body: emailData.body,
      });
      toast.success('Email sent successfully');
      setShowEmailModal(false);
      setEmailData({ subject: '', body: '' });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send email');
    } finally {
      setFormLoading(false);
    }
  };

  const openEditModal = (doctor) => {
    setSelectedDoctor(doctor);
    setFormData({
      name: doctor.name,
      reg_no: doctor.reg_no,
      address: doctor.address,
      email: doctor.email,
      phone: doctor.phone,
      lead_status: doctor.lead_status,
      dob: doctor.dob || '',
      priority: doctor.priority || 'moderate',
      follow_up_date: doctor.follow_up_date || '',
    });
    setShowEditModal(true);
  };

  const openEmailModal = (doctor) => {
    setSelectedDoctor(doctor);
    setShowEmailModal(true);
  };

  const openDeleteModal = (doctor) => {
    setSelectedDoctor(doctor);
    setShowDeleteModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      reg_no: '',
      address: '',
      email: '',
      phone: '',
      lead_status: 'Pipeline',
      dob: '',
      priority: 'moderate',
      follow_up_date: '',
    });
  };

  const getPriorityConfig = (priority) => {
    const found = PRIORITIES.find(p => p.value === priority);
    return found || PRIORITIES[1];
  };

  const getPriorityLabel = (priority) => {
    const config = getPriorityConfig(priority);
    return config.label;
  };

  const getPriorityColor = (priority) => {
    const config = getPriorityConfig(priority);
    return config.color;
  };

  const isFollowUpDue = (doctor) => {
    if (doctor.lead_status === 'Not Interested' || doctor.lead_status === 'Closed') return false;
    if (!doctor.follow_up_date) return false;
    const today = new Date().toISOString().split('T')[0];
    return doctor.follow_up_date <= today;
  };

  return (
    <div className="space-y-6" data-testid="doctors-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Doctors / Leads</h1>
          <p className="text-slate-500">Manage your doctor leads and contacts</p>
        </div>
        <Button onClick={() => setShowAddModal(true)} className="gap-2" data-testid="add-doctor-btn">
          <Plus className="w-4 h-4" />
          Add Doctor
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                placeholder="Search by name, phone, email..."
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
                  <SelectItem key={status} value={status}>{status}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Doctors List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        </div>
      ) : doctors.length > 0 ? (
        <div className="grid gap-4">
          {doctors.map((doctor) => (
            <Card key={doctor.id} className={`card-hover ${isFollowUpDue(doctor) ? 'border-l-4 border-l-red-500' : ''}`} data-testid={`doctor-card-${doctor.id}`}>
              <CardContent className="pt-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center">
                      <Users className="w-6 h-6 text-slate-600" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-slate-800">{doctor.name}</h3>
                        <Badge variant="outline" className="text-xs">{doctor.customer_code}</Badge>
                        <Badge className={getStatusColor(doctor.lead_status)}>{doctor.lead_status}</Badge>
                        {doctor.priority && (
                          <Badge className={getPriorityConfig(doctor.priority).color}>
                            {getPriorityConfig(doctor.priority).label}
                          </Badge>
                        )}
                        {isFollowUpDue(doctor) && (
                          <Badge className="bg-red-500 text-white animate-pulse">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Follow-up Due
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm text-slate-500">
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {doctor.phone}
                        </span>
                        {doctor.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {doctor.email}
                          </span>
                        )}
                        {doctor.last_contact_date && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Last: {formatDate(doctor.last_contact_date)}
                          </span>
                        )}
                        {doctor.follow_up_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Follow-up: {formatDate(doctor.follow_up_date)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button variant="outline" size="sm" onClick={() => fetchDoctorDetails(doctor)} title="View Details">
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleMarkContacted(doctor)} title="Mark Contacted">
                      <PhoneCall className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openEditModal(doctor)} title="Edit">
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openEmailModal(doctor)} title="Send Email">
                      <Mail className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openDeleteModal(doctor)} className="text-red-600 hover:text-red-700" title="Delete">
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
              <Users className="w-16 h-16 mb-4" />
              <h3 className="text-lg font-medium">No doctors found</h3>
              <p className="text-sm">Add your first doctor to get started</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Doctor Modal */}
      <Dialog open={showAddModal || showEditModal} onOpenChange={() => { setShowAddModal(false); setShowEditModal(false); resetForm(); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{showEditModal ? 'Edit Doctor' : 'Add New Doctor'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label>Name *</Label>
                <Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="Dr. John Smith" data-testid="doctor-name-input" />
              </div>
              <div className="space-y-2">
                <Label>Phone *</Label>
                <Input value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} placeholder="9876543210" data-testid="doctor-phone-input" />
              </div>
              <div className="space-y-2">
                <Label>Reg. No</Label>
                <Input value={formData.reg_no} onChange={(e) => setFormData({...formData, reg_no: e.target.value})} placeholder="REG123" />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Email</Label>
                <Input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} placeholder="doctor@email.com" />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Address</Label>
                <Input value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} placeholder="123 Medical St" />
              </div>
              <div className="space-y-2">
                <Label>Date of Birth</Label>
                <Input type="date" value={formData.dob} onChange={(e) => setFormData({...formData, dob: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Lead Status</Label>
                <Select value={formData.lead_status} onValueChange={(v) => setFormData({...formData, lead_status: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LEAD_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>{status}</SelectItem>
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
            <Button onClick={showEditModal ? handleEditDoctor : handleAddDoctor} disabled={formLoading}>
              {formLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {showEditModal ? 'Update' : 'Add'} Doctor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Doctor Detail Modal with Notes & Tasks */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              {selectedDoctor?.name} - {selectedDoctor?.customer_code}
            </DialogTitle>
          </DialogHeader>
          {selectedDoctor && (
            <div className="space-y-6 py-4">
              {/* Doctor Info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-slate-500">Phone:</span> {selectedDoctor.phone}</div>
                <div><span className="text-slate-500">Email:</span> {selectedDoctor.email || 'N/A'}</div>
                <div><span className="text-slate-500">Status:</span> <Badge className={getStatusColor(selectedDoctor.lead_status)}>{selectedDoctor.lead_status}</Badge></div>
                <div><span className="text-slate-500">Priority:</span> <Badge className={getPriorityConfig(selectedDoctor.priority).color}>{getPriorityConfig(selectedDoctor.priority).label}</Badge></div>
                <div><span className="text-slate-500">Last Contact:</span> {selectedDoctor.last_contact_date ? formatDate(selectedDoctor.last_contact_date) : 'Never'}</div>
                <div><span className="text-slate-500">Follow-up:</span> {selectedDoctor.follow_up_date ? formatDate(selectedDoctor.follow_up_date) : 'Not set'}</div>
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
                          <Badge className={getPriorityConfig(task.priority).color} variant="outline">{task.priority}</Badge>
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
            <DialogTitle>Send Email to {selectedDoctor?.name}</DialogTitle>
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
            <DialogTitle className="text-red-600">Delete Doctor</DialogTitle>
          </DialogHeader>
          <p className="py-4">Are you sure you want to delete <strong>{selectedDoctor?.name}</strong>? This will also delete all notes and tasks.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
            <Button onClick={handleDeleteDoctor} disabled={formLoading} className="bg-red-600 hover:bg-red-700">
              {formLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Doctors;
