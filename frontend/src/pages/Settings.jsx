import { useState, useEffect } from 'react';
import { smtpAPI, whatsappAPI, fallbackOTPAPI, catalogueAPI, databaseAPI } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Switch } from '../components/ui/switch';
import { toast } from 'sonner';
import { Loader2, Mail, Server, Lock, CheckCircle, AlertCircle, MessageCircle, Send, Key, Plus, Trash2, BookOpen, Link, Edit, ToggleLeft, ToggleRight, ChevronDown, ChevronUp, Database, AlertTriangle, Download, RefreshCw, FileJson } from 'lucide-react';
import { Alert, AlertDescription } from '../components/ui/alert';

export const Settings = () => {
  const { isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [currentConfig, setCurrentConfig] = useState(null);
  const [whatsappConfig, setWhatsappConfig] = useState(null);
  const [testMobile, setTestMobile] = useState('');
  
  // Fallback OTP state
  const [fallbackOTPs, setFallbackOTPs] = useState([]);
  const [newOTP, setNewOTP] = useState('');
  const [addingOTP, setAddingOTP] = useState(false);
  
  // Catalogue state
  const [catalogues, setCatalogues] = useState([]);
  const [savingCatalogues, setSavingCatalogues] = useState(false);

  // Database Management state
  const [dbAction, setDbAction] = useState(null);
  const [factoryResetConfirm, setFactoryResetConfirm] = useState('');
  const [backupHistory, setBackupHistory] = useState([]);
  
  const [formData, setFormData] = useState({
    smtp_server: '',
    smtp_port: 587,
    smtp_username: '',
    smtp_password: '',
    from_email: '',
    from_name: 'VMP CRM',
  });

  const [whatsappConfigs, setWhatsappConfigs] = useState([]);
  const [editingConfig, setEditingConfig] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const defaultWaForm = {
    name: '',
    api_url: '',
    auth_token: '',
    sender_id: '',
    http_method: 'GET',
    api_type: 'query_param',
    instance_id: '',
    field_action: 'action',
    field_sender_id: 'senderId',
    field_auth_token: 'authToken',
    field_message: 'messageText',
    field_receiver: 'receiverId',
    field_file_url: 'fileUrl',
    field_file_caption: 'fileCaption',
    action_send: 'send',
    action_send_file: 'sendFile',
    is_active: true
  };

  const [whatsappFormData, setWhatsappFormData] = useState(defaultWaForm);

  useEffect(() => {
    fetchConfigs();
    fetchBackupHistory();
  }, []);

  const fetchConfigs = async () => {
    try {
      const [smtpRes, whatsappRes, waConfigsRes, fallbackRes, catRes] = await Promise.all([
        smtpAPI.getConfig(),
        whatsappAPI.getConfig(),
        whatsappAPI.getAllConfigs(),
        fallbackOTPAPI.getAll(),
        catalogueAPI.get()
      ]);
      
      if (smtpRes.data) {
        setCurrentConfig(smtpRes.data);
        setFormData({
          smtp_server: smtpRes.data.smtp_server,
          smtp_port: smtpRes.data.smtp_port,
          smtp_username: smtpRes.data.smtp_username,
          smtp_password: '',
          from_email: smtpRes.data.from_email,
          from_name: smtpRes.data.from_name,
        });
      }
      
      if (whatsappRes.data) {
        setWhatsappConfig(whatsappRes.data);
      }

      if (waConfigsRes.data) {
        setWhatsappConfigs(Array.isArray(waConfigsRes.data) ? waConfigsRes.data : []);
      }

      if (fallbackRes.data) {
        setFallbackOTPs(fallbackRes.data);
      }

      if (catRes.data?.catalogues) {
        setCatalogues(catRes.data.catalogues);
      }
    } catch (error) {
      console.error('Failed to fetch configs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSMTP = async (e) => {
    e.preventDefault();
    
    if (!isAdmin) {
      toast.error('Only admins can configure SMTP settings');
      return;
    }
    
    setSaving(true);
    try {
      await smtpAPI.saveConfig(formData);
      toast.success('SMTP configuration saved successfully');
      fetchConfigs();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save SMTP configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveWhatsApp = async (e) => {
    e.preventDefault();
    
    if (!isAdmin) {
      toast.error('Only admins can configure WhatsApp settings');
      return;
    }

    if (!whatsappFormData.name || !whatsappFormData.api_url || !whatsappFormData.sender_id) {
      toast.error('Please fill in Name, API URL and Sender ID');
      return;
    }

    if (!editingConfig && !whatsappFormData.auth_token) {
      toast.error('Please enter the Auth Token');
      return;
    }
    
    setSaving(true);
    try {
      if (editingConfig) {
        await whatsappAPI.updateConfig(editingConfig, whatsappFormData);
        toast.success('WhatsApp config updated successfully');
      } else {
        await whatsappAPI.saveConfig(whatsappFormData);
        toast.success('WhatsApp config created successfully');
      }
      setEditingConfig(null);
      setWhatsappFormData(defaultWaForm);
      setShowAdvanced(false);
      fetchConfigs();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save WhatsApp configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleEditConfig = (config) => {
    setEditingConfig(config.id);
    setWhatsappFormData({
      name: config.name || '',
      api_url: config.api_url || '',
      auth_token: '',
      sender_id: config.sender_id || '',
      http_method: config.http_method || 'GET',
      api_type: config.api_type || 'query_param',
      instance_id: config.instance_id || '',
      field_action: config.field_action || 'action',
      field_sender_id: config.field_sender_id || 'senderId',
      field_auth_token: config.field_auth_token || 'authToken',
      field_message: config.field_message || 'messageText',
      field_receiver: config.field_receiver || 'receiverId',
      field_file_url: config.field_file_url || 'fileUrl',
      field_file_caption: config.field_file_caption || 'fileCaption',
      action_send: config.action_send || 'send',
      action_send_file: config.action_send_file || 'sendFile',
      is_active: config.is_active !== false
    });
    setShowAdvanced(true);
  };

  const handleDeleteConfig = async (id) => {
    if (!window.confirm('Delete this WhatsApp config?')) return;
    try {
      await whatsappAPI.deleteConfig(id);
      toast.success('Config deleted');
      fetchConfigs();
    } catch (error) {
      toast.error('Failed to delete config');
    }
  };

  const handleActivateConfig = async (id) => {
    try {
      await whatsappAPI.activateConfig(id);
      toast.success('Config activated');
      fetchConfigs();
    } catch (error) {
      toast.error('Failed to activate config');
    }
  };

  const [testingConfigId, setTestingConfigId] = useState(null);
  const [configTestMobile, setConfigTestMobile] = useState('');

  const handleTestSpecificConfig = async (configId, configName) => {
    if (!configTestMobile || configTestMobile.length < 10) {
      toast.error('Enter a valid mobile number to test');
      return;
    }
    setTestingConfigId(configId);
    try {
      const res = await whatsappAPI.testSpecificConfig(configId, configTestMobile);
      if (res.data?.status === 'success') {
        toast.success(`${configName}: ${res.data.message}`);
      } else {
        toast.error(`${configName}: ${res.data?.message || 'Test failed'}`);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || `Failed to test ${configName}`);
    } finally {
      setTestingConfigId(null);
    }
  };

  const handleTestWhatsApp = async () => {
    if (!testMobile || testMobile.length < 10) {
      toast.error('Please enter a valid mobile number');
      return;
    }

    setTesting(true);
    try {
      const response = await whatsappAPI.testConfig(testMobile);
      if (response.data.status === 'success') {
        toast.success('Test message sent successfully!');
      } else {
        toast.error(response.data.message || 'Failed to send test message');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send test message');
    } finally {
      setTesting(false);
    }
  };

  // Fallback OTP Handlers
  const handleAddFallbackOTP = async () => {
    if (!newOTP || newOTP.length !== 4 || !/^\d{4}$/.test(newOTP)) {
      toast.error('Please enter a valid 4-digit OTP');
      return;
    }

    setAddingOTP(true);
    try {
      await fallbackOTPAPI.create({ otp: newOTP });
      toast.success('Fallback OTP added successfully');
      setNewOTP('');
      fetchConfigs();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add OTP');
    } finally {
      setAddingOTP(false);
    }
  };

  const handleToggleFallbackOTP = async (id) => {
    try {
      await fallbackOTPAPI.toggle(id);
      fetchConfigs();
    } catch (error) {
      toast.error('Failed to toggle OTP status');
    }
  };

  const handleDeleteFallbackOTP = async (id) => {
    if (!window.confirm('Are you sure you want to delete this OTP?')) return;
    
    try {
      await fallbackOTPAPI.delete(id);
      toast.success('OTP deleted');
      fetchConfigs();
    } catch (error) {
      toast.error('Failed to delete OTP');
    }
  };

  // Database Management Handlers
  const fetchBackupHistory = async () => {
    try {
      const res = await databaseAPI.getBackupHistory();
      setBackupHistory(Array.isArray(res.data) ? res.data : []);
    } catch { /* ignore */ }
  };

  const handleDeleteEmailLogs = async () => {
    if (!window.confirm('Delete ALL email logs? This cannot be undone.')) return;
    setDbAction('delete-email');
    try {
      const res = await databaseAPI.deleteEmailLogs();
      toast.success(res.data?.message || 'Email logs deleted');
      fetchBackupHistory();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete email logs');
    } finally {
      setDbAction(null);
    }
  };

  const handleDeleteWhatsappLogs = async () => {
    if (!window.confirm('Delete ALL WhatsApp logs? This cannot be undone.')) return;
    setDbAction('delete-wa');
    try {
      const res = await databaseAPI.deleteWhatsappLogs();
      toast.success(res.data?.message || 'WhatsApp logs deleted');
      fetchBackupHistory();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete WhatsApp logs');
    } finally {
      setDbAction(null);
    }
  };

  const handleFactoryReset = async () => {
    if (factoryResetConfirm !== 'RESET') {
      toast.error('Type RESET to confirm');
      return;
    }
    setDbAction('factory-reset');
    try {
      const res = await databaseAPI.factoryReset();
      toast.success(res.data?.message || 'Factory reset completed');
      setFactoryResetConfirm('');
      fetchBackupHistory();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Factory reset failed');
    } finally {
      setDbAction(null);
    }
  };

  const handleSendEmailBackup = async () => {
    if (!window.confirm('Send a full database backup to the configured backup email?')) return;
    setDbAction('email-backup');
    try {
      const res = await databaseAPI.sendEmailBackup();
      if (res.data?.status === 'failed') {
        toast.error(res.data?.message || 'Backup email failed');
      } else {
        toast.success(res.data?.message || 'Backup email sent');
      }
      fetchBackupHistory();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send backup email');
    } finally {
      setDbAction(null);
    }
  };

  const handleTriggerBackup = async () => {
    if (!window.confirm('Trigger a full backup (WhatsApp JSON + Email)?')) return;
    setDbAction('trigger-backup');
    try {
      const res = await databaseAPI.triggerBackup();
      toast.success(res.data?.message || 'Backup triggered');
      fetchBackupHistory();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Backup failed');
    } finally {
      setDbAction(null);
    }
  };

  const handleExportDatabase = async () => {
    setDbAction('export');
    try {
      const res = await databaseAPI.exportDatabase();
      const jsonStr = JSON.stringify(res.data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `crm_backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Database exported');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Export failed');
    } finally {
      setDbAction(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl" data-testid="settings-page">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 mt-1">Configure SMTP, WhatsApp, and OTP settings</p>
      </div>

      {/* WhatsApp Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <CardTitle>WhatsApp API Configurations</CardTitle>
              <CardDescription>Manage multiple WhatsApp API configs. Active config is used for all messages.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!isAdmin && (
            <Alert className="mb-6 bg-amber-50 border-amber-200">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                Only administrators can modify WhatsApp settings.
              </AlertDescription>
            </Alert>
          )}

          {/* Existing Configs List */}
          {whatsappConfigs.length > 0 && (
            <div className="mb-6 space-y-3" data-testid="whatsapp-configs-list">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-slate-500 font-medium">
                  {whatsappConfigs.length} config{whatsappConfigs.length > 1 ? 's' : ''} configured. Only the <span className="text-green-600">Active</span> config is used for sending.
                </p>
              </div>
              {whatsappConfigs.map((cfg, idx) => (
                <div key={cfg.id} className={`p-4 rounded-lg border-2 transition-all ${cfg.is_active ? 'border-green-400 bg-green-50 shadow-sm' : 'border-slate-200 bg-white'}`} data-testid={`wa-config-card-${cfg.id}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">API {idx + 1}</span>
                        <span className="font-semibold text-sm">{cfg.name || 'Unnamed Config'}</span>
                        {cfg.is_active ? (
                          <span className="text-xs bg-green-200 text-green-800 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                            <ToggleRight className="w-3 h-3" /> Active
                          </span>
                        ) : (
                          <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                            <ToggleLeft className="w-3 h-3" /> Inactive
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{cfg.api_url}</p>
                      <p className="text-xs text-slate-400">
                        Sender: {cfg.sender_id} | 
                        {cfg.api_type === 'rest_api' ? (
                          <> Type: <span className="text-blue-600 font-medium">REST API</span> | Instance: {cfg.instance_id || 'N/A'}</>
                        ) : (
                          <> Type: <span className="text-slate-600 font-medium">Query Param</span> | Method: {cfg.http_method || 'GET'}</>
                        )}
                      </p>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        {!cfg.is_active && (
                          <Button size="sm" variant="outline" onClick={() => handleActivateConfig(cfg.id)} title="Enable this config" className="text-green-600 border-green-300 hover:bg-green-50" data-testid={`activate-config-${cfg.id}`}>
                            <ToggleLeft className="w-4 h-4 mr-1" /> Enable
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => handleEditConfig(cfg)} title="Edit" data-testid={`edit-config-${cfg.id}`}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDeleteConfig(cfg.id)} className="text-red-500 hover:text-red-700" title="Delete" data-testid={`delete-config-${cfg.id}`}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                  {/* Per-config test */}
                  {isAdmin && (
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
                      <Input
                        placeholder="Mobile number"
                        value={configTestMobile}
                        onChange={(e) => setConfigTestMobile(e.target.value)}
                        className="flex-1 h-8 text-sm"
                        data-testid={`test-input-${cfg.id}`}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleTestSpecificConfig(cfg.id, cfg.name)}
                        disabled={testingConfigId === cfg.id}
                        className="h-8 text-xs"
                        data-testid={`test-btn-${cfg.id}`}
                      >
                        {testingConfigId === cfg.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Send className="w-3 h-3 mr-1" />}
                        Test
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Config Form */}
          <form onSubmit={handleSaveWhatsApp} className="space-y-4" data-testid="whatsapp-config-form">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-3">
              <h3 className="text-sm font-semibold text-slate-700">
                {editingConfig ? 'Edit Config' : 'Add New Config'}
              </h3>
              {editingConfig && (
                <Button type="button" variant="ghost" size="sm" onClick={() => { setEditingConfig(null); setWhatsappFormData(defaultWaForm); setShowAdvanced(false); }}>
                  Cancel Edit
                </Button>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="wa_name">Config Name *</Label>
              <Input
                id="wa_name"
                value={whatsappFormData.name}
                onChange={(e) => setWhatsappFormData({ ...whatsappFormData, name: e.target.value })}
                placeholder="e.g., BotMasterSender, Twilio, etc."
                required
                disabled={!isAdmin}
                data-testid="whatsapp-name-input"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="api_url">API URL *</Label>
              <Input
                id="api_url"
                value={whatsappFormData.api_url}
                onChange={(e) => setWhatsappFormData({ ...whatsappFormData, api_url: e.target.value })}
                placeholder="https://api.example.com/api/v1/"
                required
                disabled={!isAdmin}
                data-testid="whatsapp-url-input"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sender_id">Sender ID *</Label>
                <Input
                  id="sender_id"
                  value={whatsappFormData.sender_id}
                  onChange={(e) => setWhatsappFormData({ ...whatsappFormData, sender_id: e.target.value })}
                  placeholder="919944472488"
                  required
                  disabled={!isAdmin}
                  data-testid="whatsapp-sender-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="auth_token">
                  <Lock className="w-4 h-4 inline mr-1" />
                  Auth Token {editingConfig ? '(leave blank to keep)' : '*'}
                </Label>
                <Input
                  id="auth_token"
                  type="password"
                  value={whatsappFormData.auth_token}
                  onChange={(e) => setWhatsappFormData({ ...whatsappFormData, auth_token: e.target.value })}
                  placeholder={editingConfig ? 'Leave blank to keep existing' : 'Enter auth token'}
                  required={!editingConfig}
                  disabled={!isAdmin}
                  data-testid="whatsapp-token-input"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="api_type">API Type *</Label>
                <select
                  id="api_type"
                  className="w-full h-10 px-3 border rounded-md text-sm bg-white"
                  value={whatsappFormData.api_type}
                  onChange={(e) => {
                    const newType = e.target.value;
                    setWhatsappFormData({
                      ...whatsappFormData,
                      api_type: newType,
                      http_method: newType === 'rest_api' ? 'POST' : 'GET',
                    });
                  }}
                  disabled={!isAdmin}
                  data-testid="whatsapp-api-type-select"
                >
                  <option value="query_param">Query Param API (BotMasterSender)</option>
                  <option value="rest_api">REST API (AKNexus / Business API)</option>
                </select>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={whatsappFormData.is_active}
                    onChange={(e) => setWhatsappFormData({ ...whatsappFormData, is_active: e.target.checked })}
                    className="w-4 h-4"
                    disabled={!isAdmin}
                  />
                  <span className="text-sm text-slate-600">Set as Active Config</span>
                </label>
              </div>
            </div>

            {whatsappFormData.api_type === 'rest_api' && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
                <p className="text-xs text-blue-700 font-medium">REST API Settings (AKNexus)</p>
                <div className="space-y-2">
                  <Label htmlFor="instance_id">Instance ID *</Label>
                  <Input
                    id="instance_id"
                    value={whatsappFormData.instance_id}
                    onChange={(e) => setWhatsappFormData({ ...whatsappFormData, instance_id: e.target.value })}
                    placeholder="Your WhatsApp instance ID"
                    disabled={!isAdmin}
                    data-testid="whatsapp-instance-id-input"
                  />
                </div>
                <p className="text-[10px] text-blue-500">Text: POST /api/send (type=text) | Media: POST /api/send (type=media) | Auth: access_token in body</p>
              </div>
            )}

            {whatsappFormData.api_type === 'query_param' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="http_method">HTTP Method</Label>
                  <select
                    id="http_method"
                    className="w-full h-10 px-3 border rounded-md text-sm bg-white"
                    value={whatsappFormData.http_method}
                    onChange={(e) => setWhatsappFormData({ ...whatsappFormData, http_method: e.target.value })}
                    disabled={!isAdmin}
                    data-testid="whatsapp-method-select"
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                  </select>
                </div>
              </div>
            )}

            {/* Advanced Field Mappings - only for query_param type */}
            {whatsappFormData.api_type === 'query_param' && (
            <div className="border-t border-slate-200 pt-3">
              <button
                type="button"
                className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-800 font-medium"
                onClick={() => setShowAdvanced(!showAdvanced)}
                data-testid="toggle-advanced-fields"
              >
                {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                Advanced: API Field Name Mappings
              </button>
              {showAdvanced && (
                <div className="mt-4 space-y-4 p-4 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500">
                    Map your API's field names. Change these if your API uses different parameter names.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Action Field Name</Label>
                      <Input size="sm" value={whatsappFormData.field_action} onChange={(e) => setWhatsappFormData({ ...whatsappFormData, field_action: e.target.value })} placeholder="action" disabled={!isAdmin} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Sender ID Field Name</Label>
                      <Input size="sm" value={whatsappFormData.field_sender_id} onChange={(e) => setWhatsappFormData({ ...whatsappFormData, field_sender_id: e.target.value })} placeholder="senderId" disabled={!isAdmin} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Auth Token Field Name</Label>
                      <Input size="sm" value={whatsappFormData.field_auth_token} onChange={(e) => setWhatsappFormData({ ...whatsappFormData, field_auth_token: e.target.value })} placeholder="authToken" disabled={!isAdmin} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Message Field Name</Label>
                      <Input size="sm" value={whatsappFormData.field_message} onChange={(e) => setWhatsappFormData({ ...whatsappFormData, field_message: e.target.value })} placeholder="messageText" disabled={!isAdmin} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Receiver Field Name</Label>
                      <Input size="sm" value={whatsappFormData.field_receiver} onChange={(e) => setWhatsappFormData({ ...whatsappFormData, field_receiver: e.target.value })} placeholder="receiverId" disabled={!isAdmin} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">File URL Field Name</Label>
                      <Input size="sm" value={whatsappFormData.field_file_url} onChange={(e) => setWhatsappFormData({ ...whatsappFormData, field_file_url: e.target.value })} placeholder="fileUrl" disabled={!isAdmin} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">File Caption Field Name</Label>
                      <Input size="sm" value={whatsappFormData.field_file_caption} onChange={(e) => setWhatsappFormData({ ...whatsappFormData, field_file_caption: e.target.value })} placeholder="fileCaption" disabled={!isAdmin} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 border-t border-slate-200 pt-3 mt-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Send Text Action Value</Label>
                      <Input size="sm" value={whatsappFormData.action_send} onChange={(e) => setWhatsappFormData({ ...whatsappFormData, action_send: e.target.value })} placeholder="send" disabled={!isAdmin} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Send File Action Value</Label>
                      <Input size="sm" value={whatsappFormData.action_send_file} onChange={(e) => setWhatsappFormData({ ...whatsappFormData, action_send_file: e.target.value })} placeholder="sendFile" disabled={!isAdmin} />
                    </div>
                  </div>
                </div>
              )}
            </div>
            )}

            {isAdmin && (
              <div className="flex items-center gap-3 pt-2">
                <Button type="submit" disabled={saving} data-testid="save-whatsapp-config-btn">
                  {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  {editingConfig ? 'Update Config' : 'Add Config'}
                </Button>
              </div>
            )}
          </form>

          {/* Test WhatsApp */}
          {isAdmin && (
            <div className="mt-6 pt-6 border-t border-slate-200">
              <Label className="mb-2 block">Test Active WhatsApp Config</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter mobile number to test"
                  value={testMobile}
                  onChange={(e) => setTestMobile(e.target.value)}
                  className="flex-1"
                  data-testid="test-mobile-input"
                />
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleTestWhatsApp}
                  disabled={testing}
                >
                  {testing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                  Send Test
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* SMTP Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Mail className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <CardTitle>SMTP Configuration</CardTitle>
              <CardDescription>Configure email sending settings</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!isAdmin && (
            <Alert className="mb-6 bg-amber-50 border-amber-200">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                Only administrators can modify SMTP settings.
              </AlertDescription>
            </Alert>
          )}

          {currentConfig && (
            <Alert className="mb-6 bg-emerald-50 border-emerald-200">
              <CheckCircle className="h-4 w-4 text-emerald-600" />
              <AlertDescription className="text-emerald-800">
                SMTP is configured: {currentConfig.smtp_server}:{currentConfig.smtp_port}
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSaveSMTP} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="smtp_server">
                  <Server className="w-4 h-4 inline mr-1" />
                  SMTP Server *
                </Label>
                <Input
                  id="smtp_server"
                  value={formData.smtp_server}
                  onChange={(e) => setFormData({ ...formData, smtp_server: e.target.value })}
                  placeholder="smtp.gmail.com"
                  required
                  disabled={!isAdmin}
                  data-testid="smtp-server-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtp_port">SMTP Port *</Label>
                <Input
                  id="smtp_port"
                  type="number"
                  value={formData.smtp_port}
                  onChange={(e) => setFormData({ ...formData, smtp_port: parseInt(e.target.value) })}
                  placeholder="587"
                  required
                  disabled={!isAdmin}
                  data-testid="smtp-port-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtp_username">
                  <Mail className="w-4 h-4 inline mr-1" />
                  SMTP Username *
                </Label>
                <Input
                  id="smtp_username"
                  value={formData.smtp_username}
                  onChange={(e) => setFormData({ ...formData, smtp_username: e.target.value })}
                  placeholder="your-email@gmail.com"
                  required
                  disabled={!isAdmin}
                  data-testid="smtp-username-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtp_password">
                  <Lock className="w-4 h-4 inline mr-1" />
                  SMTP Password *
                </Label>
                <Input
                  id="smtp_password"
                  type="password"
                  value={formData.smtp_password}
                  onChange={(e) => setFormData({ ...formData, smtp_password: e.target.value })}
                  placeholder="••••••••"
                  required={!currentConfig}
                  disabled={!isAdmin}
                  data-testid="smtp-password-input"
                />
                <p className="text-xs text-slate-500">For Gmail, use an App Password</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="from_email">From Email *</Label>
                <Input
                  id="from_email"
                  type="email"
                  value={formData.from_email}
                  onChange={(e) => setFormData({ ...formData, from_email: e.target.value })}
                  placeholder="noreply@yourcompany.com"
                  required
                  disabled={!isAdmin}
                  data-testid="from-email-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="from_name">From Name *</Label>
                <Input
                  id="from_name"
                  value={formData.from_name}
                  onChange={(e) => setFormData({ ...formData, from_name: e.target.value })}
                  placeholder="VMP CRM"
                  required
                  disabled={!isAdmin}
                  data-testid="from-name-input"
                />
              </div>
            </div>

            {isAdmin && (
              <Button type="submit" disabled={saving} data-testid="save-smtp-btn">
                {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Save SMTP Configuration
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Fallback OTP Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <Key className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <CardTitle>Fallback OTP Management</CardTitle>
              <CardDescription>Manage static OTPs for customer registration when WhatsApp fails</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!isAdmin && (
            <Alert className="mb-6 bg-amber-50 border-amber-200">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                Only administrators can manage fallback OTPs.
              </AlertDescription>
            </Alert>
          )}

          <Alert className="mb-6 bg-blue-50 border-blue-200">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              <strong>How it works:</strong> If a customer cannot receive WhatsApp OTP, admins can share one of these static codes verbally. These codes are reusable and hidden from users.
            </AlertDescription>
          </Alert>

          {/* Add New OTP */}
          {isAdmin && (
            <div className="mb-6">
              <Label className="mb-2 block">Add New Fallback OTP</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter 4-digit OTP"
                  value={newOTP}
                  onChange={(e) => setNewOTP(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  className="flex-1 font-mono text-center tracking-widest"
                  maxLength={4}
                  data-testid="new-fallback-otp-input"
                />
                <Button 
                  type="button"
                  onClick={handleAddFallbackOTP}
                  disabled={addingOTP || newOTP.length !== 4}
                  data-testid="add-fallback-otp-btn"
                >
                  {addingOTP ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                  Add OTP
                </Button>
              </div>
            </div>
          )}

          {/* OTP List */}
          <div className="space-y-2">
            {fallbackOTPs.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                No fallback OTPs configured yet. Add some to help customers who can't receive WhatsApp messages.
              </div>
            ) : (
              fallbackOTPs.map((otp) => (
                <div 
                  key={otp.id}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    otp.is_active ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'
                  }`}
                  data-testid={`fallback-otp-${otp.otp}`}
                >
                  <div className="flex items-center gap-4">
                    <span className="font-mono text-xl font-bold tracking-widest">
                      {otp.otp}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      otp.is_active 
                        ? 'bg-emerald-100 text-emerald-700' 
                        : 'bg-slate-200 text-slate-600'
                    }`}>
                      {otp.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <span className="text-xs text-slate-500">
                      Used: {otp.used_count || 0} times
                    </span>
                  </div>
                  
                  {isAdmin && (
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={otp.is_active}
                        onCheckedChange={() => handleToggleFallbackOTP(otp.id)}
                        data-testid={`toggle-otp-${otp.otp}`}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteFallbackOTP(otp.id)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        data-testid={`delete-otp-${otp.otp}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Common SMTP Providers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Common SMTP Providers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
              <span className="font-medium">Gmail</span>
              <span className="text-slate-500">smtp.gmail.com:587</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
              <span className="font-medium">Outlook/Office365</span>
              <span className="text-slate-500">smtp.office365.com:587</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
              <span className="font-medium">SendGrid</span>
              <span className="text-slate-500">smtp.sendgrid.net:587</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
              <span className="font-medium">Mailgun</span>
              <span className="text-slate-500">smtp.mailgun.org:587</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Catalogue Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            Catalogue Downloads
          </CardTitle>
          <CardDescription>
            Add catalogue download links that will be available to portal customers.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {catalogues.map((cat, idx) => (
            <div key={idx} className="flex gap-2 items-start p-3 bg-slate-50 rounded-lg border" data-testid={`catalogue-entry-${idx}`}>
              <div className="flex-1 space-y-2">
                <Input
                  placeholder="Catalogue title (e.g., Large Animals 2026)"
                  value={cat.title || ''}
                  onChange={(e) => {
                    const updated = [...catalogues];
                    updated[idx] = { ...updated[idx], title: e.target.value };
                    setCatalogues(updated);
                  }}
                />
                <Input
                  placeholder="URL (e.g., https://drive.google.com/file/...)"
                  value={cat.url || ''}
                  onChange={(e) => {
                    const updated = [...catalogues];
                    updated[idx] = { ...updated[idx], url: e.target.value };
                    setCatalogues(updated);
                  }}
                />
                <Input
                  placeholder="Description (optional)"
                  value={cat.description || ''}
                  onChange={(e) => {
                    const updated = [...catalogues];
                    updated[idx] = { ...updated[idx], description: e.target.value };
                    setCatalogues(updated);
                  }}
                />
              </div>
              <Button variant="ghost" size="sm" className="text-red-500 mt-1" onClick={() => setCatalogues(catalogues.filter((_, i) => i !== idx))}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setCatalogues([...catalogues, { title: '', url: '', description: '' }])} data-testid="add-catalogue-btn">
              <Plus className="w-4 h-4 mr-1" /> Add Catalogue
            </Button>
            <Button size="sm" disabled={savingCatalogues} onClick={async () => {
              setSavingCatalogues(true);
              try {
                await catalogueAPI.update(catalogues.filter(c => c.title && c.url));
                toast.success('Catalogue settings saved');
              } catch { toast.error('Failed to save'); }
              finally { setSavingCatalogues(false); }
            }} data-testid="save-catalogues-btn">
              {savingCatalogues && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              Save Catalogues
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Database Management */}
      {isAdmin && (
        <Card className="border-red-200" data-testid="database-management-card">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <Database className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <CardTitle>Database Management</CardTitle>
                <CardDescription>Backup, export, and manage application data</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Backup Actions */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-700 border-b pb-2">Backup & Export</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  onClick={handleExportDatabase}
                  disabled={dbAction === 'export'}
                  className="justify-start h-auto py-3"
                  data-testid="export-database-btn"
                >
                  {dbAction === 'export' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
                  <div className="text-left">
                    <div className="font-medium text-sm">Export Database</div>
                    <div className="text-xs text-slate-500">Download JSON backup file</div>
                  </div>
                </Button>
                <Button
                  variant="outline"
                  onClick={handleSendEmailBackup}
                  disabled={dbAction === 'email-backup'}
                  className="justify-start h-auto py-3"
                  data-testid="send-email-backup-btn"
                >
                  {dbAction === 'email-backup' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Mail className="w-4 h-4 mr-2" />}
                  <div className="text-left">
                    <div className="font-medium text-sm">Email Backup</div>
                    <div className="text-xs text-slate-500">Send backup to configured email</div>
                  </div>
                </Button>
                <Button
                  variant="outline"
                  onClick={handleTriggerBackup}
                  disabled={dbAction === 'trigger-backup'}
                  className="justify-start h-auto py-3 sm:col-span-2"
                  data-testid="trigger-full-backup-btn"
                >
                  {dbAction === 'trigger-backup' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileJson className="w-4 h-4 mr-2" />}
                  <div className="text-left">
                    <div className="font-medium text-sm">Full Backup (WhatsApp + Email)</div>
                    <div className="text-xs text-slate-500">Send JSON backup via WhatsApp and Email</div>
                  </div>
                </Button>
              </div>
            </div>

            {/* Log Cleanup */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-700 border-b pb-2">Log Cleanup</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  onClick={handleDeleteEmailLogs}
                  disabled={dbAction === 'delete-email'}
                  className="justify-start h-auto py-3 border-amber-200 hover:bg-amber-50 text-amber-700"
                  data-testid="delete-email-logs-btn"
                >
                  {dbAction === 'delete-email' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                  <div className="text-left">
                    <div className="font-medium text-sm">Delete Email Logs</div>
                    <div className="text-xs opacity-75">Clear all email delivery records</div>
                  </div>
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDeleteWhatsappLogs}
                  disabled={dbAction === 'delete-wa'}
                  className="justify-start h-auto py-3 border-amber-200 hover:bg-amber-50 text-amber-700"
                  data-testid="delete-whatsapp-logs-btn"
                >
                  {dbAction === 'delete-wa' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                  <div className="text-left">
                    <div className="font-medium text-sm">Delete WhatsApp Logs</div>
                    <div className="text-xs opacity-75">Clear all WhatsApp message records</div>
                  </div>
                </Button>
              </div>
            </div>

            {/* Factory Reset */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-red-600 border-b border-red-200 pb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Danger Zone
              </h3>
              <Alert className="bg-red-50 border-red-200">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  <strong>Factory Reset</strong> will permanently delete ALL business data (doctors, medicals, agencies, orders, payments, expenses, etc.). Only system settings, templates, and admin user will be preserved. This action <strong>cannot be undone</strong>.
                </AlertDescription>
              </Alert>
              <div className="flex gap-2 items-end">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs text-red-600">Type RESET to confirm</Label>
                  <Input
                    value={factoryResetConfirm}
                    onChange={(e) => setFactoryResetConfirm(e.target.value.toUpperCase())}
                    placeholder="Type RESET"
                    className="border-red-200 focus:ring-red-500 font-mono"
                    data-testid="factory-reset-confirm-input"
                  />
                </div>
                <Button
                  variant="destructive"
                  onClick={handleFactoryReset}
                  disabled={dbAction === 'factory-reset' || factoryResetConfirm !== 'RESET'}
                  data-testid="factory-reset-btn"
                >
                  {dbAction === 'factory-reset' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                  Factory Reset
                </Button>
              </div>
            </div>

            {/* Backup History */}
            {backupHistory.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-700 border-b pb-2">Recent Backup History</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {backupHistory.slice(0, 10).map((entry, idx) => (
                    <div key={entry.id || idx} className="flex items-center justify-between text-xs p-2 bg-slate-50 rounded border" data-testid={`backup-history-${idx}`}>
                      <div>
                        <span className="font-medium">{entry.filename || entry.type}</span>
                        <span className="text-slate-400 ml-2">
                          {entry.created_at ? new Date(entry.created_at).toLocaleString() : ''}
                        </span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full ${
                        entry.status === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {entry.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
