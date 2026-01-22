import { useState, useEffect } from 'react';
import { pendingItemsAPI } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
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
  Users
} from 'lucide-react';
import { formatDateTime } from '../lib/utils';

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Pending Items</h1>
          <p className="text-slate-500">Items waiting for stock - Send notifications when available</p>
        </div>
        <Button onClick={() => { fetchPendingItems(); fetchItemsGrouped(); }} variant="outline" className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-orange-100 rounded-lg">
                <Package className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{pendingItems.length}</p>
                <p className="text-sm text-slate-500">Total Pending Items</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <User className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{Object.keys(groupedByDoctor).length}</p>
                <p className="text-sm text-slate-500">Doctors Waiting</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Hash className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{itemsGrouped.length}</p>
                <p className="text-sm text-slate-500">Unique Items Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <Input
              placeholder="Search by doctor name, phone, item name, or order number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="pending-search-input"
            />
          </div>
        </CardContent>
      </Card>

      {/* Tabs - By Doctor or By Item */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="by-doctor" className="gap-2">
            <User className="w-4 h-4" />
            By Doctor
          </TabsTrigger>
          <TabsTrigger value="by-item" className="gap-2">
            <Package className="w-4 h-4" />
            By Item (Stock Arrival)
          </TabsTrigger>
        </TabsList>

        {/* By Doctor Tab */}
        <TabsContent value="by-doctor" className="mt-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
          ) : Object.keys(groupedByDoctor).length > 0 ? (
            <div className="space-y-4">
              {Object.values(groupedByDoctor).map((group) => (
                <Card key={group.doctor_phone} className="overflow-hidden">
                  <CardHeader className="bg-slate-50 py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-white rounded-full shadow-sm">
                          <User className="w-5 h-5 text-slate-600" />
                        </div>
                        <div>
                          <CardTitle className="text-base">
                            {group.doctor_name || 'Unknown Doctor'}
                          </CardTitle>
                          <div className="flex items-center gap-1 text-sm text-slate-500">
                            <Phone className="w-3 h-3" />
                            {group.doctor_phone}
                          </div>
                        </div>
                      </div>
                      <Badge className="bg-orange-100 text-orange-700">
                        {group.items.length} pending item{group.items.length > 1 ? 's' : ''}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y">
                      {group.items.map((item) => (
                        <div key={item.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-slate-800">{item.item_name}</span>
                              <Badge variant="outline" className="text-xs">{item.item_code}</Badge>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-slate-500">
                              <span className="flex items-center gap-1">
                                <Package className="w-3 h-3" />
                                Qty: {item.quantity}
                              </span>
                              <span className="flex items-center gap-1">
                                <Hash className="w-3 h-3" />
                                {item.original_order_number}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {formatDateTime(item.original_order_date)}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openNotifyModal(item)}
                              className="text-green-600 hover:text-green-700 hover:bg-green-50"
                              title="Send Stock Arrived Notification"
                            >
                              <Bell className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openDeleteModal(item)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              title="Remove"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-16">
                <div className="flex flex-col items-center text-slate-400">
                  <AlertCircle className="w-16 h-16 mb-4" />
                  <h3 className="text-lg font-medium">No Pending Items</h3>
                  <p className="text-sm">All items have been fulfilled</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* By Item Tab - For Stock Arrival Notifications */}
        <TabsContent value="by-item" className="mt-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
          ) : filteredItemsGrouped.length > 0 ? (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-3">
                  <Bell className="w-5 h-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-green-800">Stock Arrival Notifications</p>
                    <p className="text-sm text-green-600">Click "Notify All" to send WhatsApp message to all doctors waiting for that item</p>
                  </div>
                </div>
              </div>

              {filteredItemsGrouped.map((itemGroup) => (
                <Card key={itemGroup.item_code} className="overflow-hidden">
                  <CardHeader className="bg-purple-50 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-white rounded-full shadow-sm">
                          <Package className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{itemGroup.item_name}</CardTitle>
                          <div className="flex items-center gap-2 text-sm text-slate-500">
                            <Badge variant="outline">{itemGroup.item_code}</Badge>
                            <span>Total Qty: {itemGroup.total_quantity}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className="bg-blue-100 text-blue-700 gap-1">
                          <Users className="w-3 h-3" />
                          {itemGroup.doctor_count} doctor{itemGroup.doctor_count > 1 ? 's' : ''}
                        </Badge>
                        <Button
                          onClick={() => openNotifyItemModal(itemGroup)}
                          className="bg-green-600 hover:bg-green-700 gap-2"
                          size="sm"
                          data-testid={`notify-all-${itemGroup.item_code}`}
                        >
                          <Send className="w-4 h-4" />
                          Notify All
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y">
                      {itemGroup.doctors.map((doctor, index) => (
                        <div key={index} className="p-3 flex items-center justify-between hover:bg-slate-50 text-sm">
                          <div className="flex items-center gap-3">
                            <User className="w-4 h-4 text-slate-400" />
                            <div>
                              <span className="font-medium">{doctor.doctor_name || 'Unknown'}</span>
                              <span className="text-slate-400 ml-2">({doctor.doctor_phone})</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 text-slate-500">
                            <span>Qty: {doctor.quantity}</span>
                            <span>{doctor.original_order_number}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-16">
                <div className="flex flex-col items-center text-slate-400">
                  <CheckCircle className="w-16 h-16 mb-4" />
                  <h3 className="text-lg font-medium">No Items Pending</h3>
                  <p className="text-sm">All stock requirements have been fulfilled</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

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
              Are you sure you want to remove this pending item? This action cannot be undone.
            </p>
            {selectedItem && (
              <div className="bg-slate-50 p-4 rounded-lg">
                <p className="font-medium">{selectedItem.item_name}</p>
                <p className="text-sm text-slate-500">
                  Qty: {selectedItem.quantity} | From: {selectedItem.original_order_number}
                </p>
                <p className="text-sm text-slate-500">
                  Doctor: {selectedItem.doctor_name || selectedItem.doctor_phone}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleDelete} 
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Single Item Stock Arrived Notification Modal */}
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
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <p className="font-medium text-green-800">{selectedItem.item_name}</p>
                <p className="text-sm text-green-600">
                  Qty: {selectedItem.quantity}
                </p>
                <p className="text-sm text-green-600 mt-2">
                  Will notify: {selectedItem.doctor_name || 'Customer'} ({selectedItem.doctor_phone})
                </p>
              </div>
            )}
            <p className="text-xs text-slate-400 mt-3">
              Note: This will NOT remove the pending item. Remove it manually after the customer places an order.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNotifyModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleNotifySingle} 
              disabled={notifying}
              className="bg-green-600 hover:bg-green-700"
            >
              {notifying && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Send Notification
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Item-wise Stock Arrived Notification Modal */}
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
                <p className="text-sm text-green-600">{selectedItemGroup.item_code}</p>
                <div className="mt-3 pt-3 border-t border-green-200">
                  <p className="text-sm font-medium text-green-800 mb-2">
                    Will notify {selectedItemGroup.doctor_count} doctor(s):
                  </p>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {selectedItemGroup.doctors.map((doc, idx) => (
                      <p key={idx} className="text-sm text-green-700">
                        • {doc.doctor_name || 'Unknown'} ({doc.doctor_phone}) - Qty: {doc.quantity}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            )}
            <p className="text-xs text-slate-400 mt-3">
              Note: This will NOT remove pending items. Remove them manually after customers place orders.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNotifyItemModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleNotifyByItem} 
              disabled={notifying}
              className="bg-green-600 hover:bg-green-700 gap-2"
            >
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
