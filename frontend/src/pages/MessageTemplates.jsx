import { useState, useEffect } from 'react';
import { templatesAPI } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
import { Loader2, Save, RotateCcw, MessageCircle, Mail, ChevronDown, ChevronUp, Info } from 'lucide-react';

export const MessageTemplates = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [editingKey, setEditingKey] = useState(null);
  const [editText, setEditText] = useState('');
  const [editSubject, setEditSubject] = useState('');
  const [tab, setTab] = useState('whatsapp');

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await templatesAPI.getAll(tab);
      setTemplates(res.data || []);
    } catch { toast.error('Failed to load templates'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchTemplates(); }, [tab]);

  const handleEdit = (tmpl) => {
    setEditingKey(tmpl.key);
    setEditText(tmpl.template || '');
    setEditSubject(tmpl.subject || '');
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
      const newText = `${before}{${varName}}${after}`;
      setEditText(newText);
      setTimeout(() => {
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = start + varName.length + 2;
      }, 50);
    } else {
      setEditText(prev => prev + `{${varName}}`);
    }
  };

  return (
    <div className="animate-fade-in max-w-5xl mx-auto" data-testid="message-templates-page">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Message Templates</h1>
        <p className="text-slate-500 mt-1">Customize WhatsApp and Email message templates</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6" data-testid="template-tabs">
        <Button
          variant={tab === 'whatsapp' ? 'default' : 'outline'}
          onClick={() => { setTab('whatsapp'); setEditingKey(null); }}
          data-testid="tab-whatsapp"
        >
          <MessageCircle className="w-4 h-4 mr-2" />
          WhatsApp Templates
        </Button>
        <Button
          variant={tab === 'email' ? 'default' : 'outline'}
          onClick={() => { setTab('email'); setEditingKey(null); }}
          data-testid="tab-email"
        >
          <Mail className="w-4 h-4 mr-2" />
          Email Templates
        </Button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 flex items-start gap-2">
        <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-blue-700">
          Use <code className="bg-blue-100 px-1 rounded">{'{variable_name}'}</code> syntax to insert dynamic values. 
          Click the variable chips below each template to insert them. 
          Use <code className="bg-blue-100 px-1 rounded">*bold*</code> for WhatsApp bold text.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : (
        <div className="space-y-4">
          {templates.map((tmpl) => (
            <Card key={tmpl.key} className={editingKey === tmpl.key ? 'ring-2 ring-blue-300' : ''} data-testid={`template-card-${tmpl.key}`}>
              <CardHeader className="pb-2 cursor-pointer" onClick={() => editingKey === tmpl.key ? setEditingKey(null) : handleEdit(tmpl)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {tmpl.category === 'email' ? <Mail className="w-4 h-4 text-blue-500" /> : <MessageCircle className="w-4 h-4 text-green-500" />}
                    <CardTitle className="text-sm">{tmpl.name}</CardTitle>
                    {tmpl.is_default && <span className="text-xs px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded">Default</span>}
                    {!tmpl.is_default && tmpl.updated_at && <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-600 rounded">Customized</span>}
                  </div>
                  {editingKey === tmpl.key ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </div>
              </CardHeader>
              {editingKey === tmpl.key ? (
                <CardContent className="pt-0">
                  {tmpl.category === 'email' && (
                    <div className="mb-3">
                      <Label className="text-xs mb-1 block">Email Subject</Label>
                      <Input
                        value={editSubject}
                        onChange={(e) => setEditSubject(e.target.value)}
                        placeholder="Email subject line..."
                        data-testid={`subject-input-${tmpl.key}`}
                      />
                    </div>
                  )}
                  <div className="mb-2">
                    <Label className="text-xs mb-1 block">
                      {tmpl.category === 'email' ? 'HTML Body' : 'Message Template'}
                    </Label>
                    <textarea
                      id="template-editor"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      rows={8}
                      className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm font-mono resize-y focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none"
                      placeholder="Enter template text..."
                      data-testid={`template-editor-${tmpl.key}`}
                    />
                  </div>
                  {/* Variable chips */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {(tmpl.variables || []).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => insertVariable(v)}
                        className="text-xs px-2 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full hover:bg-blue-100 transition-colors font-mono"
                        data-testid={`var-chip-${v}`}
                      >
                        {'{' + v + '}'}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleSave(tmpl)}
                      disabled={saving === tmpl.key}
                      data-testid={`save-template-${tmpl.key}`}
                    >
                      {saving === tmpl.key ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
                      Save
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleReset(tmpl)} data-testid={`reset-template-${tmpl.key}`}>
                      <RotateCcw className="w-3 h-3 mr-1" />
                      Reset Default
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingKey(null)}>
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              ) : (
                <CardContent className="pt-0">
                  <pre className="text-xs text-slate-600 bg-slate-50 rounded p-2 whitespace-pre-wrap font-mono max-h-24 overflow-y-auto">
                    {tmpl.template}
                  </pre>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default MessageTemplates;
