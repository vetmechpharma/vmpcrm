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
  Phone
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
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

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
      
      // Refresh tickets
      const response = await api.get('/support/tickets');
      setTickets(response.data || []);
      
      // Update selected ticket if open
      if (selectedTicket && selectedTicket.id === ticketId) {
        const updated = response.data.find(t => t.id === ticketId);
        if (updated) setSelectedTicket(updated);
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

  const openDetailModal = (ticket) => {
    setSelectedTicket(ticket);
    setShowDetailModal(true);
    setReplyText('');
  };

  const getStatusBadge = (status) => {
    const styles = {
      open: { bg: 'bg-yellow-100 text-yellow-800 border-yellow-300', icon: Clock },
      in_progress: { bg: 'bg-blue-100 text-blue-800 border-blue-300', icon: AlertCircle },
      resolved: { bg: 'bg-green-100 text-green-800 border-green-300', icon: CheckCircle },
      closed: { bg: 'bg-slate-100 text-slate-800 border-slate-300', icon: CheckCircle }
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
      ticket.subject.toLowerCase().includes(searchLower) ||
      ticket.customer_name?.toLowerCase().includes(searchLower) ||
      ticket.customer_phone?.includes(search)
    );
  });

  const stats = {
    total: tickets.length,
    open: tickets.filter(t => t.status === 'open').length,
    inProgress: tickets.filter(t => t.status === 'in_progress').length,
    resolved: tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Support Tickets</h1>
        <p className="text-slate-500">Manage customer support requests</p>
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
                placeholder="Search by subject, customer..."
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
                <SelectValue placeholder="All Priorities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tickets List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : filteredTickets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <LifeBuoy className="w-16 h-16 mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500">No tickets found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredTickets.map((ticket) => (
            <Card 
              key={ticket.id} 
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => openDetailModal(ticket)}
              data-testid={`ticket-${ticket.id}`}
            >
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-medium text-slate-800">{ticket.subject}</h3>
                      {getPriorityBadge(ticket.priority)}
                    </div>
                    <p className="text-sm text-slate-500 line-clamp-1 mb-2">{ticket.description}</p>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {ticket.customer_name}
                      </span>
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {ticket.customer_phone}
                      </span>
                      <span>{getCategoryLabel(ticket.category)}</span>
                      <span>•</span>
                      <span>{new Date(ticket.created_at).toLocaleDateString()}</span>
                      {ticket.replies?.length > 0 && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" />
                            {ticket.replies.length} replies
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(ticket.status)}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Ticket Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Ticket Details</span>
            </DialogTitle>
          </DialogHeader>
          {selectedTicket && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {getStatusBadge(selectedTicket.status)}
                  {getPriorityBadge(selectedTicket.priority)}
                </div>
                <Select 
                  value={selectedTicket.status} 
                  onValueChange={(value) => handleStatusChange(selectedTicket.id, value)}
                  disabled={updatingStatus}
                >
                  <SelectTrigger className="w-40" data-testid="update-status-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <h3 className="font-semibold text-lg">{selectedTicket.subject}</h3>
                <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                  <span>{getCategoryLabel(selectedTicket.category)}</span>
                  <span>•</span>
                  <span>{new Date(selectedTicket.created_at).toLocaleString()}</span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-slate-600 mb-2">
                  <User className="w-4 h-4" />
                  <span className="font-medium">{selectedTicket.customer_name}</span>
                  <span className="text-slate-400">|</span>
                  <Phone className="w-3 h-3" />
                  <span>{selectedTicket.customer_phone}</span>
                  {selectedTicket.customer_code && (
                    <>
                      <span className="text-slate-400">|</span>
                      <span className="text-blue-600">{selectedTicket.customer_code}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="text-slate-700 whitespace-pre-wrap">{selectedTicket.description}</p>
              </div>

              {/* Conversation */}
              {selectedTicket.replies && selectedTicket.replies.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-medium text-slate-700">Conversation</h4>
                  {selectedTicket.replies.map((reply) => (
                    <div 
                      key={reply.id} 
                      className={`p-3 rounded-lg ${
                        reply.sender_type === 'admin' 
                          ? 'bg-blue-50 border-l-4 border-blue-500' 
                          : 'bg-slate-50 border-l-4 border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 text-sm mb-2">
                        {reply.sender_type === 'admin' ? (
                          <ShieldCheck className="w-4 h-4 text-blue-600" />
                        ) : (
                          <User className="w-4 h-4 text-slate-500" />
                        )}
                        <span className="font-medium">
                          {reply.sender_type === 'admin' ? reply.sender_name : selectedTicket.customer_name}
                        </span>
                        <span className="text-slate-400">•</span>
                        <span className="text-slate-400">{new Date(reply.created_at).toLocaleString()}</span>
                      </div>
                      <p className="text-slate-700 whitespace-pre-wrap">{reply.message}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Reply Box */}
              {selectedTicket.status !== 'closed' && (
                <div className="pt-4 border-t">
                  <Label className="mb-2 block">Send Reply</Label>
                  <div className="flex gap-2">
                    <Textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Type your reply..."
                      rows={3}
                      className="flex-1"
                      data-testid="admin-reply-input"
                    />
                  </div>
                  <div className="flex justify-end mt-2">
                    <Button onClick={handleSendReply} disabled={sendingReply} data-testid="send-admin-reply-btn">
                      {sendingReply ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Send className="w-4 h-4 mr-2" />
                      )}
                      Send Reply
                    </Button>
                  </div>
                </div>
              )}

              {selectedTicket.resolved_at && (
                <div className="pt-4 border-t text-sm text-green-600">
                  Resolved on {new Date(selectedTicket.resolved_at).toLocaleString()} by {selectedTicket.resolved_by}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Support;
