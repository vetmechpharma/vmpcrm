import { useState, useEffect } from 'react';
import { pendingItemsAPI } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
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
  Hash
} from 'lucide-react';
import { formatDateTime } from '../lib/utils';

export const PendingItems = () => {
  const [pendingItems, setPendingItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchPendingItems();
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

  const handleDelete = async () => {
    if (!selectedItem) return;
    
    setDeleting(true);
    try {
      await pendingItemsAPI.delete(selectedItem.id);
      toast.success('Pending item removed successfully');
      setShowDeleteModal(false);
      setSelectedItem(null);
      fetchPendingItems();
    } catch (error) {
      toast.error('Failed to delete pending item');
    } finally {
      setDeleting(false);
    }
  };

  const openDeleteModal = (item) => {
    setSelectedItem(item);
    setShowDeleteModal(true);
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

  return (
    <div className="space-y-6" data-testid="pending-items-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Pending Items</h1>
          <p className="text-slate-500">Items waiting for stock availability - follow up with customers</p>
        </div>
        <Button onClick={fetchPendingItems} variant="outline" className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* Stats Card */}
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
                <p className="text-sm text-slate-500">Doctors to Follow Up</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-100 rounded-lg">
                <Clock className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">
                  {pendingItems.length > 0 
                    ? Math.ceil((new Date() - new Date(pendingItems[pendingItems.length - 1]?.created_at)) / (1000 * 60 * 60 * 24))
                    : 0}
                </p>
                <p className="text-sm text-slate-500">Oldest Item (Days)</p>
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

      {/* Pending Items List - Grouped by Doctor */}
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
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openDeleteModal(item)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        data-testid={`delete-pending-${item.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
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
              <p className="text-sm">All items have been fulfilled or no items marked as pending</p>
            </div>
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
              data-testid="confirm-delete-pending"
            >
              {deleting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PendingItems;
