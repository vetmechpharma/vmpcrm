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
  Stethoscope,
  Store,
  Building2,
  Phone,
  Mail,
  MapPin,
  Calendar
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
      approved: { bg: 'bg-green-100 text-green-800 border-green-300', icon: CheckCircle },
      rejected: { bg: 'bg-red-100 text-red-800 border-red-300', icon: XCircle }
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
                          {customer.status === 'pending' && (
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Customer Details</DialogTitle>
          </DialogHeader>
          {selectedCustomer && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getRoleBadge(selectedCustomer.role)}
                  {getStatusBadge(selectedCustomer.status)}
                </div>
                <span className="text-blue-600 font-medium">{selectedCustomer.customer_code}</span>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-sm text-slate-500">Name</p>
                  <p className="font-medium">{selectedCustomer.name}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-500">Phone</p>
                    <p className="font-medium">{selectedCustomer.phone}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Email</p>
                    <p className="font-medium">{selectedCustomer.email || '-'}</p>
                  </div>
                </div>

                {selectedCustomer.role === 'doctor' && selectedCustomer.reg_no && (
                  <div>
                    <p className="text-sm text-slate-500">Registration Number</p>
                    <p className="font-medium">{selectedCustomer.reg_no}</p>
                  </div>
                )}

                {(selectedCustomer.role === 'medical' || selectedCustomer.role === 'agency') && (
                  <>
                    {selectedCustomer.proprietor_name && (
                      <div>
                        <p className="text-sm text-slate-500">Proprietor</p>
                        <p className="font-medium">{selectedCustomer.proprietor_name}</p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      {selectedCustomer.gst_number && (
                        <div>
                          <p className="text-sm text-slate-500">GST Number</p>
                          <p className="font-medium">{selectedCustomer.gst_number}</p>
                        </div>
                      )}
                      {selectedCustomer.drug_license && (
                        <div>
                          <p className="text-sm text-slate-500">Drug License</p>
                          <p className="font-medium">{selectedCustomer.drug_license}</p>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {(selectedCustomer.address_line_1 || selectedCustomer.state) && (
                  <div className="pt-3 border-t">
                    <p className="text-sm text-slate-500 mb-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      Address
                    </p>
                    <p className="text-sm">
                      {[
                        selectedCustomer.address_line_1,
                        selectedCustomer.address_line_2,
                        selectedCustomer.district,
                        selectedCustomer.state,
                        selectedCustomer.pincode
                      ].filter(Boolean).join(', ')}
                    </p>
                    {selectedCustomer.delivery_station && (
                      <p className="text-sm text-slate-500 mt-1">
                        Delivery Station: {selectedCustomer.delivery_station}
                      </p>
                    )}
                    {selectedCustomer.transport_name && (
                      <p className="text-sm text-slate-500">
                        Preferred Transport: {selectedCustomer.transport_name}
                      </p>
                    )}
                  </div>
                )}

                <div className="pt-3 border-t">
                  <p className="text-sm text-slate-500 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Registered: {new Date(selectedCustomer.created_at).toLocaleString()}
                  </p>
                  {selectedCustomer.approved_at && (
                    <p className="text-sm text-green-600">
                      Approved: {new Date(selectedCustomer.approved_at).toLocaleString()} by {selectedCustomer.approved_by}
                    </p>
                  )}
                  {selectedCustomer.rejection_reason && (
                    <p className="text-sm text-red-600">
                      Rejected: {selectedCustomer.rejection_reason}
                    </p>
                  )}
                </div>
              </div>

              {selectedCustomer.status === 'pending' && (
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
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Approval Modal */}
      <Dialog open={showApprovalModal} onOpenChange={setShowApprovalModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {approvalAction === 'approve' ? 'Approve Customer' : 'Reject Customer'}
            </DialogTitle>
          </DialogHeader>
          {selectedCustomer && (
            <div className="py-4">
              <p className="text-slate-600 mb-4">
                {approvalAction === 'approve' 
                  ? `Are you sure you want to approve ${selectedCustomer.name}? They will be able to login and place orders.`
                  : `Are you sure you want to reject ${selectedCustomer.name}'s registration?`
                }
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
              onClick={approvalAction === 'approve' ? handleApprove : handleReject}
              disabled={processing}
              className={approvalAction === 'approve' ? 'bg-green-600 hover:bg-green-700' : ''}
              variant={approvalAction === 'reject' ? 'destructive' : 'default'}
              data-testid="confirm-approval-btn"
            >
              {processing && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {approvalAction === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Customers;
