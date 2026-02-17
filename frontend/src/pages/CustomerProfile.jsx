import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { User, Save, Loader2, MapPin, Phone, Mail, Building2, Stethoscope, Store } from 'lucide-react';
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
      toast.success('Profile updated successfully!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const roleIcons = {
    doctor: <Stethoscope className="w-6 h-6" />,
    medical: <Store className="w-6 h-6" />,
    agency: <Building2 className="w-6 h-6" />
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">My Profile</h1>
        <p className="text-slate-500">Manage your account details</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Profile Card */}
        <Card className="lg:col-span-1">
          <CardContent className="p-6 text-center">
            <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              {roleIcons[customer?.role] || <User className="w-12 h-12 text-blue-600" />}
            </div>
            <h2 className="text-xl font-bold text-slate-800">{customer?.name}</h2>
            <p className="text-slate-500 capitalize">{customer?.role}</p>
            <p className="text-sm text-blue-600 font-medium mt-1">{customer?.customer_code}</p>
            
            <div className="mt-4 space-y-2 text-left">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Phone className="w-4 h-4" />
                {customer?.phone}
              </div>
              {customer?.email && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Mail className="w-4 h-4" />
                  {customer?.email}
                </div>
              )}
              {customer?.state && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <MapPin className="w-4 h-4" />
                  {customer?.district}, {customer?.state}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Edit Form */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Edit Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Full Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="Your full name"
                  data-testid="profile-name-input"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  placeholder="your@email.com"
                  data-testid="profile-email-input"
                />
              </div>
            </div>

            {/* Role-specific fields */}
            {customer?.role === 'doctor' && (
              <div className="space-y-2">
                <Label>Registration Number</Label>
                <Input
                  value={formData.reg_no}
                  onChange={(e) => setFormData({...formData, reg_no: e.target.value})}
                  placeholder="Medical registration number"
                />
              </div>
            )}

            {(customer?.role === 'medical' || customer?.role === 'agency') && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Proprietor Name</Label>
                  <Input
                    value={formData.proprietor_name}
                    onChange={(e) => setFormData({...formData, proprietor_name: e.target.value})}
                    placeholder="Owner name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>GST Number</Label>
                  <Input
                    value={formData.gst_number}
                    onChange={(e) => setFormData({...formData, gst_number: e.target.value})}
                    placeholder="GSTIN"
                  />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <Label>Drug License</Label>
                  <Input
                    value={formData.drug_license}
                    onChange={(e) => setFormData({...formData, drug_license: e.target.value})}
                    placeholder="Drug license number"
                  />
                </div>
              </div>
            )}

            {/* Address Section */}
            <div className="pt-4 border-t">
              <h3 className="font-medium mb-4 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Address & Delivery
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2 space-y-2">
                  <Label>Address Line 1</Label>
                  <Input
                    value={formData.address_line_1}
                    onChange={(e) => setFormData({...formData, address_line_1: e.target.value})}
                    placeholder="Building, Street"
                  />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <Label>Address Line 2</Label>
                  <Input
                    value={formData.address_line_2}
                    onChange={(e) => setFormData({...formData, address_line_2: e.target.value})}
                    placeholder="Area, Landmark"
                  />
                </div>
                <div className="space-y-2">
                  <Label>State</Label>
                  <Select value={formData.state || 'none'} onValueChange={(v) => handleStateChange(v === 'none' ? '' : v)}>
                    <SelectTrigger data-testid="profile-state-select">
                      <SelectValue placeholder="Select State" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      <SelectItem value="none">Select State</SelectItem>
                      {states.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>District</Label>
                  <Select 
                    value={formData.district || 'none'} 
                    onValueChange={(v) => setFormData({...formData, district: v === 'none' ? '' : v})}
                    disabled={!formData.state}
                  >
                    <SelectTrigger data-testid="profile-district-select">
                      <SelectValue placeholder={formData.state ? "Select District" : "Select state first"} />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      <SelectItem value="none">Select District</SelectItem>
                      {districts.map((d) => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Pincode</Label>
                  <Input
                    value={formData.pincode}
                    onChange={(e) => setFormData({...formData, pincode: e.target.value.replace(/\D/g, '')})}
                    placeholder="6-digit pincode"
                    maxLength={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Delivery Station</Label>
                  <Input
                    value={formData.delivery_station}
                    onChange={(e) => setFormData({...formData, delivery_station: e.target.value})}
                    placeholder="Nearest delivery point"
                  />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <Label>Preferred Transport</Label>
                  <Select 
                    value={formData.transport_id || 'none'} 
                    onValueChange={(v) => setFormData({...formData, transport_id: v === 'none' ? '' : v})}
                  >
                    <SelectTrigger data-testid="profile-transport-select">
                      <SelectValue placeholder="Select Transport" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Preference</SelectItem>
                      {transports.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="pt-4">
              <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto" data-testid="profile-save-btn">
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save Changes
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CustomerProfile;
