import { useState, useEffect, useRef } from 'react';
import { companyAPI } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import { Loader2, Building2, Upload, Image as ImageIcon, X, Link as LinkIcon, Copy } from 'lucide-react';
import { Alert, AlertDescription } from '../components/ui/alert';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const CompanySettings = () => {
  const { isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoPreview, setLogoPreview] = useState(null);
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    company_name: '',
    address: '',
    email: '',
    gst_number: '',
    drug_license: '',
    logo_base64: null,
    terms_conditions: '',
  });

  // Public link
  const publicLink = `${window.location.origin}/showcase`;

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await companyAPI.getSettings();
      if (response.data) {
        setFormData({
          company_name: response.data.company_name || '',
          address: response.data.address || '',
          email: response.data.email || '',
          gst_number: response.data.gst_number || '',
          drug_license: response.data.drug_license || '',
          logo_base64: null,
          terms_conditions: response.data.terms_conditions || '',
        });
        if (response.data.logo_url) {
          setLogoPreview(`${API_URL}${response.data.logo_url}`);
        }
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target.result.split(',')[1];
      setFormData({ ...formData, logo_base64: base64 });
      setLogoPreview(event.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setFormData({ ...formData, logo_base64: null });
    setLogoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();

    if (!isAdmin) {
      toast.error('Only admins can update company settings');
      return;
    }

    if (!formData.company_name || !formData.email || !formData.gst_number) {
      toast.error('Please fill in required fields');
      return;
    }

    setSaving(true);
    try {
      await companyAPI.saveSettings(formData);
      toast.success('Company settings saved successfully');
      fetchSettings();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(publicLink);
    toast.success('Link copied to clipboard!');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl" data-testid="company-settings-page">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Company Settings</h1>
        <p className="text-slate-500 mt-1">Configure your company details for the public showcase</p>
      </div>

      {/* Public Link Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <LinkIcon className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-slate-900">Public Product Showcase Link</p>
                <p className="text-sm text-blue-600 break-all">{publicLink}</p>
              </div>
            </div>
            <Button variant="outline" onClick={copyLink} data-testid="copy-link-btn">
              <Copy className="w-4 h-4 mr-2" />
              Copy Link
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <CardTitle>Company Information</CardTitle>
              <CardDescription>This information appears on the public product showcase</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-6">
            {/* Logo Upload */}
            <div className="flex items-start gap-6">
              <div className="flex flex-col items-center">
                <Label className="mb-2">Company Logo</Label>
                <div className="w-32 h-32 border-2 border-dashed border-slate-300 rounded-lg overflow-hidden flex items-center justify-center bg-slate-50 relative">
                  {logoPreview ? (
                    <>
                      <img src={logoPreview} alt="Logo" className="w-full h-full object-contain" />
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <ImageIcon className="w-10 h-10 text-slate-300" />
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  ref={fileInputRef}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-4 h-4 mr-1" />
                  Upload Logo
                </Button>
              </div>

              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2 space-y-2">
                  <Label htmlFor="company_name">Company Name *</Label>
                  <Input
                    id="company_name"
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    placeholder="Your Company Name"
                    required
                    data-testid="company-name-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="contact@company.com"
                    required
                    data-testid="company-email-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gst_number">GST Number *</Label>
                  <Input
                    id="gst_number"
                    value={formData.gst_number}
                    onChange={(e) => setFormData({ ...formData, gst_number: e.target.value })}
                    placeholder="22AAAAA0000A1Z5"
                    required
                    data-testid="gst-number-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="drug_license">Drug License Number *</Label>
                  <Input
                    id="drug_license"
                    value={formData.drug_license}
                    onChange={(e) => setFormData({ ...formData, drug_license: e.target.value })}
                    placeholder="DL-XX-XXXXX"
                    data-testid="drug-license-input"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address *</Label>
              <Textarea
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Full company address"
                rows={3}
                required
                data-testid="company-address-input"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="terms_conditions">Terms & Conditions</Label>
              <Textarea
                id="terms_conditions"
                value={formData.terms_conditions}
                onChange={(e) => setFormData({ ...formData, terms_conditions: e.target.value })}
                placeholder="Enter terms and conditions for orders..."
                rows={5}
                data-testid="terms-input"
              />
            </div>

            <Button type="submit" disabled={saving || !isAdmin} data-testid="save-company-btn">
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Save Settings
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
