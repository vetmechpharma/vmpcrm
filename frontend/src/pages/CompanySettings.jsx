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
import { Loader2, Building2, Upload, Image as ImageIcon, X, Link as LinkIcon, Copy, LogIn, Palette } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const CompanySettings = () => {
  const { isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoPreview, setLogoPreview] = useState(null);
  const [bgPreview, setBgPreview] = useState(null);
  const fileInputRef = useRef(null);
  const bgInputRef = useRef(null);

  const [formData, setFormData] = useState({
    company_name: '',
    address: '',
    email: '',
    phone: '',
    gst_number: '',
    drug_license: '',
    logo_base64: null,
    terms_conditions: '',
    login_tagline: '',
    login_background_color: '',
    login_background_image: null,
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
          phone: response.data.phone || '',
          gst_number: response.data.gst_number || '',
          drug_license: response.data.drug_license || '',
          logo_base64: null,
          terms_conditions: response.data.terms_conditions || '',
          login_tagline: response.data.login_tagline || '',
          login_background_color: response.data.login_background_color || '',
          login_background_image: null,
        });
        if (response.data.logo_url) {
          setLogoPreview(`${API_URL}${response.data.logo_url}`);
        }
        if (response.data.login_background_image_url) {
          setBgPreview(`${API_URL}${response.data.login_background_image_url}`);
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

  const handleBgUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target.result.split(',')[1];
      setFormData({ ...formData, login_background_image: base64 });
      setBgPreview(event.target.result);
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

  const handleRemoveBg = () => {
    setFormData({ ...formData, login_background_image: null });
    setBgPreview(null);
    if (bgInputRef.current) {
      bgInputRef.current.value = '';
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
        <p className="text-slate-500 mt-1">Configure your company details and login page customization</p>
      </div>

      {/* Public Link Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
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

      <Tabs defaultValue="company" className="space-y-6">
        <TabsList>
          <TabsTrigger value="company" className="flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Company Info
          </TabsTrigger>
          <TabsTrigger value="login" className="flex items-center gap-2">
            <LogIn className="w-4 h-4" />
            Login Page
          </TabsTrigger>
        </TabsList>

        {/* Company Info Tab */}
        <TabsContent value="company">
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
                <div className="flex items-start gap-6 flex-wrap">
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

                  <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 min-w-[300px]">
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
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="+91 9876543210"
                        data-testid="company-phone-input"
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
        </TabsContent>

        {/* Login Page Customization Tab */}
        <TabsContent value="login">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Palette className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <CardTitle>Login Page Customization</CardTitle>
                  <CardDescription>Customize the appearance of your login page</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSave} className="space-y-6">
                {/* Preview Card */}
                <div className="border rounded-lg p-4 bg-slate-50">
                  <Label className="mb-3 block">Preview</Label>
                  <div 
                    className="w-full h-48 rounded-lg flex items-center justify-center relative overflow-hidden"
                    style={{
                      backgroundColor: formData.login_background_color || '#334155',
                      backgroundImage: bgPreview ? `url(${bgPreview})` : 'none',
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }}
                  >
                    <div className="text-center z-10">
                      {logoPreview ? (
                        <div className="w-16 h-16 bg-white rounded-xl mx-auto mb-2 overflow-hidden shadow-lg">
                          <img src={logoPreview} alt="Logo" className="w-full h-full object-contain p-2" />
                        </div>
                      ) : (
                        <div className="w-16 h-16 bg-white rounded-xl mx-auto mb-2 flex items-center justify-center shadow-lg">
                          <Building2 className="w-8 h-8 text-slate-600" />
                        </div>
                      )}
                      <h3 className="text-xl font-bold text-white drop-shadow-lg">
                        {formData.company_name || 'Company Name'}
                      </h3>
                      <p className="text-slate-200 text-sm drop-shadow">
                        {formData.login_tagline || 'Your tagline here'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Tagline */}
                  <div className="space-y-2">
                    <Label htmlFor="login_tagline">Login Tagline</Label>
                    <Input
                      id="login_tagline"
                      value={formData.login_tagline}
                      onChange={(e) => setFormData({ ...formData, login_tagline: e.target.value })}
                      placeholder="Doctor Lead Management System"
                      data-testid="login-tagline-input"
                    />
                    <p className="text-xs text-slate-500">Appears below your company name on the login page</p>
                  </div>

                  {/* Background Color */}
                  <div className="space-y-2">
                    <Label htmlFor="login_background_color">Background Color</Label>
                    <div className="flex gap-2">
                      <Input
                        id="login_background_color"
                        type="color"
                        value={formData.login_background_color || '#334155'}
                        onChange={(e) => setFormData({ ...formData, login_background_color: e.target.value })}
                        className="w-14 h-10 p-1 cursor-pointer"
                        data-testid="login-bg-color-input"
                      />
                      <Input
                        value={formData.login_background_color || '#334155'}
                        onChange={(e) => setFormData({ ...formData, login_background_color: e.target.value })}
                        placeholder="#334155"
                        className="flex-1"
                      />
                    </div>
                    <p className="text-xs text-slate-500">Used when no background image is set</p>
                  </div>
                </div>

                {/* Background Image */}
                <div className="space-y-2">
                  <Label>Background Image</Label>
                  <div className="flex items-start gap-4 flex-wrap">
                    <div className="w-48 h-28 border-2 border-dashed border-slate-300 rounded-lg overflow-hidden flex items-center justify-center bg-slate-50 relative">
                      {bgPreview ? (
                        <>
                          <img src={bgPreview} alt="Background" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={handleRemoveBg}
                            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <ImageIcon className="w-8 h-8 text-slate-300" />
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleBgUpload}
                        ref={bgInputRef}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => bgInputRef.current?.click()}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Upload Background
                      </Button>
                      <p className="text-xs text-slate-500">Recommended: 1920x1080px</p>
                    </div>
                  </div>
                </div>

                <Button type="submit" disabled={saving || !isAdmin} data-testid="save-login-btn">
                  {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Save Settings
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
