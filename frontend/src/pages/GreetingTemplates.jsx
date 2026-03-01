import { useState, useEffect } from 'react';
import { greetingTemplatesAPI } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { Switch } from '../components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2, Loader2, Gift, Heart, Eye, Clock, Image } from 'lucide-react';
import { formatDateTime } from '../lib/utils';

export const GreetingTemplates = () => {
  const [templates, setTemplates] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('birthday');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [formLoading, setFormLoading] = useState(false);

  const [formData, setFormData] = useState({
    type: 'birthday', message: '', image_url: '', is_active: true
  });

  useEffect(() => { fetchTemplates(); fetchLogs(); }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const r = await greetingTemplatesAPI.getAll();
      setTemplates(r.data);
    } catch (e) { toast.error('Failed to fetch templates'); }
    finally { setLoading(false); }
  };

  const fetchLogs = async () => {
    try { const r = await greetingTemplatesAPI.getLogs(30); setLogs(r.data); }
    catch (e) { console.error('Failed to fetch logs'); }
  };

  const handleAdd = async () => {
    if (!formData.message.trim()) { toast.error('Message is required'); return; }
    if (!formData.message.includes('{customer_name}')) { toast.error('Message must include {customer_name} placeholder'); return; }
    setFormLoading(true);
    try {
      await greetingTemplatesAPI.create(formData);
      toast.success('Template created');
      setShowAddModal(false); resetForm(); fetchTemplates();
    } catch (e) { toast.error('Failed to create template'); }
    finally { setFormLoading(false); }
  };

  const handleEdit = async () => {
    if (!formData.message.trim()) { toast.error('Message is required'); return; }
    setFormLoading(true);
    try {
      await greetingTemplatesAPI.update(selectedTemplate.id, formData);
      toast.success('Template updated');
      setShowEditModal(false); resetForm(); fetchTemplates();
    } catch (e) { toast.error('Failed to update template'); }
    finally { setFormLoading(false); }
  };

  const handleDelete = async () => {
    setFormLoading(true);
    try {
      await greetingTemplatesAPI.delete(selectedTemplate.id);
      toast.success('Template deleted');
      setShowDeleteModal(false); setSelectedTemplate(null); fetchTemplates();
    } catch (e) { toast.error('Failed to delete template'); }
    finally { setFormLoading(false); }
  };

  const handleToggleActive = async (template) => {
    try {
      await greetingTemplatesAPI.update(template.id, { is_active: !template.is_active });
      toast.success(template.is_active ? 'Template deactivated' : 'Template activated');
      fetchTemplates();
    } catch (e) { toast.error('Failed to update template'); }
  };

  const openEditModal = (template) => {
    setSelectedTemplate(template);
    setFormData({ type: template.type, message: template.message, image_url: template.image_url || '', is_active: template.is_active });
    setShowEditModal(true);
  };

  const resetForm = () => {
    setFormData({ type: activeTab || 'birthday', message: '', image_url: '', is_active: true });
    setSelectedTemplate(null);
  };

  const previewMessage = (template) => {
    const preview = template.message
      .replace('{customer_name}', 'Dr. John Smith')
      .replace('{company_name}', 'VMP Distributors');
    setSelectedTemplate({ ...template, preview });
    setShowPreviewModal(true);
  };

  const birthdayTemplates = templates.filter(t => t.type === 'birthday');
  const anniversaryTemplates = templates.filter(t => t.type === 'anniversary');
  const activeCount = templates.filter(t => t.is_active).length;

  const TemplateCard = ({ template }) => (
    <Card className={`transition-all ${!template.is_active ? 'opacity-60' : ''}`} data-testid={`template-card-${template.id}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Badge className={template.type === 'birthday' ? 'bg-pink-100 text-pink-700' : 'bg-purple-100 text-purple-700'}>
                {template.type === 'birthday' ? <Gift className="w-3 h-3 mr-1" /> : <Heart className="w-3 h-3 mr-1" />}
                {template.type}
              </Badge>
              <Badge variant="outline" className={template.is_active ? 'text-green-600 border-green-300' : 'text-slate-400 border-slate-200'}>
                {template.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <p className="text-sm text-slate-700 whitespace-pre-line line-clamp-4">{template.message}</p>
            {template.image_url && (
              <div className="mt-2 flex items-center gap-1 text-xs text-blue-600">
                <Image className="w-3 h-3" />
                <span className="truncate">Image attached</span>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1 flex-shrink-0">
            <Button variant="ghost" size="icon" onClick={() => previewMessage(template)} title="Preview" className="h-8 w-8">
              <Eye className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => openEditModal(template)} title="Edit" className="h-8 w-8">
              <Edit2 className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => { setSelectedTemplate(template); setShowDeleteModal(true); }} title="Delete" className="h-8 w-8 text-red-600">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <div className="flex items-center justify-between mt-3 pt-3 border-t">
          <div className="flex items-center gap-2">
            <Switch checked={template.is_active} onCheckedChange={() => handleToggleActive(template)} data-testid={`toggle-active-${template.id}`} />
            <span className="text-xs text-slate-500">{template.is_active ? 'Active' : 'Inactive'}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6" data-testid="greeting-templates-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Greeting Templates</h1>
          <p className="text-slate-600">Auto-sent at 10 AM daily to birthday/anniversary contacts via WhatsApp & Email</p>
        </div>
        <Button onClick={() => { resetForm(); setShowAddModal(true); }} data-testid="add-template-btn">
          <Plus className="w-4 h-4 mr-2" />Add Template
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Templates', count: templates.length, color: 'bg-slate-100', textColor: 'text-slate-600' },
          { label: 'Active', count: activeCount, color: 'bg-green-100', textColor: 'text-green-600' },
          { label: 'Birthday', count: birthdayTemplates.length, color: 'bg-pink-100', textColor: 'text-pink-600', icon: Gift },
          { label: 'Anniversary', count: anniversaryTemplates.length, color: 'bg-purple-100', textColor: 'text-purple-600', icon: Heart },
        ].map(s => (
          <Card key={s.label}><CardContent className="p-4"><div className="flex items-center gap-3">
            <div className={`w-10 h-10 ${s.color} rounded-lg flex items-center justify-center`}>
              {s.icon ? <s.icon className={`w-5 h-5 ${s.textColor}`} /> : <span className={`text-lg font-bold ${s.textColor}`}>#</span>}
            </div>
            <div><p className={`text-2xl font-bold ${s.textColor}`}>{s.count}</p><p className="text-sm text-slate-500">{s.label}</p></div>
          </div></CardContent></Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="birthday" className="gap-2"><Gift className="w-4 h-4" />Birthday ({birthdayTemplates.length})</TabsTrigger>
          <TabsTrigger value="anniversary" className="gap-2"><Heart className="w-4 h-4" />Anniversary ({anniversaryTemplates.length})</TabsTrigger>
          <TabsTrigger value="logs" className="gap-2"><Clock className="w-4 h-4" />Sent Log</TabsTrigger>
        </TabsList>

        <TabsContent value="birthday" className="mt-4">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
          ) : birthdayTemplates.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {birthdayTemplates.map(t => <TemplateCard key={t.id} template={t} />)}
            </div>
          ) : (
            <div className="text-center py-12"><Gift className="w-12 h-12 text-slate-300 mx-auto mb-4" /><h3 className="text-lg font-medium text-slate-600">No birthday templates</h3></div>
          )}
        </TabsContent>

        <TabsContent value="anniversary" className="mt-4">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
          ) : anniversaryTemplates.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {anniversaryTemplates.map(t => <TemplateCard key={t.id} template={t} />)}
            </div>
          ) : (
            <div className="text-center py-12"><Heart className="w-12 h-12 text-slate-300 mx-auto mb-4" /><h3 className="text-lg font-medium text-slate-600">No anniversary templates</h3></div>
          )}
        </TabsContent>

        <TabsContent value="logs" className="mt-4">
          <Card><CardContent className="pt-6">
            {logs.length > 0 ? (
              <div className="space-y-3">
                {logs.map((log, i) => (
                  <div key={log.id || i} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                    <div className={`w-8 h-8 flex-shrink-0 rounded-full flex items-center justify-center ${log.greeting_type === 'birthday' ? 'bg-pink-100' : 'bg-purple-100'}`}>
                      {log.greeting_type === 'birthday' ? <Gift className="w-4 h-4 text-pink-600" /> : <Heart className="w-4 h-4 text-purple-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{log.contact_name}</p>
                      <p className="text-xs text-slate-500">{log.contact_phone} {log.contact_email ? `| ${log.contact_email}` : ''}</p>
                      <p className="text-xs text-slate-400 mt-1">{formatDateTime(log.sent_at)}</p>
                    </div>
                    <Badge className={log.greeting_type === 'birthday' ? 'bg-pink-100 text-pink-700' : 'bg-purple-100 text-purple-700'}>{log.greeting_type}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12"><Clock className="w-12 h-12 text-slate-300 mx-auto mb-4" /><h3 className="text-lg font-medium text-slate-600">No greetings sent yet</h3><p className="text-sm text-slate-400">Greetings are automatically sent at 10 AM daily</p></div>
            )}
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      {/* Add/Edit Modal */}
      <Dialog open={showAddModal || showEditModal} onOpenChange={() => { setShowAddModal(false); setShowEditModal(false); resetForm(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{showEditModal ? 'Edit Template' : 'Add New Template'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={formData.type} onValueChange={(v) => setFormData({...formData, type: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="birthday">Birthday</SelectItem>
                  <SelectItem value="anniversary">Anniversary</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Message *</Label>
              <Textarea
                value={formData.message}
                onChange={(e) => setFormData({...formData, message: e.target.value})}
                placeholder={"Dear {customer_name},\n\nHappy Birthday! Wishing you joy and happiness.\n\nWarm regards,\n{company_name}"}
                rows={6}
                data-testid="template-message-input"
              />
              <p className="text-xs text-slate-500">
                Use <code className="bg-slate-100 px-1 rounded">{'{customer_name}'}</code> and <code className="bg-slate-100 px-1 rounded">{'{company_name}'}</code> as placeholders
              </p>
            </div>
            <div className="space-y-2">
              <Label>Image URL (Optional)</Label>
              <Input
                value={formData.image_url}
                onChange={(e) => setFormData({...formData, image_url: e.target.value})}
                placeholder="https://example.com/greeting-image.jpg"
                data-testid="template-image-input"
              />
              <p className="text-xs text-slate-500">Paste an image URL to attach to WhatsApp & Email greetings</p>
            </div>
            {formData.image_url && (
              <div className="border rounded-lg p-2">
                <img src={formData.image_url} alt="Preview" className="max-h-32 rounded object-contain mx-auto" onError={(e) => { e.target.style.display = 'none'; }} />
              </div>
            )}
            <div className="flex items-center gap-3">
              <Switch checked={formData.is_active} onCheckedChange={(v) => setFormData({...formData, is_active: v})} />
              <Label>Active (will be used for auto-sending)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddModal(false); setShowEditModal(false); resetForm(); }}>Cancel</Button>
            <Button onClick={showEditModal ? handleEdit : handleAdd} disabled={formLoading} data-testid="template-save-btn">
              {formLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {showEditModal ? 'Update' : 'Create'} Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Modal */}
      <Dialog open={showPreviewModal} onOpenChange={setShowPreviewModal}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Template Preview</DialogTitle></DialogHeader>
          {selectedTemplate && (
            <div className="py-4">
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 max-w-sm mx-auto">
                {selectedTemplate.image_url && (
                  <img src={selectedTemplate.image_url} alt="Greeting" className="w-full rounded-lg mb-3" onError={(e) => { e.target.style.display = 'none'; }} />
                )}
                <p className="text-sm whitespace-pre-line">{selectedTemplate.preview}</p>
              </div>
              <p className="text-center text-xs text-slate-400 mt-3">WhatsApp message preview (sample names used)</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-red-600">Delete Template</DialogTitle></DialogHeader>
          <p className="py-4">Are you sure you want to delete this {selectedTemplate?.type} template?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
            <Button onClick={handleDelete} disabled={formLoading} className="bg-red-600 hover:bg-red-700">
              {formLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GreetingTemplates;
