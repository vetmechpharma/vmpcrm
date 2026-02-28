import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader } from '../components/ui/card';
import { toast } from 'sonner';
import { Loader2, Stethoscope } from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const Login = () => {
  const [loading, setLoading] = useState(false);
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

  // Dynamic background style
  const getBackgroundStyle = () => {
    if (companySettings?.login_background_image_url) {
      return {
        backgroundImage: `url(${API_URL}${companySettings.login_background_image_url})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      };
    }
    if (companySettings?.login_background_color) {
      return { backgroundColor: companySettings.login_background_color };
    }
    return {};
  };

  const companyName = companySettings?.company_name || 'VMP CRM';
  const tagline = companySettings?.login_tagline || 'Doctor Lead Management System';
  const logoUrl = companySettings?.logo_url ? `${API_URL}${companySettings.logo_url}` : null;

  return (
    <div 
      className="min-h-screen login-bg flex items-center justify-center p-4"
      style={getBackgroundStyle()}
    >
      <div className="w-full max-w-md">
        {/* Logo & Branding */}
        <div className="text-center mb-8">
          {logoUrl ? (
            <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-2xl shadow-lg mb-4 overflow-hidden">
              <img 
                src={logoUrl} 
                alt={companyName} 
                className="w-full h-full object-contain p-2"
              />
            </div>
          ) : (
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-lg mb-4">
              <Stethoscope className="w-8 h-8 text-slate-900" />
            </div>
          )}
          <h1 className="text-3xl font-bold text-white mb-2 drop-shadow-lg">{companyName}</h1>
          <p className="text-slate-200 drop-shadow">{tagline}</p>
        </div>

        <Card className="border-0 shadow-2xl backdrop-blur-sm bg-white/95">
          <CardHeader className="pb-4 text-center">
            <h2 className="text-xl font-semibold text-slate-800">Sign In</h2>
            <p className="text-sm text-slate-500">Enter your credentials to continue</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="your@email.com"
                  data-testid="login-email"
                  {...loginForm.register('email')}
                />
                {loginForm.formState.errors.email && (
                  <p className="text-sm text-red-500">{loginForm.formState.errors.email.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">Password</Label>
                <Input
                  id="login-password"
                  type="password"
                  placeholder="••••••••"
                  data-testid="login-password"
                  {...loginForm.register('password')}
                />
                {loginForm.formState.errors.password && (
                  <p className="text-sm text-red-500">{loginForm.formState.errors.password.message}</p>
                )}
              </div>
              <Button 
                type="submit" 
                className="w-full" 
                disabled={loading}
                data-testid="login-submit-btn"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Sign In
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-slate-300 text-sm mt-6 drop-shadow">
          &copy; {new Date().getFullYear()} {companyName}. All rights reserved.
        </p>
      </div>
    </div>
  );
};
