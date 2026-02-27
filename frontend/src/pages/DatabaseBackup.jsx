import { useState, useEffect } from 'react';
import api from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import { 
  Database, 
  Download, 
  Clock, 
  Loader2, 
  CheckCircle,
  AlertCircle,
  Calendar,
  Settings,
  Save,
  RefreshCw,
  FileJson,
  Mail,
  MessageSquare
} from 'lucide-react';

const DatabaseBackup = () => {
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [triggeringBackup, setTriggeringBackup] = useState(false);
  const [backupHistory, setBackupHistory] = useState([]);
  const [settings, setSettings] = useState({
    auto_backup_enabled: true,
    backup_times: ['09:00', '17:00'],
    whatsapp_number: '9486544884',
    email_address: 'vetmech2server@gmail.com'
  });

  useEffect(() => {
    fetchBackupData();
  }, []);

  const fetchBackupData = async () => {
    try {
      const [historyRes, settingsRes] = await Promise.all([
        api.get('/database/backup-history'),
        api.get('/database/backup-settings')
      ]);
      setBackupHistory(historyRes.data.backups || []);
      setSettings(settingsRes.data);
    } catch (error) {
      console.error('Failed to fetch backup data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadBackup = async () => {
    setDownloading(true);
    try {
      const response = await api.get('/database/export', {
        responseType: 'blob'
      });
      
      // Create download link
      const blob = new Blob([response.data], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Generate filename with timestamp
      const now = new Date();
      const filename = `vmp_crm_backup_${now.toISOString().split('T')[0]}_${now.getHours()}${now.getMinutes()}.json`;
      link.download = filename;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success('Backup downloaded successfully!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to download backup');
    } finally {
      setDownloading(false);
    }
  };

  const handleTriggerBackup = async () => {
    setTriggeringBackup(true);
    try {
      await api.post('/database/trigger-backup');
      toast.success('Backup triggered! You will receive it via WhatsApp and Email shortly.');
      fetchBackupData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to trigger backup');
    } finally {
      setTriggeringBackup(false);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await api.put('/database/backup-settings', settings);
      toast.success('Backup settings saved successfully!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6" data-testid="database-backup-page">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-violet-100 rounded-xl flex items-center justify-center">
            <Database className="w-6 h-6 text-violet-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Database Backup</h1>
            <p className="text-slate-500 text-sm">Export and schedule automatic backups</p>
          </div>
        </div>
        <Button 
          onClick={handleDownloadBackup}
          disabled={downloading}
          className="bg-emerald-600 hover:bg-emerald-700"
          data-testid="download-backup-btn"
        >
          {downloading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Download className="w-4 h-4 mr-2" />
          )}
          Download Backup Now
        </Button>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-100">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                <Download className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">Manual Download</p>
                <p className="text-xs text-slate-500">Download JSON backup file</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">Auto Backup</p>
                <p className="text-xs text-slate-500">Daily at 9 AM & 5 PM</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-violet-50 to-purple-50 border-violet-100 cursor-pointer hover:shadow-md transition-shadow"
              onClick={handleTriggerBackup}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center">
                {triggeringBackup ? (
                  <Loader2 className="w-5 h-5 text-violet-600 animate-spin" />
                ) : (
                  <RefreshCw className="w-5 h-5 text-violet-600" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">Trigger Backup Now</p>
                <p className="text-xs text-slate-500">Send to WhatsApp & Email</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Backup Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-slate-600" />
            Backup Settings
          </CardTitle>
          <CardDescription>
            Configure automatic backup schedule and notification recipients
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Auto Backup Toggle */}
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-blue-600" />
              <div>
                <p className="font-medium text-slate-800">Automatic Backups</p>
                <p className="text-sm text-slate-500">Send backups at scheduled times</p>
              </div>
            </div>
            <Switch
              checked={settings.auto_backup_enabled}
              onCheckedChange={(checked) => setSettings(prev => ({ ...prev, auto_backup_enabled: checked }))}
              data-testid="auto-backup-toggle"
            />
          </div>

          {/* Schedule */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-500" />
                Morning Backup Time
              </Label>
              <Input
                type="time"
                value={settings.backup_times?.[0] || '09:00'}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  backup_times: [e.target.value, prev.backup_times?.[1] || '17:00']
                }))}
                data-testid="morning-backup-time"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-500" />
                Evening Backup Time
              </Label>
              <Input
                type="time"
                value={settings.backup_times?.[1] || '17:00'}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  backup_times: [prev.backup_times?.[0] || '09:00', e.target.value]
                }))}
                data-testid="evening-backup-time"
              />
            </div>
          </div>

          {/* Notification Recipients */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-green-600" />
                WhatsApp Number
              </Label>
              <Input
                value={settings.whatsapp_number || ''}
                onChange={(e) => setSettings(prev => ({ ...prev, whatsapp_number: e.target.value }))}
                placeholder="Enter WhatsApp number"
                data-testid="whatsapp-number-input"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-600" />
                Email Address
              </Label>
              <Input
                type="email"
                value={settings.email_address || ''}
                onChange={(e) => setSettings(prev => ({ ...prev, email_address: e.target.value }))}
                placeholder="Enter email address"
                data-testid="email-address-input"
              />
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Button 
              onClick={handleSaveSettings}
              disabled={savingSettings}
              className="bg-violet-600 hover:bg-violet-700"
              data-testid="save-backup-settings-btn"
            >
              {savingSettings ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Backup History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileJson className="w-5 h-5 text-amber-600" />
            Recent Backups
          </CardTitle>
          <CardDescription>
            History of recent database backups
          </CardDescription>
        </CardHeader>
        <CardContent>
          {backupHistory.length > 0 ? (
            <div className="space-y-3">
              {backupHistory.map((backup, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    {backup.status === 'success' ? (
                      <CheckCircle className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-500" />
                    )}
                    <div>
                      <p className="font-medium text-slate-700">{backup.filename || 'Backup'}</p>
                      <p className="text-xs text-slate-500">
                        {new Date(backup.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {backup.sent_whatsapp && (
                      <Badge variant="outline" className="text-green-600 border-green-200">
                        <MessageSquare className="w-3 h-3 mr-1" />
                        WhatsApp
                      </Badge>
                    )}
                    {backup.sent_email && (
                      <Badge variant="outline" className="text-blue-600 border-blue-200">
                        <Mail className="w-3 h-3 mr-1" />
                        Email
                      </Badge>
                    )}
                    <Badge variant={backup.status === 'success' ? 'default' : 'destructive'}>
                      {backup.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <Database className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p>No backup history available</p>
              <p className="text-sm">Backups will appear here after they are created</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-100">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">About Database Backups</p>
              <ul className="list-disc list-inside space-y-1 text-blue-700">
                <li>Backups include all collections: customers, orders, items, expenses, etc.</li>
                <li>Automatic backups are sent daily at 9:00 AM and 5:00 PM</li>
                <li>You will receive backup notifications via WhatsApp and Email</li>
                <li>Download backup files to store them safely offline</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DatabaseBackup;
