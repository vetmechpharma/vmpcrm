import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import { Phone, Lock, LogIn, Loader2, Eye, EyeOff } from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const CustomerLogin = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    phone: '',
    password: ''
  });

  const handleLogin = async (e) => {
    e.preventDefault();
    
    if (!formData.phone || !formData.password) {
      toast.error('Please fill all fields');
      return;
    }

    if (formData.phone.length !== 10) {
      toast.error('Please enter a valid 10-digit phone number');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/api/customer/login`, {
        phone: formData.phone,
        password: formData.password
      });
      
      localStorage.setItem('customerToken', response.data.access_token);
      localStorage.setItem('customerData', JSON.stringify(response.data.customer));
      toast.success('Welcome back!');
      navigate('/customer/dashboard');
    } catch (error) {
      const message = error.response?.data?.detail || 'Login failed';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 flex flex-col">
      {/* Header */}
      <div className="px-6 pt-12 pb-8 text-center">
        <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-600/30">
          <LogIn className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>
          Welcome Back
        </h1>
        <p className="text-slate-400 mt-1">Login to your account</p>
      </div>

      {/* Form Card */}
      <div className="flex-1 bg-white rounded-t-[2rem] px-6 pt-8 pb-6">
        <form onSubmit={handleLogin} className="space-y-5 max-w-md mx-auto">
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
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                placeholder="Enter your password"
                className="h-14 pl-12 pr-12 rounded-xl border-0 bg-slate-50 text-base"
                data-testid="login-password-input"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div className="text-right">
            <Link to="/customer/forgot-password" className="text-sm text-emerald-600 font-medium hover:underline">
              Forgot Password?
            </Link>
          </div>

          <Button 
            type="submit"
            disabled={loading}
            className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-base font-semibold shadow-lg shadow-emerald-600/30"
            data-testid="login-submit-btn"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
            ) : (
              <LogIn className="w-5 h-5 mr-2" />
            )}
            Login
          </Button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-slate-500 text-sm">
            Don't have an account?{' '}
            <Link to="/customer/register" className="text-emerald-600 font-semibold hover:underline">
              Register Now
            </Link>
          </p>
        </div>

        {/* Back to Admin */}
        <div className="mt-6 text-center">
          <Link to="/login" className="text-xs text-slate-400 hover:text-slate-600">
            Admin Login →
          </Link>
        </div>
      </div>
    </div>
  );
};

export default CustomerLogin;
