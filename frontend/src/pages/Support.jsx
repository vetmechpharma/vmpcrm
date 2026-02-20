import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { toast } from 'sonner';
import { 
  LifeBuoy, 
  Search, 
  Filter,
  MessageSquare, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Loader2,
  Send,
  User,
  ShieldCheck,
  Phone,
  Plus,
  Edit2,
  Trash2,
  Eye,
  XCircle
} from 'lucide-react';
import api from '../lib/api';

const Support = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [processing, setProcessing] = useState(false);
  
  // Form state for create/edit
  const [formData, setFormData] = useState({
    subject: '',
    description: '',
    category: 'general',
    priority: 'medium',
    customer_name: '',
    customer_phone: '',
    customer_email: ''
  });

  useEffect(() => {
    fetchTickets();
  }, [statusFilter, priorityFilter]);

  const fetchTickets = async () => {
    try {
      const params = {};
      if (statusFilter && statusFilter !== 'all') params.status = statusFilter;
      if (priorityFilter && priorityFilter !== 'all') params.priority = priorityFilter;
      
      const response = await api.get('/support/tickets', { params });
      setTickets(response.data || []);
    } catch (error) {
      toast.error('Failed to load tickets');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (ticketId, newStatus) => {
    setUpdatingStatus(true);
    try {
      await api.put(`/support/tickets/${ticketId}/status?status=${newStatus}`);
      toast.success('Status updated');
      fetchTickets();
      
      // Update selected ticket if open
      if (selectedTicket && selectedTicket.id === ticketId) {
        setSelectedTicket(prev => ({ ...prev, status: newStatus }));
      }
    } catch (error) {
      toast.error('Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedTicket) {
      toast.error('Please enter a message');
      return;
    }

    setSendingReply(true);
    try {
      await api.post(`/support/tickets/${selectedTicket.id}/reply`, { message: replyText });
      toast.success('Reply sent!');
      setReplyText('');
      
      // Refresh ticket
      const response = await api.get('/support/tickets');
      const updated = response.data.find(t => t.id === selectedTicket.id);
      if (updated) setSelectedTicket(updated);
      setTickets(response.data || []);
    } catch (error) {
      toast.error('Failed to send reply');
    } finally {
      setSendingReply(false);
    }
  };

  const handleCreateTicket = async () => {
    if (!formData.subject || !formData.description || !formData.customer_name || !formData.customer_phone) {
      toast.error('Please fill all required fields');
      return;
    }

    setProcessing(true);
    try {
      await api.post('/support/tickets/admin', formData);
      toast.success('Ticket created successfully');
      setShowCreateModal(false);
      resetForm();
      fetchTickets();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create ticket');
    } finally {
      setProcessing(false);
    }
  };

  const handleEditTicket = async () => {
    if (!formData.subject || !formData.description) {
      toast.error('Please fill all required fields');
      return;
    }

    setProcessing(true);
    try {
      await api.put(`/support/tickets/${selectedTicket.id}`, {
        subject: formData.subject,
        description: formData.description,
        category: formData.category,
        priority: formData.priority
      });
      toast.success('Ticket updated successfully');
      setShowEditModal(false);
      fetchTickets();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update ticket');
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteTicket = async (ticketId) => {
    if (!window.confirm('Are you sure you want to delete this ticket? This action cannot be undone.')) {
      return;
    }

    try {
      await api.delete(`/support/tickets/${ticketId}`);
      toast.success('Ticket deleted');
      setShowDetailModal(false);
      fetchTickets();
    } catch (error) {
      toast.error('Failed to delete ticket');
    }
  };

  const openDetailModal = (ticket) => {
    setSelectedTicket(ticket);
    setShowDetailModal(true);
    setReplyText('');
  };

  const openEditModal = (ticket) => {
    setSelectedTicket(ticket);
    setFormData({
      subject: ticket.subject,
      description: ticket.description,
      category: ticket.category || 'general',
      priority: ticket.priority || 'medium',
      customer_name: ticket.customer_name || '',
      customer_phone: ticket.customer_phone || '',
      customer_email: ticket.customer_email || ''
    });
    setShowEditModal(true);
  };

  const openCreateModal = () => {
    resetForm();
    setShowCreateModal(true);
  };

  const resetForm = () => {
    setFormData({
      subject: '',
      description: '',
      category: 'general',
      priority: 'medium',
      customer_name: '',
      customer_phone: '',
      customer_email: ''
    });
  };

  const getStatusBadge = (status) => {
    const styles = {
      open: { bg: 'bg-yellow-100 text-yellow-800 border-yellow-300', icon: Clock },
      in_progress: { bg: 'bg-blue-100 text-blue-800 border-blue-300', icon: AlertCircle },
      resolved: { bg: 'bg-green-100 text-green-800 border-green-300', icon: CheckCircle },
      closed: { bg: 'bg-slate-100 text-slate-800 border-slate-300', icon: XCircle }
    };
    const style = styles[status] || styles.open;
    const Icon = style.icon;
    return (
      <Badge className={`${style.bg} border`}>
        <Icon className="w-3 h-3 mr-1" />
        {status.replace(/_/g, ' ').toUpperCase()}
      </Badge>
    );
  };

  const getPriorityBadge = (priority) => {
    const styles = {
      low: 'bg-slate-100 text-slate-700',
      medium: 'bg-amber-100 text-amber-700',
      high: 'bg-red-100 text-red-700'
    };
    return <Badge className={styles[priority]}>{priority.toUpperCase()}</Badge>;
  };

  const getCategoryLabel = (category) => {
    const labels = {
      general: 'General Inquiry',
      order: 'Order Issue',
      product: 'Product Issue',
      delivery: 'Delivery Issue',
      payment: 'Payment Issue',
      other: 'Other'
    };
    return labels[category] || category;
  };

  const filteredTickets = tickets.filter(ticket => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      ticket.subject?.toLowerCase().includes(searchLower) ||
      ticket.customer_name?.toLowerCase().includes(searchLower) ||
      ticket.customer_phone?.includes(search) ||
      ticket.ticket_number?.toLowerCase().includes(searchLower)
    );
  });

  const stats = {
    total: tickets.length,
    open: tickets.filter(t => t.status === 'open').length,
    inProgress: tickets.filter(t => t.status === 'in_progress').length,
    resolved: tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length
  };

  return (
    <div className="p-6" data-testid="support-page">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Support Tickets</h1>
          <p className="text-slate-500">Manage customer support requests</p>
        </div>
        <Button onClick={openCreateModal} className="bg-emerald-600 hover:bg-emerald-700" data-testid="create-ticket-btn">
          <Plus className="w-4 h-4 mr-2" />
          Create Ticket
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <p className="text-xl font-bold">{stats.total}</p>
                <p className="text-xs text-slate-500">Total Tickets</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={stats.open > 0 ? "border-yellow-200 bg-yellow-50/50" : ""}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-yellow-700">{stats.open}</p>
                <p className="text-xs text-yellow-600">Open</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xl font-bold">{stats.inProgress}</p>
                <p className="text-xs text-slate-500">In Progress</p>
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
                <p className="text-xl font-bold">{stats.resolved}</p>
                <p className="text-xs text-slate-500">Resolved</p>
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
                placeholder="Search by subject, customer, ticket#..."
                className="pl-10"
                data-testid="ticket-search-input"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40" data-testid="status-filter-select">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-full sm:w-40" data-testid="priority-filter-select">
                <SelectValue placeholder="All Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tickets Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="text-center p-8 text-slate-500">
              No tickets found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left p-4 font-medium text-slate-600">Ticket</th>
                    <th className="text-left p-4 font-medium text-slate-600">Customer</th>
                    <th className="text-left p-4 font-medium text-slate-600">Priority</th>
                    <th className="text-left p-4 font-medium text-slate-600">Status</th>
                    <th className="text-left p-4 font-medium text-slate-600">Created</th>
                    <th className="text-center p-4 font-medium text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTickets.map((ticket) => (
                    <tr key={ticket.id} className="border-b hover:bg-slate-50">
                      <td className="p-4">
                        <div>
                          <p className="font-medium text-slate-800">{ticket.subject}</p>
                          <p className="text-xs text-slate-500">#{ticket.ticket_number} - {getCategoryLabel(ticket.category)}</p>
                        </div>
                      </td>
                      <td className="p-4">
                        <div>
                          <p className="font-medium text-slate-700">{ticket.customer_name}</p>
                          <p className="text-xs text-slate-500">{ticket.customer_phone}</p>
                        </div>
                      </td>
                      <td className="p-4">
                        {getPriorityBadge(ticket.priority)}
                      </td>
                      <td className="p-4">
                        <Select
                          value={ticket.status}
                          onValueChange={(value) => handleStatusChange(ticket.id, value)}
                          disabled={updatingStatus}
                        >
                          <SelectTrigger className="w-32 h-8" data-testid={`status-select-${ticket.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="open">Open</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="resolved">Resolved</SelectItem>
                            <SelectItem value="closed">Closed</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-4 text-sm text-slate-500">
                        {new Date(ticket.created_at).toLocaleDateString()}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDetailModal(ticket)}
                            data-testid={`view-ticket-${ticket.id}`}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditModal(ticket)}
                            data-testid={`edit-ticket-${ticket.id}`}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDeleteTicket(ticket.id)}
                            data-testid={`delete-ticket-${ticket.id}`}
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
          )}
        </CardContent>
      </Card>

      {/* Create Ticket Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Support Ticket</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Customer Name *</Label>
                <Input
                  value={formData.customer_name}
                  onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                  placeholder="Customer name"
                  data-testid="create-customer-name"
                />
              </div>
              <div className="space-y-2">
                <Label>Phone *</Label>
                <Input
                  value={formData.customer_phone}
                  onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                  placeholder="Phone number"
                  data-testid="create-customer-phone"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                value={formData.customer_email}
                onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
                placeholder="Email (optional)"
                type="email"
              />
            </div>
            <div className="space-y-2">
              <Label>Subject *</Label>
              <Input
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                placeholder="Ticket subject"
                data-testid="create-subject"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General Inquiry</SelectItem>
                    <SelectItem value="order">Order Issue</SelectItem>
                    <SelectItem value="product">Product Issue</SelectItem>
                    <SelectItem value="delivery">Delivery Issue</SelectItem>
                    <SelectItem value="payment">Payment Issue</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value) => setFormData({ ...formData, priority: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description *</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe the issue..."
                rows={4}
                data-testid="create-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateTicket} disabled={processing} data-testid="submit-create-ticket">
              {processing && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Create Ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Ticket Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Ticket</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Subject *</Label>
              <Input
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                placeholder="Ticket subject"
                data-testid="edit-subject"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General Inquiry</SelectItem>
                    <SelectItem value="order">Order Issue</SelectItem>
                    <SelectItem value="product">Product Issue</SelectItem>
                    <SelectItem value="delivery">Delivery Issue</SelectItem>
                    <SelectItem value="payment">Payment Issue</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value) => setFormData({ ...formData, priority: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description *</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe the issue..."
                rows={4}
                data-testid="edit-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditTicket} disabled={processing} data-testid="submit-edit-ticket">
              {processing && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LifeBuoy className="w-5 h-5 text-emerald-600" />
              Ticket Details
            </DialogTitle>
          </DialogHeader>
          
          {selectedTicket && (
            <div className="space-y-6 py-4">
              {/* Ticket Info */}
              <div className="flex flex-wrap gap-4 items-center">
                <Badge variant="outline" className="text-sm">
                  #{selectedTicket.ticket_number}
                </Badge>
                {getStatusBadge(selectedTicket.status)}
                {getPriorityBadge(selectedTicket.priority)}
                <Badge variant="secondary">{getCategoryLabel(selectedTicket.category)}</Badge>
              </div>

              {/* Subject & Description */}
              <div>
                <h3 className="font-semibold text-lg text-slate-800">{selectedTicket.subject}</h3>
                <p className="text-slate-600 mt-2 whitespace-pre-wrap">{selectedTicket.description}</p>
              </div>

              {/* Customer Info */}
              <div className="bg-slate-50 rounded-lg p-4">
                <h4 className="font-medium text-sm text-slate-500 mb-2">Customer Information</h4>
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-400" />
                    <span>{selectedTicket.customer_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-slate-400" />
                    <span>{selectedTicket.customer_phone}</span>
                  </div>
                  {selectedTicket.customer_email && (
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-slate-400" />
                      <span>{selectedTicket.customer_email}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Status Change */}
              <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-lg">
                <span className="font-medium text-sm">Change Status:</span>
                <Select
                  value={selectedTicket.status}
                  onValueChange={(value) => handleStatusChange(selectedTicket.id, value)}
                  disabled={updatingStatus}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
                {updatingStatus && <Loader2 className="w-4 h-4 animate-spin" />}
              </div>

              {/* Conversation */}
              {selectedTicket.replies && selectedTicket.replies.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm text-slate-500 mb-3">Conversation</h4>
                  <div className="space-y-3">
                    {selectedTicket.replies.map((reply, index) => (
                      <div 
                        key={index}
                        className={`p-3 rounded-lg ${
                          reply.is_admin 
                            ? 'bg-emerald-50 border border-emerald-200 ml-8' 
                            : 'bg-slate-50 border border-slate-200 mr-8'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          {reply.is_admin ? (
                            <ShieldCheck className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <User className="w-4 h-4 text-slate-400" />
                          )}
                          <span className="font-medium text-sm">
                            {reply.is_admin ? reply.admin_name || 'Admin' : selectedTicket.customer_name}
                          </span>
                          <span className="text-xs text-slate-400">
                            {new Date(reply.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-slate-700 whitespace-pre-wrap">{reply.message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Reply Form */}
              <div className="border-t pt-4">
                <h4 className="font-medium text-sm text-slate-500 mb-2">Send Reply</h4>
                <div className="flex gap-2">
                  <Textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Type your reply..."
                    rows={3}
                    className="flex-1"
                    data-testid="reply-textarea"
                  />
                </div>
                <div className="flex justify-between items-center mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-500 hover:bg-red-50"
                    onClick={() => handleDeleteTicket(selectedTicket.id)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Ticket
                  </Button>
                  <Button
                    onClick={handleSendReply}
                    disabled={sendingReply || !replyText.trim()}
                    data-testid="send-reply-btn"
                  >
                    {sendingReply ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Send className="w-4 h-4 mr-2" />
                    )}
                    Send Reply
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Support;
