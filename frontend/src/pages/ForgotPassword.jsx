import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { 
  Phone, 
  Lock, 
  ArrowLeft, 
  Loader2,
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle,
  MessageSquare
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: Phone, 2: OTP, 3: New Password
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

  const handleSendOTP = async (e) => {
    e.preventDefault();
    
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      toast.error('Please enter a valid 10-digit phone number');
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API_URL}/api/customer/send-otp`, {
        phone: cleanPhone,
        purpose: 'reset_password'
      });
      toast.success('OTP sent to your WhatsApp!');
      setOtpSent(true);
      setStep(2);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send OTP. Please check your phone number.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    
    if (otp.length !== 4) {
      toast.error('Please enter a valid 4-digit OTP');
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API_URL}/api/customer/verify-otp`, {
        phone: phone.replace(/\D/g, ''),
        otp: otp,
        purpose: 'reset_password'
      });
      toast.success('OTP verified successfully!');
      setStep(3);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API_URL}/api/customer/reset-password`, {
        phone: phone.replace(/\D/g, ''),
        otp: otp,
        new_password: newPassword
      });
      toast.success('Password reset successfully! Please login with your new password.');
      navigate('/login');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setLoading(true);
    try {
      await axios.post(`${API_URL}/api/customer/send-otp`, {
        phone: phone.replace(/\D/g, ''),
        purpose: 'reset_password'
      });
      toast.success('OTP resent to your WhatsApp!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to resend OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 flex flex-col" data-testid="forgot-password-page">
      {/* Header */}
      <div className="p-4">
        <Link to="/login" className="inline-flex items-center gap-2 text-white/70 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Login</span>
        </Link>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-4 pb-8">
        <div className="w-full max-w-md">
          {/* Icon */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <KeyRound className="w-10 h-10 text-emerald-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Reset Password</h1>
            <p className="text-slate-400 text-sm">
              {step === 1 && "Enter your registered phone number to receive OTP"}
              {step === 2 && "Enter the OTP sent to your WhatsApp"}
              {step === 3 && "Create your new password"}
            </p>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center justify-center gap-2 mb-8">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                  step >= s 
                    ? 'bg-emerald-500 text-white' 
                    : 'bg-slate-700 text-slate-400'
                }`}>
                  {step > s ? <CheckCircle className="w-5 h-5" /> : s}
                </div>
                {s < 3 && (
                  <div className={`w-12 h-1 mx-1 rounded ${
                    step > s ? 'bg-emerald-500' : 'bg-slate-700'
                  }`} />
                )}
              </div>
            ))}
          </div>

          {/* Form Card */}
          <div className="bg-white rounded-3xl shadow-2xl p-6">
            {/* Step 1: Phone Number */}
            {step === 1 && (
              <form onSubmit={handleSendOTP} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-slate-700">Phone Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <Input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="Enter 10-digit number"
                      className="pl-10 h-12"
                      maxLength={10}
                      data-testid="forgot-phone-input"
                    />
                  </div>
                </div>

                <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-sm text-emerald-700 flex items-start gap-2">
                  <MessageSquare className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <p>We'll send a 4-digit OTP to your WhatsApp number for verification.</p>
                </div>

                <Button 
                  type="submit" 
                  className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                  disabled={loading || phone.length !== 10}
                  data-testid="send-otp-btn"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>Send OTP</>
                  )}
                </Button>
              </form>
            )}

            {/* Step 2: OTP Verification */}
            {step === 2 && (
              <form onSubmit={handleVerifyOTP} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="otp" className="text-slate-700">Enter OTP</Label>
                  <Input
                    id="otp"
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="Enter 4-digit OTP"
                    className="h-12 text-center text-2xl tracking-[0.5em] font-bold"
                    maxLength={4}
                    data-testid="otp-input"
                  />
                </div>

                <p className="text-sm text-slate-500 text-center">
                  OTP sent to <span className="font-medium text-slate-700">+91 {phone}</span>
                </p>

                <Button 
                  type="submit" 
                  className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                  disabled={loading || otp.length !== 4}
                  data-testid="verify-otp-btn"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>Verify OTP</>
                  )}
                </Button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={handleResendOTP}
                    className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                    disabled={loading}
                  >
                    Didn't receive OTP? Resend
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="w-full text-sm text-slate-500 hover:text-slate-700"
                >
                  ← Change phone number
                </button>
              </form>
            )}

            {/* Step 3: New Password */}
            {step === 3 && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword" className="text-slate-700">New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <Input
                      id="newPassword"
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      className="pl-10 pr-10 h-12"
                      data-testid="new-password-input"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-slate-700">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      className="pl-10 pr-10 h-12"
                      data-testid="confirm-password-input"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-sm text-amber-700">
                  <p>Password must be at least 6 characters long.</p>
                </div>

                <Button 
                  type="submit" 
                  className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                  disabled={loading || newPassword.length < 6 || newPassword !== confirmPassword}
                  data-testid="reset-password-btn"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>Reset Password</>
                  )}
                </Button>
              </form>
            )}
          </div>

          {/* Footer */}
          <div className="text-center mt-6">
            <p className="text-slate-400 text-sm">
              Remember your password?{' '}
              <Link to="/login" className="text-emerald-400 font-semibold hover:underline">
                Login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
