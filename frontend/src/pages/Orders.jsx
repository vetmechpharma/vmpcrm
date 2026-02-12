import { useState, useEffect } from 'react';
import { ordersAPI, transportAPI, pendingItemsAPI, itemsAPI } from '../lib/api';
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
  CreditCard,
  Package,
  FileText,
  XCircle,
  Box,
  Edit,
  AlertTriangle,
  Minus,
  Search
} from 'lucide-react';
import { formatDateTime } from '../lib/utils';

const STATUS_CONFIG = {
  pending: { color: 'bg-amber-100 text-amber-700', label: 'Pending' },
  confirmed: { color: 'bg-blue-100 text-blue-700', label: 'Confirmed' },
  ready_to_despatch: { color: 'bg-purple-100 text-purple-700', label: 'Ready to Despatch' },
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
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showTransportModal, setShowTransportModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingItemsForOrder, setPendingItemsForOrder] = useState([]);
  const [existingDoctor, setExistingDoctor] = useState(null);
  const [lookingUpDoctor, setLookingUpDoctor] = useState(false);
  const [itemSearch, setItemSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState([]);
  const [searchingCustomers, setSearchingCustomers] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  // Transport form
  const [newTransport, setNewTransport] = useState({
    name: '',
    tracking_url_template: '',
    is_local: false,
    contact_number: '',
    alternate_number: ''
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

  // New order form
  const [newOrderForm, setNewOrderForm] = useState({
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    customer_address: '',
    customer_type: 'doctor',
    customer_id: null,
    items: []
  });

  // Order update form with new fields
  const [updateForm, setUpdateForm] = useState({
    status: 'pending',
    transport_id: '',
    transport_name: '',
    tracking_number: '',
    tracking_url: '',
    delivery_station: '',
    payment_mode: '',
    boxes_count: 0,
    cans_count: 0,
    bags_count: 0,
    invoice_number: '',
    invoice_date: '',
    invoice_value: '',
    cancellation_reason: ''
  });

  useEffect(() => {
    fetchOrders();
    fetchTransports();
    fetchItems();
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

  const fetchItems = async () => {
    try {
      const response = await itemsAPI.getAll({ status: 'active' });
      setItems(response.data);
    } catch (error) {
      console.error('Failed to fetch items');
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
        transport_name: transport.name
      });
    }
  };

  const handleTrackingNumberChange = (value) => {
    setUpdateForm({
      ...updateForm,
      tracking_number: value
    });
  };

  const handleSaveOrder = async () => {
    if (updateForm.status === 'cancelled' && !updateForm.cancellation_reason.trim()) {
      toast.error('Please provide a reason for cancellation');
      return;
    }
    
    if (updateForm.status === 'ready_to_despatch') {
      if (!updateForm.transport_id) {
        toast.error('Please select a transport');
        return;
      }
      if (!updateForm.payment_mode) {
        toast.error('Please select a payment mode');
        return;
      }
    }
    
    if (updateForm.status === 'shipped') {
      const transport = transports.find(t => t.id === (updateForm.transport_id || selectedOrder?.transport_id));
      const isLocal = transport?.is_local || selectedOrder?.transport_name === 'Local Supply';
      if (!isLocal && !updateForm.tracking_number?.trim() && !selectedOrder?.tracking_number) {
        toast.error('Please enter tracking number');
        return;
      }
    }
    
    setSaving(true);
    try {
      await ordersAPI.updateStatus(selectedOrder.id, updateForm);
      const statusMessages = {
        'ready_to_despatch': 'marked ready to despatch',
        'shipped': 'shipped',
        'delivered': 'delivered',
        'cancelled': 'cancelled',
        'confirmed': 'confirmed'
      };
      toast.success(`Order ${statusMessages[updateForm.status] || 'updated'} successfully!`);
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
      setNewTransport({ name: '', tracking_url_template: '', is_local: false, contact_number: '', alternate_number: '' });
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
    setEditItems(order.items.map(item => ({ ...item, remove: false, originalQty: item.quantity })));
    setItemsToMarkPending({});
    setShowEditModal(true);
  };

  const handleQuantityChange = (index, newQty) => {
    const qty = parseInt(newQty) || 0;
    if (qty < 0) return;
    
    const newItems = [...editItems];
    newItems[index].quantity = qty;
    newItems[index].remove = qty === 0;
    setEditItems(newItems);
  };

  const handleMarkOutOfStock = (index) => {
    const newItems = [...editItems];
    newItems[index].remove = true;
    newItems[index].quantity = 0;
    setEditItems(newItems);
    
    // Auto-check "mark as pending"
    setItemsToMarkPending(prev => ({
      ...prev,
      [index]: true
    }));
  };

  const handleRestoreItem = (index) => {
    const newItems = [...editItems];
    newItems[index].remove = false;
    newItems[index].quantity = newItems[index].originalQty;
    setEditItems(newItems);
    
    setItemsToMarkPending(prev => ({
      ...prev,
      [index]: false
    }));
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
      const remainingItems = editItems.filter(item => !item.remove && item.quantity > 0);
      
      const pendingItems = editItems
        .filter((item, index) => item.remove && itemsToMarkPending[index])
        .map(item => ({
          item_id: item.item_id,
          item_code: item.item_code,
          item_name: item.item_name,
          quantity: item.originalQty || item.quantity
        }));
      
      await ordersAPI.updateItems(selectedOrder.id, {
        items: remainingItems,
        pending_items: pendingItems.length > 0 ? pendingItems : null
      });
      
      const removedCount = editItems.filter(item => item.remove).length;
      const pendingCount = pendingItems.length;
      const modifiedCount = editItems.filter(item => !item.remove && item.quantity !== item.originalQty).length;
      
      let message = 'Order items updated';
      if (modifiedCount > 0) message += `, ${modifiedCount} qty changed`;
      if (removedCount > 0) message += `, ${removedCount} removed`;
      if (pendingCount > 0) message += `, ${pendingCount} marked pending`;
      
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
    
    setLookingUpDoctor(true);
    try {
      const response = await ordersAPI.lookupDoctor(order.id);
      if (response.data.found) {
        setExistingDoctor(response.data.doctor);
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

  // Add Order Functions
  const openAddModal = () => {
    setNewOrderForm({
      doctor_name: '',
      doctor_phone: '',
      doctor_email: '',
      doctor_address: '',
      items: [],
      link_to_doctor: false
    });
    setItemSearch('');
    setShowAddModal(true);
  };

  const addItemToOrder = (item) => {
    const existingIndex = newOrderForm.items.findIndex(i => i.item_id === item.id);
    if (existingIndex >= 0) {
      const newItems = [...newOrderForm.items];
      newItems[existingIndex].quantity += 1;
      setNewOrderForm({ ...newOrderForm, items: newItems });
    } else {
      setNewOrderForm({
        ...newOrderForm,
        items: [...newOrderForm.items, {
          item_id: item.id,
          item_code: item.item_code,
          item_name: item.item_name,
          quantity: 1,
          mrp: item.mrp || item.rate || 0,
          rate: item.rate || 0,
          gst: item.gst || 0
        }]
      });
    }
    setItemSearch('');
  };

  const updateOrderItemQty = (index, qty) => {
    const newQty = parseInt(qty) || 0;
    if (newQty <= 0) {
      removeOrderItem(index);
      return;
    }
    const newItems = [...newOrderForm.items];
    newItems[index].quantity = newQty;
    setNewOrderForm({ ...newOrderForm, items: newItems });
  };

  const removeOrderItem = (index) => {
    const newItems = newOrderForm.items.filter((_, i) => i !== index);
    setNewOrderForm({ ...newOrderForm, items: newItems });
  };

  const handleCreateOrder = async () => {
    if (!newOrderForm.doctor_name || !newOrderForm.doctor_phone) {
      toast.error('Customer name and phone are required');
      return;
    }
    if (newOrderForm.items.length === 0) {
      toast.error('Please add at least one item');
      return;
    }

    setSaving(true);
    try {
      // Convert quantity to string for API
      const orderData = {
        ...newOrderForm,
        items: newOrderForm.items.map(item => ({
          ...item,
          quantity: String(item.quantity)
        }))
      };
      const response = await ordersAPI.create(orderData);
      toast.success(`Order ${response.data.order_number} created successfully!`);
      setShowAddModal(false);
      fetchOrders();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create order');
    } finally {
      setSaving(false);
    }
  };

  const filteredItems = items.filter(item => 
    item.item_name?.toLowerCase().includes(itemSearch.toLowerCase()) ||
    item.item_code?.toLowerCase().includes(itemSearch.toLowerCase())
  );

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
          <Button onClick={openAddModal} data-testid="add-order-btn">
            <Plus className="w-4 h-4 mr-2" />
            Add Order
          </Button>
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
                            <p className="font-medium text-slate-900">{order.doctor_name || 'Unknown'}</p>
                            <p className="text-sm text-slate-500">{order.doctor_phone}</p>
                          </div>
                        </td>
                        <td><span className="text-sm">{order.items?.length || 0} items</span></td>
                        <td><Badge className={statusConfig.color}>{statusConfig.label}</Badge></td>
                        <td>
                          {order.transport_name ? (
                            <div>
                              <p className="text-sm font-medium">{order.transport_name}</p>
                              {order.tracking_number && <p className="text-xs text-slate-500">{order.tracking_number}</p>}
                            </div>
                          ) : <span className="text-slate-400">-</span>}
                        </td>
                        <td>
                          {order.payment_mode ? (
                            <Badge className={order.payment_mode === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}>
                              {order.payment_mode === 'paid' ? 'Paid' : 'To Pay'}
                            </Badge>
                          ) : <span className="text-slate-400">-</span>}
                        </td>
                        <td><span className="text-sm text-slate-500">{formatDateTime(order.created_at)}</span></td>
                        <td>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => viewOrderDetails(order)} title="View Details">
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => openEditModal(order)} title="Edit Items">
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => openUpdateModal(order)} title="Update Status">
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
              <p className="text-sm">Click "Add Order" to create a new order</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Order Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" /> Create New Order
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Customer Details */}
            <div className="space-y-4">
              <h4 className="font-medium flex items-center gap-2">
                <User className="w-4 h-4" /> Customer Details
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input
                    value={newOrderForm.doctor_name}
                    onChange={(e) => setNewOrderForm({...newOrderForm, doctor_name: e.target.value})}
                    placeholder="Customer name"
                    data-testid="new-order-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone *</Label>
                  <Input
                    value={newOrderForm.doctor_phone}
                    onChange={(e) => setNewOrderForm({...newOrderForm, doctor_phone: e.target.value})}
                    placeholder="Phone number"
                    data-testid="new-order-phone"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={newOrderForm.doctor_email}
                    onChange={(e) => setNewOrderForm({...newOrderForm, doctor_email: e.target.value})}
                    placeholder="Email address"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Address</Label>
                  <Input
                    value={newOrderForm.doctor_address}
                    onChange={(e) => setNewOrderForm({...newOrderForm, doctor_address: e.target.value})}
                    placeholder="Delivery address"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="link-doctor"
                  checked={newOrderForm.link_to_doctor}
                  onCheckedChange={(c) => setNewOrderForm({...newOrderForm, link_to_doctor: c})}
                />
                <label htmlFor="link-doctor" className="text-sm cursor-pointer">
                  Create/link doctor record
                </label>
              </div>
            </div>

            {/* Add Items */}
            <div className="space-y-4 border-t pt-4">
              <h4 className="font-medium flex items-center gap-2">
                <Package className="w-4 h-4" /> Order Items
              </h4>
              
              {/* Item Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                  placeholder="Search items by name or code..."
                  className="pl-10"
                  data-testid="item-search"
                />
              </div>

              {/* Search Results */}
              {itemSearch && (
                <div className="border rounded-lg max-h-40 overflow-y-auto">
                  {filteredItems.length > 0 ? (
                    filteredItems.slice(0, 10).map((item) => (
                      <div
                        key={item.id}
                        className="p-2 hover:bg-slate-50 cursor-pointer flex justify-between items-center border-b last:border-0"
                        onClick={() => addItemToOrder(item)}
                      >
                        <div>
                          <p className="font-medium text-sm">{item.item_name}</p>
                          <p className="text-xs text-slate-500">{item.item_code} | ₹{item.rate}</p>
                        </div>
                        <Plus className="w-4 h-4 text-green-600" />
                      </div>
                    ))
                  ) : (
                    <p className="p-3 text-sm text-slate-400 text-center">No items found</p>
                  )}
                </div>
              )}

              {/* Selected Items */}
              <div className="space-y-2">
                {newOrderForm.items.length > 0 ? (
                  newOrderForm.items.map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium">{item.item_name}</p>
                        <p className="text-sm text-slate-500">{item.item_code} | ₹{item.rate}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateOrderItemQty(index, item.quantity - 1)}>
                          <Minus className="w-3 h-3" />
                        </Button>
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateOrderItemQty(index, e.target.value)}
                          className="w-16 h-8 text-center"
                          min="1"
                        />
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateOrderItemQty(index, item.quantity + 1)}>
                          <Plus className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => removeOrderItem(index)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center py-8 text-slate-400">Search and add items above</p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button onClick={handleCreateOrder} disabled={saving} data-testid="create-order-btn">
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Create Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Order Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Order Details - {selectedOrder?.order_number}</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-6">
              <Card>
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <CardTitle className="text-base">Customer Information</CardTitle>
                  <Button variant="outline" size="sm" onClick={() => { setShowDetailModal(false); openCustomerModal(selectedOrder); }} data-testid="edit-customer-btn">
                    <Edit className="w-3 h-3 mr-1" /> Edit
                  </Button>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <User className="w-4 h-4 text-slate-400" />
                    <span className="font-medium">{selectedOrder.doctor_name || 'Unknown'}</span>
                    {selectedOrder.doctor_id && <Badge variant="outline" className="text-xs">Linked</Badge>}
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

              {selectedOrder.transport_name && (
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-base">Shipping Details</CardTitle></CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex items-center gap-2"><Truck className="w-4 h-4 text-slate-400" /><span className="font-medium">{selectedOrder.transport_name}</span></div>
                    {selectedOrder.tracking_number && <div className="flex items-center gap-2"><span className="text-slate-500">Tracking:</span><span>{selectedOrder.tracking_number}</span></div>}
                    {selectedOrder.delivery_station && <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-slate-400" /><span>{selectedOrder.delivery_station}</span></div>}
                    {selectedOrder.payment_mode && (
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-slate-400" />
                        <Badge className={selectedOrder.payment_mode === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}>
                          {selectedOrder.payment_mode === 'paid' ? 'Paid' : 'To Pay'}
                        </Badge>
                      </div>
                    )}
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
                    {selectedOrder.invoice_number && (
                      <div className="pt-2 border-t space-y-1">
                        <div className="flex items-center gap-2"><FileText className="w-4 h-4 text-slate-400" /><span className="font-medium">Invoice: {selectedOrder.invoice_number}</span></div>
                        {selectedOrder.invoice_date && <div className="text-slate-500 pl-6">Date: {selectedOrder.invoice_date}</div>}
                        {selectedOrder.invoice_value && <div className="text-slate-500 pl-6">Value: ₹{selectedOrder.invoice_value?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {selectedOrder.status === 'cancelled' && selectedOrder.cancellation_reason && (
                <Card className="border-red-200 bg-red-50">
                  <CardHeader className="pb-3"><CardTitle className="text-base text-red-700 flex items-center gap-2"><XCircle className="w-4 h-4" /> Cancellation Reason</CardTitle></CardHeader>
                  <CardContent><p className="text-sm text-red-600">{selectedOrder.cancellation_reason}</p></CardContent>
                </Card>
              )}

              {pendingItemsForOrder.length > 0 && (
                <Card className="border-orange-200 bg-orange-50">
                  <CardHeader className="pb-3"><CardTitle className="text-base text-orange-700 flex items-center gap-2"><Clock className="w-4 h-4" /> Pending Items for this Customer</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {pendingItemsForOrder.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-2 bg-white rounded border border-orange-200">
                        <div>
                          <p className="font-medium text-sm">{item.item_name}</p>
                          <p className="text-xs text-slate-500">Qty: {item.quantity} | From: {item.original_order_number}</p>
                        </div>
                        <Badge className="bg-orange-100 text-orange-700 text-xs">Pending</Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base">Submission Details</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-slate-400" /><span>Submitted: {formatDateTime(selectedOrder.created_at)}</span></div>
                  {selectedOrder.ip_address && <div className="flex items-center gap-2"><Monitor className="w-4 h-4 text-slate-400" /><span>IP: {selectedOrder.ip_address}</span></div>}
                  {selectedOrder.location && <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-slate-400" /><span>Location: {selectedOrder.location}</span></div>}
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
            <div className="space-y-2">
              <Label>Order Status</Label>
              <Select value={updateForm.status} onValueChange={(v) => setUpdateForm({...updateForm, status: v})}>
                <SelectTrigger data-testid="order-status-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {updateForm.status === 'ready_to_despatch' && (
              <>
                <div className="border-t pt-4 mt-4">
                  <h4 className="font-medium flex items-center gap-2 mb-3"><Truck className="w-4 h-4" /> Transport Details</h4>
                  <div className="space-y-2 mb-3">
                    <Label>Transport *</Label>
                    <Select value={updateForm.transport_id} onValueChange={handleTransportChange}>
                      <SelectTrigger data-testid="transport-select"><SelectValue placeholder="Select transport" /></SelectTrigger>
                      <SelectContent>
                        {transports.map((t) => (<SelectItem key={t.id} value={t.id}>{t.name} {t.is_local && '(Local)'}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 mb-3">
                    <Label>Delivery Station</Label>
                    <Input data-testid="delivery-station-input" value={updateForm.delivery_station} onChange={(e) => setUpdateForm({...updateForm, delivery_station: e.target.value})} placeholder="Enter delivery station" />
                  </div>
                  <div className="space-y-2">
                    <Label>Payment Mode *</Label>
                    <Select value={updateForm.payment_mode} onValueChange={(v) => setUpdateForm({...updateForm, payment_mode: v})}>
                      <SelectTrigger data-testid="payment-mode-select"><SelectValue placeholder="Select payment mode" /></SelectTrigger>
                      <SelectContent>{PAYMENT_MODES.map((mode) => (<SelectItem key={mode.value} value={mode.value}>{mode.label}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="border-t pt-4 mt-4">
                  <h4 className="font-medium flex items-center gap-2 mb-3"><Box className="w-4 h-4" /> Package Details</h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-2"><Label>Boxes</Label><Input data-testid="boxes-count-input" type="number" min="0" value={updateForm.boxes_count} onChange={(e) => setUpdateForm({...updateForm, boxes_count: parseInt(e.target.value) || 0})} /></div>
                    <div className="space-y-2"><Label>Cans</Label><Input data-testid="cans-count-input" type="number" min="0" value={updateForm.cans_count} onChange={(e) => setUpdateForm({...updateForm, cans_count: parseInt(e.target.value) || 0})} /></div>
                    <div className="space-y-2"><Label>Bags</Label><Input data-testid="bags-count-input" type="number" min="0" value={updateForm.bags_count} onChange={(e) => setUpdateForm({...updateForm, bags_count: parseInt(e.target.value) || 0})} /></div>
                  </div>
                </div>
                <div className="border-t pt-4 mt-4">
                  <h4 className="font-medium flex items-center gap-2 mb-3"><FileText className="w-4 h-4" /> Invoice Details</h4>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="space-y-2"><Label>Invoice Number</Label><Input data-testid="invoice-number-input" value={updateForm.invoice_number} onChange={(e) => setUpdateForm({...updateForm, invoice_number: e.target.value})} placeholder="INV-001" /></div>
                    <div className="space-y-2"><Label>Invoice Date</Label><Input data-testid="invoice-date-input" type="date" value={updateForm.invoice_date} onChange={(e) => setUpdateForm({...updateForm, invoice_date: e.target.value})} /></div>
                  </div>
                  <div className="space-y-2"><Label>Invoice Value (₹)</Label><Input data-testid="invoice-value-input" type="number" min="0" step="0.01" value={updateForm.invoice_value} onChange={(e) => setUpdateForm({...updateForm, invoice_value: parseFloat(e.target.value) || ''})} /></div>
                </div>
              </>
            )}

            {updateForm.status === 'shipped' && (
              <div className="border-t pt-4 mt-4">
                <h4 className="font-medium flex items-center gap-2 mb-3"><Truck className="w-4 h-4" /> Shipping Details</h4>
                {selectedOrder?.transport_name && (
                  <div className="bg-slate-50 p-3 rounded-lg mb-3">
                    <p className="text-sm"><span className="text-slate-500">Transport:</span> <span className="font-medium">{selectedOrder.transport_name}</span></p>
                    {selectedOrder.delivery_station && <p className="text-sm"><span className="text-slate-500">Delivery Station:</span> {selectedOrder.delivery_station}</p>}
                    {selectedOrder.payment_mode && <p className="text-sm"><span className="text-slate-500">Payment:</span> {selectedOrder.payment_mode === 'paid' ? 'Paid' : 'To Pay'}</p>}
                  </div>
                )}
                {!selectedOrder?.transport_name && (
                  <div className="space-y-2 mb-3">
                    <Label>Transport *</Label>
                    <Select value={updateForm.transport_id} onValueChange={handleTransportChange}>
                      <SelectTrigger data-testid="transport-select"><SelectValue placeholder="Select transport" /></SelectTrigger>
                      <SelectContent>{transports.map((t) => (<SelectItem key={t.id} value={t.id}>{t.name} {t.is_local && '(Local)'}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Tracking Number {!isLocalSupply && '*'}</Label>
                  <Input data-testid="tracking-number-input" value={updateForm.tracking_number} onChange={(e) => handleTrackingNumberChange(e.target.value)} placeholder="Enter tracking number" />
                </div>
              </div>
            )}

            {updateForm.status === 'cancelled' && (
              <div className="border-t pt-4 mt-4">
                <h4 className="font-medium flex items-center gap-2 mb-3 text-red-600"><XCircle className="w-4 h-4" /> Cancellation Details</h4>
                <div className="space-y-2">
                  <Label>Reason for Cancellation *</Label>
                  <Textarea data-testid="cancellation-reason-input" value={updateForm.cancellation_reason} onChange={(e) => setUpdateForm({...updateForm, cancellation_reason: e.target.value})} placeholder="Enter reason for cancellation..." rows={3} className="resize-none" />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUpdateModal(false)}>Cancel</Button>
            <Button onClick={handleSaveOrder} disabled={saving} data-testid="save-order-btn" className={updateForm.status === 'cancelled' ? 'bg-red-600 hover:bg-red-700' : updateForm.status === 'ready_to_despatch' ? 'bg-purple-600 hover:bg-purple-700' : ''}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {updateForm.status === 'ready_to_despatch' ? 'Ready to Despatch' : updateForm.status === 'shipped' ? 'Ship Order' : updateForm.status === 'cancelled' ? 'Cancel Order' : 'Update'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transport Management Modal */}
      <Dialog open={showTransportModal} onOpenChange={setShowTransportModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Manage Transports</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Add New Transport</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2"><Label>Transport Name *</Label><Input value={newTransport.name} onChange={(e) => setNewTransport({...newTransport, name: e.target.value})} placeholder="e.g., Blue Dart, DTDC, Local Supply" /></div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="is_local" checked={newTransport.is_local} onChange={(e) => setNewTransport({...newTransport, is_local: e.target.checked, tracking_url_template: ''})} className="rounded" />
                  <label htmlFor="is_local" className="text-sm">Local Supply (no tracking)</label>
                </div>
                {!newTransport.is_local && (<div className="space-y-2"><Label>Transport URL</Label><Input value={newTransport.tracking_url_template} onChange={(e) => setNewTransport({...newTransport, tracking_url_template: e.target.value})} placeholder="https://transport-website.com" /></div>)}
                <div className="space-y-2"><Label>Incharge Contact Number</Label><Input value={newTransport.contact_number} onChange={(e) => setNewTransport({...newTransport, contact_number: e.target.value})} placeholder="Primary contact number" /></div>
                <div className="space-y-2"><Label>Alternate Number</Label><Input value={newTransport.alternate_number} onChange={(e) => setNewTransport({...newTransport, alternate_number: e.target.value})} placeholder="Alternate contact number (optional)" /></div>
                <Button onClick={handleAddTransport} disabled={saving} className="w-full">{saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}<Plus className="w-4 h-4 mr-2" />Add Transport</Button>
              </CardContent>
            </Card>
            <div className="space-y-2">
              <Label>Existing Transports</Label>
              {transports.length > 0 ? (
                <div className="space-y-2">
                  {transports.map((t) => (
                    <div key={t.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{t.name}</p>
                        {t.is_local ? <p className="text-xs text-slate-500">Local Supply</p> : t.tracking_url_template ? <p className="text-xs text-slate-500 truncate max-w-[250px]">{t.tracking_url_template}</p> : null}
                        {(t.contact_number || t.alternate_number) && <p className="text-xs text-slate-600 mt-1">📞 {t.contact_number || '-'}{t.alternate_number && ` / ${t.alternate_number}`}</p>}
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteTransport(t.id)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-slate-400">No transports added yet</p>}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Order Items Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Edit className="w-5 h-5" />Edit Order Items - {selectedOrder?.order_number}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                <div className="text-sm text-amber-700">
                  <p className="font-medium">Edit quantities or mark items as out of stock</p>
                  <p>Check "Mark as Pending" to track for customer follow-up.</p>
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              {editItems.map((item, index) => (
                <div key={index} className={`p-4 rounded-lg border ${item.remove ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-slate-800">{item.item_name}</p>
                      <p className="text-sm text-slate-500">{item.item_code}</p>
                    </div>
                    {!item.remove ? (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleQuantityChange(index, item.quantity - 1)}>
                            <Minus className="w-3 h-3" />
                          </Button>
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => handleQuantityChange(index, e.target.value)}
                            className="w-16 h-8 text-center"
                            min="0"
                          />
                          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleQuantityChange(index, item.quantity + 1)}>
                            <Plus className="w-3 h-3" />
                          </Button>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleMarkOutOfStock(index)}
                          className="text-orange-600 border-orange-300 hover:bg-orange-50"
                        >
                          Out of Stock
                        </Button>
                      </div>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => handleRestoreItem(index)} className="text-green-600 border-green-300 hover:bg-green-50">
                        Restore
                      </Button>
                    )}
                  </div>
                  
                  {item.remove && (
                    <div className="mt-3 pt-3 border-t border-red-200">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`pending-${index}`}
                          checked={itemsToMarkPending[index] || false}
                          onCheckedChange={(checked) => handleMarkPending(index, checked)}
                        />
                        <label htmlFor={`pending-${index}`} className="text-sm text-red-700 cursor-pointer">
                          Mark as Pending (for customer follow-up)
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            {(editItems.filter(item => item.remove).length > 0 || editItems.some((item, i) => !item.remove && item.quantity !== item.originalQty)) && (
              <div className="mt-4 p-3 bg-slate-100 rounded-lg">
                <p className="text-sm text-slate-600">
                  {editItems.filter(item => !item.remove && item.quantity !== item.originalQty).length > 0 && (
                    <><strong>{editItems.filter(item => !item.remove && item.quantity !== item.originalQty).length}</strong> qty changed. </>
                  )}
                  {editItems.filter(item => item.remove).length > 0 && (
                    <><strong>{editItems.filter(item => item.remove).length}</strong> item(s) marked out of stock. </>
                  )}
                  {Object.values(itemsToMarkPending).filter(Boolean).length > 0 && (
                    <><strong>{Object.values(itemsToMarkPending).filter(Boolean).length}</strong> will be tracked as pending.</>
                  )}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)}>Cancel</Button>
            <Button onClick={handleSaveEditedItems} disabled={saving} data-testid="save-edited-items">
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Customer Modal */}
      <Dialog open={showCustomerModal} onOpenChange={setShowCustomerModal}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><User className="w-5 h-5" />Edit Customer - {selectedOrder?.order_number}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            {lookingUpDoctor ? (
              <div className="flex items-center justify-center py-4"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /><span className="ml-2 text-slate-500">Looking up customer...</span></div>
            ) : (
              <>
                {existingDoctor && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                    <div className="flex items-start gap-2">
                      <User className="w-5 h-5 text-green-600 mt-0.5" />
                      <div className="text-sm text-green-700">
                        <p className="font-medium">Existing Doctor Found!</p>
                        <p>{existingDoctor.name} ({existingDoctor.customer_code})</p>
                        <p className="text-xs text-green-600">{existingDoctor.phone}</p>
                      </div>
                    </div>
                  </div>
                )}
                <div className="space-y-3">
                  <div className="space-y-2"><Label>Doctor/Customer Name</Label><Input value={customerForm.doctor_name} onChange={(e) => setCustomerForm({...customerForm, doctor_name: e.target.value})} placeholder="Enter name" data-testid="customer-name-input" /></div>
                  <div className="space-y-2"><Label>Phone Number</Label><Input value={customerForm.doctor_phone} onChange={(e) => setCustomerForm({...customerForm, doctor_phone: e.target.value})} placeholder="Enter phone number" data-testid="customer-phone-input" /></div>
                  <div className="space-y-2"><Label>Email</Label><Input type="email" value={customerForm.doctor_email} onChange={(e) => setCustomerForm({...customerForm, doctor_email: e.target.value})} placeholder="Enter email" data-testid="customer-email-input" /></div>
                  <div className="space-y-2"><Label>Address</Label><Textarea value={customerForm.doctor_address} onChange={(e) => setCustomerForm({...customerForm, doctor_address: e.target.value})} placeholder="Enter address" rows={2} data-testid="customer-address-input" /></div>
                  <div className="border-t pt-4 mt-4">
                    <div className="flex items-center gap-2">
                      <Checkbox id="link-to-doctor" checked={customerForm.link_to_doctor} onCheckedChange={(checked) => setCustomerForm({...customerForm, link_to_doctor: checked})} />
                      <label htmlFor="link-to-doctor" className="text-sm cursor-pointer">{existingDoctor ? 'Update existing doctor record' : 'Create new doctor record & link to this order'}</label>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 ml-6">{existingDoctor ? 'This will update the doctor\'s information in the Doctors page' : 'This will create a new doctor with a customer code (VMP-XXXX)'}</p>
                  </div>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCustomerModal(false)}>Cancel</Button>
            <Button onClick={handleSaveCustomer} disabled={saving || lookingUpDoctor} data-testid="save-customer-btn">{saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Save Customer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
