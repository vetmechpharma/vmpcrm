import { useState, useEffect, useRef } from 'react';
import { ordersAPI, transportAPI, pendingItemsAPI, itemsAPI, doctorsAPI, medicalsAPI, agenciesAPI } from '../lib/api';
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
import { useReactToPrint } from 'react-to-print';
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
  Search,
  Printer,
  MessageSquare,
  ArrowRightLeft
} from 'lucide-react';
import { formatDateTime } from '../lib/utils';

const STATUS_CONFIG = {
  pending: { color: 'bg-amber-100 text-amber-700', label: 'Pending' },
  confirmed: { color: 'bg-blue-100 text-blue-700', label: 'Confirmed' },
  ready_to_despatch: { color: 'bg-purple-100 text-purple-700', label: 'Ready to Despatch' },
  shipped: { color: 'bg-indigo-100 text-indigo-700', label: 'Shipped' },
  delivered: { color: 'bg-emerald-100 text-emerald-700', label: 'Delivered' },
  cancelled: { color: 'bg-red-100 text-red-700', label: 'Cancelled' },
  transferred: { color: 'bg-teal-100 text-teal-700', label: 'Transferred' },
};

const PAYMENT_MODES = [
  { value: 'to_pay', label: 'To Pay' },
  { value: 'paid', label: 'Paid' },
];

const API_URL = process.env.REACT_APP_BACKEND_URL;

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
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingItemsForOrder, setPendingItemsForOrder] = useState([]);
  const [existingDoctor, setExistingDoctor] = useState(null);
  const [lookingUpDoctor, setLookingUpDoctor] = useState(false);
  const [itemSearch, setItemSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState([]);
  const [searchingCustomers, setSearchingCustomers] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerPendingItems, setCustomerPendingItems] = useState([]);
  const [companySettings, setCompanySettings] = useState(null);
  
  // Transfer to agency
  const [agencies, setAgencies] = useState([]);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedAgency, setSelectedAgency] = useState('');
  
  const printRef = useRef();

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
  const [editItemSearch, setEditItemSearch] = useState('');

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
    payment_amount: '',
    expense_paid_by: '',
    expense_account: 'company_account',
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
    fetchCompanySettings();
    fetchAgencies();
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

  const fetchCompanySettings = async () => {
    try {
      const response = await fetch(`${API_URL}/api/public/company-settings`);
      if (response.ok) {
        const data = await response.json();
        setCompanySettings(data);
      }
    } catch (error) {
      console.error('Failed to fetch company settings');
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

  const fetchAgencies = async () => {
    try {
      const response = await agenciesAPI.getAll();
      setAgencies(response.data);
    } catch (error) {
      console.error('Failed to fetch agencies');
    }
  };

  const handleTransferOrder = async () => {
    if (!selectedAgency || !selectedOrder) return;
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/orders/${selectedOrder.id}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ agency_id: selectedAgency }),
      });
      if (!res.ok) throw new Error('Transfer failed');
      toast.success('Order transferred successfully! WhatsApp notifications sent.');
      setShowTransferModal(false);
      setSelectedAgency('');
      fetchOrders();
    } catch {
      toast.error('Failed to transfer order');
    } finally { setSaving(false); }
  };

  const openUpdateModal = async (order) => {
    setSelectedOrder(order);
    
    // Initialize form with order data
    let deliveryStation = order.delivery_station || '';
    let transportId = order.transport_id || '';
    let transportName = order.transport_name || '';
    
    // If order doesn't have delivery station/transport set, try to get from customer
    if ((!deliveryStation || !transportId) && order.doctor_id) {
      try {
        // Determine customer type from order
        let customerData = null;
        if (order.doctor_customer_code?.startsWith('VMP-D')) {
          const res = await doctorsAPI.getOne(order.doctor_id);
          customerData = res.data;
        } else if (order.doctor_customer_code?.startsWith('VMP-M')) {
          const res = await medicalsAPI.getOne(order.doctor_id);
          customerData = res.data;
        } else if (order.doctor_customer_code?.startsWith('VMP-A')) {
          const res = await agenciesAPI.getOne(order.doctor_id);
          customerData = res.data;
        }
        
        if (customerData) {
          // Use customer's delivery preferences if order doesn't have them
          if (!deliveryStation && customerData.delivery_station) {
            deliveryStation = customerData.delivery_station;
          }
          if (!transportId && customerData.transport_id) {
            transportId = customerData.transport_id;
            // Find transport name
            const transport = transports.find(t => t.id === transportId);
            transportName = transport?.name || '';
          }
        }
      } catch (error) {
        console.error('Failed to fetch customer preferences:', error);
      }
    }
    
    setUpdateForm({
      status: order.status,
      transport_id: transportId,
      transport_name: transportName,
      tracking_number: order.tracking_number || '',
      tracking_url: order.tracking_url || '',
      delivery_station: deliveryStation,
      payment_mode: order.payment_mode || '',
      payment_amount: order.payment_amount || '',
      expense_paid_by: order.expense_paid_by || '',
      expense_account: order.expense_account || 'company_account',
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
      // Sanitize form data - convert empty strings to null for numeric fields
      const sanitizedData = {
        ...updateForm,
        payment_amount: updateForm.payment_amount === '' ? null : updateForm.payment_amount,
        invoice_value: updateForm.invoice_value === '' ? null : updateForm.invoice_value,
        boxes_count: updateForm.boxes_count || 0,
        cans_count: updateForm.cans_count || 0,
        bags_count: updateForm.bags_count || 0,
      };
      await ordersAPI.updateStatus(selectedOrder.id, sanitizedData);
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

  const handleDeleteOrder = async (orderId) => {
    if (!window.confirm('Are you sure you want to delete this order? This action cannot be undone.')) return;
    try {
      await ordersAPI.delete(orderId);
      toast.success('Order deleted successfully');
      fetchOrders();
      setShowDetailModal(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete order');
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
    const cType = order.customer_type || 'doctor';
    setEditItems(order.items.map(item => {
      // Look up full item data for role-based pricing
      const fullItem = items.find(i => i.id === item.item_id);
      let defaultRate = 0;
      let offer = '';
      let special_offer = '';
      if (fullItem) {
        if (cType === 'medical') defaultRate = fullItem.rate_medicals || fullItem.rate || 0;
        else if (cType === 'agency') defaultRate = fullItem.rate_agencies || fullItem.rate || 0;
        else defaultRate = fullItem.rate_doctors || fullItem.rate || 0;
        offer = fullItem[`offer_${cType}s`] || fullItem.offer_doctors || fullItem.offer || '';
        special_offer = fullItem[`special_offer_${cType}s`] || fullItem.special_offer_doctors || fullItem.special_offer || '';
      }
      return {
        ...item,
        remove: false,
        originalQty: item.quantity,
        originalRate: item.rate || 0,
        editQty: item.quantity,
        defaultRate,
        offer,
        special_offer
      };
    }));
    setItemsToMarkPending({});
    setEditItemSearch('');
    // Fetch pending items for this customer
    if (order.doctor_phone) {
      pendingItemsAPI.getByDoctor(order.doctor_phone)
        .then(res => setPendingItemsForOrder(res.data || []))
        .catch(() => setPendingItemsForOrder([]));
    } else {
      setPendingItemsForOrder([]);
    }
    setShowEditModal(true);
  };

  const handleQuantityChange = (index, newQty) => {
    const newItems = [...editItems];
    newItems[index].editQty = newQty;
    newItems[index].quantity = newQty;
    const isZero = newQty === '' || newQty === '0';
    newItems[index].remove = isZero;
    setEditItems(newItems);
  };

  const handleEditItemRate = (index, rate) => {
    const newItems = [...editItems];
    newItems[index].rate = parseFloat(rate) || 0;
    setEditItems(newItems);
  };

  const handleMarkOutOfStock = (index) => {
    const newItems = [...editItems];
    newItems[index].remove = true;
    newItems[index].quantity = '0';
    newItems[index].editQty = '0';
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
    newItems[index].editQty = newItems[index].originalQty;
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

  const handleDeleteEditItem = (index) => {
    const newItems = editItems.filter((_, i) => i !== index);
    setEditItems(newItems);
    // Reindex pending items
    const newPending = {};
    Object.entries(itemsToMarkPending).forEach(([key, val]) => {
      const k = parseInt(key);
      if (k < index) newPending[k] = val;
      else if (k > index) newPending[k - 1] = val;
    });
    setItemsToMarkPending(newPending);
  };

  const handleAddEditItem = (item) => {
    const existingIndex = editItems.findIndex(i => i.item_id === item.id);
    if (existingIndex >= 0) {
      // Increment quantity of existing item
      const newItems = [...editItems];
      const currentQty = String(newItems[existingIndex].quantity || newItems[existingIndex].editQty || '1');
      const qtyParts = currentQty.split('+').map(p => parseInt(p.trim()) || 0);
      const newQty = (qtyParts[0] || 0) + 1;
      newItems[existingIndex].quantity = qtyParts[1] ? `${newQty}+${qtyParts[1]}` : String(newQty);
      newItems[existingIndex].editQty = newItems[existingIndex].quantity;
      newItems[existingIndex].remove = false;
      setEditItems(newItems);
      toast.success(`Increased qty for ${item.item_name}`);
    } else {
      const cType = selectedOrder?.customer_type || 'doctor';
      let defaultRate = 0;
      let offer = '';
      let special_offer = '';
      if (cType === 'medical') defaultRate = item.rate_medicals || item.rate || 0;
      else if (cType === 'agency') defaultRate = item.rate_agencies || item.rate || 0;
      else defaultRate = item.rate_doctors || item.rate || 0;
      offer = item[`offer_${cType}s`] || item.offer_doctors || item.offer || '';
      special_offer = item[`special_offer_${cType}s`] || item.special_offer_doctors || item.special_offer || '';

      setEditItems([...editItems, {
        item_id: item.id,
        item_code: item.item_code,
        item_name: item.item_name,
        quantity: '1',
        editQty: '1',
        mrp: item.mrp || 0,
        rate: defaultRate,
        originalQty: '0',
        originalRate: 0,
        gst: item.gst || 0,
        remove: false,
        isNew: true,
        defaultRate,
        offer,
        special_offer
      }]);
      toast.success(`Added ${item.item_name}`);
    }
    setEditItemSearch('');
  };

  const editFilteredItems = items.filter(item => {
    if (!editItemSearch) return false;
    const search = editItemSearch.toLowerCase();
    return (item.item_name?.toLowerCase().includes(search) || item.item_code?.toLowerCase().includes(search));
  });

  const addPendingToEditOrder = (pItem) => {
    const existingIndex = editItems.findIndex(i => i.item_id === pItem.item_id && !i.remove);
    if (existingIndex >= 0) {
      toast.info(`${pItem.item_name} is already in this order`);
      return;
    }
    const cType = selectedOrder?.customer_type || 'doctor';
    const fullItem = items.find(i => i.id === pItem.item_id);
    let defaultRate = 0;
    let offer = '';
    let special_offer = '';
    if (fullItem) {
      if (cType === 'medical') defaultRate = fullItem.rate_medicals || fullItem.rate || 0;
      else if (cType === 'agency') defaultRate = fullItem.rate_agencies || fullItem.rate || 0;
      else defaultRate = fullItem.rate_doctors || fullItem.rate || 0;
      offer = fullItem[`offer_${cType}s`] || fullItem.offer_doctors || fullItem.offer || '';
      special_offer = fullItem[`special_offer_${cType}s`] || fullItem.special_offer_doctors || fullItem.special_offer || '';
    }
    setEditItems([...editItems, {
      item_id: pItem.item_id,
      item_code: pItem.item_code,
      item_name: pItem.item_name,
      quantity: pItem.quantity || '1',
      editQty: pItem.quantity || '1',
      mrp: fullItem?.mrp || 0,
      rate: defaultRate,
      originalQty: '0',
      originalRate: 0,
      gst: fullItem?.gst || 0,
      remove: false,
      isNew: true,
      fromPending: true,
      defaultRate,
      offer,
      special_offer
    }]);
    toast.success(`Added pending item: ${pItem.item_name}`);
  };

  const handleSaveEditedItems = async () => {
    setSaving(true);
    try {
      // Filter and keep items with valid quantity (not empty, not just "0")
      const remainingItems = editItems.filter(item => {
        if (item.remove) return false;
        const qty = String(item.quantity || item.editQty || '');
        return qty !== '' && qty !== '0';
      }).map(item => ({
        ...item,
        quantity: String(item.quantity || item.editQty)
      }));
      
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
      const modifiedCount = editItems.filter(item => !item.remove && String(item.quantity) !== String(item.originalQty)).length;
      
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

  // Print order
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Order-${selectedOrder?.order_number}`,
  });

  const openPrintModal = (order) => {
    setSelectedOrder(order);
    setShowPrintModal(true);
  };

  // Send order via WhatsApp
  const sendOrderWhatsApp = (order) => {
    const companyName = companySettings?.company_name || 'VMP CRM';
    const companyPhone = companySettings?.phone || '';
    
    let message = `*${companyName}*\n`;
    message += `📦 *Order: ${order.order_number}*\n\n`;
    message += `👤 *Customer:* ${order.doctor_name}\n`;
    message += `📱 *Phone:* ${order.doctor_phone}\n`;
    if (order.doctor_address) message += `📍 *Address:* ${order.doctor_address}\n`;
    message += `\n*━━━━ ORDER ITEMS ━━━━*\n\n`;
    
    order.items?.forEach((item, idx) => {
      message += `${idx + 1}. *${item.item_name}*\n`;
      message += `   Code: ${item.item_code}\n`;
      message += `   Qty: ${item.quantity}`;
      if (item.rate) message += ` | Rate: ₹${item.rate}`;
      if (item.mrp) message += ` | MRP: ₹${item.mrp}`;
      message += `\n\n`;
    });
    
    message += `*━━━━━━━━━━━━━━━━━*\n`;
    message += `📅 Date: ${formatDateTime(order.created_at)}\n`;
    if (order.status) message += `📊 Status: ${STATUS_CONFIG[order.status]?.label || order.status}\n`;
    if (companyPhone) message += `\n📞 Contact: ${companyPhone}`;
    
    const encodedMessage = encodeURIComponent(message);
    const phone = order.doctor_phone.replace(/\D/g, '');
    const whatsappUrl = `https://wa.me/91${phone}?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
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
      customer_name: '',
      customer_phone: '',
      customer_email: '',
      customer_address: '',
      customer_type: 'doctor',
      customer_id: null,
      items: []
    });
    setItemSearch('');
    setCustomerSearch('');
    setCustomerResults([]);
    setSelectedCustomer(null);
    setCustomerPendingItems([]);
    setShowAddModal(true);
  };

  const searchCustomers = async (query) => {
    setCustomerSearch(query);
    if (query.length < 2) {
      setCustomerResults([]);
      return;
    }
    
    setSearchingCustomers(true);
    try {
      const response = await ordersAPI.searchCustomers(query);
      setCustomerResults(response.data);
    } catch (error) {
      console.error('Failed to search customers');
    } finally {
      setSearchingCustomers(false);
    }
  };

  const selectCustomer = (customer) => {
    setSelectedCustomer(customer);
    setNewOrderForm({
      ...newOrderForm,
      customer_name: customer.name,
      customer_phone: customer.phone,
      customer_email: customer.email || '',
      customer_address: customer.address || '',
      customer_type: customer.type,
      customer_id: customer.id
    });
    setCustomerSearch('');
    setCustomerResults([]);
    // Fetch pending items for this customer
    if (customer.phone) {
      pendingItemsAPI.getByDoctor(customer.phone)
        .then(res => setCustomerPendingItems(res.data || []))
        .catch(() => setCustomerPendingItems([]));
    }
  };

  const clearSelectedCustomer = () => {
    setSelectedCustomer(null);
    setCustomerPendingItems([]);
    setNewOrderForm({
      ...newOrderForm,
      customer_name: '',
      customer_phone: '',
      customer_email: '',
      customer_address: '',
      customer_type: 'doctor',
      customer_id: null
    });
  };

  // Get the role-based rate for the selected customer type
  const getRoleRate = (item) => {
    const cType = selectedCustomer?.type || newOrderForm.customer_type || 'doctor';
    if (cType === 'medical') return item.rate_medicals || item.rate || 0;
    if (cType === 'agency') return item.rate_agencies || item.rate || 0;
    return item.rate_doctors || item.rate || 0;
  };

  const addItemToOrder = (item) => {
    const existingIndex = newOrderForm.items.findIndex(i => i.item_id === item.id);
    if (existingIndex >= 0) {
      // Increment quantity - handle both number and scheme format
      const newItems = [...newOrderForm.items];
      const currentQty = String(newItems[existingIndex].quantity);
      const qtyParts = currentQty.split('+').map(p => parseInt(p.trim()) || 0);
      const newQty = (qtyParts[0] || 0) + 1;
      newItems[existingIndex].quantity = qtyParts[1] ? `${newQty}+${qtyParts[1]}` : String(newQty);
      newItems[existingIndex].outOfStock = false;
      setNewOrderForm({ ...newOrderForm, items: newItems });
    } else {
      const roleRate = getRoleRate(item);
      const cType = selectedCustomer?.type || newOrderForm.customer_type || 'doctor';
      setNewOrderForm({
        ...newOrderForm,
        items: [...newOrderForm.items, {
          item_id: item.id,
          item_code: item.item_code,
          item_name: item.item_name,
          quantity: '1',
          mrp: item.mrp || 0,
          rate: roleRate,
          defaultRate: roleRate,
          gst: item.gst || 0,
          outOfStock: false,
          offer: item[`offer_${cType}s`] || item.offer_doctors || item.offer || '',
          special_offer: item[`special_offer_${cType}s`] || item.special_offer_doctors || item.special_offer || '',
        }]
      });
    }
    setItemSearch('');
  };

  const addPendingItemToOrder = (pendingItem) => {
    // Find the full item data from loaded items
    const fullItem = items.find(i => i.id === pendingItem.item_id);
    if (fullItem) {
      addItemToOrder(fullItem);
      // Update quantity to match the pending quantity
      const idx = newOrderForm.items.length; // will be the last item added
      setTimeout(() => {
        setNewOrderForm(prev => {
          const updated = [...prev.items];
          const lastIdx = updated.findIndex(i => i.item_id === pendingItem.item_id);
          if (lastIdx >= 0) {
            updated[lastIdx].quantity = String(pendingItem.quantity);
          }
          return { ...prev, items: updated };
        });
      }, 0);
    } else {
      // Item not in loaded list - add with basic info
      const roleRate = 0;
      setNewOrderForm({
        ...newOrderForm,
        items: [...newOrderForm.items, {
          item_id: pendingItem.item_id,
          item_code: pendingItem.item_code,
          item_name: pendingItem.item_name,
          quantity: String(pendingItem.quantity),
          mrp: 0,
          rate: roleRate,
          defaultRate: roleRate,
          gst: 0,
          outOfStock: false,
          offer: '',
          special_offer: '',
        }]
      });
    }
    toast.success(`Added pending item: ${pendingItem.item_name}`);
  };

  const updateOrderItemQty = (index, qty) => {
    // Allow string quantities like "10+5" for scheme
    const qtyStr = String(qty).trim();
    const newItems = [...newOrderForm.items];
    
    // Check if empty or zero
    if (qtyStr === '' || qtyStr === '0') {
      newItems[index].quantity = qtyStr;
      newItems[index].outOfStock = true;
    } else {
      newItems[index].quantity = qtyStr;
      newItems[index].outOfStock = false;
    }
    setNewOrderForm({ ...newOrderForm, items: newItems });
  };

  const updateOrderItemRate = (index, rate) => {
    const newItems = [...newOrderForm.items];
    newItems[index].rate = parseFloat(rate) || 0;
    setNewOrderForm({ ...newOrderForm, items: newItems });
  };

  const markNewOrderItemOutOfStock = (index) => {
    const newItems = [...newOrderForm.items];
    newItems[index].outOfStock = true;
    newItems[index].previousQty = newItems[index].quantity;
    newItems[index].quantity = '0';
    setNewOrderForm({ ...newOrderForm, items: newItems });
  };

  const restoreNewOrderItem = (index) => {
    const newItems = [...newOrderForm.items];
    newItems[index].outOfStock = false;
    newItems[index].quantity = newItems[index].previousQty || '1';
    setNewOrderForm({ ...newOrderForm, items: newItems });
  };

  const removeOrderItem = (index) => {
    const newItems = newOrderForm.items.filter((_, i) => i !== index);
    setNewOrderForm({ ...newOrderForm, items: newItems });
  };

  const handleCreateOrder = async () => {
    if (!newOrderForm.customer_name || !newOrderForm.customer_phone) {
      toast.error('Customer name and phone are required');
      return;
    }
    
    // Filter out items marked as out of stock
    const availableItems = newOrderForm.items.filter(item => !item.outOfStock && item.quantity !== '0' && item.quantity !== '');
    
    if (availableItems.length === 0) {
      toast.error('Please add at least one available item (not out of stock)');
      return;
    }

    setSaving(true);
    try {
      // Prepare order data with only available items
      const orderData = {
        ...newOrderForm,
        items: availableItems.map(item => ({
          item_id: item.item_id,
          item_code: item.item_code,
          item_name: item.item_name,
          quantity: String(item.quantity),
          mrp: item.mrp,
          rate: item.rate,
          gst: item.gst
        }))
      };
      
      // Collect out of stock items to mark as pending
      const outOfStockItems = newOrderForm.items.filter(item => item.outOfStock || item.quantity === '0');
      if (outOfStockItems.length > 0) {
        orderData.pending_items = outOfStockItems.map(item => ({
          item_id: item.item_id,
          item_code: item.item_code,
          item_name: item.item_name,
          quantity: item.previousQty || '1'
        }));
      }
      
      const response = await ordersAPI.create(orderData);
      
      let successMsg = `Order ${response.data.order_number} created successfully!`;
      if (outOfStockItems.length > 0) {
        successMsg += ` ${outOfStockItems.length} item(s) marked as pending.`;
      }
      toast.success(successMsg);
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
                          {order.source === 'mr' && <Badge className="ml-1 bg-indigo-100 text-indigo-700 text-[10px]">MR</Badge>}
                        </td>
                        <td>
                          <div>
                            <p className="font-medium text-slate-900">{order.doctor_name || 'Unknown'}</p>
                            <p className="text-sm text-slate-500">{order.doctor_phone}</p>
                            {order.source === 'mr' && order.mr_name && (
                              <p className="text-xs text-indigo-600 font-medium">Submitted by: {order.mr_name}</p>
                            )}
                            {order.source === 'customer_portal' && (
                              <p className="text-xs text-green-600 font-medium">Self Order</p>
                            )}
                            {order.notes && (
                              <p className="text-xs text-amber-600 mt-0.5 truncate max-w-[200px]" title={order.notes}>Notes: {order.notes}</p>
                            )}
                          </div>
                        </td>
                        <td><span className="text-sm">{order.items?.length || 0} items</span></td>
                        <td>
                          <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
                          {order.cancel_requested && <Badge className="ml-1 bg-red-50 text-red-600 border border-red-200 text-[10px]">Cancel Req</Badge>}
                          {order.status === 'transferred' && order.transferred_to_agency_name && (
                            <p className="text-xs text-teal-600 mt-1">To: {order.transferred_to_agency_name}</p>
                          )}
                        </td>
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
                            <div className="flex flex-col">
                              <Badge className={order.payment_mode === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}>
                                {order.payment_mode === 'paid' ? 'Paid' : 'To Pay'}
                              </Badge>
                              {order.payment_amount > 0 && (
                                <span className="text-xs text-slate-600 mt-0.5">₹{order.payment_amount?.toLocaleString('en-IN')}</span>
                              )}
                            </div>
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
                            <Button variant="ghost" size="sm" onClick={() => openPrintModal(order)} title="Print Order" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                              <Printer className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => sendOrderWhatsApp(order)} title="Send WhatsApp" className="text-green-600 hover:text-green-700 hover:bg-green-50">
                              <MessageSquare className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => openUpdateModal(order)} title="Update Status">
                              <Truck className="w-4 h-4" />
                            </Button>
                            {order.status !== 'transferred' && order.status !== 'delivered' && order.status !== 'cancelled' && (
                              <Button variant="ghost" size="sm" title="Transfer to Agency" className="text-teal-600 hover:text-teal-700 hover:bg-teal-50"
                                onClick={() => { setSelectedOrder(order); setSelectedAgency(''); setShowTransferModal(true); }}
                                data-testid={`transfer-order-${order.id}`}>
                                <ArrowRightLeft className="w-4 h-4" />
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" onClick={() => handleDeleteOrder(order.id)} title="Delete Order" className="text-red-500 hover:text-red-700 hover:bg-red-50" data-testid={`delete-order-${order.id}`}>
                              <Trash2 className="w-4 h-4" />
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
            {/* Customer Search */}
            <div className="space-y-4">
              <h4 className="font-medium flex items-center gap-2">
                <User className="w-4 h-4" /> Select Customer
              </h4>
              
              {selectedCustomer ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium">{selectedCustomer.name}</p>
                        <p className="text-sm text-slate-600">{selectedCustomer.phone} • {selectedCustomer.customer_code}</p>
                        <Badge className={
                          selectedCustomer.type === 'doctor' ? 'bg-blue-100 text-blue-700' :
                          selectedCustomer.type === 'medical' ? 'bg-purple-100 text-purple-700' :
                          'bg-orange-100 text-orange-700'
                        }>
                          {selectedCustomer.type_label}
                        </Badge>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={clearSelectedCustomer}>
                      Change
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      value={customerSearch}
                      onChange={(e) => searchCustomers(e.target.value)}
                      placeholder="Search by name or phone across Doctors, Medicals, Agencies..."
                      className="pl-10"
                      data-testid="customer-search"
                    />
                    {searchingCustomers && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-slate-400" />
                    )}
                  </div>
                  
                  {customerResults.length > 0 && (
                    <div className="border rounded-lg max-h-48 overflow-y-auto">
                      {customerResults.map((customer) => (
                        <div
                          key={`${customer.type}-${customer.id}`}
                          className="p-3 hover:bg-slate-50 cursor-pointer flex items-center justify-between border-b last:border-0"
                          onClick={() => selectCustomer(customer)}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center">
                              <User className="w-4 h-4 text-slate-600" />
                            </div>
                            <div>
                              <p className="font-medium">{customer.name}</p>
                              <p className="text-sm text-slate-500">{customer.phone} • {customer.customer_code}</p>
                            </div>
                          </div>
                          <Badge className={
                            customer.type === 'doctor' ? 'bg-blue-100 text-blue-700' :
                            customer.type === 'medical' ? 'bg-purple-100 text-purple-700' :
                            'bg-orange-100 text-orange-700'
                          }>
                            {customer.type_label}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {customerSearch.length >= 2 && customerResults.length === 0 && !searchingCustomers && (
                    <p className="text-sm text-slate-500 text-center py-2">No existing customers found. Enter details below to create new.</p>
                  )}
                </>
              )}
            </div>

            {/* Customer Details (for new or editing) */}
            {!selectedCustomer && (
              <div className="space-y-4 border-t pt-4">
                <h4 className="font-medium text-sm text-slate-600">Or enter new customer details:</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Name *</Label>
                    <Input
                      value={newOrderForm.customer_name}
                      onChange={(e) => setNewOrderForm({...newOrderForm, customer_name: e.target.value})}
                      placeholder="Customer name"
                      data-testid="new-order-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone *</Label>
                    <Input
                      value={newOrderForm.customer_phone}
                      onChange={(e) => setNewOrderForm({...newOrderForm, customer_phone: e.target.value})}
                      placeholder="Phone number"
                      data-testid="new-order-phone"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={newOrderForm.customer_email}
                      onChange={(e) => setNewOrderForm({...newOrderForm, customer_email: e.target.value})}
                      placeholder="Email address"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Customer Type</Label>
                    <Select value={newOrderForm.customer_type} onValueChange={(v) => setNewOrderForm({...newOrderForm, customer_type: v})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="doctor">Doctor</SelectItem>
                        <SelectItem value="medical">Medical</SelectItem>
                        <SelectItem value="agency">Agency</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label>Address</Label>
                    <Input
                      value={newOrderForm.customer_address}
                      onChange={(e) => setNewOrderForm({...newOrderForm, customer_address: e.target.value})}
                      placeholder="Delivery address"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Pending Items for this Customer */}
            {customerPendingItems.length > 0 && (
              <div className="space-y-3 border-t pt-4">
                <h4 className="font-medium flex items-center gap-2 text-amber-700">
                  <AlertTriangle className="w-4 h-4" /> Previous Pending Items ({customerPendingItems.length})
                </h4>
                <p className="text-xs text-amber-600">These items were out of stock in previous orders for this customer. Add them to this order to fulfill.</p>
                <div className="border border-amber-200 rounded-lg bg-amber-50 divide-y divide-amber-200 max-h-48 overflow-y-auto">
                  {customerPendingItems.map((pItem) => {
                    const alreadyAdded = newOrderForm.items.some(i => i.item_id === pItem.item_id);
                    return (
                      <div key={pItem.id} className="p-3 flex items-center justify-between" data-testid={`pending-item-${pItem.id}`}>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-slate-800">{pItem.item_name}</p>
                          <p className="text-xs text-slate-500">{pItem.item_code} | Qty: {pItem.quantity} | Order: {pItem.original_order_number}</p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={alreadyAdded}
                          onClick={() => addPendingItemToOrder(pItem)}
                          className={alreadyAdded ? 'text-slate-400' : 'text-green-600 border-green-300 hover:bg-green-50'}
                          data-testid={`add-pending-${pItem.id}`}
                        >
                          {alreadyAdded ? 'Added' : <><Plus className="w-3 h-3 mr-1" />Add</>}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

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
                <div className="border rounded-lg max-h-48 overflow-y-auto">
                  {filteredItems.length > 0 ? (
                    filteredItems.slice(0, 10).map((item) => {
                      const cType = selectedCustomer?.type || newOrderForm.customer_type || 'doctor';
                      const roleRate = getRoleRate(item);
                      const offer = item[`offer_${cType}s`] || item.offer_doctors || item.offer || '';
                      const special = item[`special_offer_${cType}s`] || item.special_offer_doctors || item.special_offer || '';
                      return (
                        <div
                          key={item.id}
                          className="p-3 hover:bg-slate-50 cursor-pointer flex justify-between items-center border-b last:border-0"
                          onClick={() => addItemToOrder(item)}
                          data-testid={`add-item-${item.id}`}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">{item.item_name}</p>
                            <p className="text-xs text-slate-500">
                              {item.item_code} | MRP: ₹{item.mrp || 0}
                              {roleRate > 0 && <span className="text-blue-600 font-medium"> | Rate: ₹{roleRate}</span>}
                            </p>
                            {(offer || special) && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {offer && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium">{offer}</span>}
                                {special && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-medium">{special}</span>}
                              </div>
                            )}
                          </div>
                          <Plus className="w-4 h-4 text-green-600 shrink-0 ml-2" />
                        </div>
                      );
                    })
                  ) : (
                    <p className="p-3 text-sm text-slate-400 text-center">No items found</p>
                  )}
                </div>
              )}

              {/* Selected Items */}
              <div className="space-y-3">
                {newOrderForm.items.length > 0 ? (
                  <>
                    {/* Helper text */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-sm text-blue-700">
                        Enter qty as number (10) or with free scheme (10+5). Mark items "Out of Stock" to track for customer follow-up.
                      </p>
                    </div>
                    
                    {newOrderForm.items.map((item, index) => (
                      <div key={index} className={`p-4 rounded-lg border ${item.outOfStock ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-800">{item.item_name}</p>
                            <p className="text-sm text-slate-500">{item.item_code}</p>
                            <div className="flex gap-3 mt-1 text-xs text-slate-600">
                              {item.mrp > 0 && <span>MRP: ₹{item.mrp} (fixed)</span>}
                              {item.gst > 0 && <span>GST: {item.gst}%</span>}
                              {item.defaultRate > 0 && <span className="text-blue-600 font-medium">Default Rate: ₹{item.defaultRate}</span>}
                            </div>
                            {(item.offer || item.special_offer) && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {item.offer && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium">{item.offer}</span>}
                                {item.special_offer && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-medium">{item.special_offer}</span>}
                              </div>
                            )}
                          </div>
                          {!item.outOfStock ? (
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <div className="space-y-1">
                                <Label className="text-xs text-slate-500">Rate (₹)</Label>
                                <Input
                                  type="number"
                                  value={item.rate || ''}
                                  onChange={(e) => updateOrderItemRate(index, e.target.value)}
                                  className="w-20 h-9 text-center"
                                  placeholder="Rate"
                                  min="0"
                                  step="0.01"
                                  data-testid={`new-order-rate-${index}`}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs text-slate-500">Qty (e.g. 10+5)</Label>
                                <Input
                                  type="text"
                                  value={item.quantity}
                                  onChange={(e) => updateOrderItemQty(index, e.target.value)}
                                  className="w-24 h-9 text-center"
                                  placeholder="10 or 10+5"
                                />
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => markNewOrderItemOutOfStock(index)}
                                className="text-orange-600 border-orange-300 hover:bg-orange-50 h-9"
                              >
                                Out of Stock
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-9 w-9 text-red-500" 
                                onClick={() => removeOrderItem(index)}
                                title="Remove item"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Badge className="bg-red-100 text-red-700">Out of Stock</Badge>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => restoreNewOrderItem(index)} 
                                className="text-green-600 border-green-300 hover:bg-green-50"
                              >
                                Restore
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-9 w-9 text-red-500" 
                                onClick={() => removeOrderItem(index)}
                                title="Remove item"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                        {item.outOfStock && (
                          <div className="mt-3 pt-3 border-t border-red-200">
                            <p className="text-sm text-red-600 flex items-center gap-1">
                              <AlertTriangle className="w-4 h-4" />
                              This item will be tracked as pending for customer follow-up
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                    
                    {/* Summary */}
                    <div className="p-3 bg-slate-100 rounded-lg">
                      <p className="text-sm text-slate-600">
                        <strong>{newOrderForm.items.filter(i => !i.outOfStock && i.quantity !== '0').length}</strong> available item(s)
                        {newOrderForm.items.filter(i => i.outOfStock).length > 0 && (
                          <>, <strong className="text-orange-600">{newOrderForm.items.filter(i => i.outOfStock).length}</strong> out of stock (will be tracked as pending)</>
                        )}
                      </p>
                    </div>
                  </>
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

              {/* Source & Notes Info */}
              {(selectedOrder.source || selectedOrder.notes || selectedOrder.status === 'transferred') && (
                <Card>
                  <CardContent className="pt-4 space-y-2 text-sm">
                    {selectedOrder.source === 'mr' && selectedOrder.mr_name && (
                      <div className="flex items-center gap-2">
                        <Badge className="bg-indigo-100 text-indigo-700">MR Order</Badge>
                        <span className="font-medium">Submitted by: {selectedOrder.mr_name}</span>
                      </div>
                    )}
                    {selectedOrder.source === 'customer_portal' && (
                      <div className="flex items-center gap-2">
                        <Badge className="bg-green-100 text-green-700">Self Order</Badge>
                        <span className="text-slate-500">Placed via Customer Portal</span>
                      </div>
                    )}
                    {selectedOrder.notes && (
                      <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg">
                        <p className="text-xs text-amber-600 font-medium mb-1">Order Notes:</p>
                        <p className="text-slate-700 whitespace-pre-line">{selectedOrder.notes}</p>
                      </div>
                    )}
                    {selectedOrder.status === 'transferred' && selectedOrder.transferred_to_agency_name && (
                      <div className="bg-teal-50 border border-teal-200 p-3 rounded-lg">
                        <p className="text-xs text-teal-600 font-medium mb-1">Transferred to Agency:</p>
                        <p className="font-medium">{selectedOrder.transferred_to_agency_name}</p>
                        {selectedOrder.transferred_to_agency_phone && <p className="text-slate-500">{selectedOrder.transferred_to_agency_phone}</p>}
                        {selectedOrder.transferred_at && <p className="text-xs text-slate-400 mt-1">{formatDateTime(selectedOrder.transferred_at)}</p>}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

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
                        {selectedOrder.payment_amount > 0 && (
                          <span className="font-medium">₹{selectedOrder.payment_amount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        )}
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

              {selectedOrder.cancel_requested && selectedOrder.status !== 'cancelled' && (
                <Card className="border-orange-200 bg-orange-50">
                  <CardHeader className="pb-3"><CardTitle className="text-base text-orange-700 flex items-center gap-2"><XCircle className="w-4 h-4" /> Cancellation Request</CardTitle></CardHeader>
                  <CardContent>
                    <p className="text-sm text-orange-700 mb-1">Requested by: {selectedOrder.cancel_requested_by}</p>
                    {selectedOrder.cancel_reason && <p className="text-sm text-orange-600 mb-3">Reason: {selectedOrder.cancel_reason}</p>}
                    <div className="flex gap-2">
                      <Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={async () => {
                        try {
                          await ordersAPI.approveCancel(selectedOrder.id, { action: 'approve' });
                          toast.success('Order cancelled');
                          fetchOrders(); setShowDetailModal(false);
                        } catch { toast.error('Failed'); }
                      }} data-testid="approve-cancel-btn">Approve Cancel</Button>
                      <Button size="sm" variant="outline" onClick={async () => {
                        try {
                          await ordersAPI.approveCancel(selectedOrder.id, { action: 'reject' });
                          toast.success('Cancellation rejected');
                          fetchOrders(); setShowDetailModal(false);
                        } catch { toast.error('Failed'); }
                      }} data-testid="reject-cancel-btn">Reject</Button>
                    </div>
                  </CardContent>
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
                    <Select value={updateForm.payment_mode} onValueChange={(v) => setUpdateForm({...updateForm, payment_mode: v, payment_amount: '', expense_paid_by: '', expense_account: 'company_account'})}>
                      <SelectTrigger data-testid="payment-mode-select"><SelectValue placeholder="Select payment mode" /></SelectTrigger>
                      <SelectContent>{PAYMENT_MODES.map((mode) => (<SelectItem key={mode.value} value={mode.value}>{mode.label}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                  
                  {/* Payment Amount - shown for both To Pay and Paid */}
                  {updateForm.payment_mode && (
                    <div className="mt-3 p-3 rounded-lg border bg-slate-50">
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label>{updateForm.payment_mode === 'paid' ? 'Paid Amount (₹) *' : 'To Pay Amount (₹)'}</Label>
                          <Input 
                            data-testid="payment-amount-input" 
                            type="number" 
                            min="0" 
                            step="0.01"
                            value={updateForm.payment_amount} 
                            onChange={(e) => setUpdateForm({...updateForm, payment_amount: parseFloat(e.target.value) || ''})} 
                            placeholder={updateForm.payment_mode === 'paid' ? 'Enter paid amount' : 'Enter amount to pay'}
                          />
                          {updateForm.payment_mode === 'to_pay' && (
                            <p className="text-xs text-slate-500">This amount will be stored for reference only (not sent to customer)</p>
                          )}
                        </div>
                        
                        {/* Expense details - only for Paid mode */}
                        {updateForm.payment_mode === 'paid' && (
                          <>
                            <div className="border-t pt-3 mt-3">
                              <p className="text-sm font-medium text-slate-700 mb-2">Expense Details (auto-added to Transport/Shipping expenses)</p>
                            </div>
                            <div className="space-y-2">
                              <Label>Paid By (Who spent?)</Label>
                              <Input 
                                data-testid="expense-paid-by-input"
                                value={updateForm.expense_paid_by} 
                                onChange={(e) => setUpdateForm({...updateForm, expense_paid_by: e.target.value})} 
                                placeholder="Enter name of person who paid"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>From Account</Label>
                              <Select value={updateForm.expense_account} onValueChange={(v) => setUpdateForm({...updateForm, expense_account: v})}>
                                <SelectTrigger data-testid="expense-account-select"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="company_account">Company Account</SelectItem>
                                  <SelectItem value="admin_account">Admin Account</SelectItem>
                                  <SelectItem value="employee_account">Employee Account</SelectItem>
                                  <SelectItem value="cash">Cash</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
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
                    {selectedOrder.payment_mode && (
                      <p className="text-sm">
                        <span className="text-slate-500">Payment:</span> {selectedOrder.payment_mode === 'paid' ? 'Paid' : 'To Pay'}
                        {selectedOrder.payment_amount > 0 && <span className="font-medium"> - ₹{selectedOrder.payment_amount?.toLocaleString('en-IN')}</span>}
                      </p>
                    )}
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
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Edit className="w-5 h-5" />Edit Order Items - {selectedOrder?.order_number}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                <div className="text-sm text-amber-700">
                  <p className="font-medium">Edit, add, or remove items</p>
                  <p>Enter qty as number (10) or with free scheme (10+5). Use "Out of Stock" to track pending items.</p>
                </div>
              </div>
            </div>

            {/* Add Item Search */}
            <div className="mb-4">
              <Label className="text-sm font-medium text-slate-700 mb-1.5 block">Add Item to Order</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Search items to add..."
                  value={editItemSearch}
                  onChange={(e) => setEditItemSearch(e.target.value)}
                  className="pl-9"
                  data-testid="edit-order-add-item-search"
                />
              </div>
              {editItemSearch && (
                <div className="border rounded-lg max-h-40 overflow-y-auto mt-1">
                  {editFilteredItems.length > 0 ? (
                    editFilteredItems.slice(0, 8).map((item) => {
                      const cType = selectedOrder?.customer_type || 'doctor';
                      let roleRate = 0;
                      if (cType === 'medical') roleRate = item.rate_medicals || item.rate || 0;
                      else if (cType === 'agency') roleRate = item.rate_agencies || item.rate || 0;
                      else roleRate = item.rate_doctors || item.rate || 0;
                      const offer = item[`offer_${cType}s`] || item.offer_doctors || item.offer || '';
                      const special = item[`special_offer_${cType}s`] || item.special_offer_doctors || item.special_offer || '';
                      const alreadyInOrder = editItems.some(ei => ei.item_id === item.id && !ei.remove);
                      return (
                        <div
                          key={item.id}
                          className={`p-2.5 hover:bg-slate-50 cursor-pointer flex justify-between items-center border-b last:border-0 ${alreadyInOrder ? 'bg-blue-50' : ''}`}
                          onClick={() => handleAddEditItem(item)}
                          data-testid={`edit-add-item-${item.id}`}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">{item.item_name} {alreadyInOrder && <span className="text-blue-500 text-xs">(in order)</span>}</p>
                            <p className="text-xs text-slate-500">
                              {item.item_code} | MRP: ₹{item.mrp || 0}
                              {roleRate > 0 && <span className="text-blue-600 font-medium"> | Rate: ₹{roleRate}</span>}
                            </p>
                            {(offer || special) && (
                              <div className="flex flex-wrap gap-1 mt-0.5">
                                {offer && <span className="text-[10px] px-1 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium">{offer}</span>}
                                {special && <span className="text-[10px] px-1 py-0.5 rounded bg-amber-50 text-amber-700 font-medium">{special}</span>}
                              </div>
                            )}
                          </div>
                          <Plus className="w-4 h-4 text-green-600 shrink-0 ml-2" />
                        </div>
                      );
                    })
                  ) : (
                    <p className="p-2.5 text-sm text-slate-400 text-center">No items found</p>
                  )}
                </div>
              )}
            </div>

            {/* Previous Pending Items */}
            {pendingItemsForOrder.length > 0 && (
              <div className="mb-4 p-3 border border-orange-200 bg-orange-50 rounded-lg">
                <p className="text-sm font-medium text-orange-800 mb-2">Previous Pending Items (Out of Stock)</p>
                <div className="space-y-2">
                  {pendingItemsForOrder
                    .filter(p => !editItems.some(ei => ei.item_id === p.item_id && !ei.remove))
                    .map((pItem) => (
                    <div key={pItem.id} className="flex items-center justify-between bg-white p-2 rounded border border-orange-100">
                      <div>
                        <p className="text-sm font-medium text-slate-800">{pItem.item_name}</p>
                        <p className="text-xs text-slate-500">{pItem.item_code} | Qty: {pItem.quantity} | Order #{pItem.original_order_number}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => addPendingToEditOrder(pItem)}
                        className="text-orange-600 border-orange-300 hover:bg-orange-100 h-7 text-xs"
                        data-testid={`edit-add-pending-${pItem.id}`}
                      >
                        <Plus className="w-3 h-3 mr-1" />Add to Order
                      </Button>
                    </div>
                  ))}
                  {pendingItemsForOrder.filter(p => !editItems.some(ei => ei.item_id === p.item_id && !ei.remove)).length === 0 && (
                    <p className="text-xs text-orange-600 italic">All pending items are already in this order</p>
                  )}
                </div>
              </div>
            )}
            
            <div className="space-y-3">
              {editItems.map((item, index) => (
                <div key={index} className={`p-4 rounded-lg border ${item.remove ? 'bg-red-50 border-red-200' : item.isNew ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-slate-800">{item.item_name}</p>
                        {item.isNew && <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-medium">NEW</span>}
                      </div>
                      <p className="text-sm text-slate-500">{item.item_code}</p>
                      <div className="flex gap-3 mt-1 text-xs text-slate-600">
                        {item.mrp > 0 && <span>MRP: ₹{item.mrp} (fixed)</span>}
                        {item.gst > 0 && <span>GST: {item.gst}%</span>}
                        {item.defaultRate > 0 && <span className="text-blue-600 font-medium">Default Rate: ₹{item.defaultRate}</span>}
                      </div>
                      {(item.offer || item.special_offer) && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {item.offer && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium">{item.offer}</span>}
                          {item.special_offer && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-medium">{item.special_offer}</span>}
                        </div>
                      )}
                    </div>
                    {!item.remove ? (
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="space-y-1">
                          <Label className="text-xs text-slate-500">Rate (₹)</Label>
                          <Input
                            type="number"
                            value={item.rate || ''}
                            onChange={(e) => handleEditItemRate(index, e.target.value)}
                            className="w-20 h-9 text-center"
                            placeholder="Rate"
                            min="0"
                            step="0.01"
                            data-testid={`edit-order-rate-${index}`}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-slate-500">Qty (e.g. 10+5)</Label>
                          <Input
                            type="text"
                            value={item.editQty || item.quantity}
                            onChange={(e) => handleQuantityChange(index, e.target.value)}
                            className="w-24 h-9 text-center"
                            placeholder="10 or 10+5"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleMarkOutOfStock(index)}
                            className="text-orange-600 border-orange-300 hover:bg-orange-50 h-8 text-xs"
                          >
                            Out of Stock
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteEditItem(index)}
                            className="text-red-600 border-red-300 hover:bg-red-50 h-8 text-xs"
                            data-testid={`edit-delete-item-${index}`}
                          >
                            <Trash2 className="w-3 h-3 mr-1" />Delete
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleRestoreItem(index)} className="text-green-600 border-green-300 hover:bg-green-50">
                          Restore
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDeleteEditItem(index)} className="text-red-600 border-red-300 hover:bg-red-50">
                          <Trash2 className="w-3 h-3 mr-1" />Delete
                        </Button>
                      </div>
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
            
            {(editItems.filter(item => item.remove).length > 0 || editItems.some((item, i) => !item.remove && (item.quantity !== item.originalQty || item.rate !== item.originalRate)) || editItems.some(item => item.isNew)) && (
              <div className="mt-4 p-3 bg-slate-100 rounded-lg">
                <p className="text-sm text-slate-600">
                  {editItems.filter(item => item.isNew && !item.remove).length > 0 && (
                    <><strong>{editItems.filter(item => item.isNew && !item.remove).length}</strong> item(s) added. </>
                  )}
                  {editItems.filter(item => !item.remove && !item.isNew && item.quantity !== item.originalQty).length > 0 && (
                    <><strong>{editItems.filter(item => !item.remove && !item.isNew && item.quantity !== item.originalQty).length}</strong> qty changed. </>
                  )}
                  {editItems.filter(item => !item.remove && item.rate !== item.originalRate).length > 0 && (
                    <><strong>{editItems.filter(item => !item.remove && item.rate !== item.originalRate).length}</strong> rate changed. </>
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

      {/* Print Order Modal */}
      <Dialog open={showPrintModal} onOpenChange={setShowPrintModal}>
        <DialogContent className="max-w-3xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="w-5 h-5" /> Print Order - {selectedOrder?.order_number}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {/* Print Preview */}
            <div ref={printRef} className="bg-white p-6 print:p-4">
              {/* Company Header */}
              <div className="text-center border-b pb-4 mb-4">
                {companySettings?.logo_url && (
                  <img src={companySettings.logo_url} alt="Logo" className="h-16 mx-auto mb-2" />
                )}
                <h1 className="text-xl font-bold">{companySettings?.company_name || 'VMP CRM'}</h1>
                {companySettings?.address && <p className="text-sm text-gray-600">{companySettings.address}</p>}
                <div className="flex justify-center gap-4 text-xs text-gray-500 mt-1">
                  {companySettings?.phone && <span>Ph: {companySettings.phone}</span>}
                  {companySettings?.email && <span>Email: {companySettings.email}</span>}
                </div>
                {companySettings?.gst_number && <p className="text-xs text-gray-500">GST: {companySettings.gst_number}</p>}
              </div>

              {/* Order Info */}
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-lg font-bold">ORDER SHEET</h2>
                  <p className="text-sm"><span className="font-medium">Order No:</span> {selectedOrder?.order_number}</p>
                  <p className="text-sm"><span className="font-medium">Date:</span> {selectedOrder && formatDateTime(selectedOrder.created_at)}</p>
                  <p className="text-sm"><span className="font-medium">Status:</span> {selectedOrder && STATUS_CONFIG[selectedOrder.status]?.label}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium">Bill To:</p>
                  <p className="text-sm font-semibold">{selectedOrder?.doctor_name}</p>
                  <p className="text-sm">{selectedOrder?.doctor_phone}</p>
                  {selectedOrder?.doctor_email && <p className="text-sm">{selectedOrder.doctor_email}</p>}
                  {selectedOrder?.doctor_address && <p className="text-sm max-w-[200px]">{selectedOrder.doctor_address}</p>}
                </div>
              </div>

              {/* Items Table */}
              <table className="w-full border-collapse mb-4">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-2 py-1 text-left text-sm">S.No</th>
                    <th className="border border-gray-300 px-2 py-1 text-left text-sm">Item Code</th>
                    <th className="border border-gray-300 px-2 py-1 text-left text-sm">Item Name</th>
                    <th className="border border-gray-300 px-2 py-1 text-center text-sm">Qty</th>
                    <th className="border border-gray-300 px-2 py-1 text-right text-sm">Rate (₹)</th>
                    <th className="border border-gray-300 px-2 py-1 text-right text-sm">MRP (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedOrder?.items?.map((item, index) => {
                    const rate = parseFloat(item.rate) || 0;
                    
                    return (
                      <tr key={index}>
                        <td className="border border-gray-300 px-2 py-1 text-sm">{index + 1}</td>
                        <td className="border border-gray-300 px-2 py-1 text-sm font-mono">{item.item_code}</td>
                        <td className="border border-gray-300 px-2 py-1 text-sm">{item.item_name}</td>
                        <td className="border border-gray-300 px-2 py-1 text-sm text-center font-medium">{item.quantity}</td>
                        <td className="border border-gray-300 px-2 py-1 text-sm text-right">{rate.toFixed(2)}</td>
                        <td className="border border-gray-300 px-2 py-1 text-sm text-right">{item.mrp ? parseFloat(item.mrp).toFixed(2) : '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50">
                    <td colSpan={3} className="border border-gray-300 px-2 py-1 text-sm font-medium text-right">Total Items: {selectedOrder?.items?.length || 0}</td>
                    <td className="border border-gray-300 px-2 py-1 text-sm text-center font-bold">
                      {selectedOrder?.items?.reduce((sum, item) => {
                        const qtyStr = String(item.quantity || '0');
                        const qtyParts = qtyStr.split('+').map(p => parseInt(p.trim()) || 0);
                        return sum + (qtyParts[0] || 0) + (qtyParts[1] || 0);
                      }, 0)}
                    </td>
                    <td colSpan={2} className="border border-gray-300 px-2 py-1"></td>
                  </tr>
                </tfoot>
              </table>

              {/* Transport & Invoice Details */}
              {(selectedOrder?.transport_name || selectedOrder?.invoice_number) && (
                <div className="grid grid-cols-2 gap-4 border-t pt-4 mb-4">
                  {selectedOrder?.transport_name && (
                    <div>
                      <h3 className="font-medium text-sm mb-1">Transport Details</h3>
                      <p className="text-sm">Transport: {selectedOrder.transport_name}</p>
                      {selectedOrder.tracking_number && <p className="text-sm">Tracking: {selectedOrder.tracking_number}</p>}
                      {selectedOrder.delivery_station && <p className="text-sm">Station: {selectedOrder.delivery_station}</p>}
                      {selectedOrder.payment_mode && <p className="text-sm">Payment: {selectedOrder.payment_mode === 'paid' ? 'Paid' : 'To Pay'}</p>}
                      {(selectedOrder.boxes_count > 0 || selectedOrder.cans_count > 0 || selectedOrder.bags_count > 0) && (
                        <p className="text-sm">
                          Packages: {selectedOrder.boxes_count > 0 && `${selectedOrder.boxes_count} Box`}
                          {selectedOrder.boxes_count > 0 && (selectedOrder.cans_count > 0 || selectedOrder.bags_count > 0) && ', '}
                          {selectedOrder.cans_count > 0 && `${selectedOrder.cans_count} Can`}
                          {selectedOrder.cans_count > 0 && selectedOrder.bags_count > 0 && ', '}
                          {selectedOrder.bags_count > 0 && `${selectedOrder.bags_count} Bag`}
                        </p>
                      )}
                    </div>
                  )}
                  {selectedOrder?.invoice_number && (
                    <div>
                      <h3 className="font-medium text-sm mb-1">Invoice Details</h3>
                      <p className="text-sm">Invoice No: {selectedOrder.invoice_number}</p>
                      {selectedOrder.invoice_date && <p className="text-sm">Date: {selectedOrder.invoice_date}</p>}
                      {selectedOrder.invoice_value && <p className="text-sm">Value: ₹{parseFloat(selectedOrder.invoice_value).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>}
                    </div>
                  )}
                </div>
              )}

              {/* Footer */}
              <div className="border-t pt-4 mt-4 text-center text-xs text-gray-500">
                <p>Thank you for your business!</p>
                {companySettings?.phone && <p>For queries, contact: {companySettings.phone}</p>}
              </div>
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setShowPrintModal(false)}>Close</Button>
            <Button variant="outline" onClick={() => sendOrderWhatsApp(selectedOrder)} className="text-green-600 border-green-300 hover:bg-green-50">
              <MessageSquare className="w-4 h-4 mr-2" /> Send WhatsApp
            </Button>
            <Button onClick={handlePrint} data-testid="print-order-btn">
              <Printer className="w-4 h-4 mr-2" /> Print
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer to Agency Modal */}
      <Dialog open={showTransferModal} onOpenChange={setShowTransferModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Transfer Order to Agency</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedOrder && (
              <div className="bg-slate-50 p-3 rounded-lg text-sm">
                <p className="font-medium">{selectedOrder.order_number}</p>
                <p className="text-slate-600">{selectedOrder.doctor_name} - {selectedOrder.doctor_phone}</p>
                <p className="text-slate-500">{selectedOrder.items?.length || 0} items</p>
              </div>
            )}
            <div>
              <Label>Select Agency <span className="text-red-500">*</span></Label>
              <Select value={selectedAgency} onValueChange={setSelectedAgency}>
                <SelectTrigger data-testid="transfer-agency-select">
                  <SelectValue placeholder="Choose agency..." />
                </SelectTrigger>
                <SelectContent>
                  {agencies.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.name} {a.phone ? `- ${a.phone}` : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-slate-500">The selected agency will receive WhatsApp with customer details and order items. The customer will be notified about the agency transfer.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTransferModal(false)}>Cancel</Button>
            <Button onClick={handleTransferOrder} disabled={!selectedAgency || saving}
              className="bg-teal-600 hover:bg-teal-700" data-testid="confirm-transfer-btn">
              {saving ? 'Transferring...' : 'Transfer Order'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
