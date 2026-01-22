import { useState, useEffect } from 'react';
import { ordersAPI, transportAPI, pendingItemsAPI } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Checkbox } from '../components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import { 
  Loader2, 
  ShoppingCart, 
  RefreshCw, 
  Eye,
  MapPin,
  Monitor,
  Clock,
  User,
  Phone,
  Mail,
  Truck,
  Plus,
  Trash2,
  ExternalLink,
  CreditCard,
  Package,
  FileText,
  XCircle,
  Box,
  Edit,
  AlertTriangle
} from 'lucide-react';
import { formatDateTime } from '../lib/utils';

const STATUS_CONFIG = {
  pending: { color: 'bg-amber-100 text-amber-700', label: 'Pending' },
  confirmed: { color: 'bg-blue-100 text-blue-700', label: 'Confirmed' },
  shipped: { color: 'bg-indigo-100 text-indigo-700', label: 'Shipped' },
  delivered: { color: 'bg-emerald-100 text-emerald-700', label: 'Delivered' },
  cancelled: { color: 'bg-red-100 text-red-700', label: 'Cancelled' },
};

const PAYMENT_MODES = [
  { value: 'to_pay', label: 'To Pay' },
  { value: 'paid', label: 'Paid' },
];

export const Orders = () => {
  const { isAdmin } = useAuth();
  const [orders, setOrders] = useState([]);
  const [transports, setTransports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showTransportModal, setShowTransportModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingItemsForOrder, setPendingItemsForOrder] = useState([]);
  const [existingDoctor, setExistingDoctor] = useState(null);
  const [lookingUpDoctor, setLookingUpDoctor] = useState(false);

  // Transport form
  const [newTransport, setNewTransport] = useState({
    name: '',
    tracking_url_template: '',
    is_local: false
  });

  // Edit order items form
  const [editItems, setEditItems] = useState([]);
  const [itemsToMarkPending, setItemsToMarkPending] = useState({});

  // Customer edit form
  const [customerForm, setCustomerForm] = useState({
    doctor_name: '',
    doctor_email: '',
    doctor_address: '',
    doctor_phone: '',
    link_to_doctor: false
  });

  // Order update form with new fields
  const [updateForm, setUpdateForm] = useState({
    status: 'pending',
    // Transport & shipping (only for shipped status)
    transport_id: '',
    transport_name: '',
    tracking_number: '',
    tracking_url: '',
    delivery_station: '',
    payment_mode: '',
    // Package counts
    boxes_count: 0,
    cans_count: 0,
    bags_count: 0,
    // Invoice details
    invoice_number: '',
    invoice_date: '',
    invoice_value: '',
    // Cancellation reason (only for cancelled status)
    cancellation_reason: ''
  });

  useEffect(() => {
    fetchOrders();
    fetchTransports();
  }, [statusFilter]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      const response = await ordersAPI.getAll(params);
      setOrders(response.data);
    } catch (error) {
      toast.error('Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  };

  const fetchTransports = async () => {
    try {
      const response = await transportAPI.getAll();
      setTransports(response.data);
    } catch (error) {
      console.error('Failed to fetch transports');
    }
  };

  const openUpdateModal = (order) => {
    setSelectedOrder(order);
    setUpdateForm({
      status: order.status,
      transport_id: order.transport_id || '',
      transport_name: order.transport_name || '',
      tracking_number: order.tracking_number || '',
      tracking_url: order.tracking_url || '',
      delivery_station: order.delivery_station || '',
      payment_mode: order.payment_mode || '',
      boxes_count: order.boxes_count || 0,
      cans_count: order.cans_count || 0,
      bags_count: order.bags_count || 0,
      invoice_number: order.invoice_number || '',
      invoice_date: order.invoice_date || '',
      invoice_value: order.invoice_value || '',
      cancellation_reason: order.cancellation_reason || ''
    });
    setShowUpdateModal(true);
  };

  const handleTransportChange = (transportId) => {
    const transport = transports.find(t => t.id === transportId);
    if (transport) {
      setUpdateForm({
        ...updateForm,
        transport_id: transport.id,
        transport_name: transport.name,
        tracking_url: transport.is_local ? '' : (transport.tracking_url_template || '')
      });
    }
  };

  const handleTrackingNumberChange = (value) => {
    const transport = transports.find(t => t.id === updateForm.transport_id);
    let trackingUrl = '';
    
    if (transport && transport.tracking_url_template && value) {
      trackingUrl = transport.tracking_url_template.replace('{tracking_number}', value);
    }
    
    setUpdateForm({
      ...updateForm,
      tracking_number: value,
      tracking_url: trackingUrl
    });
  };

  const handleSaveOrder = async () => {
    // Validate cancellation reason if status is cancelled
    if (updateForm.status === 'cancelled' && !updateForm.cancellation_reason.trim()) {
      toast.error('Please provide a reason for cancellation');
      return;
    }
    
    setSaving(true);
    try {
      await ordersAPI.updateStatus(selectedOrder.id, updateForm);
      toast.success(`Order ${updateForm.status === 'shipped' ? 'shipped' : 'updated'} successfully! WhatsApp notification sent.`);
      setShowUpdateModal(false);
      fetchOrders();
    } catch (error) {
      toast.error('Failed to update order');
    } finally {
      setSaving(false);
    }
  };

  const handleAddTransport = async () => {
    if (!newTransport.name.trim()) {
      toast.error('Please enter transport name');
      return;
    }
    
    setSaving(true);
    try {
      await transportAPI.create(newTransport);
      toast.success('Transport added successfully');
      setNewTransport({ name: '', tracking_url_template: '', is_local: false });
      fetchTransports();
    } catch (error) {
      toast.error('Failed to add transport');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTransport = async (id) => {
    if (!window.confirm('Delete this transport?')) return;
    
    try {
      await transportAPI.delete(id);
      toast.success('Transport deleted');
      fetchTransports();
    } catch (error) {
      toast.error('Failed to delete transport');
    }
  };

  const viewOrderDetails = async (order) => {
    setSelectedOrder(order);
    // Fetch pending items for this order's customer
    try {
      const response = await pendingItemsAPI.getByDoctor(order.doctor_phone);
      setPendingItemsForOrder(response.data);
    } catch (error) {
      setPendingItemsForOrder([]);
    }
    setShowDetailModal(true);
  };

  const openEditModal = (order) => {
    setSelectedOrder(order);
    setEditItems(order.items.map(item => ({ ...item, remove: false })));
    setItemsToMarkPending({});
    setShowEditModal(true);
  };

  const handleRemoveItem = (index, shouldRemove) => {
    const newItems = [...editItems];
    newItems[index].remove = shouldRemove;
    setEditItems(newItems);
  };

  const handleMarkPending = (index, shouldMarkPending) => {
    setItemsToMarkPending(prev => ({
      ...prev,
      [index]: shouldMarkPending
    }));
  };

  const handleSaveEditedItems = async () => {
    setSaving(true);
    try {
      // Get items that are NOT removed
      const remainingItems = editItems.filter(item => !item.remove);
      
      // Get items to mark as pending
      const pendingItems = editItems
        .filter((item, index) => item.remove && itemsToMarkPending[index])
        .map(item => ({
          item_id: item.item_id,
          item_code: item.item_code,
          item_name: item.item_name,
          quantity: item.quantity
        }));
      
      await ordersAPI.updateItems(selectedOrder.id, {
        items: remainingItems,
        pending_items: pendingItems.length > 0 ? pendingItems : null
      });
      
      const removedCount = editItems.filter(item => item.remove).length;
      const pendingCount = pendingItems.length;
      
      let message = 'Order items updated';
      if (removedCount > 0) {
        message += `, ${removedCount} item(s) removed`;
      }
      if (pendingCount > 0) {
        message += `, ${pendingCount} item(s) marked as pending`;
      }
      
      toast.success(message);
      setShowEditModal(false);
      fetchOrders();
    } catch (error) {
      toast.error('Failed to update order items');
    } finally {
      setSaving(false);
    }
  };

  const openCustomerModal = async (order) => {
    setSelectedOrder(order);
    setCustomerForm({
      doctor_name: order.doctor_name || '',
      doctor_email: order.doctor_email || '',
      doctor_address: order.doctor_address || '',
      doctor_phone: order.doctor_phone || '',
      link_to_doctor: false
    });
    setExistingDoctor(null);
    setShowCustomerModal(true);
    
    // Look up existing doctor by phone
    setLookingUpDoctor(true);
    try {
      const response = await ordersAPI.lookupDoctor(order.id);
      if (response.data.found) {
        setExistingDoctor(response.data.doctor);
        // Pre-fill form with existing doctor data
        setCustomerForm({
          doctor_name: response.data.doctor.name || order.doctor_name || '',
          doctor_email: response.data.doctor.email || order.doctor_email || '',
          doctor_address: response.data.doctor.address || order.doctor_address || '',
          doctor_phone: order.doctor_phone || '',
          link_to_doctor: false
        });
      }
    } catch (error) {
      console.error('Failed to lookup doctor');
    } finally {
      setLookingUpDoctor(false);
    }
  };

  const handleSaveCustomer = async () => {
    setSaving(true);
    try {
      const response = await ordersAPI.updateCustomer(selectedOrder.id, customerForm);
      toast.success(response.data.message);
      setShowCustomerModal(false);
      fetchOrders();
    } catch (error) {
      toast.error('Failed to update customer info');
    } finally {
      setSaving(false);
    }
  };

  const selectedTransport = transports.find(t => t.id === updateForm.transport_id);
  const isLocalSupply = selectedTransport?.is_local;

  return (
    <div className="space-y-6 animate-fade-in" data-testid="orders-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Orders</h1>
          <p className="text-slate-500 mt-1">Manage orders and shipping</p>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <Button variant="outline" onClick={() => setShowTransportModal(true)}>
              <Truck className="w-4 h-4 mr-2" />
              Transports
            </Button>
          )}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Orders</SelectItem>
              {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                <SelectItem key={key} value={key}>{config.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={fetchOrders} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
          ) : orders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>Customer</th>
                    <th>Items</th>
                    <th>Status</th>
                    <th>Transport</th>
                    <th>Payment</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => {
                    const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
                    return (
                      <tr key={order.id}>
                        <td>
                          <span className="font-mono font-medium">{order.order_number}</span>
                        </td>
                        <td>
                          <div>
                            <p className="font-medium text-slate-900">
                              {order.doctor_name || 'Unknown'}
                            </p>
                            <p className="text-sm text-slate-500">{order.doctor_phone}</p>
                          </div>
                        </td>
                        <td>
                          <span className="text-sm">{order.items?.length || 0} items</span>
                        </td>
                        <td>
                          <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
                        </td>
                        <td>
                          {order.transport_name ? (
                            <div>
                              <p className="text-sm font-medium">{order.transport_name}</p>
                              {order.tracking_number && (
                                <p className="text-xs text-slate-500">
                                  {order.tracking_url ? (
                                    <a href={order.tracking_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                                      {order.tracking_number} <ExternalLink className="w-3 h-3" />
                                    </a>
                                  ) : order.tracking_number}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td>
                          {order.payment_mode ? (
                            <Badge className={order.payment_mode === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}>
                              {order.payment_mode === 'paid' ? 'Paid' : 'To Pay'}
                            </Badge>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td>
                          <span className="text-sm text-slate-500">
                            {formatDateTime(order.created_at)}
                          </span>
                        </td>
                        <td>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => viewOrderDetails(order)}
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditModal(order)}
                              title="Edit Items"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openUpdateModal(order)}
                              title="Update Status"
                            >
                              <Truck className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <ShoppingCart className="w-16 h-16 mb-4" />
              <h3 className="text-lg font-medium">No orders yet</h3>
              <p className="text-sm">Orders from the public showcase will appear here</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Order Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Order Details - {selectedOrder?.order_number}</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-6">
              {/* Customer Info */}
              <Card>
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <CardTitle className="text-base">Customer Information</CardTitle>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setShowDetailModal(false);
                      openCustomerModal(selectedOrder);
                    }}
                    data-testid="edit-customer-btn"
                  >
                    <Edit className="w-3 h-3 mr-1" />
                    Edit
                  </Button>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <User className="w-4 h-4 text-slate-400" />
                    <span className="font-medium">{selectedOrder.doctor_name || 'Unknown'}</span>
                    {selectedOrder.doctor_id && (
                      <Badge variant="outline" className="text-xs">Linked</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-slate-400" />
                    <span>{selectedOrder.doctor_phone}</span>
                  </div>
                  {selectedOrder.doctor_email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="w-4 h-4 text-slate-400" />
                      <span>{selectedOrder.doctor_email}</span>
                    </div>
                  )}
                  {selectedOrder.doctor_address && (
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin className="w-4 h-4 text-slate-400 mt-0.5" />
                      <span>{selectedOrder.doctor_address}</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Order Items */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Order Items</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {selectedOrder.items?.map((item, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div>
                          <p className="font-medium">{item.item_name}</p>
                          <p className="text-sm text-slate-500">{item.item_code}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">Qty: {item.quantity}</p>
                          <p className="text-sm text-slate-500">₹{item.rate} / unit</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Transport Info */}
              {selectedOrder.transport_name && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Shipping Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Truck className="w-4 h-4 text-slate-400" />
                      <span className="font-medium">{selectedOrder.transport_name}</span>
                    </div>
                    {selectedOrder.tracking_number && (
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">Tracking:</span>
                        {selectedOrder.tracking_url ? (
                          <a href={selectedOrder.tracking_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                            {selectedOrder.tracking_number} <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span>{selectedOrder.tracking_number}</span>
                        )}
                      </div>
                    )}
                    {selectedOrder.delivery_station && (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-slate-400" />
                        <span>{selectedOrder.delivery_station}</span>
                      </div>
                    )}
                    {selectedOrder.payment_mode && (
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-slate-400" />
                        <Badge className={selectedOrder.payment_mode === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}>
                          {selectedOrder.payment_mode === 'paid' ? 'Paid' : 'To Pay'}
                        </Badge>
                      </div>
                    )}
                    
                    {/* Package Details */}
                    {(selectedOrder.boxes_count > 0 || selectedOrder.cans_count > 0 || selectedOrder.bags_count > 0) && (
                      <div className="flex items-center gap-2 pt-2 border-t">
                        <Box className="w-4 h-4 text-slate-400" />
                        <span>
                          {selectedOrder.boxes_count > 0 && `${selectedOrder.boxes_count} Box(es)`}
                          {selectedOrder.boxes_count > 0 && (selectedOrder.cans_count > 0 || selectedOrder.bags_count > 0) && ', '}
                          {selectedOrder.cans_count > 0 && `${selectedOrder.cans_count} Can(s)`}
                          {selectedOrder.cans_count > 0 && selectedOrder.bags_count > 0 && ', '}
                          {selectedOrder.bags_count > 0 && `${selectedOrder.bags_count} Bag(s)`}
                        </span>
                      </div>
                    )}
                    
                    {/* Invoice Details */}
                    {selectedOrder.invoice_number && (
                      <div className="pt-2 border-t space-y-1">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-slate-400" />
                          <span className="font-medium">Invoice: {selectedOrder.invoice_number}</span>
                        </div>
                        {selectedOrder.invoice_date && (
                          <div className="text-slate-500 pl-6">Date: {selectedOrder.invoice_date}</div>
                        )}
                        {selectedOrder.invoice_value && (
                          <div className="text-slate-500 pl-6">Value: ₹{selectedOrder.invoice_value?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
              
              {/* Cancellation Reason */}
              {selectedOrder.status === 'cancelled' && selectedOrder.cancellation_reason && (
                <Card className="border-red-200 bg-red-50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base text-red-700 flex items-center gap-2">
                      <XCircle className="w-4 h-4" /> Cancellation Reason
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-red-600">{selectedOrder.cancellation_reason}</p>
                  </CardContent>
                </Card>
              )}

              {/* Pending Items for this Customer */}
              {pendingItemsForOrder.length > 0 && (
                <Card className="border-orange-200 bg-orange-50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base text-orange-700 flex items-center gap-2">
                      <Clock className="w-4 h-4" /> Pending Items for this Customer
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {pendingItemsForOrder.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-2 bg-white rounded border border-orange-200">
                        <div>
                          <p className="font-medium text-sm">{item.item_name}</p>
                          <p className="text-xs text-slate-500">
                            Qty: {item.quantity} | From: {item.original_order_number} ({formatDateTime(item.original_order_date)})
                          </p>
                        </div>
                        <Badge className="bg-orange-100 text-orange-700 text-xs">Pending</Badge>
                      </div>
                    ))}
                    <p className="text-xs text-orange-600 mt-2">
                      💡 These items were removed from previous orders due to stock unavailability. Follow up with the customer!
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Device Info */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Submission Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span>Submitted: {formatDateTime(selectedOrder.created_at)}</span>
                  </div>
                  {selectedOrder.ip_address && (
                    <div className="flex items-center gap-2">
                      <Monitor className="w-4 h-4 text-slate-400" />
                      <span>IP: {selectedOrder.ip_address}</span>
                    </div>
                  )}
                  {selectedOrder.location && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-slate-400" />
                      <span>Location: {selectedOrder.location}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Update Order Modal */}
      <Dialog open={showUpdateModal} onOpenChange={setShowUpdateModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Update Order - {selectedOrder?.order_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Status */}
            <div className="space-y-2">
              <Label>Order Status</Label>
              <Select value={updateForm.status} onValueChange={(v) => setUpdateForm({...updateForm, status: v})}>
                <SelectTrigger data-testid="order-status-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* SHIPPED STATUS - Show transport & invoice fields */}
            {updateForm.status === 'shipped' && (
              <>
                {/* Transport Section */}
                <div className="border-t pt-4 mt-4">
                  <h4 className="font-medium flex items-center gap-2 mb-3">
                    <Truck className="w-4 h-4" /> Transport Details
                  </h4>
                  
                  {/* Transport */}
                  <div className="space-y-2 mb-3">
                    <Label>Transport</Label>
                    <Select value={updateForm.transport_id} onValueChange={handleTransportChange}>
                      <SelectTrigger data-testid="transport-select">
                        <SelectValue placeholder="Select transport" />
                      </SelectTrigger>
                      <SelectContent>
                        {transports.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name} {t.is_local && '(Local)'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Tracking Number - Only if not local */}
                  {updateForm.transport_id && !isLocalSupply && (
                    <div className="space-y-2 mb-3">
                      <Label>Tracking Number</Label>
                      <Input
                        data-testid="tracking-number-input"
                        value={updateForm.tracking_number}
                        onChange={(e) => handleTrackingNumberChange(e.target.value)}
                        placeholder="Enter tracking number"
                      />
                      {updateForm.tracking_url && (
                        <a href={updateForm.tracking_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                          Preview tracking link <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  )}

                  {/* Delivery Station */}
                  <div className="space-y-2 mb-3">
                    <Label>Delivery Station</Label>
                    <Input
                      data-testid="delivery-station-input"
                      value={updateForm.delivery_station}
                      onChange={(e) => setUpdateForm({...updateForm, delivery_station: e.target.value})}
                      placeholder="Enter delivery station"
                    />
                  </div>

                  {/* Payment Mode */}
                  <div className="space-y-2">
                    <Label>Payment Mode</Label>
                    <Select value={updateForm.payment_mode} onValueChange={(v) => setUpdateForm({...updateForm, payment_mode: v})}>
                      <SelectTrigger data-testid="payment-mode-select">
                        <SelectValue placeholder="Select payment mode" />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYMENT_MODES.map((mode) => (
                          <SelectItem key={mode.value} value={mode.value}>{mode.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Package Counts Section */}
                <div className="border-t pt-4 mt-4">
                  <h4 className="font-medium flex items-center gap-2 mb-3">
                    <Box className="w-4 h-4" /> Package Details
                  </h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label>Boxes</Label>
                      <Input
                        data-testid="boxes-count-input"
                        type="number"
                        min="0"
                        value={updateForm.boxes_count}
                        onChange={(e) => setUpdateForm({...updateForm, boxes_count: parseInt(e.target.value) || 0})}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Cans</Label>
                      <Input
                        data-testid="cans-count-input"
                        type="number"
                        min="0"
                        value={updateForm.cans_count}
                        onChange={(e) => setUpdateForm({...updateForm, cans_count: parseInt(e.target.value) || 0})}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Bags</Label>
                      <Input
                        data-testid="bags-count-input"
                        type="number"
                        min="0"
                        value={updateForm.bags_count}
                        onChange={(e) => setUpdateForm({...updateForm, bags_count: parseInt(e.target.value) || 0})}
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>

                {/* Invoice Section */}
                <div className="border-t pt-4 mt-4">
                  <h4 className="font-medium flex items-center gap-2 mb-3">
                    <FileText className="w-4 h-4" /> Invoice Details
                  </h4>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="space-y-2">
                      <Label>Invoice Number</Label>
                      <Input
                        data-testid="invoice-number-input"
                        value={updateForm.invoice_number}
                        onChange={(e) => setUpdateForm({...updateForm, invoice_number: e.target.value})}
                        placeholder="INV-001"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Invoice Date</Label>
                      <Input
                        data-testid="invoice-date-input"
                        type="date"
                        value={updateForm.invoice_date}
                        onChange={(e) => setUpdateForm({...updateForm, invoice_date: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Invoice Value (₹)</Label>
                    <Input
                      data-testid="invoice-value-input"
                      type="number"
                      min="0"
                      step="0.01"
                      value={updateForm.invoice_value}
                      onChange={(e) => setUpdateForm({...updateForm, invoice_value: parseFloat(e.target.value) || ''})}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </>
            )}

            {/* CANCELLED STATUS - Show cancellation reason */}
            {updateForm.status === 'cancelled' && (
              <div className="border-t pt-4 mt-4">
                <h4 className="font-medium flex items-center gap-2 mb-3 text-red-600">
                  <XCircle className="w-4 h-4" /> Cancellation Details
                </h4>
                <div className="space-y-2">
                  <Label>Reason for Cancellation *</Label>
                  <Textarea
                    data-testid="cancellation-reason-input"
                    value={updateForm.cancellation_reason}
                    onChange={(e) => setUpdateForm({...updateForm, cancellation_reason: e.target.value})}
                    placeholder="Enter reason for cancellation..."
                    rows={3}
                    className="resize-none"
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUpdateModal(false)}>Cancel</Button>
            <Button 
              onClick={handleSaveOrder} 
              disabled={saving}
              data-testid="save-order-btn"
              className={updateForm.status === 'cancelled' ? 'bg-red-600 hover:bg-red-700' : ''}
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {updateForm.status === 'shipped' ? 'Ship Order' : updateForm.status === 'cancelled' ? 'Cancel Order' : 'Update'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transport Management Modal */}
      <Dialog open={showTransportModal} onOpenChange={setShowTransportModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Manage Transports</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Add New Transport */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Add New Transport</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label>Transport Name *</Label>
                  <Input
                    value={newTransport.name}
                    onChange={(e) => setNewTransport({...newTransport, name: e.target.value})}
                    placeholder="e.g., Blue Dart, DTDC, Local Supply"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_local"
                    checked={newTransport.is_local}
                    onChange={(e) => setNewTransport({...newTransport, is_local: e.target.checked, tracking_url_template: ''})}
                    className="rounded"
                  />
                  <label htmlFor="is_local" className="text-sm">Local Supply (no tracking)</label>
                </div>
                {!newTransport.is_local && (
                  <div className="space-y-2">
                    <Label>Tracking URL Template</Label>
                    <Input
                      value={newTransport.tracking_url_template}
                      onChange={(e) => setNewTransport({...newTransport, tracking_url_template: e.target.value})}
                      placeholder="https://track.com/?awb={tracking_number}"
                    />
                    <p className="text-xs text-slate-500">Use {'{tracking_number}'} as placeholder</p>
                  </div>
                )}
                <Button onClick={handleAddTransport} disabled={saving} className="w-full">
                  {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  <Plus className="w-4 h-4 mr-2" />
                  Add Transport
                </Button>
              </CardContent>
            </Card>

            {/* Existing Transports */}
            <div className="space-y-2">
              <Label>Existing Transports</Label>
              {transports.length > 0 ? (
                <div className="space-y-2">
                  {transports.map((t) => (
                    <div key={t.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div>
                        <p className="font-medium">{t.name}</p>
                        {t.is_local ? (
                          <p className="text-xs text-slate-500">Local Supply</p>
                        ) : t.tracking_url_template ? (
                          <p className="text-xs text-slate-500 truncate max-w-[250px]">{t.tracking_url_template}</p>
                        ) : null}
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteTransport(t.id)} className="text-red-500 hover:text-red-700">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400">No transports added yet</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Order Items Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5" />
              Edit Order Items - {selectedOrder?.order_number}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                <div className="text-sm text-amber-700">
                  <p className="font-medium">Remove unavailable items</p>
                  <p>Check "Mark as Pending" to track items for customer follow-up when stock is available.</p>
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              {editItems.map((item, index) => (
                <div 
                  key={index} 
                  className={`p-4 rounded-lg border ${item.remove ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-slate-800">{item.item_name}</p>
                      <p className="text-sm text-slate-500">{item.item_code} | Qty: {item.quantity}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant={item.remove ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleRemoveItem(index, !item.remove)}
                        className={item.remove ? "bg-red-600 hover:bg-red-700" : ""}
                      >
                        {item.remove ? 'Removed' : 'Remove'}
                      </Button>
                    </div>
                  </div>
                  
                  {/* Mark as Pending option - only show when item is removed */}
                  {item.remove && (
                    <div className="mt-3 pt-3 border-t border-red-200">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`pending-${index}`}
                          checked={itemsToMarkPending[index] || false}
                          onCheckedChange={(checked) => handleMarkPending(index, checked)}
                        />
                        <label 
                          htmlFor={`pending-${index}`} 
                          className="text-sm text-red-700 cursor-pointer"
                        >
                          Mark as Pending (for customer follow-up)
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            {editItems.filter(item => item.remove).length > 0 && (
              <div className="mt-4 p-3 bg-slate-100 rounded-lg">
                <p className="text-sm text-slate-600">
                  <strong>{editItems.filter(item => item.remove).length}</strong> item(s) will be removed.
                  {Object.values(itemsToMarkPending).filter(Boolean).length > 0 && (
                    <> <strong>{Object.values(itemsToMarkPending).filter(Boolean).length}</strong> will be marked as pending.</>
                  )}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveEditedItems} 
              disabled={saving}
              data-testid="save-edited-items"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
