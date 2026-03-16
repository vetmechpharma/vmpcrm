import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMRAuth } from '../../context/MRAuthContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { toast } from 'sonner';
import { Loader2, Phone, Lock, Eye, EyeOff, Stethoscope, Download, Smartphone } from 'lucide-react';

export default function MRLogin() {
  const { login } = useMRAuth();
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);

  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const result = await installPrompt.userChoice;
    setInstallPrompt(null);
    if (result.outcome === 'accepted') toast.success('MR Field App installed!');
  }, [installPrompt]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!phone || !password) { toast.error('Enter phone and password'); return; }
    setLoading(true);
    try {
      await login(phone, password);
      toast.success('Login successful');
      navigate('/mrvet/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Login failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex" data-testid="mr-login-page">
      {/* Left panel */}
      <div className="hidden lg:flex lg:flex-1 items-center justify-center p-12" style={{ background: 'linear-gradient(135deg, #0c3c60 0%, #1e7a4d 100%)' }}>
        <div className="max-w-md text-white">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-8" style={{ background: 'rgba(255,255,255,0.15)' }}>
            <Stethoscope className="w-8 h-8" />
          </div>
          <h1 className="text-4xl font-bold mb-4 leading-tight">MR Field App</h1>
          <p className="text-lg opacity-80 mb-6">Your complete toolkit for field visits, product presentations, and customer management.</p>
          <div className="space-y-3 text-sm opacity-70">
            <div className="flex items-center gap-3"><div className="w-1.5 h-1.5 bg-white rounded-full" />Visual Aid Presentations</div>
            <div className="flex items-center gap-3"><div className="w-1.5 h-1.5 bg-white rounded-full" />Visit Tracking & Follow-ups</div>
            <div className="flex items-center gap-3"><div className="w-1.5 h-1.5 bg-white rounded-full" />Territory Customer Management</div>
            <div className="flex items-center gap-3"><div className="w-1.5 h-1.5 bg-white rounded-full" />Order Placement</div>
          </div>
          {/* Desktop install button */}
          {installPrompt && (
            <button onClick={handleInstall}
              className="mt-8 flex items-center gap-3 px-6 py-3 bg-white/15 hover:bg-white/25 backdrop-blur rounded-xl text-white font-semibold transition-colors"
              data-testid="mr-login-install-desktop">
              <Download className="w-5 h-5" />
              Install MR Field App
            </button>
          )}
        </div>
      </div>

      {/* Right panel - login form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-slate-50">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: '#0c3c60' }}>
              <Stethoscope className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">MR Field App</h2>
          </div>

          {/* Mobile install card */}
          {installPrompt && (
            <div className="mb-6 p-4 rounded-xl border-2 border-dashed flex items-center gap-3" style={{ borderColor: '#1e7a4d', background: 'rgba(30,122,77,0.05)' }}
              data-testid="mr-login-install-card">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#0c3c60' }}>
                <Smartphone className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800">Install MR Field App</p>
                <p className="text-xs text-slate-500">Works offline, faster access</p>
              </div>
              <button onClick={handleInstall}
                className="px-4 py-2 rounded-lg text-white text-sm font-semibold shrink-0"
                style={{ background: '#1e7a4d' }}
                data-testid="mr-login-install-btn">
                Install
              </button>
            </div>
          )}

          <h2 className="text-2xl font-bold text-slate-800 mb-1">Welcome Back</h2>
          <p className="text-slate-500 mb-8">Sign in to your MR account</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label>Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="9876543210" className="pl-10" data-testid="mr-login-phone" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password" className="pl-10 pr-10" data-testid="mr-login-password" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full h-11" style={{ background: '#0c3c60' }} disabled={loading} data-testid="mr-login-submit">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}Sign In
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
