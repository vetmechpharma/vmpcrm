import { useState, useEffect, useMemo } from 'react';
import { whatsappAPI, itemsAPI } from '../lib/api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { toast } from 'sonner';
import { MessageCircle, Send, Loader2, Image, FileText, Package, Search } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const MSG_TYPES = [
  { value: 'text', label: 'Text', icon: MessageCircle },
  { value: 'image', label: 'Image', icon: Image },
  { value: 'pdf', label: 'PDF', icon: FileText },
  { value: 'product', label: 'Product', icon: Package },
];

export default function WhatsAppDirectDialog({ open, onOpenChange, recipientName, recipientPhone, recipientRole }) {
  const [msgType, setMsgType] = useState('text');
  const [message, setMessage] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [sending, setSending] = useState(false);

  // Product selection
  const [items, setItems] = useState([]);
  const [itemSearch, setItemSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [loadingItems, setLoadingItems] = useState(false);

  useEffect(() => {
    if (open && msgType === 'product' && items.length === 0) {
      fetchItems();
    }
  }, [open, msgType]);

  useEffect(() => {
    if (!open) {
      setMsgType('text');
      setMessage('');
      setFileUrl('');
      setSelectedItem(null);
      setItemSearch('');
    }
  }, [open]);

  const fetchItems = async () => {
    setLoadingItems(true);
    try {
      const res = await itemsAPI.getAll();
      setItems(res.data || []);
    } catch { toast.error('Failed to load items'); }
    finally { setLoadingItems(false); }
  };

  const filteredItems = useMemo(() => {
    if (!itemSearch.trim()) return items.slice(0, 50);
    const q = itemSearch.toLowerCase();
    return items.filter(i =>
      i.item_name?.toLowerCase().includes(q) || i.item_code?.toLowerCase().includes(q)
    ).slice(0, 50);
  }, [items, itemSearch]);

  const getRolePrice = (item) => {
    const r = recipientRole || 'doctors';
    return {
      rate: item[`rate_${r}`] ?? item.rate,
      offer: item[`offer_${r}`] ?? item.offer,
      specialOffer: item[`special_offer_${r}`] ?? item.special_offer,
    };
  };

  const handleSend = async () => {
    if (msgType === 'text' && !message.trim()) { toast.error('Enter a message'); return; }
    if ((msgType === 'image' || msgType === 'pdf') && !fileUrl.trim()) { toast.error('Enter a file URL'); return; }
    if (msgType === 'product' && !selectedItem) { toast.error('Select a product'); return; }

    setSending(true);
    try {
      const payload = {
        phone: recipientPhone,
        name: recipientName,
        message: message,
        message_type: msgType,
        recipient_role: recipientRole || 'doctors',
      };
      if (msgType === 'image' || msgType === 'pdf') payload.file_url = fileUrl;
      if (msgType === 'product') payload.item_id = selectedItem.id;

      const res = await whatsappAPI.sendDirect(payload);
      if (res.data?.status === 'success') {
        toast.success(res.data.message);
        onOpenChange(false);
      } else {
        toast.error(res.data?.message || 'Failed to send');
      }
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to send WhatsApp'); }
    finally { setSending(false); }
  };

  const canSend = () => {
    if (sending) return false;
    if (msgType === 'text') return message.trim().length > 0;
    if (msgType === 'image' || msgType === 'pdf') return fileUrl.trim().length > 0;
    if (msgType === 'product') return !!selectedItem;
    return false;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="wa-direct-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-green-700">
            <MessageCircle className="w-5 h-5" />Send WhatsApp
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <p className="text-sm text-slate-600">To: <strong>{recipientName}</strong> ({recipientPhone})</p>

          {/* Message Type Tabs */}
          <div className="flex gap-1 p-1 bg-slate-100 rounded-lg" data-testid="wa-msg-type-tabs">
            {MSG_TYPES.map(t => {
              const Icon = t.icon;
              return (
                <button
                  key={t.value}
                  onClick={() => { setMsgType(t.value); if (t.value === 'product' && items.length === 0) fetchItems(); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-all ${
                    msgType === t.value ? 'bg-white text-green-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                  data-testid={`wa-type-${t.value}`}
                >
                  <Icon className="w-3.5 h-3.5" />{t.label}
                </button>
              );
            })}
          </div>

          {/* Product Selector */}
          {msgType === 'product' && (
            <div className="space-y-2" data-testid="wa-product-section">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search products..."
                  value={itemSearch}
                  onChange={e => setItemSearch(e.target.value)}
                  className="pl-8 h-9 text-sm"
                  data-testid="wa-product-search"
                />
              </div>

              {loadingItems ? (
                <div className="flex items-center justify-center py-4 text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
              ) : (
                <div className="max-h-40 overflow-y-auto border rounded-lg divide-y" data-testid="wa-product-list">
                  {filteredItems.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-3">No products found</p>
                  ) : filteredItems.map(item => (
                    <button
                      key={item.id}
                      onClick={() => setSelectedItem(item)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors text-sm ${
                        selectedItem?.id === item.id ? 'bg-green-50 border-l-2 border-green-500' : 'hover:bg-slate-50'
                      }`}
                      data-testid={`wa-product-item-${item.id}`}
                    >
                      {item.image_url ? (
                        <img src={`${API_URL}${item.image_url}`} alt="" className="w-8 h-8 rounded object-cover border flex-shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center flex-shrink-0">
                          <Package className="w-4 h-4 text-slate-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-800 truncate text-xs">{item.item_name}</p>
                        <p className="text-[11px] text-slate-400">{item.item_code} | MRP: Rs.{item.mrp}{getRolePrice(item).rate ? ` | Rate: Rs.${getRolePrice(item).rate}` : ''}</p>
                        {(getRolePrice(item).offer || getRolePrice(item).specialOffer) && (
                          <p className="text-[10px] text-slate-400 truncate">
                            {getRolePrice(item).offer && <span className="text-amber-500">Offer: {getRolePrice(item).offer}</span>}
                            {getRolePrice(item).offer && getRolePrice(item).specialOffer && ' | '}
                            {getRolePrice(item).specialOffer && <span className="text-purple-500">Spl: {getRolePrice(item).specialOffer}</span>}
                          </p>
                        )}
                      </div>
                      {item.out_of_stock && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded">OOS</span>}
                    </button>
                  ))}
                </div>
              )}

              {/* Selected product preview */}
              {selectedItem && (
                <div className="flex items-center gap-3 p-2.5 bg-green-50 rounded-lg border border-green-200" data-testid="wa-selected-product">
                  {selectedItem.image_url ? (
                    <img src={`${API_URL}${selectedItem.image_url}`} alt="" className="w-12 h-12 rounded object-cover border" />
                  ) : (
                    <div className="w-12 h-12 rounded bg-white flex items-center justify-center border">
                      <Package className="w-5 h-5 text-slate-400" />
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-green-800">{selectedItem.item_name}</p>
                    <p className="text-xs text-green-600">MRP: Rs.{selectedItem.mrp} | Code: {selectedItem.item_code}</p>
                    {(() => { const p = getRolePrice(selectedItem); return (
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                        {p.rate && <span className="text-xs text-green-700 font-medium">Rate: Rs.{p.rate}</span>}
                        {p.offer && <span className="text-xs text-amber-600">Offer: {p.offer}</span>}
                        {p.specialOffer && <span className="text-xs text-purple-600">Spl: {p.specialOffer}</span>}
                      </div>
                    ); })()}
                  </div>
                  <button onClick={() => setSelectedItem(null)} className="text-slate-400 hover:text-red-500 text-lg">&times;</button>
                </div>
              )}
            </div>
          )}

          {/* File URL input for image/pdf */}
          {(msgType === 'image' || msgType === 'pdf') && (
            <div className="space-y-1.5" data-testid="wa-file-section">
              <label className="text-xs font-medium text-slate-600">
                {msgType === 'image' ? 'Image URL' : 'PDF URL'}
              </label>
              <Input
                placeholder={msgType === 'image' ? 'https://example.com/image.jpg' : 'https://example.com/document.pdf'}
                value={fileUrl}
                onChange={e => setFileUrl(e.target.value)}
                className="h-9 text-sm"
                data-testid="wa-file-url-input"
              />
              <p className="text-[11px] text-slate-400">
                {msgType === 'image' ? 'Enter a publicly accessible image URL (.jpg, .png)' : 'Enter a publicly accessible PDF URL'}
              </p>
            </div>
          )}

          {/* Message / Caption */}
          <div>
            <label className="text-xs font-medium text-slate-600">
              {msgType === 'text' ? 'Message' : 'Caption / Message'}
            </label>
            <textarea
              rows={msgType === 'text' ? 4 : 2}
              className="w-full border rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-400 mt-1"
              placeholder={msgType === 'product' ? 'Optional caption for product...' : msgType === 'text' ? 'Type your message...' : 'Caption for attachment...'}
              value={message}
              onChange={e => setMessage(e.target.value)}
              data-testid="wa-message-input"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="wa-cancel-btn">Cancel</Button>
          <Button
            onClick={handleSend}
            disabled={!canSend()}
            className="bg-green-600 hover:bg-green-700"
            data-testid="wa-send-btn"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
            Send {msgType !== 'text' ? msgType.charAt(0).toUpperCase() + msgType.slice(1) : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
