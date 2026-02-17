import { useState, useEffect } from 'react';
import { smtpAPI, whatsappAPI, fallbackOTPAPI } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Switch } from '../components/ui/switch';
import { toast } from 'sonner';
import { Loader2, Mail, Server, Lock, CheckCircle, AlertCircle, MessageCircle, Send, Key, Plus, Trash2 } from 'lucide-react';
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
  
  const [formData, setFormData] = useState({
    smtp_server: '',
    smtp_port: 587,
    smtp_username: '',
    smtp_password: '',
    from_email: '',
    from_name: 'VMP CRM',
  });

  const [whatsappFormData, setWhatsappFormData] = useState({
    api_url: 'https://api.botmastersender.com/api/v1/',
    auth_token: '',
    sender_id: '919944472488',
  });

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    try {
      const [smtpRes, whatsappRes, fallbackRes] = await Promise.all([
        smtpAPI.getConfig(),
        whatsappAPI.getConfig(),
        fallbackOTPAPI.getAll()
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
        setWhatsappFormData({
          api_url: whatsappRes.data.api_url,
          auth_token: '',
          sender_id: whatsappRes.data.sender_id,
        });
      }

      if (fallbackRes.data) {
        setFallbackOTPs(fallbackRes.data);
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

    if (!whatsappFormData.auth_token) {
      toast.error('Please enter the Auth Token');
      return;
    }
    
    setSaving(true);
    try {
      await whatsappAPI.saveConfig(whatsappFormData);
      toast.success('WhatsApp configuration saved successfully');
      fetchConfigs();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save WhatsApp configuration');
    } finally {
      setSaving(false);
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
        <p className="text-slate-500 mt-1">Configure SMTP and WhatsApp integrations</p>
      </div>

      {/* WhatsApp Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <CardTitle>WhatsApp API Configuration</CardTitle>
              <CardDescription>Configure WhatsApp messaging for OTP & order notifications</CardDescription>
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

          {whatsappConfig && whatsappConfig.id !== 'default' && (
            <Alert className="mb-6 bg-emerald-50 border-emerald-200">
              <CheckCircle className="h-4 w-4 text-emerald-600" />
              <AlertDescription className="text-emerald-800">
                WhatsApp API configured: {whatsappConfig.sender_id}
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSaveWhatsApp} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="api_url">API URL *</Label>
              <Input
                id="api_url"
                value={whatsappFormData.api_url}
                onChange={(e) => setWhatsappFormData({ ...whatsappFormData, api_url: e.target.value })}
                placeholder="https://api.botmastersender.com/api/v1/"
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
                  Auth Token *
                </Label>
                <Input
                  id="auth_token"
                  type="password"
                  value={whatsappFormData.auth_token}
                  onChange={(e) => setWhatsappFormData({ ...whatsappFormData, auth_token: e.target.value })}
                  placeholder="Enter auth token"
                  required
                  disabled={!isAdmin}
                  data-testid="whatsapp-token-input"
                />
              </div>
            </div>

            {isAdmin && (
              <div className="flex items-center gap-3 pt-2">
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Save WhatsApp Config
                </Button>
              </div>
            )}
          </form>

          {/* Test WhatsApp */}
          {isAdmin && (
            <div className="mt-6 pt-6 border-t border-slate-200">
              <Label className="mb-2 block">Test WhatsApp Integration</Label>
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
    </div>
  );
};
