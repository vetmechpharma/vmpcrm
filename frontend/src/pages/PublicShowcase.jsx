import { useState, useEffect } from 'react';
import { publicAPI } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Checkbox } from '../components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { toast } from 'sonner';
import { 
  Loader2, 
  Package, 
  ShoppingCart, 
  Phone,
  CheckCircle,
  Send
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const PublicShowcase = () => {
  const [company, setCompany] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [quantities, setQuantities] = useState({});
  const [mobile, setMobile] = useState('');
  const [doctorInfo, setDoctorInfo] = useState(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showOTPModal, setShowOTPModal] = useState(false);
  const [otp, setOtp] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [companyRes, itemsRes] = await Promise.all([
        publicAPI.getCompanySettings(),
        publicAPI.getItems()
      ]);
      setCompany(companyRes.data);
      setCategories(itemsRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMobileChange = async (value) => {
    setMobile(value);
    const cleanMobile = value.replace(/\D/g, '');
    
    if (cleanMobile.length >= 10) {
      try {
        const response = await publicAPI.getDoctorByMobile(cleanMobile);
        if (response.data) {
          setDoctorInfo(response.data);
          toast.success('Doctor details found!');
        } else {
          setDoctorInfo(null);
        }
      } catch (error) {
        setDoctorInfo(null);
      }
    } else {
      setDoctorInfo(null);
    }
  };

  const handleQuantityChange = (itemId, value) => {
    setQuantities({ ...quantities, [itemId]: value });
  };

  const getSelectedItems = () => {
    return categories.flatMap(cat => 
      cat.items.filter(item => quantities[item.id] && quantities[item.id].trim())
        .map(item => ({
          item_id: item.id,
          item_code: item.item_code,
          item_name: item.item_name,
          quantity: quantities[item.id],
          mrp: item.mrp,
          rate: item.rate
        }))
    );
  };

  const handleSendOTP = async () => {
    const cleanMobile = mobile.replace(/\D/g, '');
    if (cleanMobile.length < 10) {
      toast.error('Please enter a valid mobile number');
      return;
    }

    const selectedItems = getSelectedItems();
    if (selectedItems.length === 0) {
      toast.error('Please select at least one item with quantity');
      return;
    }

    if (!termsAccepted) {
      toast.error('Please accept the terms and conditions');
      return;
    }

    setSubmitting(true);
    try {
      await publicAPI.sendOTP({ mobile: cleanMobile, items: selectedItems });
      toast.success('OTP sent to your WhatsApp!');
      setShowOTPModal(true);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send OTP');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) {
      toast.error('Please enter a valid 6-digit OTP');
      return;
    }

    setSubmitting(true);
    try {
      // Get device info
      const deviceInfo = `${navigator.userAgent}`;
      
      // Try to get location
      let location = null;
      try {
        const pos = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        location = `${pos.coords.latitude}, ${pos.coords.longitude}`;
      } catch (e) {
        console.log('Location not available');
      }

      // Get IP (will be captured by server)
      let ipAddress = null;
      try {
        const ipRes = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipRes.json();
        ipAddress = ipData.ip;
      } catch (e) {
        console.log('IP fetch failed');
      }

      const response = await publicAPI.verifyOTP({
        mobile: mobile.replace(/\D/g, ''),
        otp,
        items: getSelectedItems(),
        ip_address: ipAddress,
        location,
        device_info: deviceInfo
      });

      setOrderNumber(response.data.order_number);
      setOrderSuccess(true);
      setShowOTPModal(false);
      toast.success('Order submitted successfully!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Invalid OTP');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (orderSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-8">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Order Submitted!</h2>
            <p className="text-slate-500 mb-4">Your order has been received successfully.</p>
            <div className="bg-slate-100 rounded-lg p-4 mb-6">
              <p className="text-sm text-slate-500">Order Number</p>
              <p className="text-xl font-bold text-slate-900">{orderNumber}</p>
            </div>
            <p className="text-sm text-slate-500">
              You will receive a confirmation on WhatsApp shortly.
            </p>
            <Button className="mt-6" onClick={() => window.location.reload()}>
              Place Another Order
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      {company && (
        <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
          <div className="max-w-6xl mx-auto px-4 py-4">
            <div className="flex items-center gap-4">
              {company.logo_url && (
                <img 
                  src={`${API_URL}${company.logo_url}`} 
                  alt={company.company_name}
                  className="w-16 h-16 object-contain"
                />
              )}
              <div className="flex-1">
                <h1 className="text-xl font-bold text-slate-900">{company.company_name}</h1>
                <p className="text-sm text-slate-500">{company.address}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-4 mt-3 text-xs text-slate-500">
              <span>Email: {company.email}</span>
              <span>GST: {company.gst_number}</span>
              <span>Drug License: {company.drug_license}</span>
            </div>
          </div>
        </header>
      )}

      {/* Products */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {categories.length > 0 ? (
          <div className="space-y-8">
            {categories.map((category) => (
              <div key={category.category}>
                <h2 className="text-lg font-bold text-slate-900 mb-4 pb-2 border-b-2 border-slate-200">
                  {category.category}
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="text-left p-3 font-semibold">Code</th>
                        <th className="text-left p-3 font-semibold">Item</th>
                        <th className="text-left p-3 font-semibold">Image</th>
                        <th className="text-left p-3 font-semibold">Composition & Offer</th>
                        <th className="text-right p-3 font-semibold">MRP</th>
                        <th className="text-right p-3 font-semibold">Rate</th>
                        <th className="text-center p-3 font-semibold w-32">Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {category.items.map((item) => (
                        <tr key={item.id} className="border-t border-slate-100 hover:bg-slate-50">
                          <td className="p-3 font-mono text-xs">{item.item_code}</td>
                          <td className="p-3 font-medium">{item.item_name}</td>
                          <td className="p-3">
                            {item.image_url ? (
                              <img 
                                src={`${API_URL}${item.image_url}`} 
                                alt={item.item_name}
                                className="w-12 h-12 object-cover rounded"
                              />
                            ) : (
                              <div className="w-12 h-12 bg-slate-100 rounded flex items-center justify-center">
                                <Package className="w-5 h-5 text-slate-400" />
                              </div>
                            )}
                          </td>
                          <td className="p-3">
                            <p className="text-slate-600">{item.composition || '-'}</p>
                            {item.offer && (
                              <span className="inline-block mt-1 text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded">
                                {item.offer}
                              </span>
                            )}
                            {item.gst > 0 && (
                              <span className="inline-block mt-1 ml-1 text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                                GST: {item.gst}%
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-right font-medium">₹{item.mrp}</td>
                          <td className="p-3 text-right font-bold text-emerald-600">₹{item.rate}</td>
                          <td className="p-3">
                            <Input
                              placeholder="e.g., 10, 10+2"
                              value={quantities[item.id] || ''}
                              onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                              className="text-center h-9"
                              data-testid={`qty-${item.id}`}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 text-slate-400">
            <Package className="w-16 h-16 mx-auto mb-4" />
            <p>No products available</p>
          </div>
        )}

        {/* Order Form */}
        <Card className="mt-8 sticky bottom-0 shadow-lg border-t-4 border-blue-500">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Mobile & Doctor Info */}
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="mobile">Mobile Number *</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      id="mobile"
                      placeholder="Enter your mobile number"
                      value={mobile}
                      onChange={(e) => handleMobileChange(e.target.value)}
                      className="pl-10"
                      data-testid="mobile-input"
                    />
                  </div>
                </div>
                {doctorInfo && (
                  <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                    <p className="text-sm font-medium text-emerald-800">{doctorInfo.name}</p>
                    <p className="text-xs text-emerald-600">{doctorInfo.customer_code}</p>
                  </div>
                )}
              </div>

              {/* Terms */}
              <div className="space-y-3">
                <Label>Terms & Conditions</Label>
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="terms"
                    checked={termsAccepted}
                    onCheckedChange={setTermsAccepted}
                    data-testid="terms-checkbox"
                  />
                  <label htmlFor="terms" className="text-sm text-slate-600 cursor-pointer">
                    I accept the terms and conditions
                  </label>
                </div>
                {company?.terms_conditions && (
                  <p className="text-xs text-slate-500 max-h-20 overflow-y-auto p-2 bg-slate-50 rounded">
                    {company.terms_conditions}
                  </p>
                )}
              </div>

              {/* Submit */}
              <div className="flex flex-col justify-end">
                <div className="text-sm text-slate-500 mb-2">
                  {getSelectedItems().length} items selected
                </div>
                <Button 
                  size="lg" 
                  onClick={handleSendOTP}
                  disabled={submitting || !mobile || !termsAccepted || getSelectedItems().length === 0}
                  className="w-full"
                  data-testid="submit-order-btn"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <ShoppingCart className="w-4 h-4 mr-2" />
                  )}
                  Send OTP & Submit Order
                </Button>
                <p className="text-xs text-slate-400 mt-2 text-center">
                  OTP will be sent to your WhatsApp
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* OTP Modal */}
      <Dialog open={showOTPModal} onOpenChange={setShowOTPModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enter OTP</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-slate-500">
              We've sent a 6-digit OTP to your WhatsApp ({mobile})
            </p>
            <Input
              placeholder="Enter 6-digit OTP"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="text-center text-2xl tracking-widest"
              maxLength={6}
              data-testid="otp-input"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOTPModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleVerifyOTP} disabled={submitting || otp.length !== 6}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              Verify & Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
