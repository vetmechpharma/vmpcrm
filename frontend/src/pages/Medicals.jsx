import { useState, useEffect } from 'react';
import { medicalsAPI, emailAPI, tasksAPI, transportAPI, locationAPI } from '../lib/api';
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
  RefreshCw,
  Truck
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
  
  // Bulk selection
  const [selectedIds, setSelectedIds] = useState([]);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  
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
    address_line_1: '',
    address_line_2: '',
    state: '',
    district: '',
    pincode: '',
    delivery_station: '',
    transport_id: '',
    email: '',
    phone: '',
    alternate_phone: '',
    lead_status: 'Pipeline',
    priority: 'moderate',
    follow_up_date: '',
    birthday: '',
    anniversary: '',
  });

  // States, Districts, and Transports data
  const [states, setStates] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [transports, setTransports] = useState([]);

  const [emailData, setEmailData] = useState({
    subject: '',
    body: '',
  });

  useEffect(() => {
    fetchMedicals();
  }, [search, statusFilter]);

  useEffect(() => {
    fetchStatesAndTransports();
  }, []);

  // Fetch districts when state changes
  useEffect(() => {
    if (formData.state) {
      fetchDistricts(formData.state);
    } else {
      setDistricts([]);
    }
  }, [formData.state]);

  const fetchStatesAndTransports = async () => {
    try {
      const [statesRes, transportsRes] = await Promise.all([
        locationAPI.getStates(),
        transportAPI.getAll()
      ]);
      setStates(statesRes.data.states || []);
      setTransports(transportsRes.data || []);
    } catch (error) {
      console.error('Failed to fetch states/transports');
    }
  };

  const fetchDistricts = async (state) => {
    try {
      const response = await locationAPI.getDistricts(state);
      setDistricts(response.data.districts || []);
    } catch (error) {
      console.error('Failed to fetch districts');
      setDistricts([]);
    }
  };

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

  // Bulk selection handlers
  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedIds(medicals.map(m => m.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id, checked) => {
    if (checked) {
      setSelectedIds([...selectedIds, id]);
    } else {
      setSelectedIds(selectedIds.filter(i => i !== id));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    
    setBulkDeleting(true);
    try {
      const response = await medicalsAPI.bulkDelete(selectedIds);
      toast.success(response.data.message || `${selectedIds.length} medical(s) deleted successfully`);
      setShowBulkDeleteModal(false);
      setSelectedIds([]);
      fetchMedicals();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete medicals');
    } finally {
      setBulkDeleting(false);
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

  const openEditModal = async (medical) => {
    setSelectedMedical(medical);
    // If medical has a state, fetch districts first
    if (medical.state) {
      try {
        const response = await locationAPI.getDistricts(medical.state);
        setDistricts(response.data.districts || []);
      } catch (error) {
        console.error('Failed to fetch districts');
      }
    }
    setFormData({
      name: medical.name,
      proprietor_name: medical.proprietor_name || '',
      gst_number: medical.gst_number || '',
      drug_license: medical.drug_license || '',
      address: medical.address || '',
      address_line_1: medical.address_line_1 || '',
      address_line_2: medical.address_line_2 || '',
      state: medical.state || '',
      district: medical.district || '',
      pincode: medical.pincode || '',
      delivery_station: medical.delivery_station || '',
      transport_id: medical.transport_id || '',
      email: medical.email || '',
      phone: medical.phone,
      alternate_phone: medical.alternate_phone || '',
      lead_status: medical.lead_status,
      priority: medical.priority || 'moderate',
      follow_up_date: medical.follow_up_date || '',
      birthday: medical.birthday || '',
      anniversary: medical.anniversary || '',
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
      address_line_1: '',
      address_line_2: '',
      state: '',
      district: '',
      pincode: '',
      delivery_station: '',
      transport_id: '',
      email: '',
      phone: '',
      alternate_phone: '',
      lead_status: 'Pipeline',
      priority: 'moderate',
      follow_up_date: '',
      birthday: '',
      anniversary: '',
    });
    setDistricts([]);
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
            {selectedIds.length > 0 && (
              <Button 
                variant="destructive" 
                onClick={() => setShowBulkDeleteModal(true)}
                data-testid="bulk-delete-btn"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete ({selectedIds.length})
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Medicals Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Medicals List</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
          ) : medicals.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedIds.length === medicals.length && medicals.length > 0}
                        onCheckedChange={handleSelectAll}
                        data-testid="select-all-checkbox"
                      />
                    </TableHead>
                    <TableHead>Medical</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead className="hidden md:table-cell">Follow-up</TableHead>
                    <TableHead className="hidden lg:table-cell">Last Contact</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {medicals.map((medical) => (
                    <TableRow 
                      key={medical.id} 
                      className={`${isFollowUpDue(medical) ? 'bg-red-50' : ''} ${selectedIds.includes(medical.id) ? 'bg-blue-50' : ''}`}
                      data-testid={`medical-row-${medical.id}`}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.includes(medical.id)}
                          onCheckedChange={(checked) => handleSelectOne(medical.id, checked)}
                          data-testid={`select-medical-${medical.id}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <Store className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{medical.name}</p>
                            <p className="text-xs text-slate-500">{medical.customer_code}</p>
                            {medical.proprietor_name && <p className="text-xs text-slate-400">Prop: {medical.proprietor_name}</p>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="flex items-center gap-1 text-sm">
                            <Phone className="w-3 h-3 text-slate-400" />
                            {medical.phone}
                          </p>
                          {medical.gst_number && (
                            <p className="flex items-center gap-1 text-xs text-slate-500">
                              <FileText className="w-3 h-3" />
                              GST: {medical.gst_number}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1">
                          <Badge className={getStatusColor(medical.lead_status)}>
                            {medical.lead_status}
                          </Badge>
                          {medical.is_portal_customer && (
                            <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">
                              Portal
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getPriorityColor(medical.priority)}>
                          {getPriorityLabel(medical.priority)}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {medical.follow_up_date ? (
                          <div className="flex items-center gap-1 text-sm">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            <span className={isFollowUpDue(medical) ? 'text-red-600 font-medium' : ''}>
                              {formatDate(medical.follow_up_date)}
                            </span>
                          </div>
                        ) : <span className="text-slate-400">-</span>}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {medical.last_contact_date ? (
                          <div className="flex items-center gap-1 text-sm">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {formatDate(medical.last_contact_date)}
                          </div>
                        ) : <span className="text-slate-400">-</span>}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => fetchMedicalDetails(medical)} title="View Details">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleMarkContacted(medical)} title="Mark Contacted">
                            <PhoneCall className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditModal(medical)} title="Edit">
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEmailModal(medical)} title="Send Email">
                            <Mail className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => openDeleteModal(medical)} title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12">
              <Store className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">No medicals found</p>
              <Button onClick={() => setShowAddModal(true)} variant="outline" className="mt-4">
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Medical
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Medical Modal */}
      <Dialog open={showAddModal || showEditModal} onOpenChange={() => { setShowAddModal(false); setShowEditModal(false); resetForm(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{showEditModal ? 'Edit Medical' : 'Add New Medical'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Basic Info */}
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

              {/* Address Section */}
              <div className="col-span-2 pt-2 border-t">
                <h4 className="text-sm font-medium text-slate-700 mb-3">Address Details</h4>
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Address Line 1</Label>
                <Input value={formData.address_line_1} onChange={(e) => setFormData({...formData, address_line_1: e.target.value})} placeholder="Building/Street" />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Address Line 2</Label>
                <Input value={formData.address_line_2} onChange={(e) => setFormData({...formData, address_line_2: e.target.value})} placeholder="Area/Landmark" />
              </div>
              <div className="space-y-2">
                <Label>State</Label>
                <Select value={formData.state} onValueChange={(v) => setFormData({...formData, state: v, district: ''})}>
                  <SelectTrigger><SelectValue placeholder="Select State" /></SelectTrigger>
                  <SelectContent className="max-h-60">
                    {states.map((state) => (
                      <SelectItem key={state} value={state}>{state}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>District</Label>
                <Select value={formData.district} onValueChange={(v) => setFormData({...formData, district: v})} disabled={!formData.state}>
                  <SelectTrigger><SelectValue placeholder={formData.state ? "Select District" : "Select state first"} /></SelectTrigger>
                  <SelectContent className="max-h-60">
                    {districts.map((district) => (
                      <SelectItem key={district} value={district}>{district}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Pincode</Label>
                <Input value={formData.pincode} onChange={(e) => setFormData({...formData, pincode: e.target.value})} placeholder="560001" maxLength={6} />
              </div>

              {/* Delivery Preferences */}
              <div className="col-span-2 pt-2 border-t">
                <h4 className="text-sm font-medium text-slate-700 mb-3">Delivery Preferences</h4>
              </div>
              <div className="space-y-2">
                <Label>Delivery Station</Label>
                <Input value={formData.delivery_station} onChange={(e) => setFormData({...formData, delivery_station: e.target.value})} placeholder="Station name" />
              </div>
              <div className="space-y-2">
                <Label>Preferred Transport</Label>
                <Select value={formData.transport_id || 'none'} onValueChange={(v) => setFormData({...formData, transport_id: v === 'none' ? '' : v})}>
                  <SelectTrigger><SelectValue placeholder="Select Transport" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {transports.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Other Details */}
              <div className="col-span-2 pt-2 border-t">
                <h4 className="text-sm font-medium text-slate-700 mb-3">Other Details</h4>
              </div>
              <div className="space-y-2">
                <Label>Birthday</Label>
                <Input type="date" value={formData.birthday} onChange={(e) => setFormData({...formData, birthday: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Anniversary</Label>
                <Input type="date" value={formData.anniversary} onChange={(e) => setFormData({...formData, anniversary: e.target.value})} />
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

      {/* Bulk Delete Modal */}
      <Dialog open={showBulkDeleteModal} onOpenChange={setShowBulkDeleteModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Delete {selectedIds.length} Medical(s)
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-slate-600 mb-3">Are you sure you want to delete <strong>{selectedIds.length}</strong> selected medical(s)?</p>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700">
                <strong>Warning:</strong> This action cannot be undone. All associated notes will also be deleted.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkDeleteModal(false)}>Cancel</Button>
            <Button onClick={handleBulkDelete} disabled={bulkDeleting} className="bg-red-600 hover:bg-red-700">
              {bulkDeleting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Delete {selectedIds.length} Medical(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Medicals;
