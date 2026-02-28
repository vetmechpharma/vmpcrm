import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../context/AuthContext';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import { Loader2, Eye, EyeOff, Mail, Lock } from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const Login = () => {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [companySettings, setCompanySettings] = useState(null);
  const { login } = useAuth();
  const navigate = useNavigate();

  const loginForm = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  useEffect(() => {
    fetchCompanySettings();
  }, []);

  const fetchCompanySettings = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/public/company-settings`);
      setCompanySettings(response.data);
    } catch (error) {
      console.log('Company settings not configured');
    }
  };

  const handleLogin = async (data) => {
    setLoading(true);
    try {
      await login(data.email, data.password);
      toast.success('Welcome back!');
      navigate('/admin');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const companyName = companySettings?.company_name || 'VMP CRM';
  const logoUrl = companySettings?.logo_url ? `${API_URL}${companySettings.logo_url}` : null;
  const bgImage = companySettings?.login_background_image_url
    ? `${API_URL}${companySettings.login_background_image_url}`
    : 'https://images.unsplash.com/photo-1671108503276-1d3d5ab23a3a?w=1200&q=80';

  return (
    <div className="min-h-screen flex">
      {/* Left - Image Panel */}
      <div className="hidden lg:flex lg:w-7/12 relative overflow-hidden">
        <img
          src={bgImage}
          alt="Background"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(115,103,240,0.85) 0%, rgba(40,199,111,0.7) 100%)' }} />
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-lg overflow-hidden p-1">
                <img src={logoUrl} alt={companyName} className="w-full h-full object-contain" />
              </div>
            ) : (
              <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">V</span>
              </div>
            )}
            <span className="text-white font-bold text-xl tracking-tight">{companyName}</span>
          </div>
          <div className="max-w-lg">
            <h1 className="text-4xl font-bold text-white mb-4 leading-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
              Manage Your Business<br />Smarter & Faster
            </h1>
            <p className="text-white/80 text-lg">
              Complete CRM solution for pharmaceutical distributors. Track customers, orders, and grow your business.
            </p>
          </div>
          <p className="text-white/50 text-sm">
            &copy; {new Date().getFullYear()} {companyName}. All rights reserved.
          </p>
        </div>
      </div>

      {/* Right - Login Form */}
      <div className="w-full lg:w-5/12 flex items-center justify-center p-6 lg:p-12" style={{ background: '#F8F7FA' }}>
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3 mb-10">
            {logoUrl ? (
              <div className="w-10 h-10 rounded-lg overflow-hidden p-1" style={{ background: '#7367F026' }}>
                <img src={logoUrl} alt={companyName} className="w-full h-full object-contain" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: '#7367F0' }}>
                <span className="text-white font-bold text-lg">V</span>
              </div>
            )}
            <span className="font-bold text-xl" style={{ color: '#434050' }}>{companyName}</span>
          </div>

          {/* Welcome Text */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-2" style={{ color: '#434050', fontFamily: 'Manrope, sans-serif' }}>
              Welcome Back! 👋
            </h2>
            <p style={{ color: '#8D8A94' }}>Sign in to your admin account to continue</p>
          </div>

          {/* Login Card */}
          <div className="mat-card p-8">
            <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium" style={{ color: '#5D596C' }}>Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px]" style={{ color: '#B4B2B7' }} />
                  <Input
                    type="email"
                    placeholder="admin@company.com"
                    data-testid="login-email"
                    className="h-12 pl-11 rounded-lg border-slate-200 bg-white focus:border-[#7367F0] focus:ring-[#7367F0]"
                    {...loginForm.register('email')}
                  />
                </div>
                {loginForm.formState.errors.email && (
                  <p className="text-xs" style={{ color: '#EA5455' }}>{loginForm.formState.errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium" style={{ color: '#5D596C' }}>Password</label>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px]" style={{ color: '#B4B2B7' }} />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    data-testid="login-password"
                    className="h-12 pl-11 pr-11 rounded-lg border-slate-200 bg-white focus:border-[#7367F0] focus:ring-[#7367F0]"
                    {...loginForm.register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2"
                    style={{ color: '#B4B2B7' }}
                  >
                    {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                  </button>
                </div>
                {loginForm.formState.errors.password && (
                  <p className="text-xs" style={{ color: '#EA5455' }}>{loginForm.formState.errors.password.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                data-testid="login-submit-btn"
                className="w-full h-12 rounded-lg text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all hover:shadow-lg disabled:opacity-70"
                style={{ background: '#7367F0', boxShadow: '0 2px 6px rgba(115,103,240,0.4)' }}
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Sign In
              </button>
            </form>
          </div>

          <p className="text-center mt-6 text-sm" style={{ color: '#8D8A94' }}>
            Customer Portal?{' '}
            <a href="/login" className="font-semibold hover:underline" style={{ color: '#7367F0' }}>Login here</a>
          </p>
        </div>
      </div>
    </div>
  );
};
