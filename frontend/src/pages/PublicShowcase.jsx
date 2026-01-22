import { useState, useEffect } from 'react';
import { publicAPI } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Checkbox } from '../components/ui/checkbox';
import { Card, CardContent } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { toast } from 'sonner';
import { 
  Loader2, 
  Package, 
  ShoppingCart, 
  Phone,
  CheckCircle,
  Send,
  Sparkles
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
      let location = null;
      try {
        const pos = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        location = `${pos.coords.latitude}, ${pos.coords.longitude}`;
      } catch (e) {
        console.log('Location not available');
      }

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
        device_info: navigator.userAgent
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
            <Button className="mt-6 w-full" onClick={() => window.location.reload()}>
              Place Another Order
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const selectedCount = getSelectedItems().length;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header - Mobile Optimized */}
      {company && (
        <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
          <div className="px-3 py-3">
            <div className="flex items-center gap-3">
              {company.logo_url && (
                <img 
                  src={`${API_URL}${company.logo_url}`} 
                  alt={company.company_name}
                  className="w-12 h-12 object-contain rounded-lg"
                />
              )}
              <div className="flex-1 min-w-0">
                <h1 className="text-base font-bold text-slate-900 truncate">{company.company_name}</h1>
                <p className="text-xs text-slate-500 truncate">{company.address}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[10px] text-slate-500">
              <span>📧 {company.email}</span>
              <span>GST: {company.gst_number}</span>
              <span>DL: {company.drug_license}</span>
            </div>
          </div>
        </header>
      )}

      {/* Products - Mobile Optimized Table */}
      <main className="px-2 py-4 pb-48">
        {categories.length > 0 ? (
          <div className="space-y-6">
            {categories.map((category) => (
              <div key={category.category}>
                {/* Category Header */}
                <div className="bg-slate-800 text-white px-3 py-2 rounded-t-lg">
                  <h2 className="text-sm font-bold">{category.category}</h2>
                </div>
                
                {/* Mobile Table */}
                <div className="bg-white rounded-b-lg shadow-sm overflow-hidden">
                  {/* Table Header */}
                  <div className="grid grid-cols-12 gap-1 bg-slate-100 px-2 py-2 text-[10px] font-semibold text-slate-600 uppercase">
                    <div className="col-span-1">#</div>
                    <div className="col-span-4">Item</div>
                    <div className="col-span-2 text-right">Rate</div>
                    <div className="col-span-2 text-center">Offer</div>
                    <div className="col-span-3 text-center">Qty</div>
                  </div>
                  
                  {/* Table Body */}
                  {category.items.map((item, index) => (
                    <div key={item.id}>
                      {/* Main Row */}
                      <div 
                        className={`grid grid-cols-12 gap-1 px-2 py-2 items-center border-b border-slate-100 ${
                          quantities[item.id] ? 'bg-emerald-50' : ''
                        }`}
                      >
                        {/* S.No */}
                        <div className="col-span-1 text-xs text-slate-400">
                          {index + 1}
                        </div>
                        
                        {/* Item Name & Composition */}
                        <div className="col-span-4">
                          <p className="text-xs font-medium text-slate-900 leading-tight">
                            {item.item_name}
                          </p>
                          {item.composition && (
                            <p className="text-[10px] text-slate-500 leading-tight mt-0.5 line-clamp-2">
                              {item.composition}
                            </p>
                          )}
                        </div>
                        
                        {/* Rate */}
                        <div className="col-span-2 text-right">
                          <p className="text-xs font-bold text-emerald-600">₹{item.rate}</p>
                        </div>
                        
                        {/* Offer */}
                        <div className="col-span-2 text-center">
                          {item.offer ? (
                            <span className="inline-block text-[9px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-medium">
                              {item.offer}
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </div>
                        
                        {/* Qty Input */}
                        <div className="col-span-3">
                          <Input
                            placeholder="Qty"
                            value={quantities[item.id] || ''}
                            onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                            className="h-8 text-xs text-center px-1"
                            data-testid={`qty-${item.id}`}
                          />
                        </div>
                      </div>
                      
                      {/* Special Offer Row - Only shown if special_offer exists */}
                      {item.special_offer && (
                        <div className="px-2 py-1.5 bg-gradient-to-r from-pink-50 via-orange-50 to-yellow-50 border-b border-orange-200">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-3 h-3 text-orange-500 flex-shrink-0" />
                            <span className="text-[11px] font-semibold bg-gradient-to-r from-pink-600 via-orange-500 to-yellow-500 bg-clip-text text-transparent">
                              SPECIAL: {item.special_offer}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 text-slate-400">
            <Package className="w-12 h-12 mx-auto mb-3" />
            <p className="text-sm">No products available</p>
          </div>
        )}
      </main>

      {/* Fixed Bottom Order Form - Mobile Optimized */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-lg z-20">
        <div className="px-3 py-3 space-y-3">
          {/* Mobile Number & Doctor Info */}
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Label className="text-xs text-slate-500 mb-1 block">Mobile Number</Label>
              <div className="relative">
                <Phone className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Enter mobile number"
                  value={mobile}
                  onChange={(e) => handleMobileChange(e.target.value)}
                  className="pl-8 h-10 text-sm"
                  data-testid="mobile-input"
                />
              </div>
            </div>
            {doctorInfo && (
              <div className="px-2 py-1 bg-emerald-50 rounded border border-emerald-200 max-w-[120px]">
                <p className="text-xs font-medium text-emerald-800 truncate">{doctorInfo.name}</p>
                <p className="text-[10px] text-emerald-600">{doctorInfo.customer_code}</p>
              </div>
            )}
          </div>

          {/* Terms & Submit */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="terms"
                checked={termsAccepted}
                onCheckedChange={setTermsAccepted}
                data-testid="terms-checkbox"
              />
              <label htmlFor="terms" className="text-xs text-slate-600">
                Accept T&C
              </label>
            </div>
            
            <div className="flex items-center gap-2">
              {selectedCount > 0 && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
                  {selectedCount} items
                </span>
              )}
              <Button 
                onClick={handleSendOTP}
                disabled={submitting || !mobile || !termsAccepted || selectedCount === 0}
                className="h-10 px-4"
                data-testid="submit-order-btn"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <ShoppingCart className="w-4 h-4 mr-1" />
                    <span className="text-sm">Order</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* OTP Modal */}
      <Dialog open={showOTPModal} onOpenChange={setShowOTPModal}>
        <DialogContent className="max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle className="text-center">Enter OTP</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-slate-500 text-center">
              OTP sent to WhatsApp ({mobile})
            </p>
            <Input
              placeholder="Enter 6-digit OTP"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="text-center text-2xl tracking-widest h-14"
              maxLength={6}
              data-testid="otp-input"
            />
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button onClick={handleVerifyOTP} disabled={submitting || otp.length !== 6} className="w-full">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              Verify & Submit
            </Button>
            <Button variant="outline" onClick={() => setShowOTPModal(false)} className="w-full">
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
