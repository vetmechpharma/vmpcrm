import { useState, useEffect } from 'react';
import { emailAPI } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Loader2, Mail, CheckCircle, XCircle, Clock, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/button';
import { formatDateTime } from '../lib/utils';

const STATUS_CONFIG = {
  sent: { icon: CheckCircle, color: 'bg-emerald-100 text-emerald-700', label: 'Sent' },
  failed: { icon: XCircle, color: 'bg-red-100 text-red-700', label: 'Failed' },
  pending: { icon: Clock, color: 'bg-amber-100 text-amber-700', label: 'Pending' },
};

export const EmailLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const response = await emailAPI.getLogs();
      setLogs(response.data);
    } catch (error) {
      console.error('Failed to fetch email logs:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in" data-testid="email-logs-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Email Logs</h1>
          <p className="text-slate-500 mt-1">Track all sent emails</p>
        </div>
        <Button variant="outline" onClick={fetchLogs} disabled={loading} data-testid="refresh-logs-btn">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Logs */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
          ) : logs.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {logs.map((log) => {
                const statusConfig = STATUS_CONFIG[log.status] || STATUS_CONFIG.pending;
                const StatusIcon = statusConfig.icon;
                
                return (
                  <div 
                    key={log.id} 
                    className="p-4 hover:bg-slate-50 transition-colors"
                    data-testid={`email-log-${log.id}`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Mail className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3 className="font-medium text-slate-900 truncate">{log.subject}</h3>
                            <p className="text-sm text-slate-500 mt-0.5">
                              To: {log.doctor_name} ({log.doctor_email})
                            </p>
                          </div>
                          <Badge className={statusConfig.color}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {statusConfig.label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                          {log.sent_at && (
                            <span>Sent: {formatDateTime(log.sent_at)}</span>
                          )}
                          {log.error_message && (
                            <span className="text-red-500">Error: {log.error_message}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-state">
              <Mail className="empty-state-icon" />
              <h3 className="empty-state-title">No emails sent yet</h3>
              <p className="empty-state-text">
                Email logs will appear here once you send emails to doctors
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
