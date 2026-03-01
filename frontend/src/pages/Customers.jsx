import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { 
  Users, 
  Search, 
  Filter,
  CheckCircle, 
  XCircle, 
  Clock, 
  Loader2,
  Eye,
  Edit2,
  Trash2,
  Stethoscope,
  Store,
  Building2,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Ban,
  Key,
  FileText,
  Gift,
  Heart,
  Send
} from 'lucide-react';
import api from '../lib/api';

const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalAction, setApprovalAction] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [sendingPassword, setSendingPassword] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editFormData, setEditFormData] = useState({});
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchCustomers();
  }, [statusFilter, roleFilter, search]);

  const fetchCustomers = async () => {
    try {
      const params = {};
      if (statusFilter && statusFilter !== 'all') params.status = statusFilter;
      if (roleFilter && roleFilter !== 'all') params.role = roleFilter;
      if (search) params.search = search;
      
      const response = await api.get('/customers', { params });
      setCustomers(response.data || []);
    } catch (error) {
      toast.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedCustomer) return;
    
    setProcessing(true);
    try {
      await api.put(`/customers/${selectedCustomer.id}/approve`, {
        status: 'approved'
      });
      toast.success(`${selectedCustomer.name} has been approved!`);
      setShowApprovalModal(false);
      setShowDetailModal(false);
      fetchCustomers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to approve customer');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedCustomer) return;
    
    setProcessing(true);
    try {
      await api.put(`/customers/${selectedCustomer.id}/approve`, {
        status: 'rejected',
        rejection_reason: rejectionReason
      });
      toast.success(`${selectedCustomer.name} has been rejected`);
      setShowApprovalModal(false);
      setShowDetailModal(false);
      setRejectionReason('');
      fetchCustomers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to reject customer');
    } finally {
      setProcessing(false);
    }
  };

  const handleSuspend = async () => {
    if (!selectedCustomer) return;
    
    setProcessing(true);
    try {
      await api.put(`/customers/${selectedCustomer.id}/approve`, {
        status: 'suspended'
      });
      toast.success(`${selectedCustomer.name} has been suspended`);
      setShowApprovalModal(false);
      setShowDetailModal(false);
      fetchCustomers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to suspend customer');
    } finally {
      setProcessing(false);
    }
  };

  const handleReactivate = async () => {
    if (!selectedCustomer) return;
    
    setProcessing(true);
    try {
      await api.put(`/customers/${selectedCustomer.id}/approve`, {
        status: 'approved'
      });
      toast.success(`${selectedCustomer.name} has been reactivated!`);
      setShowApprovalModal(false);
      setShowDetailModal(false);
      fetchCustomers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to reactivate customer');
    } finally {
      setProcessing(false);
    }
  };

  const handleSendNewPassword = async () => {
    if (!selectedCustomer) return;
    
    setSendingPassword(true);
    try {
      const response = await api.post(`/customers/${selectedCustomer.id}/send-new-password`);
      if (response.data.password_sent) {
        toast.success(`New password sent to ${selectedCustomer.name} via WhatsApp!`);
      } else if (response.data.password) {
        toast.info(
          <div>
            <p>{response.data.message}</p>
            <p className="mt-2 font-mono bg-slate-100 p-2 rounded text-sm">
              Password: <strong>{response.data.password}</strong>
            </p>
          </div>,
          { duration: 15000 }
        );
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send new password');
    } finally {
      setSendingPassword(false);
    }
  };

  const openEditModal = (customer) => {
    setSelectedCustomer(customer);
    setEditFormData({
      name: customer.name || '',
      email: customer.email || '',
      phone: customer.phone || '',
      role: customer.role || 'doctor',
      proprietor_name: customer.proprietor_name || '',
      gst_number: customer.gst_number || '',
      drug_license: customer.drug_license || '',
      address_line_1: customer.address_line_1 || '',
      address_line_2: customer.address_line_2 || '',
      state: customer.state || '',
      district: customer.district || '',
      pincode: customer.pincode || '',
      delivery_station: customer.delivery_station || '',
    });
    setShowEditModal(true);
  };

  const handleEditCustomer = async () => {
    if (!editFormData.name || !editFormData.phone) { toast.error('Name and phone are required'); return; }
    setProcessing(true);
    try {
      await api.put(`/customers/${selectedCustomer.id}`, editFormData);
      toast.success('Customer updated successfully');
      setShowEditModal(false);
      fetchCustomers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update customer');
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteCustomer = async () => {
    setDeleting(true);
    try {
      await api.delete(`/customers/${selectedCustomer.id}`);
      toast.success(`${selectedCustomer.name} deleted successfully`);
      setShowDeleteModal(false);
      setShowDetailModal(false);
      setSelectedCustomer(null);
      fetchCustomers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete customer');
    } finally {
      setDeleting(false);
    }
  };

  const openApprovalModal = (customer, action) => {
    setSelectedCustomer(customer);
    setApprovalAction(action);
    setRejectionReason('');
    setShowApprovalModal(true);
  };

  const openDetailModal = (customer) => {
    setSelectedCustomer(customer);
    setShowDetailModal(true);
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: { bg: 'bg-yellow-100 text-yellow-800 border-yellow-300', icon: Clock },
      pending_approval: { bg: 'bg-yellow-100 text-yellow-800 border-yellow-300', icon: Clock },
      approved: { bg: 'bg-green-100 text-green-800 border-green-300', icon: CheckCircle },
      rejected: { bg: 'bg-red-100 text-red-800 border-red-300', icon: XCircle },
      suspended: { bg: 'bg-orange-100 text-orange-800 border-orange-300', icon: Ban }
    };
    const style = styles[status] || styles.pending;
    const Icon = style.icon;
    return (
      <Badge className={`${style.bg} border`}>
        <Icon className="w-3 h-3 mr-1" />
        {status.toUpperCase()}
      </Badge>
    );
  };

  const getRoleBadge = (role) => {
    const styles = {
      doctor: { bg: 'bg-blue-100 text-blue-800', icon: Stethoscope, label: 'Doctor' },
      medical: { bg: 'bg-purple-100 text-purple-800', icon: Store, label: 'Medical' },
      agency: { bg: 'bg-orange-100 text-orange-800', icon: Building2, label: 'Agency' }
    };
    const style = styles[role] || styles.doctor;
    const Icon = style.icon;
    return (
      <Badge className={style.bg}>
        <Icon className="w-3 h-3 mr-1" />
        {style.label}
      </Badge>
    );
  };

  const stats = {
    total: customers.length,
    pending: customers.filter(c => c.status === 'pending').length,
    approved: customers.filter(c => c.status === 'approved').length,
    rejected: customers.filter(c => c.status === 'rejected').length
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Customer Registrations</h1>
        <p className="text-slate-500">Manage portal customer registrations</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <p className="text-xl font-bold">{stats.total}</p>
                <p className="text-xs text-slate-500">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-yellow-200 bg-yellow-50/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-yellow-700">{stats.pending}</p>
                <p className="text-xs text-yellow-600">Pending Approval</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xl font-bold">{stats.approved}</p>
                <p className="text-xs text-slate-500">Approved</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <XCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-xl font-bold">{stats.rejected}</p>
                <p className="text-xs text-slate-500">Rejected</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, phone, code..."
                className="pl-10"
                data-testid="customer-search-input"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40" data-testid="status-filter-select">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full sm:w-40" data-testid="role-filter-select">
                <SelectValue placeholder="All Roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="doctor">Doctor</SelectItem>
                <SelectItem value="medical">Medical</SelectItem>
                <SelectItem value="agency">Agency</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Customers Table */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : customers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="w-16 h-16 mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500">No customers found</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left p-4 font-medium text-slate-600">Customer</th>
                    <th className="text-left p-4 font-medium text-slate-600">Contact</th>
                    <th className="text-left p-4 font-medium text-slate-600">Role</th>
                    <th className="text-left p-4 font-medium text-slate-600">Status</th>
                    <th className="text-left p-4 font-medium text-slate-600">Registered</th>
                    <th className="text-center p-4 font-medium text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((customer) => (
                    <tr key={customer.id} className="border-b hover:bg-slate-50" data-testid={`customer-row-${customer.id}`}>
                      <td className="p-4">
                        <div>
                          <p className="font-medium text-slate-800">{customer.name}</p>
                          <p className="text-sm text-blue-600">{customer.customer_code}</p>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="text-sm">
                          <p className="flex items-center gap-1 text-slate-600">
                            <Phone className="w-3 h-3" />
                            {customer.phone}
                          </p>
                          {customer.email && (
                            <p className="flex items-center gap-1 text-slate-500">
                              <Mail className="w-3 h-3" />
                              {customer.email}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="p-4">{getRoleBadge(customer.role)}</td>
                      <td className="p-4">{getStatusBadge(customer.status)}</td>
                      <td className="p-4 text-sm text-slate-500">
                        {new Date(customer.created_at).toLocaleDateString()}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => openDetailModal(customer)}
                            data-testid={`view-customer-${customer.id}`}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => openEditModal(customer)}
                            title="Edit Customer"
                            data-testid={`edit-customer-${customer.id}`}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          {(customer.status === 'pending' || customer.status === 'pending_approval') && (
                            <>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                onClick={() => openApprovalModal(customer, 'approve')}
                                data-testid={`approve-customer-${customer.id}`}
                              >
                                <CheckCircle className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => openApprovalModal(customer, 'reject')}
                                data-testid={`reject-customer-${customer.id}`}
                              >
                                <XCircle className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                          {customer.status === 'approved' && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                              onClick={() => openApprovalModal(customer, 'suspend')}
                              data-testid={`suspend-customer-${customer.id}`}
                              title="Suspend Customer"
                            >
                              <Ban className="w-4 h-4" />
                            </Button>
                          )}
                          {customer.status === 'suspended' && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="text-green-600 hover:text-green-700 hover:bg-green-50"
                              onClick={() => openApprovalModal(customer, 'reactivate')}
                              data-testid={`reactivate-customer-${customer.id}`}
                              title="Reactivate Customer"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                          )}
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => { setSelectedCustomer(customer); setShowDeleteModal(true); }}
                            title="Delete Customer"
                            data-testid={`delete-customer-${customer.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Customer Registration Details</DialogTitle>
          </DialogHeader>
          {selectedCustomer && (
            <div className="space-y-4">
              {/* Header with badges and code */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-3">
                  {getRoleBadge(selectedCustomer.role)}
                  {getStatusBadge(selectedCustomer.status)}
                </div>
                <span className="text-blue-600 font-bold text-lg">{selectedCustomer.customer_code}</span>
              </div>

              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-white border rounded-lg">
                <div className="md:col-span-2">
                  <p className="text-xs text-slate-400 uppercase tracking-wide">Name</p>
                  <p className="font-semibold text-lg text-slate-800">{selectedCustomer.name}</p>
                </div>
                
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide flex items-center gap-1">
                    <Phone className="w-3 h-3" /> Primary Phone
                  </p>
                  <p className="font-medium">{selectedCustomer.phone}</p>
                </div>
                
                {selectedCustomer.alternate_phone && (
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide flex items-center gap-1">
                      <Phone className="w-3 h-3" /> Alternate Phone
                    </p>
                    <p className="font-medium">{selectedCustomer.alternate_phone}</p>
                  </div>
                )}
                
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide flex items-center gap-1">
                    <Mail className="w-3 h-3" /> Email
                  </p>
                  <p className="font-medium">{selectedCustomer.email || '-'}</p>
                </div>
              </div>

              {/* Doctor-specific fields */}
              {selectedCustomer.role === 'doctor' && (
                <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg">
                  <h4 className="text-sm font-semibold text-blue-800 mb-3 flex items-center gap-2">
                    <Stethoscope className="w-4 h-4" /> Doctor Details
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-blue-600 uppercase tracking-wide flex items-center gap-1">
                        <FileText className="w-3 h-3" /> Registration Number
                      </p>
                      <p className="font-medium text-slate-800">{selectedCustomer.reg_no || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-blue-600 uppercase tracking-wide flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> Date of Birth
                      </p>
                      <p className="font-medium text-slate-800">
                        {selectedCustomer.dob ? new Date(selectedCustomer.dob).toLocaleDateString() : '-'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Medical/Agency-specific fields */}
              {(selectedCustomer.role === 'medical' || selectedCustomer.role === 'agency') && (
                <div className={`p-4 border rounded-lg ${selectedCustomer.role === 'medical' ? 'bg-emerald-50 border-emerald-100' : 'bg-purple-50 border-purple-100'}`}>
                  <h4 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${selectedCustomer.role === 'medical' ? 'text-emerald-800' : 'text-purple-800'}`}>
                    {selectedCustomer.role === 'medical' ? <Store className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
                    {selectedCustomer.role === 'medical' ? 'Medical Store' : 'Agency'} Details
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    {selectedCustomer.proprietor_name && (
                      <div className="col-span-2">
                        <p className={`text-xs uppercase tracking-wide ${selectedCustomer.role === 'medical' ? 'text-emerald-600' : 'text-purple-600'}`}>Proprietor Name</p>
                        <p className="font-medium text-slate-800">{selectedCustomer.proprietor_name}</p>
                      </div>
                    )}
                    <div>
                      <p className={`text-xs uppercase tracking-wide ${selectedCustomer.role === 'medical' ? 'text-emerald-600' : 'text-purple-600'}`}>GST Number</p>
                      <p className="font-medium text-slate-800">{selectedCustomer.gst_number || '-'}</p>
                    </div>
                    <div>
                      <p className={`text-xs uppercase tracking-wide ${selectedCustomer.role === 'medical' ? 'text-emerald-600' : 'text-purple-600'}`}>Drug License</p>
                      <p className="font-medium text-slate-800">{selectedCustomer.drug_license || '-'}</p>
                    </div>
                    <div>
                      <p className={`text-xs uppercase tracking-wide flex items-center gap-1 ${selectedCustomer.role === 'medical' ? 'text-emerald-600' : 'text-purple-600'}`}>
                        <Gift className="w-3 h-3" /> Birthday
                      </p>
                      <p className="font-medium text-slate-800">
                        {selectedCustomer.birthday ? new Date(selectedCustomer.birthday).toLocaleDateString() : '-'}
                      </p>
                    </div>
                    <div>
                      <p className={`text-xs uppercase tracking-wide flex items-center gap-1 ${selectedCustomer.role === 'medical' ? 'text-emerald-600' : 'text-purple-600'}`}>
                        <Heart className="w-3 h-3" /> Anniversary
                      </p>
                      <p className="font-medium text-slate-800">
                        {selectedCustomer.anniversary ? new Date(selectedCustomer.anniversary).toLocaleDateString() : '-'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Address Section */}
              <div className="p-4 bg-slate-50 border rounded-lg">
                <h4 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
                  <MapPin className="w-4 h-4" /> Address Details
                </h4>
                {(selectedCustomer.address_line_1 || selectedCustomer.state) ? (
                  <div className="space-y-2">
                    <p className="text-sm text-slate-700">
                      {[
                        selectedCustomer.address_line_1,
                        selectedCustomer.address_line_2
                      ].filter(Boolean).join(', ')}
                    </p>
                    <p className="text-sm text-slate-700">
                      {[
                        selectedCustomer.district,
                        selectedCustomer.state,
                        selectedCustomer.pincode
                      ].filter(Boolean).join(', ')}
                    </p>
                    <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-slate-200">
                      <div>
                        <p className="text-xs text-slate-400 uppercase tracking-wide">Delivery Station</p>
                        <p className="font-medium text-slate-700">{selectedCustomer.delivery_station || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 uppercase tracking-wide">Transport</p>
                        <p className="font-medium text-slate-700">{selectedCustomer.transport_name || '-'}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 italic">No address provided</p>
                )}
              </div>

              {/* Registration Info */}
              <div className="p-4 bg-slate-100 rounded-lg">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide">Registered On</p>
                    <p className="font-medium text-slate-700">
                      {new Date(selectedCustomer.created_at).toLocaleString()}
                    </p>
                  </div>
                  {selectedCustomer.approved_at && (
                    <div>
                      <p className="text-xs text-green-600 uppercase tracking-wide">Approved On</p>
                      <p className="font-medium text-green-700">
                        {new Date(selectedCustomer.approved_at).toLocaleString()}
                      </p>
                      <p className="text-xs text-green-600">by {selectedCustomer.approved_by}</p>
                    </div>
                  )}
                  {selectedCustomer.rejection_reason && (
                    <div className="col-span-2">
                      <p className="text-xs text-red-600 uppercase tracking-wide">Rejection Reason</p>
                      <p className="font-medium text-red-700">{selectedCustomer.rejection_reason}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              {(selectedCustomer.status === 'pending' || selectedCustomer.status === 'pending_approval') && (
                <div className="flex gap-3 pt-4 border-t">
                  <Button 
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    onClick={() => openApprovalModal(selectedCustomer, 'approve')}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Approve
                  </Button>
                  <Button 
                    variant="destructive"
                    className="flex-1"
                    onClick={() => openApprovalModal(selectedCustomer, 'reject')}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Reject
                  </Button>
                </div>
              )}
              {selectedCustomer.status === 'approved' && (
                <div className="flex flex-col gap-3 pt-4 border-t">
                  <Button 
                    variant="outline"
                    className="w-full border-blue-300 text-blue-600 hover:bg-blue-50"
                    onClick={handleSendNewPassword}
                    disabled={sendingPassword}
                    data-testid="send-new-password-btn"
                  >
                    {sendingPassword ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Key className="w-4 h-4 mr-2" />
                    )}
                    Send New Password via WhatsApp
                  </Button>
                  <Button 
                    variant="outline"
                    className="w-full border-orange-300 text-orange-600 hover:bg-orange-50"
                    onClick={() => openApprovalModal(selectedCustomer, 'suspend')}
                  >
                    <Ban className="w-4 h-4 mr-2" />
                    Suspend Customer
                  </Button>
                </div>
              )}
              {selectedCustomer.status === 'suspended' && (
                <div className="flex gap-3 pt-4 border-t">
                  <Button 
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    onClick={() => openApprovalModal(selectedCustomer, 'reactivate')}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Reactivate Customer
                  </Button>
                </div>
              )}

              {/* Edit & Delete */}
              <div className="flex gap-3 pt-4 border-t">
                <Button variant="outline" className="flex-1" onClick={() => { setShowDetailModal(false); openEditModal(selectedCustomer); }}>
                  <Edit2 className="w-4 h-4 mr-2" />Edit Customer
                </Button>
                <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => { setShowDetailModal(false); setShowDeleteModal(true); }}>
                  <Trash2 className="w-4 h-4 mr-2" />Delete
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Approval Modal */}
      <Dialog open={showApprovalModal} onOpenChange={setShowApprovalModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {approvalAction === 'approve' && 'Approve Customer'}
              {approvalAction === 'reject' && 'Reject Customer'}
              {approvalAction === 'suspend' && 'Suspend Customer'}
              {approvalAction === 'reactivate' && 'Reactivate Customer'}
            </DialogTitle>
          </DialogHeader>
          {selectedCustomer && (
            <div className="py-4">
              <p className="text-slate-600 mb-4">
                {approvalAction === 'approve' && `Are you sure you want to approve ${selectedCustomer.name}? They will be able to login and place orders.`}
                {approvalAction === 'reject' && `Are you sure you want to reject ${selectedCustomer.name}'s registration?`}
                {approvalAction === 'suspend' && `Are you sure you want to suspend ${selectedCustomer.name}? They will not be able to login until reactivated.`}
                {approvalAction === 'reactivate' && `Are you sure you want to reactivate ${selectedCustomer.name}? They will be able to login and place orders again.`}
              </p>
              
              {approvalAction === 'reject' && (
                <div className="space-y-2">
                  <Label>Rejection Reason (optional)</Label>
                  <Textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Provide reason for rejection..."
                    rows={3}
                    data-testid="rejection-reason-input"
                  />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApprovalModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (approvalAction === 'approve') handleApprove();
                else if (approvalAction === 'reject') handleReject();
                else if (approvalAction === 'suspend') handleSuspend();
                else if (approvalAction === 'reactivate') handleReactivate();
              }}
              disabled={processing}
              className={
                approvalAction === 'approve' || approvalAction === 'reactivate' 
                  ? 'bg-green-600 hover:bg-green-700' 
                  : approvalAction === 'suspend'
                  ? 'bg-orange-600 hover:bg-orange-700'
                  : ''
              }
              variant={approvalAction === 'reject' ? 'destructive' : 'default'}
              data-testid="confirm-approval-btn"
            >
              {processing && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {approvalAction === 'approve' && 'Approve'}
              {approvalAction === 'reject' && 'Reject'}
              {approvalAction === 'suspend' && 'Suspend'}
              {approvalAction === 'reactivate' && 'Reactivate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Customers;
