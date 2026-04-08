import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import { Phone, Lock, LogIn, Loader2, Eye, EyeOff, MessageSquare, ArrowLeft, Download } from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const CustomerLogin = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginMode, setLoginMode] = useState('password'); // 'password' or 'otp'
  const [otpStep, setOtpStep] = useState('phone'); // 'phone' or 'verify'
  const [otpTimer, setOtpTimer] = useState(0);
  const [formData, setFormData] = useState({ phone: '', password: '', otp: '' });
  const [company, setCompany] = useState(null);
  const otpRefs = useRef([]);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    // Fetch company settings for branding
    axios.get(`${API_URL}/api/public/company-settings`).then(res => {
      setCompany(res.data);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (otpTimer <= 0) return;
    const id = setTimeout(() => setOtpTimer(otpTimer - 1), 1000);
    return () => clearTimeout(id);
  }, [otpTimer]);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setCanInstall(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === 'accepted') {
      setCanInstall(false);
      toast.success('App installed successfully!');
    }
    setDeferredPrompt(null);
  };

  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    if (!formData.phone || !formData.password) return toast.error('Please fill all fields');
    if (formData.phone.length !== 10) return toast.error('Enter a valid 10-digit number');
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/api/customer/login`, { phone: formData.phone, password: formData.password });
      localStorage.setItem('customerToken', res.data.access_token);
      localStorage.setItem('customerData', JSON.stringify(res.data.customer));
      toast.success('Welcome back!');
      navigate('/portal/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Login failed');
    } finally { setLoading(false); }
  };

  const handleSendOtp = async () => {
    if (!formData.phone) return toast.error('Enter your phone number');
    if (formData.phone.length !== 10) return toast.error('Enter a valid 10-digit number');
    setLoading(true);
    try {
      await axios.post(`${API_URL}/api/customer/login-otp-send`, { phone: formData.phone, purpose: 'login' });
      toast.success('OTP sent to your WhatsApp!');
      setOtpStep('verify');
      setOtpTimer(60);
      setFormData(prev => ({ ...prev, otp: '' }));
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to send OTP');
    } finally { setLoading(false); }
  };

  const handleVerifyOtp = async () => {
    if (formData.otp.length !== 4) return toast.error('Enter the 4-digit OTP');
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/api/customer/login-otp-verify`, { phone: formData.phone, otp: formData.otp, purpose: 'login' });
      localStorage.setItem('customerToken', res.data.access_token);
      localStorage.setItem('customerData', JSON.stringify(res.data.customer));
      toast.success('Welcome back!');
      navigate('/portal/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Invalid OTP');
    } finally { setLoading(false); }
  };

  const handleOtpDigit = (idx, val) => {
    if (!/^\d*$/.test(val)) return;
    const digits = formData.otp.split('');
    digits[idx] = val;
    const newOtp = digits.join('').slice(0, 4);
    setFormData(prev => ({ ...prev, otp: newOtp }));
    if (val && idx < 3) otpRefs.current[idx + 1]?.focus();
  };

  const handleOtpKeyDown = (idx, e) => {
    if (e.key === 'Backspace' && !formData.otp[idx] && idx > 0) otpRefs.current[idx - 1]?.focus();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 flex flex-col">
      <div className="px-6 pt-12 pb-8 text-center">
        {company?.logo_url ? (
          <img 
            src={`${API_URL}${company.logo_url}`} 
            alt={company?.company_name || 'Company'} 
            className="w-20 h-20 object-contain mx-auto mb-4 rounded-2xl bg-white p-1 shadow-lg"
            data-testid="company-logo"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        ) : (
          <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-600/30">
            <LogIn className="w-8 h-8 text-white" />
          </div>
        )}
        <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Manrope, sans-serif' }} data-testid="company-name-heading">
          {company?.company_name || 'Welcome Back'}
        </h1>
        <p className="text-slate-400 mt-1">Login to your account</p>
      </div>

      <div className="flex-1 bg-white rounded-t-[2rem] px-6 pt-8 pb-6">
        {/* Mode Toggle */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl max-w-md mx-auto mb-6">
          <button
            onClick={() => { setLoginMode('password'); setOtpStep('phone'); }}
            className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
              loginMode === 'password' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
            }`}
            data-testid="login-mode-password"
          >
            <Lock className="w-4 h-4" /> Password
          </button>
          <button
            onClick={() => { setLoginMode('otp'); setOtpStep('phone'); }}
            className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
              loginMode === 'otp' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
            }`}
            data-testid="login-mode-otp"
          >
            <MessageSquare className="w-4 h-4" /> OTP Login
          </button>
        </div>

        {/* Password Login */}
        {loginMode === 'password' && (
          <form onSubmit={handlePasswordLogin} className="space-y-5 max-w-md mx-auto">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                  placeholder="Enter 10-digit number"
                  className="h-14 pl-12 rounded-xl border-0 bg-slate-50 text-base"
                  data-testid="login-phone-input"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">Password</Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Enter your password"
                  className="h-14 pl-12 pr-12 rounded-xl border-0 bg-slate-50 text-base"
                  data-testid="login-password-input"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            <div className="text-right">
              <Link to="/forgot-password" className="text-sm text-emerald-600 font-medium hover:underline">Forgot Password?</Link>
            </div>
            <Button type="submit" disabled={loading} className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-base font-semibold shadow-lg shadow-emerald-600/30" data-testid="login-submit-btn">
              {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <LogIn className="w-5 h-5 mr-2" />} Login
            </Button>
          </form>
        )}

        {/* OTP Login */}
        {loginMode === 'otp' && (
          <div className="space-y-5 max-w-md mx-auto">
            {otpStep === 'phone' && (
              <>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">Phone Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <Input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                      placeholder="Enter 10-digit number"
                      className="h-14 pl-12 rounded-xl border-0 bg-slate-50 text-base"
                      data-testid="otp-phone-input"
                    />
                  </div>
                </div>
                <Button onClick={handleSendOtp} disabled={loading} className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-base font-semibold shadow-lg shadow-emerald-600/30" data-testid="otp-send-btn">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <MessageSquare className="w-5 h-5 mr-2" />} Send OTP via WhatsApp
                </Button>
              </>
            )}

            {otpStep === 'verify' && (
              <>
                <button onClick={() => setOtpStep('phone')} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
                  <ArrowLeft className="w-4 h-4" /> Change Number
                </button>
                <p className="text-sm text-slate-600 text-center">
                  OTP sent to <span className="font-semibold text-slate-800">{formData.phone}</span>
                </p>
                <div className="flex justify-center gap-3">
                  {[0, 1, 2, 3].map(i => (
                    <input
                      key={i}
                      ref={el => otpRefs.current[i] = el}
                      type="tel"
                      maxLength={1}
                      value={formData.otp[i] || ''}
                      onChange={(e) => handleOtpDigit(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      className="w-14 h-14 text-center text-2xl font-bold border-2 border-slate-200 rounded-xl bg-slate-50 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                      data-testid={`otp-digit-${i}`}
                    />
                  ))}
                </div>
                <Button onClick={handleVerifyOtp} disabled={loading || formData.otp.length < 4} className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-base font-semibold shadow-lg shadow-emerald-600/30" data-testid="otp-verify-btn">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <LogIn className="w-5 h-5 mr-2" />} Verify & Login
                </Button>
                <div className="text-center">
                  {otpTimer > 0 ? (
                    <p className="text-sm text-slate-400">Resend OTP in {otpTimer}s</p>
                  ) : (
                    <button onClick={handleSendOtp} disabled={loading} className="text-sm text-emerald-600 font-medium hover:underline" data-testid="otp-resend-btn">
                      Resend OTP
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        <div className="mt-8 text-center">
          <p className="text-slate-500 text-sm">
            Don't have an account?{' '}
            <Link to="/register" className="text-emerald-600 font-semibold hover:underline">Register Now</Link>
          </p>
        </div>

        {canInstall && (
          <div className="mt-4 max-w-md mx-auto">
            <button
              onClick={handleInstallApp}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl text-sm font-semibold shadow-lg shadow-blue-600/30 hover:from-blue-700 hover:to-blue-800 transition-all"
              data-testid="install-app-btn"
            >
              <Download className="w-5 h-5" />
              Install App on Your Device
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerLogin;
