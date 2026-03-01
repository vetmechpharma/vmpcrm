import { useState, useEffect } from 'react';
import { remindersAPI, doctorsAPI, medicalsAPI, agenciesAPI, followupsAPI } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Card, CardContent } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import { 
  Plus, Trash2, Loader2, Bell, Calendar, Clock, CheckCircle,
  User, Store, Building, Gift, Heart, Phone, Send, RefreshCw,
  CalendarDays, AlertCircle, PhoneCall, History, ArrowRight
} from 'lucide-react';
import { LEAD_STATUSES, getStatusColor, formatDate, formatDateTime } from '../lib/utils';

const REMINDER_TYPES = [
  { value: 'follow_up', label: 'Follow-up', icon: Phone, color: 'bg-blue-100 text-blue-700' },
  { value: 'birthday', label: 'Birthday', icon: Gift, color: 'bg-pink-100 text-pink-700' },
  { value: 'anniversary', label: 'Anniversary', icon: Heart, color: 'bg-purple-100 text-purple-700' },
  { value: 'custom', label: 'Custom', icon: Bell, color: 'bg-slate-100 text-slate-700' },
];

const PRIORITIES = [
  { value: 'low', label: 'Low', color: 'bg-slate-100 text-slate-700' },
  { value: 'moderate', label: 'Moderate', color: 'bg-amber-100 text-amber-700' },
  { value: 'high', label: 'High', color: 'bg-red-100 text-red-700' },
];

const ENTITY_TYPES = [
  { value: 'doctor', label: 'Doctor', icon: User },
  { value: 'medical', label: 'Medical', icon: Store },
  { value: 'agency', label: 'Agency', icon: Building },
];

export const Reminders = () => {
  const [todayReminders, setTodayReminders] = useState({ reminders: [], total_count: 0 });
  const [allReminders, setAllReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState('today');
  
  const [doctors, setDoctors] = useState([]);
  const [medicals, setMedicals] = useState([]);
  const [agencies, setAgencies] = useState([]);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedReminder, setSelectedReminder] = useState(null);
  const [formLoading, setFormLoading] = useState(false);

  // Follow-up modal (from reminders)
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [followUpTarget, setFollowUpTarget] = useState(null);
  const [followUpData, setFollowUpData] = useState({ notes: '', new_status: '', next_follow_up_date: '', next_follow_up_time: '' });
  const [followUpHistory, setFollowUpHistory] = useState([]);
  const [loadingFollowUps, setLoadingFollowUps] = useState(false);
  const [followUpSubmitting, setFollowUpSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    title: '', description: '', reminder_type: 'custom',
    reminder_date: new Date().toISOString().split('T')[0], reminder_time: '',
    entity_type: '', entity_id: '', entity_name: '', priority: 'moderate',
  });

  useEffect(() => { fetchData(); fetchEntities(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [todayRes, allRes] = await Promise.all([
        remindersAPI.getToday(), remindersAPI.getAll({ is_completed: false }),
      ]);
      setTodayReminders(todayRes.data); setAllReminders(allRes.data);
    } catch (e) { toast.error('Failed to fetch reminders'); }
    finally { setLoading(false); }
  };

  const fetchEntities = async () => {
    try {
      const [docRes, medRes, agyRes] = await Promise.all([doctorsAPI.getAll({}), medicalsAPI.getAll({}), agenciesAPI.getAll({})]);
      setDoctors(docRes.data); setMedicals(medRes.data); setAgencies(agyRes.data);
    } catch (e) { console.error('Failed to fetch entities'); }
  };

  const handleAddReminder = async () => {
    if (!formData.title || !formData.reminder_date) { toast.error('Title and date are required'); return; }
    setFormLoading(true);
    try { await remindersAPI.create(formData); toast.success('Reminder created'); setShowAddModal(false); resetForm(); fetchData(); }
    catch (e) { toast.error('Failed to create reminder'); }
    finally { setFormLoading(false); }
  };

  const handleMarkComplete = async (reminder) => {
    try { await remindersAPI.markComplete(reminder.id); toast.success('Marked as complete'); fetchData(); }
    catch (e) { toast.error('Failed to mark complete'); }
  };

  const handleDelete = async () => {
    if (!selectedReminder || selectedReminder.is_auto_generated) return;
    setFormLoading(true);
    try { await remindersAPI.delete(selectedReminder.id); toast.success('Reminder deleted'); setShowDeleteModal(false); setSelectedReminder(null); fetchData(); }
    catch (e) { toast.error('Failed to delete'); }
    finally { setFormLoading(false); }
  };

  const handleSendWhatsApp = async () => {
    setSending(true);
    try {
      const r = await remindersAPI.sendWhatsAppSummary();
      if (r.data.sent) toast.success(`Summary sent to admin (${r.data.phone})`);
      else toast.info(r.data.message);
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to send'); }
    finally { setSending(false); }
  };

  // Follow-up from reminder
  const openFollowUpFromReminder = async (reminder) => {
    if (!reminder.entity_type || !reminder.entity_id) {
      toast.info('No linked contact for this reminder');
      return;
    }
    setFollowUpTarget(reminder);
    setFollowUpData({
      notes: '', new_status: reminder.lead_status || 'Contacted',
      next_follow_up_date: '', next_follow_up_time: ''
    });
    setShowFollowUpModal(true);
    setLoadingFollowUps(true);
    try {
      const r = await followupsAPI.getHistory(reminder.entity_type, reminder.entity_id);
      setFollowUpHistory(r.data);
    } catch (e) { setFollowUpHistory([]); }
    finally { setLoadingFollowUps(false); }
  };

  const handleSubmitFollowUp = async () => {
    if (!followUpData.notes.trim()) { toast.error('Please add follow-up notes'); return; }
    setFollowUpSubmitting(true);
    try {
      await followupsAPI.create({
        entity_type: followUpTarget.entity_type, entity_id: followUpTarget.entity_id,
        notes: followUpData.notes, new_status: followUpData.new_status || null,
        next_follow_up_date: followUpData.next_follow_up_date || null,
        next_follow_up_time: followUpData.next_follow_up_time || null,
      });
      toast.success('Follow-up recorded');
      setShowFollowUpModal(false);
      fetchData();
    } catch (e) { toast.error('Failed to save follow-up'); }
    finally { setFollowUpSubmitting(false); }
  };

  const resetForm = () => {
    setFormData({ title: '', description: '', reminder_type: 'custom', reminder_date: new Date().toISOString().split('T')[0], reminder_time: '', entity_type: '', entity_id: '', entity_name: '', priority: 'moderate' });
  };

  const getTypeInfo = (type) => REMINDER_TYPES.find(t => t.value === type) || REMINDER_TYPES[3];
  const getPriorityInfo = (p) => PRIORITIES.find(x => x.value === p) || PRIORITIES[1];
  const getEntityIcon = (type) => (ENTITY_TYPES.find(e => e.value === type)?.icon) || User;

  const getEntityOptions = () => {
    switch (formData.entity_type) {
      case 'doctor': return doctors.map(d => ({ id: d.id, name: d.name }));
      case 'medical': return medicals.map(m => ({ id: m.id, name: m.name }));
      case 'agency': return agencies.map(a => ({ id: a.id, name: a.name }));
      default: return [];
    }
  };

  const handleEntitySelect = (entityId) => {
    const selected = getEntityOptions().find(o => o.id === entityId);
    setFormData({ ...formData, entity_id: entityId, entity_name: selected?.name || '' });
  };

  // Separate overdue and today's follow-ups
  const todayStr = new Date().toISOString().split('T')[0];
  const overdueFollowUps = todayReminders.reminders.filter(r => r.reminder_type === 'follow_up' && r.is_overdue);
  const todayFollowUps = todayReminders.reminders.filter(r => r.reminder_type === 'follow_up' && !r.is_overdue);
  const birthdays = todayReminders.reminders.filter(r => r.reminder_type === 'birthday');
  const anniversaries = todayReminders.reminders.filter(r => r.reminder_type === 'anniversary');
  const customs = todayReminders.reminders.filter(r => r.reminder_type === 'custom');

  const ReminderRow = ({ reminder, index, showDate = false }) => {
    const typeInfo = getTypeInfo(reminder.reminder_type);
    const priorityInfo = getPriorityInfo(reminder.priority);
    const EntityIcon = getEntityIcon(reminder.entity_type);
    const isOverdue = reminder.is_overdue;

    return (
      <TableRow className={`hover:bg-slate-50 ${isOverdue ? 'bg-red-50' : ''}`} data-testid={`reminder-row-${reminder.id}`}>
        <TableCell className="text-center text-slate-500">{index + 1}</TableCell>
        {showDate && <TableCell className="font-medium">{formatDate(reminder.reminder_date)}</TableCell>}
        <TableCell>
          <div className="flex items-center gap-2">
            <Badge className={`${typeInfo.color} ${isOverdue ? 'animate-pulse' : ''}`}>{typeInfo.label}</Badge>
            {isOverdue && <Badge className="bg-red-600 text-white text-[10px]">OVERDUE</Badge>}
          </div>
        </TableCell>
        <TableCell>
          <div>
            <span className="font-medium">{reminder.title}</span>
            {reminder.description && <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{reminder.description}</p>}
          </div>
        </TableCell>
        <TableCell>
          {reminder.entity_type && (
            <div className="flex items-center gap-1 text-sm text-slate-600">
              <EntityIcon className="w-3 h-3" />
              {reminder.entity_name || '-'}
            </div>
          )}
          {reminder.lead_status && (
            <Badge className={`${getStatusColor(reminder.lead_status)} text-[10px] mt-1`}>{reminder.lead_status}</Badge>
          )}
        </TableCell>
        <TableCell>
          <Badge variant="outline" className={priorityInfo.color}>{priorityInfo.label}</Badge>
        </TableCell>
        <TableCell>
          {reminder.phone && (
            <a href={`tel:${reminder.phone}`} className="text-blue-600 hover:underline text-sm flex items-center gap-1">
              <Phone className="w-3 h-3" />{reminder.phone}
            </a>
          )}
        </TableCell>
        <TableCell>
          <div className="flex justify-center gap-1">
            {reminder.reminder_type === 'follow_up' && reminder.entity_type && (
              <Button
                variant="ghost" size="sm"
                onClick={() => openFollowUpFromReminder(reminder)}
                className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                title="Update Follow-up"
                data-testid={`reminder-followup-${reminder.id}`}
              >
                <PhoneCall className="w-4 h-4" />
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => handleMarkComplete(reminder)}
              className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50" title="Mark Complete">
              <CheckCircle className="w-4 h-4" />
            </Button>
            {!reminder.is_auto_generated && (
              <Button variant="ghost" size="sm" onClick={() => { setSelectedReminder(reminder); setShowDeleteModal(true); }}
                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50" title="Delete">
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </TableCell>
      </TableRow>
    );
  };

  return (
    <div className="space-y-6" data-testid="reminders-page">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Reminders & Follow-ups</h1>
          <p className="text-slate-500">Track follow-ups, birthdays, and custom reminders</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={handleSendWhatsApp} disabled={sending || todayReminders.total_count === 0} className="gap-2">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}Send to Admin
          </Button>
          <Button variant="outline" onClick={fetchData} className="gap-2"><RefreshCw className="w-4 h-4" />Refresh</Button>
          <Button onClick={() => setShowAddModal(true)} className="gap-2" data-testid="add-reminder-btn"><Plus className="w-4 h-4" />Add Reminder</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        {[
          { label: 'Total Today', count: todayReminders.total_count, color: 'bg-amber-100', textColor: 'text-amber-600', icon: Bell, highlight: todayReminders.total_count > 0 },
          { label: 'Overdue', count: overdueFollowUps.length, color: 'bg-red-100', textColor: 'text-red-600', icon: AlertCircle, highlight: overdueFollowUps.length > 0 },
          { label: 'Follow-ups', count: todayFollowUps.length, color: 'bg-blue-100', textColor: 'text-blue-600', icon: Phone },
          { label: 'Birthdays', count: birthdays.length, color: 'bg-pink-100', textColor: 'text-pink-600', icon: Gift },
          { label: 'Anniversaries', count: anniversaries.length, color: 'bg-purple-100', textColor: 'text-purple-600', icon: Heart },
          { label: 'Custom', count: customs.length, color: 'bg-slate-100', textColor: 'text-slate-600', icon: CalendarDays },
        ].map(s => (
          <Card key={s.label} className={s.highlight ? 'border-amber-300 bg-amber-50' : ''}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div><p className="text-sm text-slate-500">{s.label}</p><p className={`text-2xl font-bold ${s.textColor}`}>{s.count}</p></div>
                <div className={`w-10 h-10 ${s.color} rounded-full flex items-center justify-center`}><s.icon className={`w-5 h-5 ${s.textColor}`} /></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="today" className="gap-2">
            <Bell className="w-4 h-4" />Today's Reminders
            {todayReminders.total_count > 0 && <Badge className="bg-amber-500 text-white ml-1">{todayReminders.total_count}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="overdue" className="gap-2">
            <AlertCircle className="w-4 h-4" />Overdue
            {overdueFollowUps.length > 0 && <Badge className="bg-red-500 text-white ml-1">{overdueFollowUps.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="all" className="gap-2"><Calendar className="w-4 h-4" />All Reminders</TabsTrigger>
        </TabsList>

        {/* Today Tab */}
        <TabsContent value="today" className="mt-4">
          <Card><CardContent className="pt-6">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
            ) : todayReminders.reminders.length > 0 ? (
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader><TableRow className="bg-slate-50">
                    <TableHead className="w-[50px] text-center">#</TableHead>
                    <TableHead className="w-[140px]">Type</TableHead>
                    <TableHead>Title / Contact</TableHead>
                    <TableHead className="w-[140px]">Entity</TableHead>
                    <TableHead className="w-[100px]">Priority</TableHead>
                    <TableHead className="w-[120px]">Phone</TableHead>
                    <TableHead className="w-[120px] text-center">Actions</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {todayReminders.reminders.map((reminder, index) => (
                      <ReminderRow key={reminder.id} reminder={reminder} index={index} />
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center text-slate-400 py-12">
                <CheckCircle className="w-16 h-16 mb-4 text-green-300" />
                <h3 className="text-lg font-medium">No Reminders Today</h3>
                <p className="text-sm">You're all caught up!</p>
              </div>
            )}
          </CardContent></Card>
        </TabsContent>

        {/* Overdue Tab */}
        <TabsContent value="overdue" className="mt-4">
          <Card><CardContent className="pt-6">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
            ) : overdueFollowUps.length > 0 ? (
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader><TableRow className="bg-red-50">
                    <TableHead className="w-[50px] text-center">#</TableHead>
                    <TableHead className="w-[110px]">Due Date</TableHead>
                    <TableHead className="w-[140px]">Type</TableHead>
                    <TableHead>Title / Last Notes</TableHead>
                    <TableHead className="w-[140px]">Entity</TableHead>
                    <TableHead className="w-[100px]">Priority</TableHead>
                    <TableHead className="w-[120px]">Phone</TableHead>
                    <TableHead className="w-[120px] text-center">Actions</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {overdueFollowUps.map((reminder, index) => (
                      <ReminderRow key={reminder.id} reminder={reminder} index={index} showDate />
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center text-slate-400 py-12">
                <CheckCircle className="w-16 h-16 mb-4 text-green-300" />
                <h3 className="text-lg font-medium">No Overdue Follow-ups</h3>
                <p className="text-sm">All follow-ups are on track!</p>
              </div>
            )}
          </CardContent></Card>
        </TabsContent>

        {/* All Reminders Tab */}
        <TabsContent value="all" className="mt-4">
          <Card><CardContent className="pt-6">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
            ) : allReminders.length > 0 ? (
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader><TableRow className="bg-slate-50">
                    <TableHead className="w-[50px] text-center">#</TableHead>
                    <TableHead className="w-[100px]">Date</TableHead>
                    <TableHead className="w-[90px]">Type</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead className="w-[120px]">Entity</TableHead>
                    <TableHead className="w-[90px]">Priority</TableHead>
                    <TableHead className="w-[80px] text-center">Actions</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {allReminders.map((reminder, index) => {
                      const typeInfo = getTypeInfo(reminder.reminder_type);
                      const priorityInfo = getPriorityInfo(reminder.priority);
                      return (
                        <TableRow key={reminder.id} className="hover:bg-slate-50">
                          <TableCell className="text-center text-slate-500">{index + 1}</TableCell>
                          <TableCell className="font-medium">{formatDate(reminder.reminder_date)}</TableCell>
                          <TableCell><Badge className={typeInfo.color} variant="outline">{typeInfo.label}</Badge></TableCell>
                          <TableCell><span>{reminder.title}</span>{reminder.description && <p className="text-xs text-slate-400">{reminder.description}</p>}</TableCell>
                          <TableCell className="text-sm text-slate-600">{reminder.entity_name || '-'}</TableCell>
                          <TableCell><Badge variant="outline" className={priorityInfo.color}>{priorityInfo.label}</Badge></TableCell>
                          <TableCell>
                            <div className="flex justify-center gap-1">
                              <Button variant="ghost" size="sm" onClick={() => { setSelectedReminder(reminder); setShowDeleteModal(true); }}
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700"><Trash2 className="w-4 h-4" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center text-slate-400 py-12">
                <Calendar className="w-16 h-16 mb-4" /><h3 className="text-lg font-medium">No Scheduled Reminders</h3>
              </div>
            )}
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      {/* Follow-Up Modal (from Reminders) */}
      <Dialog open={showFollowUpModal} onOpenChange={setShowFollowUpModal}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PhoneCall className="w-5 h-5 text-green-600" />
              Follow-up: {followUpTarget?.entity_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2 text-sm bg-slate-50 p-3 rounded-lg">
              <span className="text-slate-500">Type:</span>
              <Badge className="bg-blue-100 text-blue-700">{followUpTarget?.entity_type}</Badge>
              {followUpTarget?.lead_status && (
                <><span className="text-slate-400">|</span><span className="text-slate-500">Status:</span><Badge className={getStatusColor(followUpTarget?.lead_status)}>{followUpTarget?.lead_status}</Badge></>
              )}
            </div>
            <div className="space-y-2">
              <Label>What happened? *</Label>
              <Textarea value={followUpData.notes} onChange={(e) => setFollowUpData({...followUpData, notes: e.target.value})} placeholder="e.g., Called and they are interested, asked to send quote..." rows={3} data-testid="reminder-followup-notes" />
            </div>
            <div className="space-y-2">
              <Label>Update Lead Status</Label>
              <Select value={followUpData.new_status} onValueChange={(v) => setFollowUpData({...followUpData, new_status: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{LEAD_STATUSES.map((s) => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Next Follow-up Date</Label><Input type="date" value={followUpData.next_follow_up_date} onChange={(e) => setFollowUpData({...followUpData, next_follow_up_date: e.target.value})} /></div>
              <div className="space-y-2"><Label>Time (Optional)</Label><Input type="time" value={followUpData.next_follow_up_time} onChange={(e) => setFollowUpData({...followUpData, next_follow_up_time: e.target.value})} /></div>
            </div>
            {/* History */}
            <div className="border-t pt-4">
              <h4 className="font-medium flex items-center gap-2 mb-3 text-sm"><History className="w-4 h-4" /> Previous Follow-ups</h4>
              {loadingFollowUps ? <Loader2 className="w-4 h-4 animate-spin" /> : followUpHistory.length > 0 ? (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {followUpHistory.map((fu) => (
                    <div key={fu.id} className={`p-3 rounded-lg text-sm border-l-4 ${fu.status === 'open' ? 'border-l-green-500 bg-green-50' : 'border-l-slate-300 bg-slate-50'}`}>
                      <p className="text-slate-800">{fu.notes}</p>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500 flex-wrap">
                        <span>{fu.created_by} - {formatDateTime(fu.created_at)}</span>
                        {fu.new_status && <Badge className={`${getStatusColor(fu.new_status)} text-[10px]`}>{fu.new_status}</Badge>}
                        {fu.next_follow_up_date && <span>Next: {formatDate(fu.next_follow_up_date)}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-slate-400">No previous follow-ups</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFollowUpModal(false)}>Cancel</Button>
            <Button onClick={handleSubmitFollowUp} disabled={followUpSubmitting} data-testid="reminder-followup-submit">
              {followUpSubmitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Save Follow-up
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Reminder Modal */}
      <Dialog open={showAddModal} onOpenChange={() => { setShowAddModal(false); resetForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Bell className="w-5 h-5" />Add New Reminder</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>Title *</Label><Input value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} placeholder="Reminder title" data-testid="reminder-title-input" /></div>
            <div className="space-y-2"><Label>Description</Label><Textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} placeholder="Additional details" rows={2} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Type</Label><Select value={formData.reminder_type} onValueChange={(v) => setFormData({...formData, reminder_type: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{REMINDER_TYPES.map((t) => (<SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>))}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Priority</Label><Select value={formData.priority} onValueChange={(v) => setFormData({...formData, priority: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PRIORITIES.map((p) => (<SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>))}</SelectContent></Select></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Date *</Label><Input type="date" value={formData.reminder_date} onChange={(e) => setFormData({...formData, reminder_date: e.target.value})} /></div>
              <div className="space-y-2"><Label>Time</Label><Input type="time" value={formData.reminder_time} onChange={(e) => setFormData({...formData, reminder_time: e.target.value})} /></div>
            </div>
            <div className="space-y-2">
              <Label>Link to Contact</Label>
              <div className="grid grid-cols-2 gap-2">
                <Select value={formData.entity_type || "none"} onValueChange={(v) => setFormData({...formData, entity_type: v === "none" ? "" : v, entity_id: '', entity_name: ''})}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent><SelectItem value="none">None</SelectItem>{ENTITY_TYPES.map((e) => (<SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>))}</SelectContent>
                </Select>
                {formData.entity_type && (
                  <Select value={formData.entity_id} onValueChange={handleEntitySelect}>
                    <SelectTrigger><SelectValue placeholder="Select contact" /></SelectTrigger>
                    <SelectContent>{getEntityOptions().map((o) => (<SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>))}</SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddModal(false); resetForm(); }}>Cancel</Button>
            <Button onClick={handleAddReminder} disabled={formLoading}>{formLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Create Reminder</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="max-w-md"><DialogHeader><DialogTitle className="text-red-600">Delete Reminder</DialogTitle></DialogHeader>
          <p className="py-4">Delete "<strong>{selectedReminder?.title}</strong>"?</p>
          <DialogFooter><Button variant="outline" onClick={() => setShowDeleteModal(false)}>Cancel</Button><Button onClick={handleDelete} disabled={formLoading} className="bg-red-600 hover:bg-red-700">{formLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Delete</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Reminders;
