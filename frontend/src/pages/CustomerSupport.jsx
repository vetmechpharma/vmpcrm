import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { toast } from 'sonner';
import { 
  LifeBuoy, 
  Plus, 
  MessageSquare, 
  Clock, 
  CheckCircle, 
  Loader2,
  Send,
  User,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const CustomerSupport = () => {
  const { customer } = useOutletContext();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [showTicketDetail, setShowTicketDetail] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  
  const [newTicket, setNewTicket] = useState({
    subject: '',
    description: '',
    category: 'general',
    priority: 'medium'
  });

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      const token = localStorage.getItem('customerToken');
      const response = await axios.get(`${API_URL}/api/customer/tickets`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTickets(response.data || []);
    } catch (error) {
      console.error('Failed to fetch tickets');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTicket = async () => {
    if (!newTicket.subject.trim() || !newTicket.description.trim()) {
      toast.error('Please fill all required fields');
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem('customerToken');
      await axios.post(`${API_URL}/api/customer/tickets`, newTicket, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Ticket created!');
      setShowNewTicket(false);
      setNewTicket({ subject: '', description: '', category: 'general', priority: 'medium' });
      fetchTickets();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create ticket');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendReply = async () => {
    if (!replyText.trim()) {
      toast.error('Please enter a message');
      return;
    }

    setSendingReply(true);
    try {
      const token = localStorage.getItem('customerToken');
      await axios.post(`${API_URL}/api/customer/tickets/${selectedTicket.id}/reply`, 
        { message: replyText },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Reply sent!');
      setReplyText('');
      
      const response = await axios.get(`${API_URL}/api/customer/tickets`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const updated = response.data.find(t => t.id === selectedTicket.id);
      if (updated) setSelectedTicket(updated);
      setTickets(response.data || []);
    } catch (error) {
      toast.error('Failed to send reply');
    } finally {
      setSendingReply(false);
    }
  };

  const openTicketDetail = (ticket) => {
    setSelectedTicket(ticket);
    setShowTicketDetail(true);
    setReplyText('');
  };

  const getStatusConfig = (status) => {
    const configs = {
      open: { color: 'bg-amber-100 text-amber-700', icon: Clock, label: 'Open' },
      in_progress: { color: 'bg-blue-100 text-blue-700', icon: Loader2, label: 'In Progress' },
      resolved: { color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle, label: 'Resolved' },
      closed: { color: 'bg-slate-100 text-slate-700', icon: CheckCircle, label: 'Closed' }
    };
    return configs[status] || configs.open;
  };

  const getCategoryLabel = (category) => {
    const labels = {
      general: 'General',
      order: 'Order Issue',
      product: 'Product',
      delivery: 'Delivery',
      payment: 'Payment',
      other: 'Other'
    };
    return labels[category] || category;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="px-4 py-6 md:px-6 space-y-4">
      {/* New Ticket Button */}
      <Button 
        onClick={() => setShowNewTicket(true)}
        className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-base font-medium"
        data-testid="new-ticket-btn"
      >
        <Plus className="w-5 h-5 mr-2" />
        Create New Ticket
      </Button>

      {/* Tickets List */}
      {tickets.length === 0 ? (
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardContent className="py-12 text-center">
            <LifeBuoy className="w-16 h-16 mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500 mb-2">No support tickets yet</p>
            <p className="text-sm text-slate-400">We're here to help!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => {
            const statusConfig = getStatusConfig(ticket.status);
            const StatusIcon = statusConfig.icon;
            
            return (
              <Card 
                key={ticket.id}
                className="rounded-2xl border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer active:scale-[0.98]"
                onClick={() => openTicketDetail(ticket)}
                data-testid={`ticket-${ticket.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-800 text-sm line-clamp-1">
                        {ticket.subject}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {getCategoryLabel(ticket.category)} • {new Date(ticket.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${statusConfig.color}`}>
                      <StatusIcon className="w-3 h-3" />
                      {statusConfig.label}
                    </span>
                  </div>
                  
                  <p className="text-sm text-slate-600 line-clamp-2 mb-3">{ticket.description}</p>
                  
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    {ticket.replies?.length > 0 ? (
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" />
                        {ticket.replies.length} replies
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">No replies yet</span>
                    )}
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* New Ticket Modal */}
      <Dialog open={showNewTicket} onOpenChange={setShowNewTicket}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-bold" style={{ fontFamily: 'Manrope, sans-serif' }}>
              Create Support Ticket
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Subject *</Label>
              <Input
                value={newTicket.subject}
                onChange={(e) => setNewTicket({...newTicket, subject: e.target.value})}
                placeholder="Brief summary of your issue"
                className="h-12 rounded-xl border-0 bg-slate-50"
                data-testid="ticket-subject-input"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Category</Label>
                <Select 
                  value={newTicket.category} 
                  onValueChange={(v) => setNewTicket({...newTicket, category: v})}
                >
                  <SelectTrigger className="h-12 rounded-xl border-0 bg-slate-50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="order">Order Issue</SelectItem>
                    <SelectItem value="product">Product</SelectItem>
                    <SelectItem value="delivery">Delivery</SelectItem>
                    <SelectItem value="payment">Payment</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Priority</Label>
                <Select 
                  value={newTicket.priority} 
                  onValueChange={(v) => setNewTicket({...newTicket, priority: v})}
                >
                  <SelectTrigger className="h-12 rounded-xl border-0 bg-slate-50">
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
              <Label className="text-sm font-medium">Description *</Label>
              <Textarea
                value={newTicket.description}
                onChange={(e) => setNewTicket({...newTicket, description: e.target.value})}
                placeholder="Describe your issue in detail..."
                rows={4}
                className="rounded-xl border-0 bg-slate-50 resize-none"
                data-testid="ticket-description-input"
              />
            </div>
            
            <Button 
              onClick={handleCreateTicket} 
              disabled={submitting}
              className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-base"
              data-testid="submit-ticket-btn"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Submit Ticket
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Ticket Detail Modal */}
      <Dialog open={showTicketDetail} onOpenChange={setShowTicketDetail}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-bold" style={{ fontFamily: 'Manrope, sans-serif' }}>
              Ticket Details
            </DialogTitle>
          </DialogHeader>
          
          {selectedTicket && (
            <div className="space-y-4">
              {/* Header */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-slate-800">{selectedTicket.subject}</h3>
                  {(() => {
                    const config = getStatusConfig(selectedTicket.status);
                    const Icon = config.icon;
                    return (
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${config.color}`}>
                        <Icon className="w-3 h-3" />
                        {config.label}
                      </span>
                    );
                  })()}
                </div>
                <p className="text-xs text-slate-500">
                  {getCategoryLabel(selectedTicket.category)} • {new Date(selectedTicket.created_at).toLocaleString()}
                </p>
              </div>

              {/* Description */}
              <div className="p-4 bg-slate-50 rounded-xl">
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{selectedTicket.description}</p>
              </div>

              {/* Conversation */}
              {selectedTicket.replies && selectedTicket.replies.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-slate-600">Conversation</p>
                  {selectedTicket.replies.map((reply) => (
                    <div 
                      key={reply.id} 
                      className={`p-3 rounded-xl ${
                        reply.sender_type === 'admin' 
                          ? 'bg-blue-50 border-l-4 border-blue-500' 
                          : 'bg-slate-50 border-l-4 border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 text-xs mb-2">
                        {reply.sender_type === 'admin' ? (
                          <ShieldCheck className="w-4 h-4 text-blue-600" />
                        ) : (
                          <User className="w-4 h-4 text-slate-500" />
                        )}
                        <span className="font-medium text-slate-700">
                          {reply.sender_type === 'admin' ? reply.sender_name || 'Support' : 'You'}
                        </span>
                        <span className="text-slate-400">•</span>
                        <span className="text-slate-400">{new Date(reply.created_at).toLocaleString()}</span>
                      </div>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">{reply.message}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Reply Box */}
              {selectedTicket.status !== 'closed' && (
                <div className="pt-4 border-t">
                  <div className="flex gap-2">
                    <Textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Type your message..."
                      rows={2}
                      className="flex-1 rounded-xl border-0 bg-slate-50 resize-none"
                      data-testid="ticket-reply-input"
                    />
                    <Button 
                      onClick={handleSendReply} 
                      disabled={sendingReply}
                      className="h-auto bg-emerald-600 hover:bg-emerald-700 rounded-xl px-4"
                      data-testid="send-reply-btn"
                    >
                      {sendingReply ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Send className="w-5 h-5" />
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CustomerSupport;
