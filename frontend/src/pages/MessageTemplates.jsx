import { useState, useEffect, useMemo } from 'react';
import { templatesAPI } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
import {
  Loader2, Save, RotateCcw, MessageCircle, Mail, Info, Eye, EyeOff,
  Search, Pencil, X, Copy, Tag, Clock
} from 'lucide-react';

// Variable descriptions for documentation
const VARIABLE_DESCRIPTIONS = {
  otp: 'One-time password code',
  company_short_name: 'Short company name from settings',
  company_name: 'Full company name from settings',
  company_phone: 'Company phone number',
  customer_name: 'Customer/Doctor/Medical name',
  order_number: 'Order reference number',
  item_count: 'Number of items in order',
  items_text: 'Formatted list of items (WA)',
  items_html: 'HTML formatted list of items (Email)',
  transport_name: 'Transport/courier name',
  tracking_number: 'Shipment tracking number',
  amount: 'Payment amount',
  payment_mode: 'Payment method (Cash/Online/Cheque)',
  balance: 'Outstanding balance amount',
  item_name: 'Product/Item name',
  item_code: 'Product/Item code',
  customer_code: 'Customer unique code',
  reason: 'Decline/cancellation reason',
  new_password: 'New generated password',
  period: 'Statement period (e.g., Jan 2026)',
  total_balance: 'Total outstanding balance',
  summary: 'Summary text/HTML content',
  ticket_number: 'Support ticket number',
  status: 'Current status text',
};

// Template usage context
const TEMPLATE_USAGE = {
  otp: 'Sent during login/registration OTP verification',
  order_confirmation: 'Sent when a new order is placed',
  status_confirmed: 'Sent when order status changes to Confirmed',
  status_processing: 'Sent when order status changes to Processing',
  status_ready: 'Sent when order is Ready to Dispatch',
  status_dispatched: 'Sent when order is Dispatched/Shipped',
  status_delivered: 'Sent when order is Delivered',
  payment_receipt: 'Sent when a payment is recorded',
  out_of_stock: 'Sent when items in an order are out of stock',
  stock_arrived: 'Sent when previously out-of-stock items are available',
  account_approved: 'Sent when customer registration is approved',
  account_declined: 'Sent when customer registration is declined',
  password_reset: 'Sent when admin resets a customer password',
  test_message: 'Used for testing WhatsApp configuration',
  daily_reminder: 'Sent daily to customers with pending orders',
  ledger_statement: 'Sent with ledger statement PDF attachment',
  birthday_greeting: 'Auto-sent on customer birthday',
  anniversary_greeting: 'Auto-sent on customer anniversary',
  order_confirmation_email: 'Email sent when a new order is placed',
  order_confirmed_email: 'Email sent when order is confirmed',
  order_dispatched_email: 'Email sent when order is dispatched',
  order_delivered_email: 'Email sent when order is delivered',
  order_cancelled_email: 'Email sent when order is cancelled',
  payment_receipt_email: 'Email sent when payment is received',
  account_approved_email: 'Email sent when customer account is approved',
  account_declined_email: 'Email sent when customer registration is declined',
  ledger_statement_email: 'Email sent with ledger statement attachment',
  ticket_status_email: 'Email sent on support ticket status change',
  ticket_reply_email: 'Email sent when new ticket reply is added',
  out_of_stock_email: 'Email sent when items are out of stock',
  daily_reminder_email: 'Daily order summary email',
};

// Sample values for preview rendering
const SAMPLE_VALUES = {
  otp: '482913',
  company_short_name: 'VMP Pharma',
  company_name: 'VMP Pharmaceuticals Pvt. Ltd.',
  company_phone: '9876543210',
  customer_name: 'Dr. Rajesh Kumar',
  order_number: 'ORD-2026-0451',
  item_count: '3',
  items_text: '1. Amoxicillin 500mg - Qty: 10\n2. Paracetamol IP - Qty: 20\n3. Vitamin B Complex - Qty: 5',
  items_html: '<ul><li>Amoxicillin 500mg - Qty: 10</li><li>Paracetamol IP - Qty: 20</li><li>Vitamin B Complex - Qty: 5</li></ul>',
  transport_name: 'VRL Logistics',
  tracking_number: 'TRK-9876543',
  amount: '12,500',
  payment_mode: 'Online Transfer',
  balance: '3,200',
  item_name: 'Amoxicillin 500mg',
  item_code: 'AMX-500',
  customer_code: 'CUST-0125',
  reason: 'Incomplete documentation',
  new_password: 'temp@1234',
  period: 'January 2026',
  total_balance: '45,000',
  summary: 'Pending Orders: 3 | Dispatched: 5 | Delivered: 12',
  ticket_number: 'TKT-0089',
  status: 'RESOLVED',
};

export const MessageTemplates = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [editingKey, setEditingKey] = useState(null);
  const [editText, setEditText] = useState('');
  const [editSubject, setEditSubject] = useState('');
  const [previewKey, setPreviewKey] = useState(null);
  const [tab, setTab] = useState('whatsapp');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await templatesAPI.getAll(tab);
      setTemplates(res.data || []);
    } catch { toast.error('Failed to load templates'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchTemplates(); }, [tab]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return templates;
    const q = searchQuery.toLowerCase();
    return templates.filter(t =>
      t.name?.toLowerCase().includes(q) || t.key?.toLowerCase().includes(q) ||
      t.template?.toLowerCase().includes(q)
    );
  }, [templates, searchQuery]);

  const handleEdit = (tmpl) => {
    setEditingKey(tmpl.key);
    setEditText(tmpl.template || '');
    setEditSubject(tmpl.subject || '');
    setPreviewKey(null);
  };

  const handleSave = async (tmpl) => {
    setSaving(tmpl.key);
    try {
      await templatesAPI.update(tmpl.key, {
        name: tmpl.name,
        category: tmpl.category,
        variables: tmpl.variables,
        template: editText,
        subject: editSubject,
      });
      toast.success('Template saved');
      setEditingKey(null);
      fetchTemplates();
    } catch { toast.error('Failed to save template'); }
    finally { setSaving(null); }
  };

  const handleReset = async (tmpl) => {
    if (!window.confirm('Reset this template to default? Your customizations will be lost.')) return;
    try {
      await templatesAPI.reset(tmpl.key);
      toast.success('Template reset to default');
      setEditingKey(null);
      fetchTemplates();
    } catch { toast.error('Failed to reset template'); }
  };

  const insertVariable = (varName) => {
    const textarea = document.getElementById('template-editor');
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const before = editText.substring(0, start);
      const after = editText.substring(end);
      setEditText(`${before}{${varName}}${after}`);
      setTimeout(() => {
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = start + varName.length + 2;
      }, 50);
    } else {
      setEditText(prev => prev + `{${varName}}`);
    }
  };

  const renderPreview = (template, category) => {
    let rendered = template || '';
    for (const [key, val] of Object.entries(SAMPLE_VALUES)) {
      rendered = rendered.replace(new RegExp(`\\{${key}\\}`, 'g'), val);
    }
    if (category === 'email') {
      return <div className="prose prose-sm max-w-none text-sm" dangerouslySetInnerHTML={{ __html: rendered }} />;
    }
    // WhatsApp: convert *bold* to <strong>
    rendered = rendered.replace(/\*(.*?)\*/g, '<strong>$1</strong>');
    rendered = rendered.replace(/\n/g, '<br/>');
    return <div className="text-sm" dangerouslySetInnerHTML={{ __html: rendered }} />;
  };

  const copyTemplate = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Template copied to clipboard');
  };

  return (
    <div className="animate-fade-in max-w-6xl mx-auto" data-testid="message-templates-page">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Message Templates</h1>
        <p className="text-slate-500 mt-1">Manage all WhatsApp and Email notification templates</p>
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
        <div className="flex gap-2" data-testid="template-tabs">
          <Button
            variant={tab === 'whatsapp' ? 'default' : 'outline'}
            onClick={() => { setTab('whatsapp'); setEditingKey(null); setPreviewKey(null); setSearchQuery(''); }}
            className={tab === 'whatsapp' ? 'bg-green-600 hover:bg-green-700' : ''}
            data-testid="tab-whatsapp"
          >
            <MessageCircle className="w-4 h-4 mr-2" />
            WhatsApp ({templates.length})
          </Button>
          <Button
            variant={tab === 'email' ? 'default' : 'outline'}
            onClick={() => { setTab('email'); setEditingKey(null); setPreviewKey(null); setSearchQuery(''); }}
            className={tab === 'email' ? 'bg-blue-600 hover:bg-blue-700' : ''}
            data-testid="tab-email"
          >
            <Mail className="w-4 h-4 mr-2" />
            Email Templates
          </Button>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
            data-testid="template-search"
          />
        </div>
      </div>

      {/* Info bar */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-5 flex items-start gap-2">
        <Info className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-amber-700">
          Use <code className="bg-amber-100 px-1 rounded font-mono">{'{'}<em>variable</em>{'}'}</code> to insert dynamic values.
          Click any template to <strong>edit</strong>, or use the <Eye className="w-3 h-3 inline" /> icon to <strong>preview</strong> with sample data.
          {tab === 'whatsapp' && <> Use <code className="bg-amber-100 px-1 rounded font-mono">*text*</code> for bold.</>}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          {searchQuery ? 'No templates match your search' : 'No templates found'}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((tmpl) => {
            const isEditing = editingKey === tmpl.key;
            const isPreviewing = previewKey === tmpl.key;
            const usage = TEMPLATE_USAGE[tmpl.key];
            const isWa = tmpl.category === 'whatsapp';

            return (
              <Card
                key={tmpl.key}
                className={`transition-shadow ${isEditing ? 'ring-2 ring-blue-300 shadow-lg' : isPreviewing ? 'ring-2 ring-purple-200' : 'hover:shadow-md'}`}
                data-testid={`template-card-${tmpl.key}`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {isWa ? <MessageCircle className="w-4 h-4 text-green-500 flex-shrink-0" /> : <Mail className="w-4 h-4 text-blue-500 flex-shrink-0" />}
                      <CardTitle className="text-sm">{tmpl.name}</CardTitle>
                      {tmpl.is_default && <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded flex-shrink-0">Default</span>}
                      {!tmpl.is_default && tmpl.updated_at && <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-600 rounded flex-shrink-0">Customized</span>}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7"
                        title="Preview"
                        onClick={() => { setPreviewKey(isPreviewing ? null : tmpl.key); if (isEditing) setEditingKey(null); }}
                        data-testid={`preview-btn-${tmpl.key}`}
                      >
                        {isPreviewing ? <EyeOff className="w-3.5 h-3.5 text-purple-500" /> : <Eye className="w-3.5 h-3.5 text-slate-400" />}
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7"
                        title="Edit"
                        onClick={() => { isEditing ? setEditingKey(null) : handleEdit(tmpl); if (isPreviewing) setPreviewKey(null); }}
                        data-testid={`edit-btn-${tmpl.key}`}
                      >
                        {isEditing ? <X className="w-3.5 h-3.5 text-blue-500" /> : <Pencil className="w-3.5 h-3.5 text-slate-400" />}
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7"
                        title="Copy template"
                        onClick={() => copyTemplate(tmpl.template)}
                        data-testid={`copy-btn-${tmpl.key}`}
                      >
                        <Copy className="w-3.5 h-3.5 text-slate-400" />
                      </Button>
                    </div>
                  </div>

                  {/* Meta info */}
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 font-mono bg-slate-50 px-1.5 py-0.5 rounded">
                      <Tag className="w-3 h-3" />{tmpl.key}
                    </span>
                    {usage && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
                        <Clock className="w-3 h-3" />{usage}
                      </span>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="pt-0">
                  {/* Normal view - template text */}
                  {!isEditing && !isPreviewing && (
                    <div>
                      {tmpl.category === 'email' && tmpl.subject && (
                        <p className="text-xs text-slate-500 mb-1"><strong>Subject:</strong> {tmpl.subject}</p>
                      )}
                      <pre className="text-xs text-slate-600 bg-slate-50 rounded p-3 whitespace-pre-wrap font-mono max-h-28 overflow-y-auto border">
                        {tmpl.template}
                      </pre>
                      {/* Variables summary */}
                      {tmpl.variables?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {tmpl.variables.map(v => (
                            <span key={v} className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded font-mono border border-blue-100" title={VARIABLE_DESCRIPTIONS[v] || v}>
                              {'{'}{v}{'}'}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Preview mode */}
                  {isPreviewing && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Eye className="w-4 h-4 text-purple-500" />
                        <span className="text-xs font-semibold text-purple-700 uppercase tracking-wide">Live Preview (Sample Data)</span>
                      </div>
                      {tmpl.category === 'email' && tmpl.subject && (
                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-2 mb-2">
                          <p className="text-xs text-purple-600"><strong>Subject:</strong> {tmpl.subject.replace(/\{(\w+)\}/g, (_, k) => SAMPLE_VALUES[k] || `{${k}}`)}</p>
                        </div>
                      )}
                      <div className={`rounded-lg p-4 border ${isWa ? 'bg-[#e5ddd5]' : 'bg-white'}`}>
                        {isWa ? (
                          <div className="bg-white rounded-lg p-3 shadow-sm max-w-md">
                            {renderPreview(tmpl.template, tmpl.category)}
                          </div>
                        ) : (
                          <div className="border rounded-lg overflow-hidden">
                            <div className="bg-gradient-to-r from-slate-800 to-slate-600 px-4 py-3 text-center">
                              <span className="text-white font-bold text-sm">VMP Pharmaceuticals</span>
                            </div>
                            <div className="p-4">{renderPreview(tmpl.template, tmpl.category)}</div>
                          </div>
                        )}
                      </div>
                      {/* Variable reference */}
                      <div className="bg-slate-50 rounded-lg p-3 border">
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Variables Used</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                          {(tmpl.variables || []).map(v => (
                            <div key={v} className="flex items-start gap-1.5 text-xs">
                              <code className="text-blue-600 font-mono bg-blue-50 px-1 rounded flex-shrink-0">{'{'}{v}{'}'}</code>
                              <span className="text-slate-500">{VARIABLE_DESCRIPTIONS[v] || 'Custom variable'}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Edit mode */}
                  {isEditing && (
                    <div className="space-y-3">
                      {tmpl.category === 'email' && (
                        <div>
                          <Label className="text-xs mb-1 block text-slate-600">Email Subject</Label>
                          <Input
                            value={editSubject}
                            onChange={e => setEditSubject(e.target.value)}
                            placeholder="Email subject line..."
                            className="font-mono text-sm"
                            data-testid={`subject-input-${tmpl.key}`}
                          />
                        </div>
                      )}
                      <div>
                        <Label className="text-xs mb-1 block text-slate-600">
                          {tmpl.category === 'email' ? 'HTML Body' : 'Message Template'}
                        </Label>
                        <textarea
                          id="template-editor"
                          value={editText}
                          onChange={e => setEditText(e.target.value)}
                          rows={10}
                          className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm font-mono resize-y focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none bg-slate-50"
                          placeholder="Enter template text..."
                          data-testid={`template-editor-${tmpl.key}`}
                        />
                      </div>

                      {/* Clickable variable chips with descriptions */}
                      <div>
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Click to insert variable</p>
                        <div className="flex flex-wrap gap-1.5">
                          {(tmpl.variables || []).map(v => (
                            <button
                              key={v}
                              type="button"
                              onClick={() => insertVariable(v)}
                              className="group inline-flex items-center gap-1 text-xs px-2 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full hover:bg-blue-100 transition-colors font-mono"
                              title={VARIABLE_DESCRIPTIONS[v] || v}
                              data-testid={`var-chip-${v}`}
                            >
                              {'{'}{v}{'}'}
                              <span className="hidden group-hover:inline text-blue-400 font-sans text-[10px] ml-1">{VARIABLE_DESCRIPTIONS[v] ? `- ${VARIABLE_DESCRIPTIONS[v]}` : ''}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Live preview of edits */}
                      <div>
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Edit Preview</p>
                        <div className={`rounded-lg p-3 border text-sm ${isWa ? 'bg-[#e5ddd5]' : 'bg-white'}`}>
                          {isWa ? (
                            <div className="bg-white rounded-lg p-3 shadow-sm max-w-md">
                              {renderPreview(editText, tmpl.category)}
                            </div>
                          ) : (
                            renderPreview(editText, tmpl.category)
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <Button
                          size="sm"
                          onClick={() => handleSave(tmpl)}
                          disabled={saving === tmpl.key}
                          data-testid={`save-template-${tmpl.key}`}
                        >
                          {saving === tmpl.key ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
                          Save Changes
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleReset(tmpl)} data-testid={`reset-template-${tmpl.key}`}>
                          <RotateCcw className="w-3 h-3 mr-1" />
                          Reset Default
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingKey(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MessageTemplates;
