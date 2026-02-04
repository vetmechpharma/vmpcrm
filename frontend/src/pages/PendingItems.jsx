import { useState, useEffect } from 'react';
import { pendingItemsAPI } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { toast } from 'sonner';
import { 
  Loader2, 
  Clock, 
  Phone, 
  User,
  Package,
  Trash2,
  Search,
  RefreshCw,
  AlertCircle,
  Calendar,
  Hash,
  Bell,
  Send,
  CheckCircle,
  Users,
  Printer,
  ShoppingCart
} from 'lucide-react';
import { formatDateTime, formatDate } from '../lib/utils';

export const PendingItems = () => {
  const [pendingItems, setPendingItems] = useState([]);
  const [itemsGrouped, setItemsGrouped] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const [showNotifyItemModal, setShowNotifyItemModal] = useState(false);
  const [selectedItemGroup, setSelectedItemGroup] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [activeTab, setActiveTab] = useState('by-doctor');

  useEffect(() => {
    fetchPendingItems();
    fetchItemsGrouped();
  }, []);

  const fetchPendingItems = async () => {
    setLoading(true);
    try {
      const response = await pendingItemsAPI.getAll();
      setPendingItems(response.data);
    } catch (error) {
      toast.error('Failed to fetch pending items');
    } finally {
      setLoading(false);
    }
  };

  const fetchItemsGrouped = async () => {
    try {
      const response = await pendingItemsAPI.getByItem();
      setItemsGrouped(response.data);
    } catch (error) {
      console.error('Failed to fetch items grouped');
    }
  };

  const handleDelete = async () => {
    if (!selectedItem) return;
    
    setDeleting(true);
    try {
      await pendingItemsAPI.delete(selectedItem.id);
      toast.success('Pending item removed successfully');
      setShowDeleteModal(false);
      setSelectedItem(null);
      fetchPendingItems();
      fetchItemsGrouped();
    } catch (error) {
      toast.error('Failed to delete pending item');
    } finally {
      setDeleting(false);
    }
  };

  const handleNotifySingle = async () => {
    if (!selectedItem) return;
    
    setNotifying(true);
    try {
      await pendingItemsAPI.notifyStockArrivedSingle(selectedItem.id);
      toast.success('Stock arrived notification sent!');
      setShowNotifyModal(false);
      setSelectedItem(null);
    } catch (error) {
      toast.error('Failed to send notification');
    } finally {
      setNotifying(false);
    }
  };

  const handleNotifyByItem = async () => {
    if (!selectedItemGroup) return;
    
    setNotifying(true);
    try {
      const response = await pendingItemsAPI.notifyStockArrivedByItem(selectedItemGroup.item_code);
      toast.success(`Notifications sent to ${response.data.doctors_notified} doctor(s)!`);
      setShowNotifyItemModal(false);
      setSelectedItemGroup(null);
    } catch (error) {
      toast.error('Failed to send notifications');
    } finally {
      setNotifying(false);
    }
  };

  const openDeleteModal = (item) => {
    setSelectedItem(item);
    setShowDeleteModal(true);
  };

  const openNotifyModal = (item) => {
    setSelectedItem(item);
    setShowNotifyModal(true);
  };

  const openNotifyItemModal = (itemGroup) => {
    setSelectedItemGroup(itemGroup);
    setShowNotifyItemModal(true);
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    
    const content = activeTab === 'by-doctor' 
      ? generateDoctorReport() 
      : generateItemReport();
    
    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const generateDoctorReport = () => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Pending Items - By Doctor</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
          .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 15px; }
          .title { font-size: 20px; font-weight: bold; }
          .subtitle { font-size: 12px; color: #666; margin-top: 5px; }
          .summary { display: flex; justify-content: space-around; margin: 20px 0; padding: 15px; background: #f5f5f5; border-radius: 5px; }
          .summary-item { text-align: center; }
          .summary-label { font-size: 11px; color: #666; }
          .summary-value { font-size: 18px; font-weight: bold; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 11px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background: #f0f0f0; font-weight: bold; }
          tr:nth-child(even) { background: #fafafa; }
          .footer { margin-top: 20px; text-align: center; font-size: 10px; color: #666; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">PENDING ITEMS REPORT - BY DOCTOR</div>
          <div class="subtitle">Generated: ${new Date().toLocaleString()}</div>
        </div>
        <div class="summary">
          <div class="summary-item">
            <div class="summary-value">${pendingItems.length}</div>
            <div class="summary-label">Total Items</div>
          </div>
          <div class="summary-item">
            <div class="summary-value">${Object.keys(groupedByDoctor).length}</div>
            <div class="summary-label">Doctors Waiting</div>
          </div>
          <div class="summary-item">
            <div class="summary-value">${itemsGrouped.length}</div>
            <div class="summary-label">Unique Products</div>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Doctor Name</th>
              <th>Phone</th>
              <th>Item</th>
              <th>Code</th>
              <th>Qty</th>
              <th>Order #</th>
              <th>Order Date</th>
            </tr>
          </thead>
          <tbody>
            ${filteredItems.map((item, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td>${item.doctor_name || 'N/A'}</td>
                <td>${item.doctor_phone}</td>
                <td>${item.item_name}</td>
                <td>${item.item_code}</td>
                <td>${item.quantity}</td>
                <td>${item.original_order_number}</td>
                <td>${formatDate(item.original_order_date)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="footer">This is a computer-generated report</div>
      </body>
      </html>
    `;
  };

  const generateItemReport = () => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Pending Items - By Item</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
          .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 15px; }
          .title { font-size: 20px; font-weight: bold; }
          .subtitle { font-size: 12px; color: #666; margin-top: 5px; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 11px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background: #f0f0f0; font-weight: bold; }
          tr:nth-child(even) { background: #fafafa; }
          .item-header { background: #e8e8e8 !important; font-weight: bold; }
          .footer { margin-top: 20px; text-align: center; font-size: 10px; color: #666; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">PENDING ITEMS REPORT - BY PRODUCT</div>
          <div class="subtitle">Generated: ${new Date().toLocaleString()}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Item Name</th>
              <th>Code</th>
              <th>Total Qty</th>
              <th>Doctors</th>
              <th>Doctor Details</th>
            </tr>
          </thead>
          <tbody>
            ${itemsGrouped.map(group => `
              <tr>
                <td><strong>${group.item_name}</strong></td>
                <td>${group.item_code}</td>
                <td>${group.total_quantity}</td>
                <td>${group.doctor_count}</td>
                <td>${group.doctors.map(d => `${d.doctor_name || 'N/A'} (${d.doctor_phone}) - Qty: ${d.quantity}`).join('<br>')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="footer">This is a computer-generated report</div>
      </body>
      </html>
    `;
  };

  // Filter items based on search
  const filteredItems = pendingItems.filter(item => {
    const query = searchQuery.toLowerCase();
    return (
      (item.doctor_name || '').toLowerCase().includes(query) ||
      item.doctor_phone.includes(query) ||
      item.item_name.toLowerCase().includes(query) ||
      item.item_code.toLowerCase().includes(query) ||
      item.original_order_number.toLowerCase().includes(query)
    );
  });

  // Group items by doctor
  const groupedByDoctor = filteredItems.reduce((acc, item) => {
    const key = item.doctor_phone;
    if (!acc[key]) {
      acc[key] = {
        doctor_phone: item.doctor_phone,
        doctor_name: item.doctor_name,
        items: []
      };
    }
    acc[key].items.push(item);
    return acc;
  }, {});

  // Filter items grouped for search
  const filteredItemsGrouped = itemsGrouped.filter(group => {
    const query = searchQuery.toLowerCase();
    return (
      group.item_name.toLowerCase().includes(query) ||
      group.item_code.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6" data-testid="pending-items-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Pending Items</h1>
          <p className="text-slate-500">Items waiting for stock - Send notifications when available</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handlePrint} variant="outline" className="gap-2">
            <Printer className="w-4 h-4" />
            Print
          </Button>
          <Button onClick={() => { fetchPendingItems(); fetchItemsGrouped(); }} variant="outline" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Pending</p>
                <p className="text-2xl font-bold text-slate-800">{pendingItems.length}</p>
              </div>
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                <Package className="w-5 h-5 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Doctors Waiting</p>
                <p className="text-2xl font-bold text-slate-800">{Object.keys(groupedByDoctor).length}</p>
              </div>
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Unique Items</p>
                <p className="text-2xl font-bold text-slate-800">{itemsGrouped.length}</p>
              </div>
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                <Hash className="w-5 h-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Quantity</p>
                <p className="text-2xl font-bold text-slate-800">
                  {pendingItems.reduce((sum, item) => sum + (parseInt(item.quantity) || 0), 0)}
                </p>
              </div>
              <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                <ShoppingCart className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Tabs */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                placeholder="Search doctor, phone, item, order..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="pending-search-input"
              />
            </div>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full md:w-auto">
              <TabsList>
                <TabsTrigger value="by-doctor" className="gap-2">
                  <User className="w-4 h-4" />
                  By Doctor
                </TabsTrigger>
                <TabsTrigger value="by-item" className="gap-2">
                  <Package className="w-4 h-4" />
                  By Item
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardContent>
      </Card>

      {/* By Doctor Tab - Table View */}
      {activeTab === 'by-doctor' && (
        <Card>
          <CardContent className="pt-6">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
              </div>
            ) : filteredItems.length > 0 ? (
              <>
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="w-[50px] text-center">#</TableHead>
                        <TableHead className="w-[150px]">Doctor</TableHead>
                        <TableHead className="w-[110px]">Phone</TableHead>
                        <TableHead>Item Name</TableHead>
                        <TableHead className="w-[90px]">Code</TableHead>
                        <TableHead className="w-[60px] text-center">Qty</TableHead>
                        <TableHead className="w-[100px]">Order #</TableHead>
                        <TableHead className="w-[100px]">Date</TableHead>
                        <TableHead className="w-[90px] text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredItems.map((item, index) => (
                        <TableRow key={item.id} className="hover:bg-slate-50" data-testid={`pending-row-${item.id}`}>
                          <TableCell className="text-center text-slate-500">{index + 1}</TableCell>
                          <TableCell className="font-medium">{item.doctor_name || 'N/A'}</TableCell>
                          <TableCell>
                            <span className="flex items-center gap-1 text-sm">
                              <Phone className="w-3 h-3 text-slate-400" />
                              {item.doctor_phone}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="font-medium text-slate-800">{item.item_name}</span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-mono text-xs">{item.item_code}</Badge>
                          </TableCell>
                          <TableCell className="text-center font-semibold">{item.quantity}</TableCell>
                          <TableCell className="text-sm text-slate-600">{item.original_order_number}</TableCell>
                          <TableCell className="text-sm text-slate-500">{formatDate(item.original_order_date)}</TableCell>
                          <TableCell>
                            <div className="flex justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openNotifyModal(item)}
                                className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                title="Send Notification"
                              >
                                <Bell className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openDeleteModal(item)}
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                title="Remove"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <p className="text-sm text-slate-500 mt-4">
                  Showing {filteredItems.length} pending item{filteredItems.length !== 1 ? 's' : ''}
                </p>
              </>
            ) : (
              <div className="flex flex-col items-center text-slate-400 py-12">
                <CheckCircle className="w-16 h-16 mb-4" />
                <h3 className="text-lg font-medium">No Pending Items</h3>
                <p className="text-sm">All items have been fulfilled</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* By Item Tab - Table View */}
      {activeTab === 'by-item' && (
        <Card>
          <CardContent className="pt-6">
            {/* Info Banner */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <Bell className="w-5 h-5 text-green-600 mt-0.5" />
                <div>
                  <p className="font-medium text-green-800">Stock Arrival Notifications</p>
                  <p className="text-sm text-green-600">Click "Notify All" to send WhatsApp message to all doctors waiting for that item</p>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
              </div>
            ) : filteredItemsGrouped.length > 0 ? (
              <>
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="w-[50px] text-center">#</TableHead>
                        <TableHead>Item Name</TableHead>
                        <TableHead className="w-[100px]">Code</TableHead>
                        <TableHead className="w-[80px] text-center">Total Qty</TableHead>
                        <TableHead className="w-[90px] text-center">Doctors</TableHead>
                        <TableHead className="w-[250px]">Waiting Doctors</TableHead>
                        <TableHead className="w-[120px] text-center">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredItemsGrouped.map((group, index) => (
                        <TableRow key={group.item_code} className="hover:bg-slate-50" data-testid={`item-group-${group.item_code}`}>
                          <TableCell className="text-center text-slate-500">{index + 1}</TableCell>
                          <TableCell>
                            <span className="font-semibold text-slate-800">{group.item_name}</span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-mono text-xs">{group.item_code}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="font-bold text-lg text-slate-800">{group.total_quantity}</span>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className="bg-blue-100 text-blue-700">
                              <Users className="w-3 h-3 mr-1" />
                              {group.doctor_count}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs text-slate-500 space-y-0.5 max-h-16 overflow-y-auto">
                              {group.doctors.slice(0, 3).map((doc, idx) => (
                                <div key={idx}>
                                  {doc.doctor_name || 'N/A'} ({doc.doctor_phone}) - Qty: {doc.quantity}
                                </div>
                              ))}
                              {group.doctors.length > 3 && (
                                <div className="text-slate-400">+{group.doctors.length - 3} more...</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button
                              onClick={() => openNotifyItemModal(group)}
                              className="bg-green-600 hover:bg-green-700 gap-1 w-full"
                              size="sm"
                              data-testid={`notify-all-${group.item_code}`}
                            >
                              <Send className="w-3 h-3" />
                              Notify All
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <p className="text-sm text-slate-500 mt-4">
                  Showing {filteredItemsGrouped.length} unique item{filteredItemsGrouped.length !== 1 ? 's' : ''}
                </p>
              </>
            ) : (
              <div className="flex flex-col items-center text-slate-400 py-12">
                <CheckCircle className="w-16 h-16 mb-4" />
                <h3 className="text-lg font-medium">No Items Pending</h3>
                <p className="text-sm">All stock requirements have been fulfilled</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" />
              Remove Pending Item
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-slate-600 mb-4">
              Are you sure you want to remove this pending item?
            </p>
            {selectedItem && (
              <div className="bg-slate-50 p-4 rounded-lg space-y-2">
                <p className="font-medium">{selectedItem.item_name}</p>
                <p className="text-sm text-slate-500">
                  Code: {selectedItem.item_code} | Qty: {selectedItem.quantity}
                </p>
                <p className="text-sm text-slate-500">
                  Order: {selectedItem.original_order_number}
                </p>
                <p className="text-sm text-slate-500">
                  Doctor: {selectedItem.doctor_name || selectedItem.doctor_phone}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
            <Button onClick={handleDelete} disabled={deleting} className="bg-red-600 hover:bg-red-700">
              {deleting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Single Item Notification Modal */}
      <Dialog open={showNotifyModal} onOpenChange={setShowNotifyModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <Bell className="w-5 h-5" />
              Send Stock Arrived Notification
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-slate-600 mb-4">
              Send a WhatsApp notification to inform the customer that this item is now available.
            </p>
            {selectedItem && (
              <div className="bg-green-50 p-4 rounded-lg border border-green-200 space-y-2">
                <p className="font-medium text-green-800">{selectedItem.item_name}</p>
                <p className="text-sm text-green-600">Code: {selectedItem.item_code} | Qty: {selectedItem.quantity}</p>
                <p className="text-sm text-green-600 pt-2 border-t border-green-200">
                  Will notify: {selectedItem.doctor_name || 'Customer'} ({selectedItem.doctor_phone})
                </p>
              </div>
            )}
            <p className="text-xs text-slate-400 mt-3">
              Note: This will NOT remove the pending item. Remove it manually after order is placed.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNotifyModal(false)}>Cancel</Button>
            <Button onClick={handleNotifySingle} disabled={notifying} className="bg-green-600 hover:bg-green-700">
              {notifying && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Send Notification
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notify All Doctors Modal */}
      <Dialog open={showNotifyItemModal} onOpenChange={setShowNotifyItemModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <Send className="w-5 h-5" />
              Notify All Doctors - Stock Arrived
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-slate-600 mb-4">
              Send WhatsApp notification to ALL doctors waiting for this item.
            </p>
            {selectedItemGroup && (
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <p className="font-medium text-green-800 text-lg">{selectedItemGroup.item_name}</p>
                <p className="text-sm text-green-600">{selectedItemGroup.item_code} | Total Qty: {selectedItemGroup.total_quantity}</p>
                <div className="mt-3 pt-3 border-t border-green-200">
                  <p className="text-sm font-medium text-green-800 mb-2">
                    Will notify {selectedItemGroup.doctor_count} doctor(s):
                  </p>
                  <div className="space-y-1 max-h-32 overflow-y-auto text-sm text-green-700">
                    {selectedItemGroup.doctors.map((doc, idx) => (
                      <p key={idx}>• {doc.doctor_name || 'Unknown'} ({doc.doctor_phone}) - Qty: {doc.quantity}</p>
                    ))}
                  </div>
                </div>
              </div>
            )}
            <p className="text-xs text-slate-400 mt-3">
              Note: This will NOT remove pending items. Remove them manually after orders are placed.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNotifyItemModal(false)}>Cancel</Button>
            <Button onClick={handleNotifyByItem} disabled={notifying} className="bg-green-600 hover:bg-green-700 gap-2">
              {notifying && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              <Send className="w-4 h-4" />
              Send to All ({selectedItemGroup?.doctor_count})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PendingItems;
