import { useState, useEffect } from 'react';
import { mrAPI, locationAPI } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Card, CardContent } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { toast } from 'sonner';
import { Plus, Search, Edit2, Trash2, Loader2, UserCog, MapPin, Phone, Eye, EyeOff } from 'lucide-react';
import { formatDate } from '../lib/utils';

export const MRManagement = () => {
  const [mrs, setMrs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selectedMR, setSelectedMR] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [states, setStates] = useState([]);
  const [districts, setDistricts] = useState([]);

  const [formData, setFormData] = useState({
    name: '', phone: '', email: '', password: '', state: '', districts: [], status: 'active',
  });

  useEffect(() => { fetchMRs(); }, [search]);
  useEffect(() => { fetchStates(); }, []);
  useEffect(() => {
    if (formData.state) fetchDistricts(formData.state);
    else setDistricts([]);
  }, [formData.state]);

  const fetchStates = async () => {
    try {
      const res = await locationAPI.getStates();
      setStates(res.data.states || []);
    } catch { /* silent */ }
  };

  const fetchDistricts = async (state) => {
    try {
      const res = await locationAPI.getDistricts(state);
      setDistricts(res.data.districts || []);
    } catch { setDistricts([]); }
  };

  const fetchMRs = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      const res = await mrAPI.getAll(params);
      setMrs(res.data);
    } catch { toast.error('Failed to fetch MRs'); }
    finally { setLoading(false); }
  };

  const resetForm = () => {
    setFormData({ name: '', phone: '', email: '', password: '', state: '', districts: [], status: 'active' });
    setEditing(null);
    setShowPassword(false);
  };

  const openAdd = () => { resetForm(); setShowModal(true); };
  const openEdit = (mr) => {
    setEditing(mr);
    setFormData({ name: mr.name, phone: mr.phone, email: mr.email || '', password: '', state: mr.state, districts: mr.districts || [], status: mr.status });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.phone || !formData.state) { toast.error('Name, phone, and state are required'); return; }
    if (!editing && !formData.password) { toast.error('Password is required for new MR'); return; }
    setFormLoading(true);
    try {
      const payload = { ...formData };
      if (editing && !payload.password) delete payload.password;
      if (editing) {
        await mrAPI.update(editing.id, payload);
        toast.success('MR updated');
      } else {
        await mrAPI.create(payload);
        toast.success('MR created');
      }
      setShowModal(false); resetForm(); fetchMRs();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to save MR'); }
    finally { setFormLoading(false); }
  };

  const handleDelete = async () => {
    if (!selectedMR) return;
    setFormLoading(true);
    try {
      await mrAPI.delete(selectedMR.id);
      toast.success('MR deleted');
      setShowDeleteModal(false); setSelectedMR(null); fetchMRs();
    } catch { toast.error('Failed to delete MR'); }
    finally { setFormLoading(false); }
  };

  const toggleDistrict = (district) => {
    const current = formData.districts || [];
    if (current.includes(district)) {
      setFormData({ ...formData, districts: current.filter(d => d !== district) });
    } else {
      setFormData({ ...formData, districts: [...current, district] });
    }
  };

  return (
    <div className="space-y-6" data-testid="mr-management-page">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">MR Management</h1>
          <p className="text-slate-500">Manage Medical Representatives and their territories</p>
        </div>
        <Button onClick={openAdd} data-testid="add-mr-btn"><Plus className="w-4 h-4 mr-2" />Add MR</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-slate-500">Total MRs</p><p className="text-2xl font-bold text-slate-800">{mrs.length}</p></div>
            <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center"><UserCog className="w-5 h-5 text-indigo-600" /></div>
          </div>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-slate-500">Active</p><p className="text-2xl font-bold text-emerald-600">{mrs.filter(m => m.status === 'active').length}</p></div>
            <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center"><UserCog className="w-5 h-5 text-emerald-600" /></div>
          </div>
        </CardContent></Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input placeholder="Search by name, phone..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" data-testid="mr-search" />
      </div>

      {/* MR List */}
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
          ) : mrs.length > 0 ? (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="w-[50px]">#</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Districts</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mrs.map((mr, i) => (
                    <TableRow key={mr.id} data-testid={`mr-row-${mr.id}`}>
                      <TableCell className="text-slate-500">{i + 1}</TableCell>
                      <TableCell className="font-medium">{mr.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm"><Phone className="w-3 h-3 text-slate-400" />{mr.phone}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm"><MapPin className="w-3 h-3 text-slate-400" />{mr.state}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(mr.districts || []).slice(0, 3).map(d => (
                            <Badge key={d} variant="outline" className="text-[10px] bg-slate-50">{d}</Badge>
                          ))}
                          {(mr.districts || []).length > 3 && (
                            <Badge variant="outline" className="text-[10px]">+{mr.districts.length - 3}</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={mr.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}>
                          {mr.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">{formatDate(mr.created_at)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(mr)} className="h-8 w-8"><Edit2 className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => { setSelectedMR(mr); setShowDeleteModal(true); }} className="h-8 w-8 text-red-600"><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12">
              <UserCog className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-600">No Medical Representatives</h3>
              <p className="text-sm text-slate-400">Add your first MR to get started</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Modal */}
      <Dialog open={showModal} onOpenChange={() => { setShowModal(false); resetForm(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit MR' : 'Add New MR'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2"><Label>Name *</Label><Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Full name" data-testid="mr-name-input" /></div>
              <div className="space-y-2"><Label>Phone *</Label><Input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="9876543210" data-testid="mr-phone-input" /></div>
              <div className="space-y-2"><Label>Email</Label><Input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="mr@email.com" /></div>
              <div className="col-span-2 space-y-2">
                <Label>{editing ? 'New Password (leave blank to keep)' : 'Password *'}</Label>
                <div className="relative">
                  <Input type={showPassword ? 'text' : 'password'} value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} placeholder="Password" data-testid="mr-password-input" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2"><MapPin className="w-4 h-4" />Territory Assignment</h4>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>State *</Label>
                  <Select value={formData.state} onValueChange={v => setFormData({...formData, state: v, districts: []})}>
                    <SelectTrigger data-testid="mr-state-select"><SelectValue placeholder="Select State" /></SelectTrigger>
                    <SelectContent className="max-h-60">{states.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Districts (click to select)</Label>
                  {districts.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto border rounded-lg p-3 bg-slate-50">
                      {districts.map(d => (
                        <Badge key={d} variant="outline"
                          className={`cursor-pointer transition-colors ${formData.districts.includes(d) ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700' : 'hover:bg-slate-100'}`}
                          onClick={() => toggleDistrict(d)} data-testid={`district-${d}`}>
                          {d}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">{formData.state ? 'No districts found' : 'Select a state first'}</p>
                  )}
                  {formData.districts.length > 0 && (
                    <p className="text-xs text-indigo-600">{formData.districts.length} district(s) selected</p>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={v => setFormData({...formData, status: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowModal(false); resetForm(); }}>Cancel</Button>
            <Button onClick={handleSave} disabled={formLoading} data-testid="save-mr-btn">
              {formLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}{editing ? 'Update' : 'Create'} MR
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-red-600">Delete MR</DialogTitle></DialogHeader>
          <p className="py-4">Delete <strong>{selectedMR?.name}</strong>? This will remove their account and territory assignment.</p>
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

export default MRManagement;
