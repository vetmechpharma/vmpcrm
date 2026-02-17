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
  ShieldCheck
} from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const CustomerRegister = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [countdown, setCountdown] = useState(0);
  
  const [formData, setFormData] = useState({
    phone: '',
    otp: '',
    role: '',
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleSendOTP = async () => {
    if (!formData.phone || formData.phone.length !== 10) {
      toast.error('Please enter a valid 10-digit phone number');
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API_URL}/api/customer/send-otp`, {
        phone: formData.phone
      });
      setOtpSent(true);
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
        otp: formData.otp
      });
      toast.success('Phone verified!');
      setStep(2);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!formData.role || !formData.name || !formData.password) {
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

    setLoading(true);
    try {
      await axios.post(`${API_URL}/api/customer/register`, {
        phone: formData.phone,
        otp: formData.otp,
        role: formData.role,
        name: formData.name,
        email: formData.email || null,
        password: formData.password
      });
      setStep(3);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const roleOptions = [
    { value: 'doctor', label: 'Doctor', icon: Stethoscope, desc: 'Medical practitioner' },
    { value: 'medical', label: 'Medical Store', icon: Store, desc: 'Pharmacy/Retail' },
    { value: 'agency', label: 'Agency', icon: Building2, desc: 'Distribution' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 flex flex-col">
      {/* Header */}
      <div className="px-6 pt-8 pb-6">
        {step < 3 && (
          <button 
            onClick={() => step > 1 ? setStep(step - 1) : navigate('/customer/login')}
            className="text-slate-400 hover:text-white mb-4 flex items-center gap-1"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        )}
        
        {/* Progress */}
        <div className="flex items-center gap-2 mb-6">
          {[1, 2, 3].map((s) => (
            <div 
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                s <= step ? 'bg-emerald-500' : 'bg-slate-700'
              }`}
            />
          ))}
        </div>

        <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>
          {step === 1 && 'Verify Phone'}
          {step === 2 && 'Create Account'}
          {step === 3 && 'Registration Complete'}
        </h1>
        <p className="text-slate-400 mt-1 text-sm">
          {step === 1 && 'We\'ll send an OTP to verify your number'}
          {step === 2 && 'Fill in your details to get started'}
          {step === 3 && 'Your account is pending approval'}
        </p>
      </div>

      {/* Form Card */}
      <div className="flex-1 bg-white rounded-t-[2rem] px-6 pt-8 pb-6">
        <div className="max-w-md mx-auto">
          
          {/* Step 1: Phone Verification */}
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
                    disabled={otpSent}
                    data-testid="register-phone-input"
                  />
                </div>
              </div>

              {!otpSent ? (
                <Button 
                  onClick={handleSendOTP}
                  disabled={loading || formData.phone.length !== 10}
                  className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-base font-semibold"
                  data-testid="send-otp-btn"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  ) : null}
                  Send OTP via WhatsApp
                </Button>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700">Enter OTP</Label>
                    <Input
                      type="text"
                      value={formData.otp}
                      onChange={(e) => setFormData({...formData, otp: e.target.value.replace(/\D/g, '').slice(0, 4)})}
                      placeholder="4-digit OTP"
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

                  <Button 
                    onClick={handleVerifyOTP}
                    disabled={loading || formData.otp.length !== 4}
                    className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-base font-semibold"
                    data-testid="verify-otp-btn"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    ) : (
                      <ArrowRight className="w-5 h-5 mr-2" />
                    )}
                    Verify & Continue
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Step 2: Account Details */}
          {step === 2 && (
            <div className="space-y-5">
              {/* Role Selection */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">Account Type *</Label>
                <div className="grid grid-cols-3 gap-2">
                  {roleOptions.map((role) => {
                    const Icon = role.icon;
                    const isSelected = formData.role === role.value;
                    return (
                      <button
                        key={role.value}
                        type="button"
                        onClick={() => setFormData({...formData, role: role.value})}
                        className={`p-4 rounded-xl border-2 transition-all text-center ${
                          isSelected 
                            ? 'border-emerald-500 bg-emerald-50' 
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                        data-testid={`role-${role.value}`}
                      >
                        <Icon className={`w-6 h-6 mx-auto mb-2 ${isSelected ? 'text-emerald-600' : 'text-slate-400'}`} />
                        <p className={`text-xs font-medium ${isSelected ? 'text-emerald-700' : 'text-slate-600'}`}>
                          {role.label}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">Full Name *</Label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="Your full name"
                    className="h-14 pl-12 rounded-xl border-0 bg-slate-50 text-base"
                    data-testid="register-name-input"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">Email (Optional)</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  placeholder="your@email.com"
                  className="h-14 rounded-xl border-0 bg-slate-50 text-base"
                  data-testid="register-email-input"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">Password *</Label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    placeholder="Min 6 characters"
                    className="h-14 pl-12 pr-12 rounded-xl border-0 bg-slate-50 text-base"
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
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">Confirm Password *</Label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                    placeholder="Re-enter password"
                    className="h-14 pl-12 rounded-xl border-0 bg-slate-50 text-base"
                    data-testid="register-confirm-password-input"
                  />
                </div>
              </div>

              <Button 
                onClick={handleRegister}
                disabled={loading}
                className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-base font-semibold"
                data-testid="register-submit-btn"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                ) : (
                  <ShieldCheck className="w-5 h-5 mr-2" />
                )}
                Create Account
              </Button>
            </div>
          )}

          {/* Step 3: Success */}
          {step === 3 && (
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
              >
                Go to Login
              </Button>
            </div>
          )}

          {/* Login Link */}
          {step < 3 && (
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
