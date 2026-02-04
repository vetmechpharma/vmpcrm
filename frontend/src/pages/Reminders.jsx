import { useState, useEffect } from 'react';
import { remindersAPI, doctorsAPI, medicalsAPI, agenciesAPI } from '../lib/api';
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
  Plus, 
  Trash2, 
  Loader2,
  Bell,
  Calendar,
  Clock,
  CheckCircle,
  User,
  Store,
  Building,
  Gift,
  Heart,
  Phone,
  Send,
  RefreshCw,
  CalendarDays,
  AlertCircle
} from 'lucide-react';
import { formatDate } from '../lib/utils';

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
  
  // Entity lists for dropdown
  const [doctors, setDoctors] = useState([]);
  const [medicals, setMedicals] = useState([]);
  const [agencies, setAgencies] = useState([]);
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedReminder, setSelectedReminder] = useState(null);
  const [formLoading, setFormLoading] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    reminder_type: 'custom',
    reminder_date: new Date().toISOString().split('T')[0],
    reminder_time: '',
    entity_type: '',
    entity_id: '',
    entity_name: '',
    priority: 'moderate',
  });

  useEffect(() => {
    fetchData();
    fetchEntities();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [todayRes, allRes] = await Promise.all([
        remindersAPI.getToday(),
        remindersAPI.getAll({ is_completed: false }),
      ]);
      setTodayReminders(todayRes.data);
      setAllReminders(allRes.data);
    } catch (error) {
      toast.error('Failed to fetch reminders');
    } finally {
      setLoading(false);
    }
  };

  const fetchEntities = async () => {
    try {
      const [docRes, medRes, agyRes] = await Promise.all([
        doctorsAPI.getAll({}),
        medicalsAPI.getAll({}),
        agenciesAPI.getAll({}),
      ]);
      setDoctors(docRes.data);
      setMedicals(medRes.data);
      setAgencies(agyRes.data);
    } catch (error) {
      console.error('Failed to fetch entities');
    }
  };

  const handleAddReminder = async () => {
    if (!formData.title || !formData.reminder_date) {
      toast.error('Title and date are required');
      return;
    }
    
    setFormLoading(true);
    try {
      await remindersAPI.create(formData);
      toast.success('Reminder created successfully');
      setShowAddModal(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error('Failed to create reminder');
    } finally {
      setFormLoading(false);
    }
  };

  const handleMarkComplete = async (reminder) => {
    try {
      await remindersAPI.markComplete(reminder.id);
      toast.success('Reminder marked as complete');
      fetchData();
    } catch (error) {
      toast.error('Failed to mark reminder as complete');
    }
  };

  const handleDelete = async () => {
    if (!selectedReminder || selectedReminder.is_auto_generated) return;
    
    setFormLoading(true);
    try {
      await remindersAPI.delete(selectedReminder.id);
      toast.success('Reminder deleted');
      setShowDeleteModal(false);
      setSelectedReminder(null);
      fetchData();
    } catch (error) {
      toast.error('Failed to delete reminder');
    } finally {
      setFormLoading(false);
    }
  };

  const handleSendWhatsApp = async () => {
    setSending(true);
    try {
      const response = await remindersAPI.sendWhatsAppSummary();
      if (response.data.sent) {
        toast.success(`Reminder summary sent to admin (${response.data.phone})`);
      } else {
        toast.info(response.data.message);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send WhatsApp summary');
    } finally {
      setSending(false);
    }
  };

  const openDeleteModal = (reminder) => {
    setSelectedReminder(reminder);
    setShowDeleteModal(true);
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      reminder_type: 'custom',
      reminder_date: new Date().toISOString().split('T')[0],
      reminder_time: '',
      entity_type: '',
      entity_id: '',
      entity_name: '',
      priority: 'moderate',
    });
  };

  const getTypeInfo = (type) => {
    return REMINDER_TYPES.find(t => t.value === type) || REMINDER_TYPES[3];
  };

  const getPriorityInfo = (priority) => {
    return PRIORITIES.find(p => p.value === priority) || PRIORITIES[1];
  };

  const getEntityIcon = (type) => {
    const entity = ENTITY_TYPES.find(e => e.value === type);
    return entity ? entity.icon : User;
  };

  const getEntityOptions = () => {
    switch (formData.entity_type) {
      case 'doctor':
        return doctors.map(d => ({ id: d.id, name: d.name }));
      case 'medical':
        return medicals.map(m => ({ id: m.id, name: m.name }));
      case 'agency':
        return agencies.map(a => ({ id: a.id, name: a.name }));
      default:
        return [];
    }
  };

  const handleEntitySelect = (entityId) => {
    const options = getEntityOptions();
    const selected = options.find(o => o.id === entityId);
    setFormData({
      ...formData,
      entity_id: entityId,
      entity_name: selected?.name || '',
    });
  };

  // Group today's reminders by type
  const followUps = todayReminders.reminders.filter(r => r.reminder_type === 'follow_up');
  const birthdays = todayReminders.reminders.filter(r => r.reminder_type === 'birthday');
  const anniversaries = todayReminders.reminders.filter(r => r.reminder_type === 'anniversary');
  const customs = todayReminders.reminders.filter(r => r.reminder_type === 'custom');

  return (
    <div className="space-y-6" data-testid="reminders-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Reminders</h1>
          <p className="text-slate-500">Manage follow-ups, birthdays, and custom reminders</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button 
            variant="outline" 
            onClick={handleSendWhatsApp} 
            disabled={sending || todayReminders.total_count === 0}
            className="gap-2"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Send to Admin
          </Button>
          <Button variant="outline" onClick={fetchData} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
          <Button onClick={() => setShowAddModal(true)} className="gap-2" data-testid="add-reminder-btn">
            <Plus className="w-4 h-4" />
            Add Reminder
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className={todayReminders.total_count > 0 ? 'border-amber-300 bg-amber-50' : ''}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Today</p>
                <p className="text-2xl font-bold text-slate-800">{todayReminders.total_count}</p>
              </div>
              <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                <Bell className="w-5 h-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Follow-ups</p>
                <p className="text-2xl font-bold text-blue-600">{followUps.length}</p>
              </div>
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <Phone className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Birthdays</p>
                <p className="text-2xl font-bold text-pink-600">{birthdays.length}</p>
              </div>
              <div className="w-10 h-10 bg-pink-100 rounded-full flex items-center justify-center">
                <Gift className="w-5 h-5 text-pink-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Anniversaries</p>
                <p className="text-2xl font-bold text-purple-600">{anniversaries.length}</p>
              </div>
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                <Heart className="w-5 h-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Custom</p>
                <p className="text-2xl font-bold text-slate-600">{customs.length}</p>
              </div>
              <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                <CalendarDays className="w-5 h-5 text-slate-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="today" className="gap-2">
            <Bell className="w-4 h-4" />
            Today's Reminders
            {todayReminders.total_count > 0 && (
              <Badge className="bg-amber-500 text-white ml-1">{todayReminders.total_count}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="all" className="gap-2">
            <Calendar className="w-4 h-4" />
            All Reminders
          </TabsTrigger>
        </TabsList>

        {/* Today Tab */}
        <TabsContent value="today" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                </div>
              ) : todayReminders.reminders.length > 0 ? (
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="w-[50px] text-center">#</TableHead>
                        <TableHead className="w-[100px]">Type</TableHead>
                        <TableHead>Title / Contact</TableHead>
                        <TableHead className="w-[120px]">Entity</TableHead>
                        <TableHead className="w-[100px]">Priority</TableHead>
                        <TableHead className="w-[100px]">Phone</TableHead>
                        <TableHead className="w-[100px] text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {todayReminders.reminders.map((reminder, index) => {
                        const typeInfo = getTypeInfo(reminder.reminder_type);
                        const priorityInfo = getPriorityInfo(reminder.priority);
                        const EntityIcon = getEntityIcon(reminder.entity_type);
                        
                        return (
                          <TableRow key={reminder.id} className="hover:bg-slate-50" data-testid={`reminder-row-${reminder.id}`}>
                            <TableCell className="text-center text-slate-500">{index + 1}</TableCell>
                            <TableCell>
                              <Badge className={typeInfo.color}>
                                {typeInfo.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div>
                                <span className="font-medium">{reminder.title}</span>
                                {reminder.description && (
                                  <p className="text-xs text-slate-400 mt-0.5">{reminder.description}</p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {reminder.entity_type && (
                                <div className="flex items-center gap-1 text-sm text-slate-600">
                                  <EntityIcon className="w-3 h-3" />
                                  {reminder.entity_name || '-'}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={priorityInfo.color}>
                                {priorityInfo.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {reminder.phone && (
                                <a href={`tel:${reminder.phone}`} className="text-blue-600 hover:underline text-sm">
                                  {reminder.phone}
                                </a>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex justify-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleMarkComplete(reminder)}
                                  className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                  title="Mark Complete"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </Button>
                                {!reminder.is_auto_generated && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openDeleteModal(reminder)}
                                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                    title="Delete"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                )}
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
                  <CheckCircle className="w-16 h-16 mb-4 text-green-300" />
                  <h3 className="text-lg font-medium">No Reminders Today</h3>
                  <p className="text-sm">You're all caught up!</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* All Reminders Tab */}
        <TabsContent value="all" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                </div>
              ) : allReminders.length > 0 ? (
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="w-[50px] text-center">#</TableHead>
                        <TableHead className="w-[100px]">Date</TableHead>
                        <TableHead className="w-[90px]">Type</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead className="w-[120px]">Entity</TableHead>
                        <TableHead className="w-[90px]">Priority</TableHead>
                        <TableHead className="w-[80px] text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allReminders.map((reminder, index) => {
                        const typeInfo = getTypeInfo(reminder.reminder_type);
                        const priorityInfo = getPriorityInfo(reminder.priority);
                        
                        return (
                          <TableRow key={reminder.id} className="hover:bg-slate-50">
                            <TableCell className="text-center text-slate-500">{index + 1}</TableCell>
                            <TableCell className="font-medium">{formatDate(reminder.reminder_date)}</TableCell>
                            <TableCell>
                              <Badge className={typeInfo.color} variant="outline">
                                {typeInfo.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <span>{reminder.title}</span>
                              {reminder.description && (
                                <p className="text-xs text-slate-400">{reminder.description}</p>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-slate-600">
                              {reminder.entity_name || '-'}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={priorityInfo.color}>
                                {priorityInfo.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex justify-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openDeleteModal(reminder)}
                                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
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
                  <Calendar className="w-16 h-16 mb-4" />
                  <h3 className="text-lg font-medium">No Scheduled Reminders</h3>
                  <p className="text-sm">Create a reminder to get started</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Reminder Modal */}
      <Dialog open={showAddModal} onOpenChange={() => { setShowAddModal(false); resetForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Add New Reminder
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                placeholder="Reminder title"
                data-testid="reminder-title-input"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Additional details"
                rows={2}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={formData.reminder_type} onValueChange={(v) => setFormData({...formData, reminder_type: v})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REMINDER_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={formData.priority} onValueChange={(v) => setFormData({...formData, priority: v})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={formData.reminder_date}
                  onChange={(e) => setFormData({...formData, reminder_date: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Time (Optional)</Label>
                <Input
                  type="time"
                  value={formData.reminder_time}
                  onChange={(e) => setFormData({...formData, reminder_time: e.target.value})}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Link to Contact (Optional)</Label>
              <div className="grid grid-cols-2 gap-2">
                <Select 
                  value={formData.entity_type} 
                  onValueChange={(v) => setFormData({...formData, entity_type: v, entity_id: '', entity_name: ''})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {ENTITY_TYPES.map((e) => (
                      <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {formData.entity_type && (
                  <Select value={formData.entity_id} onValueChange={handleEntitySelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select contact" />
                    </SelectTrigger>
                    <SelectContent>
                      {getEntityOptions().map((opt) => (
                        <SelectItem key={opt.id} value={opt.id}>{opt.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddModal(false); resetForm(); }}>Cancel</Button>
            <Button onClick={handleAddReminder} disabled={formLoading}>
              {formLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Create Reminder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600">Delete Reminder</DialogTitle>
          </DialogHeader>
          <p className="py-4">
            Are you sure you want to delete the reminder "<strong>{selectedReminder?.title}</strong>"?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
            <Button onClick={handleDelete} disabled={formLoading} className="bg-red-600 hover:bg-red-700">
              {formLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Reminders;
