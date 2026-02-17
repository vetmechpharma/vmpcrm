import { useState, useEffect } from 'react';
import { agenciesAPI, emailAPI, tasksAPI, transportAPI, locationAPI } from '../lib/api';
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
  Building,
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

export const Agencies = () => {
  const [agencies, setAgencies] = useState([]);
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
  const [selectedAgency, setSelectedAgency] = useState(null);
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
    fetchAgencies();
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

  const fetchAgencies = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (statusFilter !== 'all') params.status = statusFilter;
      
      const response = await agenciesAPI.getAll(params);
      setAgencies(response.data);
    } catch (error) {
      toast.error('Failed to fetch agencies');
    } finally {
      setLoading(false);
    }
  };

  const fetchAgencyDetails = async (agency) => {
    setSelectedAgency(agency);
    setShowDetailModal(true);
    setLoadingNotes(true);
    
    try {
      const [notesRes, tasksRes] = await Promise.all([
        agenciesAPI.getNotes(agency.id),
        tasksAPI.getAll({ agency_id: agency.id })
      ]);
      setNotes(notesRes.data);
      setTasks(tasksRes.data);
    } catch (error) {
      console.error('Failed to fetch details');
    } finally {
      setLoadingNotes(false);
    }
  };

  const handleAddAgency = async () => {
    if (!formData.name || !formData.phone) {
      toast.error('Name and phone are required');
      return;
    }
    
    setFormLoading(true);
    try {
      await agenciesAPI.create(formData);
      toast.success('Agency added successfully');
      setShowAddModal(false);
      resetForm();
      fetchAgencies();
    } catch (error) {
      toast.error('Failed to add agency');
    } finally {
      setFormLoading(false);
    }
  };

  const handleEditAgency = async () => {
    setFormLoading(true);
    try {
      await agenciesAPI.update(selectedAgency.id, formData);
      toast.success('Agency updated successfully');
      setShowEditModal(false);
      resetForm();
      fetchAgencies();
    } catch (error) {
      toast.error('Failed to update agency');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteAgency = async () => {
    setFormLoading(true);
    try {
      await agenciesAPI.delete(selectedAgency.id);
      toast.success('Agency deleted successfully');
      setShowDeleteModal(false);
      setSelectedAgency(null);
      fetchAgencies();
    } catch (error) {
      toast.error('Failed to delete agency');
    } finally {
      setFormLoading(false);
    }
  };

  // Bulk selection handlers
  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedIds(agencies.map(a => a.id));
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
      const response = await agenciesAPI.bulkDelete(selectedIds);
      toast.success(response.data.message || `${selectedIds.length} agency(ies) deleted successfully`);
      setShowBulkDeleteModal(false);
      setSelectedIds([]);
      fetchAgencies();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete agencies');
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleMarkContacted = async (agency) => {
    try {
      await agenciesAPI.updateContact(agency.id);
      toast.success('Contact updated! Follow-up set for 25 days');
      fetchAgencies();
    } catch (error) {
      toast.error('Failed to update contact');
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    
    try {
      await agenciesAPI.addNote(selectedAgency.id, { note: newNote });
      toast.success('Note added');
      setNewNote('');
      const notesRes = await agenciesAPI.getNotes(selectedAgency.id);
      setNotes(notesRes.data);
    } catch (error) {
      toast.error('Failed to add note');
    }
  };

  const handleDeleteNote = async (noteId) => {
    try {
      await agenciesAPI.deleteNote(selectedAgency.id, noteId);
      toast.success('Note deleted');
      setNotes(notes.filter(n => n.id !== noteId));
    } catch (error) {
      toast.error('Failed to delete note');
    }
  };

  const handleAddTask = async () => {
    if (!newTask.title.trim()) return;
    
    try {
      await tasksAPI.create({ ...newTask, agency_id: selectedAgency.id });
      toast.success('Task added');
      setNewTask({ title: '', description: '', due_date: '', priority: 'moderate' });
      const tasksRes = await tasksAPI.getAll({ agency_id: selectedAgency.id });
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
      // For agencies, we'd need a dedicated email endpoint or use generic one
      toast.info('Email functionality for agencies coming soon');
      setShowEmailModal(false);
      setEmailData({ subject: '', body: '' });
    } catch (error) {
      toast.error('Failed to send email');
    } finally {
      setFormLoading(false);
    }
  };

  const openEditModal = (agency) => {
    setSelectedAgency(agency);
    setFormData({
      name: agency.name,
      proprietor_name: agency.proprietor_name || '',
      gst_number: agency.gst_number || '',
      drug_license: agency.drug_license || '',
      address: agency.address || '',
      state: agency.state || '',
      district: agency.district || '',
      pincode: agency.pincode || '',
      email: agency.email || '',
      phone: agency.phone,
      alternate_phone: agency.alternate_phone || '',
      lead_status: agency.lead_status,
      priority: agency.priority || 'moderate',
      follow_up_date: agency.follow_up_date || '',
    });
    setShowEditModal(true);
  };

  const openEmailModal = (agency) => {
    setSelectedAgency(agency);
    setShowEmailModal(true);
  };

  const openDeleteModal = (agency) => {
    setSelectedAgency(agency);
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

  const isFollowUpDue = (agency) => {
    if (agency.lead_status === 'Not Interested' || agency.lead_status === 'Closed') return false;
    if (!agency.follow_up_date) return false;
    const today = new Date().toISOString().split('T')[0];
    return agency.follow_up_date <= today;
  };

  const getFullAddress = (agency) => {
    const parts = [agency.address, agency.district, agency.state, agency.pincode].filter(Boolean);
    return parts.join(', ') || 'N/A';
  };

  return (
    <div className="space-y-6" data-testid="agencies-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Agencies</h1>
          <p className="text-slate-500">Manage your distribution agency contacts</p>
        </div>
        <Button onClick={() => setShowAddModal(true)} className="gap-2" data-testid="add-agency-btn">
          <Plus className="w-4 h-4" />
          Add Agency
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

      {/* Agencies Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Agencies List</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
          ) : agencies.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedIds.length === agencies.length && agencies.length > 0}
                        onCheckedChange={handleSelectAll}
                        data-testid="select-all-checkbox"
                      />
                    </TableHead>
                    <TableHead>Agency</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead className="hidden md:table-cell">Follow-up</TableHead>
                    <TableHead className="hidden lg:table-cell">Last Contact</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agencies.map((agency) => (
                    <TableRow 
                      key={agency.id} 
                      className={`${isFollowUpDue(agency) ? 'bg-red-50' : ''} ${selectedIds.includes(agency.id) ? 'bg-blue-50' : ''}`}
                      data-testid={`agency-row-${agency.id}`}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.includes(agency.id)}
                          onCheckedChange={(checked) => handleSelectOne(agency.id, checked)}
                          data-testid={`select-agency-${agency.id}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <Building className="w-5 h-5 text-purple-600" />
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{agency.name}</p>
                            <p className="text-xs text-slate-500">{agency.customer_code}</p>
                            {agency.proprietor_name && <p className="text-xs text-slate-400">Prop: {agency.proprietor_name}</p>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="flex items-center gap-1 text-sm">
                            <Phone className="w-3 h-3 text-slate-400" />
                            {agency.phone}
                          </p>
                          {agency.gst_number && (
                            <p className="flex items-center gap-1 text-xs text-slate-500">
                              <FileText className="w-3 h-3" />
                              GST: {agency.gst_number}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(agency.lead_status)}>
                          {agency.lead_status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getPriorityColor(agency.priority)}>
                          {getPriorityLabel(agency.priority)}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {agency.follow_up_date ? (
                          <div className="flex items-center gap-1 text-sm">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            <span className={isFollowUpDue(agency) ? 'text-red-600 font-medium' : ''}>
                              {formatDate(agency.follow_up_date)}
                            </span>
                          </div>
                        ) : <span className="text-slate-400">-</span>}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {agency.last_contact_date ? (
                          <div className="flex items-center gap-1 text-sm">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {formatDate(agency.last_contact_date)}
                          </div>
                        ) : <span className="text-slate-400">-</span>}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => fetchAgencyDetails(agency)} title="View Details">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleMarkContacted(agency)} title="Mark Contacted">
                            <PhoneCall className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditModal(agency)} title="Edit">
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEmailModal(agency)} title="Send Email">
                            <Mail className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => openDeleteModal(agency)} title="Delete">
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
              <Building className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">No agencies found</p>
              <Button onClick={() => setShowAddModal(true)} variant="outline" className="mt-4">
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Agency
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Agency Modal */}
      <Dialog open={showAddModal || showEditModal} onOpenChange={() => { setShowAddModal(false); setShowEditModal(false); resetForm(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{showEditModal ? 'Edit Agency' : 'Add New Agency'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label>Agency Name *</Label>
                <Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="XYZ Distribution Agency" data-testid="agency-name-input" />
              </div>
              <div className="space-y-2">
                <Label>Proprietor Name</Label>
                <Input value={formData.proprietor_name} onChange={(e) => setFormData({...formData, proprietor_name: e.target.value})} placeholder="John Doe" />
              </div>
              <div className="space-y-2">
                <Label>Phone *</Label>
                <Input value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} placeholder="9876543210" data-testid="agency-phone-input" />
              </div>
              <div className="space-y-2">
                <Label>Alternate Phone</Label>
                <Input value={formData.alternate_phone} onChange={(e) => setFormData({...formData, alternate_phone: e.target.value})} placeholder="9876543211" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} placeholder="agency@email.com" />
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
            <Button onClick={showEditModal ? handleEditAgency : handleAddAgency} disabled={formLoading}>
              {formLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {showEditModal ? 'Update' : 'Add'} Agency
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Agency Detail Modal with Notes & Tasks */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building className="w-5 h-5" />
              {selectedAgency?.name} - {selectedAgency?.customer_code}
            </DialogTitle>
          </DialogHeader>
          {selectedAgency && (
            <div className="space-y-6 py-4">
              {/* Agency Info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-slate-500">Proprietor:</span> {selectedAgency.proprietor_name || 'N/A'}</div>
                <div><span className="text-slate-500">Phone:</span> {selectedAgency.phone}</div>
                <div><span className="text-slate-500">Alternate:</span> {selectedAgency.alternate_phone || 'N/A'}</div>
                <div><span className="text-slate-500">Email:</span> {selectedAgency.email || 'N/A'}</div>
                <div><span className="text-slate-500">GST:</span> {selectedAgency.gst_number || 'N/A'}</div>
                <div><span className="text-slate-500">Drug License:</span> {selectedAgency.drug_license || 'N/A'}</div>
                <div className="col-span-2"><span className="text-slate-500">Address:</span> {getFullAddress(selectedAgency)}</div>
                <div><span className="text-slate-500">Status:</span> <Badge className={getStatusColor(selectedAgency.lead_status)}>{selectedAgency.lead_status}</Badge></div>
                <div><span className="text-slate-500">Priority:</span> <Badge className={getPriorityColor(selectedAgency.priority || 'moderate')}>{getPriorityLabel(selectedAgency.priority || 'moderate')}</Badge></div>
                <div><span className="text-slate-500">Last Contact:</span> {selectedAgency.last_contact_date ? formatDate(selectedAgency.last_contact_date) : 'Never'}</div>
                <div><span className="text-slate-500">Follow-up:</span> {selectedAgency.follow_up_date ? formatDate(selectedAgency.follow_up_date) : 'Not set'}</div>
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
            <DialogTitle>Send Email to {selectedAgency?.name}</DialogTitle>
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
            <DialogTitle className="text-red-600">Delete Agency</DialogTitle>
          </DialogHeader>
          <p className="py-4">Are you sure you want to delete <strong>{selectedAgency?.name}</strong>? This will also delete all notes and tasks.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
            <Button onClick={handleDeleteAgency} disabled={formLoading} className="bg-red-600 hover:bg-red-700">
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
              Delete {selectedIds.length} Agency(ies)
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-slate-600 mb-3">Are you sure you want to delete <strong>{selectedIds.length}</strong> selected agency(ies)?</p>
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
              Delete {selectedIds.length} Agency(ies)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Agencies;
