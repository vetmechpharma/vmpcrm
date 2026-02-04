import { useState, useEffect } from 'react';
import { whatsappLogsAPI } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { toast } from 'sonner';
import {
  MessageSquare,
  Search,
  Trash2,
  RefreshCw,
  CheckCircle,
  XCircle,
  Phone,
  Clock,
  Filter,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { format } from 'date-fns';

export const WhatsAppLogs = () => {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [messageType, setMessageType] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const limit = 20;

  useEffect(() => {
    fetchLogs();
    fetchStats();
  }, [page, messageType, statusFilter, search]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = {
        skip: page * limit,
        limit,
      };
      if (messageType !== 'all') params.message_type = messageType;
      if (statusFilter !== 'all') params.status = statusFilter;
      if (search) params.search = search;

      const response = await whatsappLogsAPI.getAll(params);
      setLogs(response.data.logs);
      setTotal(response.data.total);
    } catch (error) {
      toast.error('Failed to fetch WhatsApp logs');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await whatsappLogsAPI.getStats();
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch stats');
    }
  };

  const handleDelete = async () => {
    if (!selectedLog) return;
    try {
      await whatsappLogsAPI.delete(selectedLog.id);
      toast.success('Log deleted');
      setDeleteDialogOpen(false);
      fetchLogs();
      fetchStats();
    } catch (error) {
      toast.error('Failed to delete log');
    }
  };

  const handleClearAll = async () => {
    try {
      await whatsappLogsAPI.clearAll();
      toast.success('All logs cleared');
      setClearDialogOpen(false);
      fetchLogs();
      fetchStats();
    } catch (error) {
      toast.error('Failed to clear logs');
    }
  };

  const getStatusBadge = (status) => {
    if (status === 'success') {
      return (
        <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
          <CheckCircle className="w-3 h-3 mr-1" />
          Success
        </Badge>
      );
    }
    return (
      <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
        <XCircle className="w-3 h-3 mr-1" />
        Failed
      </Badge>
    );
  };

  const getTypeBadge = (type) => {
    const typeColors = {
      otp: 'bg-purple-100 text-purple-700',
      order_confirmation: 'bg-blue-100 text-blue-700',
      status_confirmed: 'bg-green-100 text-green-700',
      status_shipped: 'bg-cyan-100 text-cyan-700',
      status_delivered: 'bg-emerald-100 text-emerald-700',
      status_cancelled: 'bg-red-100 text-red-700',
      out_of_stock: 'bg-orange-100 text-orange-700',
      stock_arrived: 'bg-lime-100 text-lime-700',
      ready_to_despatch_transporter: 'bg-indigo-100 text-indigo-700',
      reminder: 'bg-amber-100 text-amber-700',
    };
    
    const typeLabels = {
      otp: 'OTP',
      order_confirmation: 'Order Confirm',
      status_confirmed: 'Confirmed',
      status_shipped: 'Shipped',
      status_delivered: 'Delivered',
      status_cancelled: 'Cancelled',
      out_of_stock: 'Out of Stock',
      stock_arrived: 'Stock Arrived',
      ready_to_despatch_transporter: 'Transport',
      reminder: 'Reminder',
    };

    return (
      <Badge className={typeColors[type] || 'bg-slate-100 text-slate-700'}>
        {typeLabels[type] || type}
      </Badge>
    );
  };

  const messageTypes = [
    { value: 'all', label: 'All Types' },
    { value: 'otp', label: 'OTP' },
    { value: 'order_confirmation', label: 'Order Confirmation' },
    { value: 'status_confirmed', label: 'Status - Confirmed' },
    { value: 'status_shipped', label: 'Status - Shipped' },
    { value: 'status_delivered', label: 'Status - Delivered' },
    { value: 'status_cancelled', label: 'Status - Cancelled' },
    { value: 'out_of_stock', label: 'Out of Stock' },
    { value: 'stock_arrived', label: 'Stock Arrived' },
    { value: 'reminder', label: 'Reminder' },
  ];

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6" data-testid="whatsapp-logs-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">WhatsApp Logs</h1>
          <p className="text-slate-600">View all WhatsApp messages sent from the system</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { fetchLogs(); fetchStats(); }} data-testid="refresh-btn">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button 
            variant="destructive" 
            onClick={() => setClearDialogOpen(true)}
            disabled={total === 0}
            data-testid="clear-all-btn"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Clear All
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-slate-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-sm text-slate-500">Total Messages</p>
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
                  <p className="text-2xl font-bold text-green-600">{stats.success}</p>
                  <p className="text-sm text-slate-500">Successful</p>
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
                  <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
                  <p className="text-sm text-slate-500">Failed</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Phone className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {stats.total > 0 ? ((stats.success / stats.total) * 100).toFixed(0) : 0}%
                  </p>
                  <p className="text-sm text-slate-500">Success Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search by phone or name..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                className="pl-10"
                data-testid="search-input"
              />
            </div>
            <Select value={messageType} onValueChange={(v) => { setMessageType(v); setPage(0); }}>
              <SelectTrigger className="w-full md:w-48" data-testid="type-filter">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Message Type" />
              </SelectTrigger>
              <SelectContent>
                {messageTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
              <SelectTrigger className="w-full md:w-36" data-testid="status-filter">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Message History</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin w-8 h-8 border-4 border-slate-200 border-t-slate-600 rounded-full mx-auto"></div>
              <p className="mt-4 text-slate-500">Loading logs...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">No WhatsApp logs found</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Recipient</TableHead>
                    <TableHead className="hidden md:table-cell">Message Preview</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden sm:table-cell">Time</TableHead>
                    <TableHead className="w-16">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>{getTypeBadge(log.message_type)}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{log.recipient_name || 'Unknown'}</p>
                          <p className="text-sm text-slate-500">{log.recipient_phone}</p>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell max-w-xs">
                        <p className="truncate text-sm text-slate-600">{log.message_preview}</p>
                        {log.error_message && (
                          <p className="text-xs text-red-500 truncate mt-1">{log.error_message}</p>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(log.status)}</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <div className="flex items-center gap-1 text-sm text-slate-500">
                          <Clock className="w-3 h-3" />
                          {format(new Date(log.created_at), 'dd MMM, HH:mm')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => { setSelectedLog(log); setDeleteDialogOpen(true); }}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          data-testid={`delete-log-${log.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <p className="text-sm text-slate-500">
                  Showing {page * limit + 1}-{Math.min((page + 1) * limit, total)} of {total} logs
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page - 1)}
                    disabled={page === 0}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page + 1)}
                    disabled={page >= totalPages - 1}
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Log Entry</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this log entry? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear All Confirmation Dialog */}
      <Dialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear All Logs</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete ALL {total} log entries? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClearDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleClearAll}>Clear All</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WhatsAppLogs;
