import { useState, useEffect, useCallback } from 'react';
import { marketingAPI, itemsAPI } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Checkbox } from '../components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { 
  Megaphone, 
  Send, 
  Users, 
  FileText, 
  Clock, 
  CheckCircle, 
  XCircle,
  Loader2,
  Plus,
  Trash2,
  Edit2,
  Image,
  Package,
  Gift,
  Bell,
  ScrollText,
  Search,
  Filter,
  Play,
  Eye,
  Calendar,
  RefreshCw,
  AlertCircle
} from 'lucide-react';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'pipeline', label: 'Pipeline' },
  { value: 'customer', label: 'Customers' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'not_interested', label: 'Not Interested' },
  { value: 'closed', label: 'Closed' }
];

const ENTITY_OPTIONS = [
  { value: 'all', label: 'All (Doctors, Medicals, Agencies)' },
  { value: 'doctors', label: 'Doctors Only' },
  { value: 'medicals', label: 'Medicals Only' },
  { value: 'agencies', label: 'Agencies Only' }
];

const CAMPAIGN_TYPES = [
  { value: 'product_promo', label: 'Product Promotion', icon: Package, color: 'blue' },
  { value: 'greeting', label: 'Greetings', icon: Gift, color: 'pink' },
  { value: 'announcement', label: 'Announcement', icon: Bell, color: 'amber' },
  { value: 'circular', label: 'Circular/Notice', icon: ScrollText, color: 'purple' }
];

const DEFAULT_TEMPLATES = [
  { name: 'Diwali Greetings', category: 'greeting', message: 'Dear {name},\n\nWishing you and your family a very Happy Diwali! May this festival of lights bring prosperity and happiness to your life.\n\nBest wishes for the festive season!' },
  { name: 'New Year Wishes', category: 'greeting', message: 'Dear {name},\n\nHappy New Year! Wishing you good health, happiness, and success in the coming year.\n\nThank you for being our valued partner.' },
  { name: 'New Product Launch', category: 'announcement', message: 'Dear {name},\n\nWe are excited to announce the launch of our new product!\n\nContact us for more details and special introductory offers.' },
  { name: 'Price Update Notice', category: 'circular', message: 'Dear {name},\n\nThis is to inform you about the updated price list effective from this month.\n\nPlease contact us for the revised rates.' }
];

export const Marketing = () => {
  const [activeTab, setActiveTab] = useState('create');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ total_campaigns: 0, completed_campaigns: 0, messages_sent_this_month: 0 });
  
  // Recipients
  const [recipients, setRecipients] = useState([]);
  const [selectedRecipients, setSelectedRecipients] = useState([]);
  const [entityFilter, setEntityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Templates
  const [templates, setTemplates] = useState([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [templateForm, setTemplateForm] = useState({ name: '', category: 'greeting', message: '', is_active: true });
  
  // Campaign
  const [campaignType, setCampaignType] = useState('greeting');
  const [campaignName, setCampaignName] = useState('');
  const [message, setMessage] = useState('');
  const [selectedItems, setSelectedItems] = useState([]);
  const [items, setItems] = useState([]);
  const [itemSearch, setItemSearch] = useState('');
  const [imageBase64, setImageBase64] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [scheduledAt, setScheduledAt] = useState('');
  const [batchSize, setBatchSize] = useState(10);
  const [batchDelay, setBatchDelay] = useState(60);
  
  // Campaigns History
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [campaignLogs, setCampaignLogs] = useState([]);
  const [showCampaignModal, setShowCampaignModal] = useState(false);

  useEffect(() => {
    fetchRecipients();
    fetchTemplates();
    fetchCampaigns();
    fetchStats();
    fetchItems();
  }, []);

  useEffect(() => {
    fetchRecipients();
  }, [entityFilter, statusFilter]);

  const fetchStats = async () => {
    try {
      const response = await marketingAPI.getStats();
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch stats');
    }
  };

  const fetchRecipients = async () => {
    setLoading(true);
    try {
      const response = await marketingAPI.getRecipients({ 
        entity_type: entityFilter, 
        status: statusFilter 
      });
      setRecipients(response.data || []);
    } catch (error) {
      toast.error('Failed to fetch recipients');
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const response = await marketingAPI.getTemplates();
      setTemplates(response.data || []);
    } catch (error) {
      console.error('Failed to fetch templates');
    }
  };

  const fetchCampaigns = async () => {
    try {
      const response = await marketingAPI.getCampaigns({});
      setCampaigns(response.data?.campaigns || []);
    } catch (error) {
      console.error('Failed to fetch campaigns');
    }
  };

  const fetchItems = async () => {
    try {
      const response = await itemsAPI.getAll({});
      setItems(response.data?.items || response.data || []);
    } catch (error) {
      console.error('Failed to fetch items');
    }
  };

  const handleSelectAll = () => {
    const filteredRecipients = getFilteredRecipients();
    if (selectedRecipients.length === filteredRecipients.length) {
      setSelectedRecipients([]);
    } else {
      setSelectedRecipients(filteredRecipients.map(r => r.id));
    }
  };

  const handleSelectRecipient = (id) => {
    setSelectedRecipients(prev => 
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    );
  };

  const getFilteredRecipients = useCallback(() => {
    return recipients.filter(r => 
      r.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.phone?.includes(searchTerm) ||
      r.customer_code?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [recipients, searchTerm]);

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image must be less than 5MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageBase64(reader.result);
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleApplyTemplate = (template) => {
    setMessage(template.message);
    setCampaignType(template.category);
    toast.success(`Template "${template.name}" applied`);
  };

  const handleSaveTemplate = async () => {
    if (!templateForm.name || !templateForm.message) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      if (editingTemplate) {
        await marketingAPI.updateTemplate(editingTemplate.id, templateForm);
        toast.success('Template updated');
      } else {
        await marketingAPI.createTemplate(templateForm);
        toast.success('Template created');
      }
      fetchTemplates();
      setShowTemplateModal(false);
      setEditingTemplate(null);
      setTemplateForm({ name: '', category: 'greeting', message: '', is_active: true });
    } catch (error) {
      toast.error('Failed to save template');
    }
  };

  const handleDeleteTemplate = async (id) => {
    if (!window.confirm('Delete this template?')) return;
    try {
      await marketingAPI.deleteTemplate(id);
      toast.success('Template deleted');
      fetchTemplates();
    } catch (error) {
      toast.error('Failed to delete template');
    }
  };

  const handleCreateCampaign = async (sendNow = false) => {
    if (!campaignName) {
      toast.error('Please enter a campaign name');
      return;
    }
    if (selectedRecipients.length === 0) {
      toast.error('Please select at least one recipient');
      return;
    }
    if (!message) {
      toast.error('Please enter a message');
      return;
    }

    setLoading(true);
    try {
      const campaignData = {
        name: campaignName,
        campaign_type: campaignType,
        target_entity: entityFilter,
        target_status: statusFilter,
        recipient_ids: selectedRecipients,
        message: message,
        item_ids: campaignType === 'product_promo' ? selectedItems : [],
        image_base64: imageBase64,
        scheduled_at: scheduledAt || null,
        batch_size: batchSize,
        batch_delay_seconds: batchDelay
      };

      const response = await marketingAPI.createCampaign(campaignData);
      toast.success('Campaign created');

      if (sendNow) {
        await marketingAPI.sendCampaign(response.data.id);
        toast.success('Campaign sending started!');
      }

      // Reset form
      setCampaignName('');
      setMessage('');
      setSelectedRecipients([]);
      setSelectedItems([]);
      setImageBase64(null);
      setImagePreview(null);
      setScheduledAt('');
      
      fetchCampaigns();
      fetchStats();
      setActiveTab('history');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create campaign');
    } finally {
      setLoading(false);
    }
  };

  const handleViewCampaign = async (campaign) => {
    try {
      const response = await marketingAPI.getCampaign(campaign.id);
      setSelectedCampaign(response.data.campaign);
      setCampaignLogs(response.data.logs || []);
      setShowCampaignModal(true);
    } catch (error) {
      toast.error('Failed to load campaign details');
    }
  };

  const handleSendCampaign = async (campaignId) => {
    try {
      await marketingAPI.sendCampaign(campaignId);
      toast.success('Campaign sending started!');
      fetchCampaigns();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to start campaign');
    }
  };

  const handleCancelCampaign = async (campaignId) => {
    if (!window.confirm('Cancel this campaign?')) return;
    try {
      await marketingAPI.cancelCampaign(campaignId);
      toast.success('Campaign cancelled');
      fetchCampaigns();
    } catch (error) {
      toast.error('Failed to cancel campaign');
    }
  };

  const filteredRecipients = getFilteredRecipients();
  const filteredItems = items.filter(item => 
    item.name?.toLowerCase().includes(itemSearch.toLowerCase()) ||
    item.item_code?.toLowerCase().includes(itemSearch.toLowerCase())
  );

  const getStatusBadge = (status) => {
    const colors = {
      draft: 'bg-slate-100 text-slate-700',
      scheduled: 'bg-blue-100 text-blue-700',
      sending: 'bg-amber-100 text-amber-700',
      completed: 'bg-emerald-100 text-emerald-700',
      cancelled: 'bg-red-100 text-red-700',
      failed: 'bg-red-100 text-red-700'
    };
    return <Badge className={colors[status] || 'bg-slate-100'}>{status}</Badge>;
  };

  return (
    <div className="space-y-6 animate-fade-in" data-testid="marketing-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2">
            <Megaphone className="w-8 h-8 text-emerald-600" />
            Marketing
          </h1>
          <p className="text-slate-500 mt-1">Send promotional messages via WhatsApp</p>
        </div>
        
        {/* Stats */}
        <div className="flex gap-4">
          <div className="bg-white rounded-lg px-4 py-2 border border-slate-200">
            <p className="text-xs text-slate-500">Total Campaigns</p>
            <p className="text-xl font-bold text-slate-900">{stats.total_campaigns}</p>
          </div>
          <div className="bg-white rounded-lg px-4 py-2 border border-slate-200">
            <p className="text-xs text-slate-500">Messages This Month</p>
            <p className="text-xl font-bold text-emerald-600">{stats.messages_sent_this_month}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          <TabsTrigger value="create" className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Create
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            History
          </TabsTrigger>
        </TabsList>

        {/* Create Campaign Tab */}
        <TabsContent value="create" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Recipients Selection */}
            <Card className="lg:col-span-1">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="w-5 h-5 text-emerald-600" />
                  Select Recipients
                </CardTitle>
                <CardDescription>Choose who will receive the message</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Filters */}
                <div className="space-y-3">
                  <Select value={entityFilter} onValueChange={setEntityFilter}>
                    <SelectTrigger data-testid="entity-filter">
                      <SelectValue placeholder="Select Entity Type" />
                    </SelectTrigger>
                    <SelectContent>
                      {ENTITY_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger data-testid="status-filter">
                      <SelectValue placeholder="Select Status" />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      placeholder="Search by name, phone..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                      data-testid="recipient-search"
                    />
                  </div>
                </div>

                {/* Recipients List */}
                <div className="border rounded-lg max-h-[400px] overflow-y-auto">
                  <div className="sticky top-0 bg-slate-50 px-3 py-2 border-b flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={filteredRecipients.length > 0 && selectedRecipients.length === filteredRecipients.length}
                        onCheckedChange={handleSelectAll}
                        data-testid="select-all-checkbox"
                      />
                      <span className="text-sm font-medium">Select All ({filteredRecipients.length})</span>
                    </div>
                    <Badge variant="secondary">{selectedRecipients.length} selected</Badge>
                  </div>

                  {loading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                    </div>
                  ) : filteredRecipients.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">No recipients found</div>
                  ) : (
                    filteredRecipients.map(recipient => (
                      <div 
                        key={recipient.id}
                        className={`flex items-center gap-3 px-3 py-2 border-b last:border-b-0 hover:bg-slate-50 cursor-pointer ${
                          selectedRecipients.includes(recipient.id) ? 'bg-emerald-50' : ''
                        }`}
                        onClick={() => handleSelectRecipient(recipient.id)}
                      >
                        <Checkbox
                          checked={selectedRecipients.includes(recipient.id)}
                          onCheckedChange={() => handleSelectRecipient(recipient.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{recipient.name}</p>
                          <p className="text-xs text-slate-500">{recipient.phone}</p>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {recipient.type}
                        </Badge>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Right: Message Composer */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Send className="w-5 h-5 text-emerald-600" />
                  Compose Message
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Campaign Name */}
                <div className="space-y-2">
                  <Label>Campaign Name *</Label>
                  <Input
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    placeholder="e.g., Diwali Promotion 2026"
                    data-testid="campaign-name-input"
                  />
                </div>

                {/* Campaign Type */}
                <div className="space-y-2">
                  <Label>Campaign Type</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {CAMPAIGN_TYPES.map(type => {
                      const Icon = type.icon;
                      return (
                        <button
                          key={type.value}
                          type="button"
                          onClick={() => setCampaignType(type.value)}
                          className={`p-3 rounded-lg border-2 transition-all text-center ${
                            campaignType === type.value
                              ? 'border-emerald-500 bg-emerald-50'
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                          data-testid={`type-${type.value}`}
                        >
                          <Icon className={`w-5 h-5 mx-auto mb-1 ${
                            campaignType === type.value ? 'text-emerald-600' : 'text-slate-400'
                          }`} />
                          <span className="text-xs font-medium">{type.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Product Selection (for product_promo) */}
                {campaignType === 'product_promo' && (
                  <div className="space-y-2">
                    <Label>Select Products</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        placeholder="Search products..."
                        value={itemSearch}
                        onChange={(e) => setItemSearch(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <div className="border rounded-lg max-h-[200px] overflow-y-auto">
                      {filteredItems.slice(0, 20).map(item => (
                        <div 
                          key={item.id}
                          className={`flex items-center gap-3 px-3 py-2 border-b last:border-b-0 hover:bg-slate-50 cursor-pointer ${
                            selectedItems.includes(item.id) ? 'bg-blue-50' : ''
                          }`}
                          onClick={() => setSelectedItems(prev => 
                            prev.includes(item.id) ? prev.filter(i => i !== item.id) : [...prev, item.id]
                          )}
                        >
                          <Checkbox checked={selectedItems.includes(item.id)} />
                          <div className="flex-1">
                            <p className="font-medium text-sm">{item.name}</p>
                            <p className="text-xs text-slate-500">MRP: {item.mrp} | Rate: {item.rate}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    {selectedItems.length > 0 && (
                      <p className="text-sm text-emerald-600">{selectedItems.length} products selected</p>
                    )}
                  </div>
                )}

                {/* Message */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Message *</Label>
                    <span className="text-xs text-slate-500">
                      Use {'{name}'} for personalization
                    </span>
                  </div>
                  <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Type your message here..."
                    rows={6}
                    className="resize-none"
                    data-testid="message-textarea"
                  />
                  <p className="text-xs text-slate-500">
                    Note: Random reference number will be added automatically for each recipient
                  </p>
                </div>

                {/* Image Upload */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Image className="w-4 h-4" />
                    Attach Image (Optional)
                  </Label>
                  <div className="flex items-center gap-4">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="flex-1"
                    />
                    {imagePreview && (
                      <div className="relative">
                        <img src={imagePreview} alt="Preview" className="w-16 h-16 object-cover rounded-lg border" />
                        <button
                          type="button"
                          onClick={() => { setImageBase64(null); setImagePreview(null); }}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                        >
                          <XCircle className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Scheduling */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-50 rounded-lg">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Schedule (Optional)
                    </Label>
                    <Input
                      type="datetime-local"
                      value={scheduledAt}
                      onChange={(e) => setScheduledAt(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Batch Size</Label>
                    <Input
                      type="number"
                      value={batchSize}
                      onChange={(e) => setBatchSize(parseInt(e.target.value) || 10)}
                      min={1}
                      max={50}
                    />
                    <p className="text-xs text-slate-500">Messages per batch</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Batch Delay (seconds)</Label>
                    <Input
                      type="number"
                      value={batchDelay}
                      onChange={(e) => setBatchDelay(parseInt(e.target.value) || 60)}
                      min={30}
                      max={300}
                    />
                    <p className="text-xs text-slate-500">Delay between batches</p>
                  </div>
                </div>

                {/* Anti-ban notice */}
                <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-800">
                    <strong>Anti-Ban Protection:</strong> Messages are sent in batches with delays to avoid WhatsApp restrictions. Each message includes a unique reference number.
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={() => handleCreateCampaign(false)}
                    variant="outline"
                    disabled={loading}
                    className="flex-1"
                  >
                    Save as Draft
                  </Button>
                  <Button
                    onClick={() => handleCreateCampaign(true)}
                    disabled={loading || selectedRecipients.length === 0}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                    data-testid="send-campaign-btn"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Send className="w-4 h-4 mr-2" />
                    )}
                    Send to {selectedRecipients.length} Recipients
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-6 mt-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Message Templates</h2>
            <Button onClick={() => { setEditingTemplate(null); setTemplateForm({ name: '', category: 'greeting', message: '', is_active: true }); setShowTemplateModal(true); }}>
              <Plus className="w-4 h-4 mr-2" />
              New Template
            </Button>
          </div>

          {/* Default Templates */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Templates</CardTitle>
              <CardDescription>Click to apply to your message</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {DEFAULT_TEMPLATES.map((template, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleApplyTemplate(template)}
                    className="p-3 border rounded-lg text-left hover:bg-slate-50 transition-colors"
                  >
                    <p className="font-medium text-sm">{template.name}</p>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">{template.message}</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Custom Templates */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Your Templates</CardTitle>
            </CardHeader>
            <CardContent>
              {templates.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  No custom templates yet. Create one to save time!
                </div>
              ) : (
                <div className="space-y-3">
                  {templates.map(template => (
                    <div key={template.id} className="flex items-start justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{template.name}</p>
                          <Badge variant="outline">{template.category}</Badge>
                          {!template.is_active && <Badge variant="secondary">Inactive</Badge>}
                        </div>
                        <p className="text-sm text-slate-500 mt-1 line-clamp-2">{template.message}</p>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleApplyTemplate(template)}
                        >
                          Use
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => { setEditingTemplate(template); setTemplateForm(template); setShowTemplateModal(true); }}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-500"
                          onClick={() => handleDeleteTemplate(template.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-6 mt-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Campaign History</h2>
            <Button variant="outline" onClick={fetchCampaigns}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Campaign</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Type</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Recipients</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Progress</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Status</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Created</th>
                      <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-8 text-slate-500">
                          No campaigns yet. Create your first campaign!
                        </td>
                      </tr>
                    ) : (
                      campaigns.map(campaign => (
                        <tr key={campaign.id} className="border-b hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div>
                                <p className="font-medium">{campaign.name}</p>
                                <p className="text-xs text-slate-500 truncate max-w-[200px]">{campaign.message_preview}</p>
                              </div>
                              {campaign.has_image && (
                                <Image className="w-4 h-4 text-blue-500" title="Has Image" />
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="outline">{campaign.campaign_type}</Badge>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-medium">{campaign.total_recipients}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <CheckCircle className="w-4 h-4 text-emerald-500" />
                              <span className="text-sm">{campaign.sent_count}</span>
                              {campaign.failed_count > 0 && (
                                <>
                                  <XCircle className="w-4 h-4 text-red-500 ml-2" />
                                  <span className="text-sm">{campaign.failed_count}</span>
                                </>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {getStatusBadge(campaign.status)}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-500">
                            {new Date(campaign.created_at).toLocaleDateString()}}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleViewCampaign(campaign)}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              {campaign.status === 'draft' && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-emerald-600"
                                  onClick={() => handleSendCampaign(campaign.id)}
                                >
                                  <Play className="w-4 h-4" />
                                </Button>
                              )}
                              {campaign.status === 'sending' && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-red-500"
                                  onClick={() => handleCancelCampaign(campaign.id)}
                                >
                                  <XCircle className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Template Modal */}
      <Dialog open={showTemplateModal} onOpenChange={setShowTemplateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Edit Template' : 'New Template'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Template Name *</Label>
              <Input
                value={templateForm.name}
                onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                placeholder="e.g., Diwali Greeting"
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={templateForm.category}
                onValueChange={(value) => setTemplateForm({ ...templateForm, category: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CAMPAIGN_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Message *</Label>
              <Textarea
                value={templateForm.message}
                onChange={(e) => setTemplateForm({ ...templateForm, message: e.target.value })}
                placeholder="Type your message..."
                rows={6}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTemplateModal(false)}>Cancel</Button>
            <Button onClick={handleSaveTemplate}>Save Template</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Campaign Details Modal */}
      <Dialog open={showCampaignModal} onOpenChange={setShowCampaignModal}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Campaign Details</DialogTitle>
          </DialogHeader>
          {selectedCampaign && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-slate-500">Status</p>
                  {getStatusBadge(selectedCampaign.status)}
                </div>
                <div>
                  <p className="text-xs text-slate-500">Total Recipients</p>
                  <p className="font-medium">{selectedCampaign.total_recipients}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Sent</p>
                  <p className="font-medium text-emerald-600">{selectedCampaign.sent_count}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Failed</p>
                  <p className="font-medium text-red-600">{selectedCampaign.failed_count}</p>
                </div>
              </div>

              {/* Campaign Image */}
              {selectedCampaign.has_image && selectedCampaign.image_url && (
                <div>
                  <p className="text-xs text-slate-500 mb-2">Attached Image</p>
                  <img 
                    src={`${process.env.REACT_APP_BACKEND_URL}${selectedCampaign.image_url}`}
                    alt="Campaign"
                    className="max-w-xs rounded-lg border shadow-sm"
                  />
                </div>
              )}

              <div>
                <p className="text-xs text-slate-500 mb-1">Message</p>
                <div className="p-3 bg-slate-50 rounded-lg text-sm whitespace-pre-wrap">
                  {selectedCampaign.message}
                </div>
              </div>

              <div>
                <p className="text-xs text-slate-500 mb-2">Delivery Log</p>
                <div className="border rounded-lg max-h-[300px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2">Recipient</th>
                        <th className="text-left px-3 py-2">Phone</th>
                        <th className="text-left px-3 py-2">Ref#</th>
                        <th className="text-left px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {campaignLogs.map(log => (
                        <tr key={log.id} className="border-t">
                          <td className="px-3 py-2">{log.recipient_name || '-'}</td>
                          <td className="px-3 py-2">{log.recipient_phone || '-'}</td>
                          <td className="px-3 py-2 font-mono text-xs">{log.reference_number}</td>
                          <td className="px-3 py-2">
                            {log.status === 'sent' ? (
                              <Badge className="bg-emerald-100 text-emerald-700">Sent</Badge>
                            ) : log.status === 'failed' ? (
                              <Badge className="bg-red-100 text-red-700">Failed</Badge>
                            ) : (
                              <Badge className="bg-slate-100 text-slate-700">Pending</Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Marketing;
