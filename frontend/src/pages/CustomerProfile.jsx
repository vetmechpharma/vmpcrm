import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { 
  User, 
  Save, 
  Loader2, 
  MapPin, 
  Phone, 
  Mail, 
  Building2, 
  Stethoscope, 
  Store,
  Truck,
  CheckCircle
} from 'lucide-react';
import { locationAPI } from '../lib/api';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const CustomerProfile = () => {
  const { customer, setCustomer } = useOutletContext();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [states, setStates] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [transports, setTransports] = useState([]);
  const [saved, setSaved] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    reg_no: '',
    proprietor_name: '',
    gst_number: '',
    drug_license: '',
    address_line_1: '',
    address_line_2: '',
    state: '',
    district: '',
    pincode: '',
    delivery_station: '',
    transport_id: ''
  });

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (customer) {
      setFormData({
        name: customer.name || '',
        email: customer.email || '',
        reg_no: customer.reg_no || '',
        proprietor_name: customer.proprietor_name || '',
        gst_number: customer.gst_number || '',
        drug_license: customer.drug_license || '',
        address_line_1: customer.address_line_1 || '',
        address_line_2: customer.address_line_2 || '',
        state: customer.state || '',
        district: customer.district || '',
        pincode: customer.pincode || '',
        delivery_station: customer.delivery_station || '',
        transport_id: customer.transport_id || ''
      });
      if (customer.state) {
        fetchDistricts(customer.state);
      }
    }
  }, [customer]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [statesRes, transportsRes] = await Promise.all([
        locationAPI.getStates(),
        axios.get(`${API_URL}/api/transports`)
      ]);
      setStates(statesRes.data.states || []);
      setTransports(transportsRes.data || []);
    } catch (error) {
      console.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const fetchDistricts = async (state) => {
    try {
      const response = await locationAPI.getDistricts(state);
      setDistricts(response.data.districts || []);
    } catch (error) {
      setDistricts([]);
    }
  };

  const handleStateChange = (state) => {
    setFormData({...formData, state, district: ''});
    fetchDistricts(state);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Name is required');
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('customerToken');
      const response = await axios.put(`${API_URL}/api/customer/profile`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setCustomer(response.data);
      localStorage.setItem('customerData', JSON.stringify(response.data));
      setSaved(true);
      toast.success('Profile updated!');
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const roleConfig = {
    doctor: { icon: Stethoscope, color: 'bg-blue-600', label: 'Doctor' },
    medical: { icon: Store, color: 'bg-purple-600', label: 'Medical Store' },
    agency: { icon: Building2, color: 'bg-orange-600', label: 'Agency' }
  };

  const config = roleConfig[customer?.role] || roleConfig.doctor;
  const RoleIcon = config.icon;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="px-4 py-6 md:px-6 space-y-4">
      {/* Profile Header */}
      <Card className="rounded-2xl border-0 shadow-sm overflow-hidden">
        <div className={`h-20 ${config.color}`} />
        <CardContent className="pt-0 pb-4 px-4 -mt-10">
          <div className="flex items-end gap-4">
            <div className={`w-20 h-20 ${config.color} rounded-2xl flex items-center justify-center text-white shadow-lg border-4 border-white`}>
              <RoleIcon className="w-10 h-10" />
            </div>
            <div className="flex-1 pb-1">
              <h1 className="text-xl font-bold text-slate-800" style={{ fontFamily: 'Manrope, sans-serif' }}>
                {customer?.name}
              </h1>
              <p className="text-sm text-slate-500">{config.label}</p>
            </div>
          </div>
          
          <div className="mt-4 flex flex-wrap gap-3">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Phone className="w-4 h-4 text-slate-400" />
              {customer?.phone}
            </div>
            {customer?.email && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Mail className="w-4 h-4 text-slate-400" />
                {customer?.email}
              </div>
            )}
          </div>
          <p className="mt-2 text-xs text-emerald-600 font-mono font-medium">{customer?.customer_code}</p>
        </CardContent>
      </Card>

      {/* Edit Form */}
      <Card className="rounded-2xl border-0 shadow-sm">
        <CardContent className="p-4 space-y-4">
          <h2 className="font-semibold text-slate-800">Personal Details</h2>
          
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Full Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                placeholder="Your full name"
                className="h-12 rounded-xl border-0 bg-slate-50 text-base"
                data-testid="profile-name-input"
              />
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Email</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                placeholder="your@email.com"
                className="h-12 rounded-xl border-0 bg-slate-50 text-base"
                data-testid="profile-email-input"
              />
            </div>

            {customer?.role === 'doctor' && (
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Registration Number</Label>
                <Input
                  value={formData.reg_no}
                  onChange={(e) => setFormData({...formData, reg_no: e.target.value})}
                  placeholder="Medical registration number"
                  className="h-12 rounded-xl border-0 bg-slate-50 text-base"
                />
              </div>
            )}

            {(customer?.role === 'medical' || customer?.role === 'agency') && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500">Proprietor Name</Label>
                  <Input
                    value={formData.proprietor_name}
                    onChange={(e) => setFormData({...formData, proprietor_name: e.target.value})}
                    placeholder="Owner name"
                    className="h-12 rounded-xl border-0 bg-slate-50 text-base"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500">GST Number</Label>
                    <Input
                      value={formData.gst_number}
                      onChange={(e) => setFormData({...formData, gst_number: e.target.value})}
                      placeholder="GSTIN"
                      className="h-12 rounded-xl border-0 bg-slate-50 text-base"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500">Drug License</Label>
                    <Input
                      value={formData.drug_license}
                      onChange={(e) => setFormData({...formData, drug_license: e.target.value})}
                      placeholder="License No."
                      className="h-12 rounded-xl border-0 bg-slate-50 text-base"
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Address Section */}
      <Card className="rounded-2xl border-0 shadow-sm">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-emerald-600" />
            <h2 className="font-semibold text-slate-800">Delivery Address</h2>
          </div>
          
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Address Line 1</Label>
              <Input
                value={formData.address_line_1}
                onChange={(e) => setFormData({...formData, address_line_1: e.target.value})}
                placeholder="Building, Street"
                className="h-12 rounded-xl border-0 bg-slate-50 text-base"
              />
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Address Line 2</Label>
              <Input
                value={formData.address_line_2}
                onChange={(e) => setFormData({...formData, address_line_2: e.target.value})}
                placeholder="Area, Landmark"
                className="h-12 rounded-xl border-0 bg-slate-50 text-base"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">State</Label>
                <Select value={formData.state || 'none'} onValueChange={(v) => handleStateChange(v === 'none' ? '' : v)}>
                  <SelectTrigger className="h-12 rounded-xl border-0 bg-slate-50" data-testid="profile-state-select">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    <SelectItem value="none">Select State</SelectItem>
                    {states.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">District</Label>
                <Select 
                  value={formData.district || 'none'} 
                  onValueChange={(v) => setFormData({...formData, district: v === 'none' ? '' : v})}
                  disabled={!formData.state}
                >
                  <SelectTrigger className="h-12 rounded-xl border-0 bg-slate-50" data-testid="profile-district-select">
                    <SelectValue placeholder={formData.state ? "Select" : "Select state first"} />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    <SelectItem value="none">Select District</SelectItem>
                    {districts.map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Pincode</Label>
                <Input
                  value={formData.pincode}
                  onChange={(e) => setFormData({...formData, pincode: e.target.value.replace(/\D/g, '')})}
                  placeholder="6-digit"
                  maxLength={6}
                  className="h-12 rounded-xl border-0 bg-slate-50 text-base"
                />
              </div>
              
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Delivery Station</Label>
                <Input
                  value={formData.delivery_station}
                  onChange={(e) => setFormData({...formData, delivery_station: e.target.value})}
                  placeholder="Nearest point"
                  className="h-12 rounded-xl border-0 bg-slate-50 text-base"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transport Preference */}
      <Card className="rounded-2xl border-0 shadow-sm">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-emerald-600" />
            <h2 className="font-semibold text-slate-800">Transport Preference</h2>
          </div>
          
          <Select 
            value={formData.transport_id || 'none'} 
            onValueChange={(v) => setFormData({...formData, transport_id: v === 'none' ? '' : v})}
          >
            <SelectTrigger className="h-12 rounded-xl border-0 bg-slate-50" data-testid="profile-transport-select">
              <SelectValue placeholder="Select preferred transport" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No Preference</SelectItem>
              {transports.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Save Button - Sticky */}
      <div className="sticky bottom-20 md:bottom-4 pt-2">
        <Button 
          onClick={handleSave} 
          disabled={saving}
          className={`w-full h-14 rounded-xl text-base font-semibold shadow-lg transition-all ${
            saved 
              ? 'bg-emerald-500 hover:bg-emerald-500' 
              : 'bg-emerald-600 hover:bg-emerald-700'
          }`}
          data-testid="profile-save-btn"
        >
          {saving ? (
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
          ) : saved ? (
            <CheckCircle className="w-5 h-5 mr-2" />
          ) : (
            <Save className="w-5 h-5 mr-2" />
          )}
          {saved ? 'Saved!' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
};

export default CustomerProfile;
