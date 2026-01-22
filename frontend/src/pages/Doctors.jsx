import { useState, useEffect } from 'react';
import { doctorsAPI, emailAPI } from '../lib/api';
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
  Calendar
} from 'lucide-react';
import { LEAD_STATUSES, getStatusColor, formatDate } from '../lib/utils';

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
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [formLoading, setFormLoading] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    reg_no: '',
    address: '',
    email: '',
    phone: '',
    lead_status: 'Pipeline',
    dob: '',
  });

  const [emailData, setEmailData] = useState({
    subject: '',
    body: '',
  });

  useEffect(() => {
    fetchDoctors();
  }, [search, statusFilter]);

  const fetchDoctors = async () => {
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

  const resetForm = () => {
    setFormData({
      name: '',
      reg_no: '',
      address: '',
      email: '',
      phone: '',
      lead_status: 'Pipeline',
      dob: '',
    });
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      await doctorsAPI.create(formData);
      toast.success('Doctor added successfully');
      setShowAddModal(false);
      resetForm();
      fetchDoctors();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add doctor');
    } finally {
      setFormLoading(false);
    }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      await doctorsAPI.update(selectedDoctor.id, formData);
      toast.success('Doctor updated successfully');
      setShowEditModal(false);
      fetchDoctors();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update doctor');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    setFormLoading(true);
    try {
      await doctorsAPI.delete(selectedDoctor.id);
      toast.success('Doctor deleted successfully');
      setShowDeleteModal(false);
      fetchDoctors();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete doctor');
    } finally {
      setFormLoading(false);
    }
  };

  const handleSendEmail = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      await emailAPI.send({
        doctor_id: selectedDoctor.id,
        subject: emailData.subject,
        body: emailData.body,
      });
      toast.success('Email queued for sending');
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
    });
    setShowEditModal(true);
  };

  const openEmailModal = (doctor) => {
    setSelectedDoctor(doctor);
    setEmailData({ subject: '', body: '' });
    setShowEmailModal(true);
  };

  const openDeleteModal = (doctor) => {
    setSelectedDoctor(doctor);
    setShowDeleteModal(true);
  };

  const DoctorForm = ({ onSubmit, isEdit = false }) => (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Doctor Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Dr. John Smith"
            required
            data-testid="doctor-name-input"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="reg_no">Registration No. *</Label>
          <Input
            id="reg_no"
            value={formData.reg_no}
            onChange={(e) => setFormData({ ...formData, reg_no: e.target.value })}
            placeholder="REG-12345"
            required
            data-testid="doctor-regno-input"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email *</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="doctor@example.com"
            required
            data-testid="doctor-email-input"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone *</Label>
          <Input
            id="phone"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="+91 9876543210"
            required
            data-testid="doctor-phone-input"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dob">Date of Birth</Label>
          <Input
            id="dob"
            type="date"
            value={formData.dob}
            onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
            data-testid="doctor-dob-input"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lead_status">Lead Status *</Label>
          <Select
            value={formData.lead_status}
            onValueChange={(value) => setFormData({ ...formData, lead_status: value })}
          >
            <SelectTrigger data-testid="doctor-status-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LEAD_STATUSES.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="address">Address *</Label>
          <Textarea
            id="address"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            placeholder="Full address"
            required
            data-testid="doctor-address-input"
          />
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => isEdit ? setShowEditModal(false) : setShowAddModal(false)}>
          Cancel
        </Button>
        <Button type="submit" disabled={formLoading} data-testid="doctor-submit-btn">
          {formLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
          {isEdit ? 'Update Doctor' : 'Add Doctor'}
        </Button>
      </DialogFooter>
    </form>
  );

  return (
    <div className="space-y-6 animate-fade-in" data-testid="doctors-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Doctors</h1>
          <p className="text-slate-500 mt-1">Manage your doctor leads</p>
        </div>
        <Button onClick={() => { resetForm(); setShowAddModal(true); }} data-testid="add-doctor-btn">
          <Plus className="w-4 h-4 mr-2" />
          Add Doctor
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search by name, code, email, phone..."
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
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Doctors Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
          ) : doctors.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Doctor</th>
                    <th>Contact</th>
                    <th>Status</th>
                    <th>Added</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {doctors.map((doctor) => (
                    <tr key={doctor.id} data-testid={`doctor-row-${doctor.id}`}>
                      <td>
                        <span className="font-mono text-sm font-medium text-slate-900">
                          {doctor.customer_code}
                        </span>
                      </td>
                      <td>
                        <div>
                          <p className="font-medium text-slate-900">{doctor.name}</p>
                          <p className="text-sm text-slate-500">Reg: {doctor.reg_no}</p>
                        </div>
                      </td>
                      <td>
                        <div className="space-y-1">
                          <p className="text-sm text-slate-600 flex items-center gap-1">
                            <Mail className="w-3 h-3" /> {doctor.email}
                          </p>
                          <p className="text-sm text-slate-600 flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {doctor.phone}
                          </p>
                        </div>
                      </td>
                      <td>
                        <Badge className={getStatusColor(doctor.lead_status)}>
                          {doctor.lead_status}
                        </Badge>
                      </td>
                      <td>
                        <span className="text-sm text-slate-500">{formatDate(doctor.created_at)}</span>
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            className="table-action-btn"
                            onClick={() => openEmailModal(doctor)}
                            title="Send Email"
                            data-testid={`email-btn-${doctor.id}`}
                          >
                            <Mail className="w-4 h-4" />
                          </button>
                          <button
                            className="table-action-btn"
                            onClick={() => openEditModal(doctor)}
                            title="Edit"
                            data-testid={`edit-btn-${doctor.id}`}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            className="table-action-btn text-red-400 hover:text-red-600 hover:bg-red-50"
                            onClick={() => openDeleteModal(doctor)}
                            title="Delete"
                            data-testid={`delete-btn-${doctor.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <Users className="empty-state-icon" />
              <h3 className="empty-state-title">No doctors found</h3>
              <p className="empty-state-text">
                {search || statusFilter !== 'all' 
                  ? 'Try adjusting your search or filter'
                  : 'Get started by adding your first doctor'}
              </p>
              {!search && statusFilter === 'all' && (
                <Button className="mt-4" onClick={() => { resetForm(); setShowAddModal(true); }}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Doctor
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Doctor Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add New Doctor</DialogTitle>
          </DialogHeader>
          <DoctorForm onSubmit={handleAdd} />
        </DialogContent>
      </Dialog>

      {/* Edit Doctor Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Doctor</DialogTitle>
          </DialogHeader>
          <DoctorForm onSubmit={handleEdit} isEdit />
        </DialogContent>
      </Dialog>

      {/* Send Email Modal */}
      <Dialog open={showEmailModal} onOpenChange={setShowEmailModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Email to {selectedDoctor?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSendEmail} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subject">Subject *</Label>
              <Input
                id="subject"
                value={emailData.subject}
                onChange={(e) => setEmailData({ ...emailData, subject: e.target.value })}
                placeholder="Email subject"
                required
                data-testid="email-subject-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="body">Message *</Label>
              <Textarea
                id="body"
                value={emailData.body}
                onChange={(e) => setEmailData({ ...emailData, body: e.target.value })}
                placeholder="Write your message..."
                rows={6}
                required
                data-testid="email-body-input"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowEmailModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={formLoading} data-testid="send-email-btn">
                {formLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Send Email
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Doctor</DialogTitle>
          </DialogHeader>
          <p className="text-slate-600">
            Are you sure you want to delete <strong>{selectedDoctor?.name}</strong>? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDelete} 
              disabled={formLoading}
              data-testid="confirm-delete-btn"
            >
              {formLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
