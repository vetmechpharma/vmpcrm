import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { 
  Phone, 
  Lock, 
  User, 
  Loader2, 
  ArrowRight, 
  ArrowLeft,
  CheckCircle,
  Stethoscope,
  Store,
  Building2,
  Eye,
  EyeOff,
  ShieldCheck,
  MapPin,
  Calendar,
  FileText,
  Mail
} from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const CustomerRegister = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: Phone, 2: OTP, 3: Role Selection, 4: Details, 5: Success
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [states, setStates] = useState([]);
  const [districts, setDistricts] = useState([]);
  
  const [formData, setFormData] = useState({
    phone: '',
    otp: '',
    role: '',
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    // Doctor-specific
    reg_no: '',
    dob: '',
    // Medical/Agency-specific
    proprietor_name: '',
    gst_number: '',
    drug_license: '',
    alternate_phone: '',
    birthday: '',
    anniversary: '',
    // Address fields
    address_line_1: '',
    address_line_2: '',
    state: '',
    district: '',
    pincode: '',
    delivery_station: ''
  });

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  useEffect(() => {
    fetchStates();
  }, []);

  useEffect(() => {
    if (formData.state) {
      fetchDistricts(formData.state);
    }
  }, [formData.state]);

  const fetchStates = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/public/states`);
      setStates(response.data || []);
    } catch (error) {
      console.error('Failed to fetch states');
    }
  };

  const fetchDistricts = async (state) => {
    try {
      const response = await axios.get(`${API_URL}/api/public/districts/${encodeURIComponent(state)}`);
      setDistricts(response.data || []);
    } catch (error) {
      console.error('Failed to fetch districts');
    }
  };

  const handleSendOTP = async () => {
    if (!formData.phone || formData.phone.length !== 10) {
      toast.error('Please enter a valid 10-digit phone number');
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API_URL}/api/customer/send-otp`, {
        phone: formData.phone,
        purpose: 'register'
      });
      setStep(2);
      setCountdown(60);
      toast.success('OTP sent via WhatsApp!');
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to send OTP';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!formData.otp || formData.otp.length !== 4) {
      toast.error('Please enter the 4-digit OTP');
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API_URL}/api/customer/verify-otp`, {
        phone: formData.phone,
        otp: formData.otp,
        purpose: 'register'
      });
      toast.success('Phone verified!');
      setStep(3); // Go to role selection
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleSelect = (role) => {
    setFormData({ ...formData, role });
    setStep(4); // Go to details form
  };

  const handleRegister = async () => {
    if (!formData.name || !formData.password) {
      toast.error('Please fill all required fields');
      return;
    }

    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    // Role-specific validation
    if (formData.role === 'doctor' && !formData.reg_no) {
      toast.error('Registration number is required for doctors');
      return;
    }

    setLoading(true);
    try {
      const registrationData = {
        phone: formData.phone,
        otp: formData.otp,
        role: formData.role,
        name: formData.name,
        email: formData.email || null,
        password: formData.password,
        // Address
        address_line_1: formData.address_line_1 || null,
        address_line_2: formData.address_line_2 || null,
        state: formData.state || null,
        district: formData.district || null,
        pincode: formData.pincode || null,
        delivery_station: formData.delivery_station || null
      };

      // Add role-specific fields
      if (formData.role === 'doctor') {
        registrationData.reg_no = formData.reg_no || null;
        registrationData.dob = formData.dob || null;
      } else {
        // Medical or Agency
        registrationData.proprietor_name = formData.proprietor_name || null;
        registrationData.gst_number = formData.gst_number || null;
        registrationData.drug_license = formData.drug_license || null;
        registrationData.alternate_phone = formData.alternate_phone || null;
        registrationData.birthday = formData.birthday || null;
        registrationData.anniversary = formData.anniversary || null;
      }

      await axios.post(`${API_URL}/api/customer/register`, registrationData);
      setStep(5); // Success
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const roleOptions = [
    { value: 'doctor', label: 'Doctor', icon: Stethoscope, desc: 'Medical practitioner', color: 'blue' },
    { value: 'medical', label: 'Medical Store', icon: Store, desc: 'Pharmacy/Retail', color: 'emerald' },
    { value: 'agency', label: 'Agency', icon: Building2, desc: 'Distribution', color: 'purple' }
  ];

  const totalSteps = 5;
  const stepLabels = ['Phone', 'Verify', 'Role', 'Details', 'Done'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 flex flex-col">
      {/* Header */}
      <div className="px-6 pt-8 pb-6">
        {step < 5 && (
          <button 
            onClick={() => {
              if (step === 1) navigate('/customer/login');
              else if (step === 4) setStep(3);
              else if (step > 1) setStep(step - 1);
            }}
            className="text-slate-400 hover:text-white mb-4 flex items-center gap-1"
            data-testid="back-button"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        )}
        
        {/* Progress */}
        <div className="flex items-center gap-1 mb-4">
          {[1, 2, 3, 4, 5].map((s) => (
            <div 
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors ${
                s <= step ? 'bg-emerald-500' : 'bg-slate-700'
              }`}
            />
          ))}
        </div>
        <div className="flex justify-between text-xs text-slate-500 mb-4">
          {stepLabels.map((label, i) => (
            <span key={i} className={i + 1 <= step ? 'text-emerald-400' : ''}>{label}</span>
          ))}
        </div>

        <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>
          {step === 1 && 'Enter Phone Number'}
          {step === 2 && 'Verify OTP'}
          {step === 3 && 'Select Your Role'}
          {step === 4 && `${formData.role === 'doctor' ? 'Doctor' : formData.role === 'medical' ? 'Medical Store' : 'Agency'} Details`}
          {step === 5 && 'Registration Complete'}
        </h1>
        <p className="text-slate-400 mt-1 text-sm">
          {step === 1 && 'We\'ll send an OTP to verify your number'}
          {step === 2 && 'Enter the 4-digit code sent to your WhatsApp'}
          {step === 3 && 'Choose your business type'}
          {step === 4 && 'Fill in your details to complete registration'}
          {step === 5 && 'Your account is pending approval'}
        </p>
      </div>

      {/* Form Card */}
      <div className="flex-1 bg-white rounded-t-[2rem] px-6 pt-8 pb-6 overflow-y-auto">
        <div className="max-w-md mx-auto">
          
          {/* Step 1: Phone Number */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">Phone Number</Label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <Input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10)})}
                    placeholder="Enter 10-digit number"
                    className="h-14 pl-12 rounded-xl border-0 bg-slate-50 text-base"
                    data-testid="register-phone-input"
                  />
                </div>
              </div>

              <Button 
                onClick={handleSendOTP}
                disabled={loading || formData.phone.length !== 10}
                className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-base font-semibold"
                data-testid="send-otp-btn"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                ) : (
                  <ArrowRight className="w-5 h-5 mr-2" />
                )}
                Send OTP via WhatsApp
              </Button>
            </div>
          )}

          {/* Step 2: OTP Verification */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">Enter OTP</Label>
                <Input
                  type="text"
                  value={formData.otp}
                  onChange={(e) => setFormData({...formData, otp: e.target.value.replace(/\D/g, '').slice(0, 4)})}
                  placeholder="0000"
                  className="h-14 text-center text-2xl tracking-[1em] rounded-xl border-0 bg-slate-50 font-mono"
                  maxLength={4}
                  data-testid="otp-input"
                />
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">OTP sent to {formData.phone}</span>
                  {countdown > 0 ? (
                    <span className="text-slate-400">Resend in {countdown}s</span>
                  ) : (
                    <button 
                      onClick={handleSendOTP}
                      className="text-emerald-600 font-medium"
                      disabled={loading}
                    >
                      Resend OTP
                    </button>
                  )}
                </div>
              </div>

              <div className="p-3 bg-amber-50 rounded-xl">
                <p className="text-xs text-amber-800">
                  <strong>Didn't receive OTP?</strong> Please contact our support team with your phone number for assistance.
                </p>
              </div>

              <Button 
                onClick={handleVerifyOTP}
                disabled={loading || formData.otp.length !== 4}
                className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-base font-semibold"
                data-testid="verify-otp-btn"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                ) : (
                  <CheckCircle className="w-5 h-5 mr-2" />
                )}
                Verify & Continue
              </Button>
            </div>
          )}

          {/* Step 3: Role Selection */}
          {step === 3 && (
            <div className="space-y-4">
              {roleOptions.map((role) => {
                const Icon = role.icon;
                const colorClasses = {
                  blue: 'border-blue-200 bg-blue-50 hover:border-blue-400',
                  emerald: 'border-emerald-200 bg-emerald-50 hover:border-emerald-400',
                  purple: 'border-purple-200 bg-purple-50 hover:border-purple-400'
                };
                const iconColors = {
                  blue: 'text-blue-600',
                  emerald: 'text-emerald-600',
                  purple: 'text-purple-600'
                };
                
                return (
                  <button
                    key={role.value}
                    type="button"
                    onClick={() => handleRoleSelect(role.value)}
                    className={`w-full p-5 rounded-xl border-2 transition-all text-left flex items-center gap-4 ${colorClasses[role.color]}`}
                    data-testid={`role-${role.value}`}
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-white shadow-sm`}>
                      <Icon className={`w-6 h-6 ${iconColors[role.color]}`} />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">{role.label}</p>
                      <p className="text-sm text-slate-500">{role.desc}</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-slate-400 ml-auto" />
                  </button>
                );
              })}
            </div>
          )}

          {/* Step 4: Details Form */}
          {step === 4 && (
            <div className="space-y-5 pb-8">
              {/* Common Fields */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">
                  {formData.role === 'doctor' ? 'Full Name' : 'Business Name'} *
                </Label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder={formData.role === 'doctor' ? 'Dr. John Doe' : 'Business Name'}
                    className="h-12 pl-12 rounded-xl border-slate-200 text-base"
                    data-testid="register-name-input"
                  />
                </div>
              </div>

              {/* Doctor-specific fields */}
              {formData.role === 'doctor' && (
                <>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700">Registration Number *</Label>
                    <div className="relative">
                      <FileText className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <Input
                        value={formData.reg_no}
                        onChange={(e) => setFormData({...formData, reg_no: e.target.value})}
                        placeholder="Medical registration number"
                        className="h-12 pl-12 rounded-xl border-slate-200 text-base"
                        data-testid="reg-no-input"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700">Date of Birth</Label>
                    <Input
                      type="date"
                      value={formData.dob}
                      onChange={(e) => setFormData({...formData, dob: e.target.value})}
                      className="h-12 rounded-xl border-slate-200"
                      data-testid="dob-input"
                    />
                  </div>
                </>
              )}

              {/* Medical/Agency-specific fields */}
              {(formData.role === 'medical' || formData.role === 'agency') && (
                <>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700">Proprietor Name</Label>
                    <Input
                      value={formData.proprietor_name}
                      onChange={(e) => setFormData({...formData, proprietor_name: e.target.value})}
                      placeholder="Owner/Proprietor name"
                      className="h-12 rounded-xl border-slate-200"
                      data-testid="proprietor-input"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700">GST Number</Label>
                      <Input
                        value={formData.gst_number}
                        onChange={(e) => setFormData({...formData, gst_number: e.target.value.toUpperCase()})}
                        placeholder="GST Number"
                        className="h-12 rounded-xl border-slate-200"
                        data-testid="gst-input"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700">Drug License</Label>
                      <Input
                        value={formData.drug_license}
                        onChange={(e) => setFormData({...formData, drug_license: e.target.value})}
                        placeholder="License No."
                        className="h-12 rounded-xl border-slate-200"
                        data-testid="drug-license-input"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700">Alternate Phone</Label>
                    <Input
                      value={formData.alternate_phone}
                      onChange={(e) => setFormData({...formData, alternate_phone: e.target.value.replace(/\D/g, '').slice(0, 10)})}
                      placeholder="Alternate contact number"
                      className="h-12 rounded-xl border-slate-200"
                      data-testid="alt-phone-input"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700">Birthday</Label>
                      <Input
                        type="date"
                        value={formData.birthday}
                        onChange={(e) => setFormData({...formData, birthday: e.target.value})}
                        className="h-12 rounded-xl border-slate-200"
                        data-testid="birthday-input"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700">Anniversary</Label>
                      <Input
                        type="date"
                        value={formData.anniversary}
                        onChange={(e) => setFormData({...formData, anniversary: e.target.value})}
                        className="h-12 rounded-xl border-slate-200"
                        data-testid="anniversary-input"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Email - Common */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">Email (Optional)</Label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    placeholder="your@email.com"
                    className="h-12 pl-12 rounded-xl border-slate-200"
                    data-testid="register-email-input"
                  />
                </div>
              </div>

              {/* Address Section */}
              <div className="pt-4 border-t border-slate-200">
                <div className="flex items-center gap-2 mb-4">
                  <MapPin className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-semibold text-slate-800">Address Details</h3>
                </div>

                <div className="space-y-3">
                  <Input
                    value={formData.address_line_1}
                    onChange={(e) => setFormData({...formData, address_line_1: e.target.value})}
                    placeholder="Address Line 1"
                    className="h-12 rounded-xl border-slate-200"
                    data-testid="address1-input"
                  />
                  <Input
                    value={formData.address_line_2}
                    onChange={(e) => setFormData({...formData, address_line_2: e.target.value})}
                    placeholder="Address Line 2"
                    className="h-12 rounded-xl border-slate-200"
                    data-testid="address2-input"
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <Select
                      value={formData.state}
                      onValueChange={(value) => setFormData({...formData, state: value, district: ''})}
                    >
                      <SelectTrigger className="h-12 rounded-xl border-slate-200" data-testid="state-select">
                        <SelectValue placeholder="State" />
                      </SelectTrigger>
                      <SelectContent>
                        {states.map((state) => (
                          <SelectItem key={state} value={state}>{state}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={formData.district}
                      onValueChange={(value) => setFormData({...formData, district: value})}
                      disabled={!formData.state}
                    >
                      <SelectTrigger className="h-12 rounded-xl border-slate-200" data-testid="district-select">
                        <SelectValue placeholder="District" />
                      </SelectTrigger>
                      <SelectContent>
                        {districts.map((district) => (
                          <SelectItem key={district} value={district}>{district}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      value={formData.pincode}
                      onChange={(e) => setFormData({...formData, pincode: e.target.value.replace(/\D/g, '').slice(0, 6)})}
                      placeholder="Pincode"
                      className="h-12 rounded-xl border-slate-200"
                      data-testid="pincode-input"
                    />
                    <Input
                      value={formData.delivery_station}
                      onChange={(e) => setFormData({...formData, delivery_station: e.target.value})}
                      placeholder="Delivery Station"
                      className="h-12 rounded-xl border-slate-200"
                      data-testid="delivery-station-input"
                    />
                  </div>
                </div>
              </div>

              {/* Password Section */}
              <div className="pt-4 border-t border-slate-200">
                <div className="flex items-center gap-2 mb-4">
                  <Lock className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-semibold text-slate-800">Set Password</h3>
                </div>

                <div className="space-y-3">
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={(e) => setFormData({...formData, password: e.target.value})}
                      placeholder="Password (min 6 characters)"
                      className="h-12 pr-12 rounded-xl border-slate-200"
                      data-testid="register-password-input"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                    placeholder="Confirm Password"
                    className="h-12 rounded-xl border-slate-200"
                    data-testid="register-confirm-password-input"
                  />
                </div>
              </div>

              <Button 
                onClick={handleRegister}
                disabled={loading}
                className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-base font-semibold mt-4"
                data-testid="register-submit-btn"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                ) : (
                  <ShieldCheck className="w-5 h-5 mr-2" />
                )}
                Complete Registration
              </Button>
            </div>
          )}

          {/* Step 5: Success */}
          {step === 5 && (
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-10 h-10 text-emerald-600" />
              </div>
              
              <h2 className="text-xl font-bold text-slate-800 mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
                Registration Successful!
              </h2>
              <p className="text-slate-500 mb-6">
                Your account has been created and is pending admin approval. You'll receive a WhatsApp notification once approved.
              </p>

              <div className="p-4 bg-amber-50 rounded-xl text-left mb-6">
                <p className="text-sm text-amber-800">
                  <strong>Note:</strong> You can login after your account is approved by our team. This usually takes 24-48 hours.
                </p>
              </div>

              <Button 
                onClick={() => navigate('/customer/login')}
                className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-base font-semibold"
                data-testid="go-to-login-btn"
              >
                Go to Login
              </Button>
            </div>
          )}

          {/* Login Link */}
          {step < 5 && (
            <div className="mt-8 text-center">
              <p className="text-slate-500 text-sm">
                Already have an account?{' '}
                <Link to="/customer/login" className="text-emerald-600 font-semibold hover:underline">
                  Login
                </Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomerRegister;
