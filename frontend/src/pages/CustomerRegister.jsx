import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { Loader2, Phone, Lock, User, Building2, Stethoscope, Store } from 'lucide-react';
import { locationAPI, transportAPI } from '../lib/api';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const CustomerRegister = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: Phone, 2: OTP, 3: Details
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [timer, setTimer] = useState(0);
  
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: '',
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
  
  const [states, setStates] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [transports, setTransports] = useState([]);

  useEffect(() => {
    fetchStatesAndTransports();
  }, []);

  useEffect(() => {
    if (formData.state) {
      fetchDistricts(formData.state);
    }
  }, [formData.state]);

  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => setTimer(t => t - 1), 1000);
      return () => clearInterval(interval);
    }
  }, [timer]);

  const fetchStatesAndTransports = async () => {
    try {
      const [statesRes, transportsRes] = await Promise.all([
        locationAPI.getStates(),
        axios.get(`${API_URL}/api/transports`)
      ]);
      setStates(statesRes.data.states || []);
      setTransports(transportsRes.data || []);
    } catch (error) {
      console.error('Failed to fetch data');
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

  const handleSendOTP = async () => {
    if (!phone || phone.length < 10) {
      toast.error('Please enter a valid phone number');
      return;
    }
    
    setLoading(true);
    try {
      await axios.post(`${API_URL}/api/customer/send-otp`, {
        phone,
        purpose: 'register'
      });
      setOtpSent(true);
      setTimer(60);
      toast.success('OTP sent to your WhatsApp!');
      setStep(2);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp || otp.length !== 4) {
      toast.error('Please enter 4-digit OTP');
      return;
    }
    
    setLoading(true);
    try {
      await axios.post(`${API_URL}/api/customer/verify-otp`, {
        phone,
        otp,
        purpose: 'register'
      });
      setOtpVerified(true);
      toast.success('OTP verified successfully!');
      setStep(3);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.password || !formData.role) {
      toast.error('Please fill all required fields');
      return;
    }
    
    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    
    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    
    setLoading(true);
    try {
      await axios.post(`${API_URL}/api/customer/register`, {
        phone,
        ...formData
      });
      toast.success('Registration successful! Please wait for admin approval.');
      navigate('/customer/login');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const roleIcons = {
    doctor: <Stethoscope className="w-6 h-6" />,
    medical: <Store className="w-6 h-6" />,
    agency: <Building2 className="w-6 h-6" />
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Create Account</CardTitle>
          <CardDescription>
            {step === 1 && 'Enter your phone number to get started'}
            {step === 2 && 'Enter the OTP sent to your WhatsApp'}
            {step === 3 && 'Complete your registration'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Phone Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder="Enter 10-digit phone number"
                    className="pl-10"
                    maxLength={10}
                    data-testid="register-phone-input"
                  />
                </div>
              </div>
              <Button onClick={handleSendOTP} disabled={loading} className="w-full" data-testid="send-otp-btn">
                {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Send OTP via WhatsApp
              </Button>
              <p className="text-center text-sm text-slate-500">
                Already have an account? <Link to="/customer/login" className="text-blue-600 hover:underline">Login</Link>
              </p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Enter OTP</Label>
                <Input
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter 4-digit OTP"
                  maxLength={4}
                  className="text-center text-2xl tracking-widest"
                  data-testid="otp-input"
                />
              </div>
              <Button onClick={handleVerifyOTP} disabled={loading} className="w-full" data-testid="verify-otp-btn">
                {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Verify OTP
              </Button>
              <div className="flex justify-between text-sm">
                <button 
                  onClick={() => setStep(1)} 
                  className="text-slate-500 hover:text-slate-700"
                >
                  Change Number
                </button>
                <button 
                  onClick={handleSendOTP} 
                  disabled={timer > 0 || loading}
                  className={timer > 0 ? 'text-slate-400' : 'text-blue-600 hover:underline'}
                >
                  {timer > 0 ? `Resend in ${timer}s` : 'Resend OTP'}
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <form onSubmit={handleRegister} className="space-y-4">
              {/* Role Selection */}
              <div className="space-y-2">
                <Label>I am a *</Label>
                <div className="grid grid-cols-3 gap-2">
                  {['doctor', 'medical', 'agency'].map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setFormData({...formData, role})}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        formData.role === role 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                      data-testid={`role-${role}-btn`}
                    >
                      <div className="flex flex-col items-center gap-2">
                        {roleIcons[role]}
                        <span className="text-sm font-medium capitalize">{role}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label>Full Name *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="Enter your full name"
                    data-testid="register-name-input"
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    placeholder="your@email.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Password *</Label>
                  <Input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    placeholder="Min 6 characters"
                    data-testid="register-password-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Confirm Password *</Label>
                  <Input
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                    placeholder="Confirm password"
                    data-testid="register-confirm-password-input"
                  />
                </div>
              </div>

              {/* Role-specific fields */}
              {formData.role === 'doctor' && (
                <div className="space-y-2">
                  <Label>Registration Number</Label>
                  <Input
                    value={formData.reg_no}
                    onChange={(e) => setFormData({...formData, reg_no: e.target.value})}
                    placeholder="Medical registration number"
                  />
                </div>
              )}

              {(formData.role === 'medical' || formData.role === 'agency') && (
                <div className="grid grid-cols-2 gap-4">
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
                  <div className="col-span-2 space-y-2">
                    <Label>Drug License</Label>
                    <Input
                      value={formData.drug_license}
                      onChange={(e) => setFormData({...formData, drug_license: e.target.value})}
                      placeholder="Drug license number"
                    />
                  </div>
                </div>
              )}

              {/* Address */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label>Address Line 1</Label>
                  <Input
                    value={formData.address_line_1}
                    onChange={(e) => setFormData({...formData, address_line_1: e.target.value})}
                    placeholder="Building/Street"
                  />
                </div>
                <div className="space-y-2">
                  <Label>State</Label>
                  <Select value={formData.state} onValueChange={(v) => setFormData({...formData, state: v, district: ''})}>
                    <SelectTrigger><SelectValue placeholder="Select State" /></SelectTrigger>
                    <SelectContent className="max-h-60">
                      {states.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>District</Label>
                  <Select value={formData.district} onValueChange={(v) => setFormData({...formData, district: v})} disabled={!formData.state}>
                    <SelectTrigger><SelectValue placeholder={formData.state ? "Select District" : "Select state first"} /></SelectTrigger>
                    <SelectContent className="max-h-60">
                      {districts.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Pincode</Label>
                  <Input
                    value={formData.pincode}
                    onChange={(e) => setFormData({...formData, pincode: e.target.value})}
                    placeholder="6-digit pincode"
                    maxLength={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Preferred Transport</Label>
                  <Select value={formData.transport_id || 'none'} onValueChange={(v) => setFormData({...formData, transport_id: v === 'none' ? '' : v})}>
                    <SelectTrigger><SelectValue placeholder="Select Transport" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {transports.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button type="submit" disabled={loading} className="w-full" data-testid="register-submit-btn">
                {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Create Account
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CustomerRegister;
