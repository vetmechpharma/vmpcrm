import { useState, useEffect } from 'react';
import { publicAPI } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Checkbox } from '../components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { toast } from 'sonner';
import { 
  Loader2, 
  ShoppingCart, 
  Phone,
  CheckCircle,
  Send,
  Sparkles,
  Plus,
  Minus,
  Filter
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Main categories
const MAIN_CATEGORIES = ['Large Animals', 'Poultry', 'Pets'];

// Subcategories for each main category
const SUBCATEGORIES = {
  'Large Animals': ['Injection', 'Liquids', 'Bolus', 'Powder', 'Feed Supplements'],
  'Poultry': ['Injection', 'Liquids', 'Powder', 'Feed Supplements', 'Vaccines'],
  'Pets': ['Injection', 'Liquids', 'Tablets', 'Syrups', 'Shampoos']
};

export const PublicShowcase = () => {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState({ main_categories: [], subcategories: {} });
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
  
  // Filters
  const [selectedMainCategory, setSelectedMainCategory] = useState('');
  const [selectedSubcategory, setSelectedSubcategory] = useState('');
  
  // Composition overlay
  const [showComposition, setShowComposition] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    fetchItems();
  }, [selectedMainCategory, selectedSubcategory]);

  const fetchData = async () => {
    try {
      const categoriesRes = await publicAPI.getCategories();
      setCategories(categoriesRes.data);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const fetchItems = async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedMainCategory) params.main_category = selectedMainCategory;
      if (selectedSubcategory) params.subcategory = selectedSubcategory;
      
      const itemsRes = await publicAPI.getItems(params);
      setItems(itemsRes.data);
    } catch (error) {
      console.error('Failed to fetch items:', error);
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
    const qty = parseInt(value) || 0;
    if (qty >= 0) {
      setQuantities({ ...quantities, [itemId]: qty });
    }
  };

  const incrementQty = (itemId) => {
    setQuantities({ ...quantities, [itemId]: (quantities[itemId] || 0) + 1 });
  };

  const decrementQty = (itemId) => {
    const current = quantities[itemId] || 0;
    if (current > 0) {
      setQuantities({ ...quantities, [itemId]: current - 1 });
    }
  };

  const getSelectedItems = () => {
    return items.filter(item => quantities[item.id] > 0).map(item => ({
      item_id: item.id,
      item_code: item.item_code,
      item_name: item.item_name,
      quantity: quantities[item.id],
      rate: item.rate,
      mrp: item.mrp
    }));
  };

  const getTotalAmount = () => {
    return items.reduce((sum, item) => {
      const qty = quantities[item.id] || 0;
      return sum + (item.rate * qty);
    }, 0);
  };

  const getCartCount = () => {
    return Object.values(quantities).reduce((sum, qty) => sum + (qty || 0), 0);
  };

  const handleSubmitOrder = async () => {
    const selectedItems = getSelectedItems();
    if (selectedItems.length === 0) {
      toast.error('Please select at least one product');
      return;
    }
    if (!mobile || mobile.replace(/\D/g, '').length < 10) {
      toast.error('Please enter a valid mobile number');
      return;
    }
    if (!termsAccepted) {
      toast.error('Please accept the terms and conditions');
      return;
    }

    setSubmitting(true);
    try {
      await publicAPI.sendOTP({ mobile: mobile.replace(/\D/g, '') });
      setShowOTPModal(true);
      toast.success('OTP sent to your WhatsApp!');
    } catch (error) {
      toast.error('Failed to send OTP. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp || otp.length !== 4) {
      toast.error('Please enter a valid 4-digit OTP');
      return;
    }

    setSubmitting(true);
    try {
      const response = await publicAPI.verifyOTP({
        mobile: mobile.replace(/\D/g, ''),
        otp,
        items: getSelectedItems(),
        doctor_info: doctorInfo
      });
      
      setOrderNumber(response.data.order_number);
      setOrderSuccess(true);
      setShowOTPModal(false);
      setQuantities({});
      toast.success('Order placed successfully!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Invalid OTP. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMainCategoryChange = (category) => {
    setSelectedMainCategory(category);
    setSelectedSubcategory('');
  };

  const availableSubcategories = selectedMainCategory 
    ? (categories.subcategories[selectedMainCategory] || SUBCATEGORIES[selectedMainCategory] || [])
    : [];

  const mainCats = categories.main_categories.length > 0 ? categories.main_categories : MAIN_CATEGORIES;

  if (orderSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Order Placed!</h2>
          <p className="text-slate-600 mb-4">Your order has been confirmed</p>
          <div className="bg-slate-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-slate-500">Order Number</p>
            <p className="text-xl font-bold text-slate-800">{orderNumber}</p>
          </div>
          <p className="text-sm text-slate-500 mb-6">
            Order confirmation has been sent to your WhatsApp
          </p>
          <Button onClick={() => { setOrderSuccess(false); setOtp(''); }} className="w-full">
            Place Another Order
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Category Filter Header */}
      <div className="sticky top-0 z-40 bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-3">
          {/* Main Categories */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <button
              onClick={() => handleMainCategoryChange('')}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                !selectedMainCategory 
                  ? 'bg-slate-800 text-white' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Products
            </button>
            {mainCats.map((cat) => (
              <button
                key={cat}
                onClick={() => handleMainCategoryChange(cat)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  selectedMainCategory === cat 
                    ? 'bg-slate-800 text-white' 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          
          {/* Subcategories */}
          {selectedMainCategory && availableSubcategories.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pt-2 scrollbar-hide">
              <button
                onClick={() => setSelectedSubcategory('')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                  !selectedSubcategory 
                    ? 'bg-emerald-600 text-white' 
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                }`}
              >
                All {selectedMainCategory}
              </button>
              {availableSubcategories.map((sub) => (
                <button
                  key={sub}
                  onClick={() => setSelectedSubcategory(sub)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                    selectedSubcategory === sub 
                      ? 'bg-emerald-600 text-white' 
                      : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  }`}
                >
                  {sub}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Products Grid */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20">
            <Filter className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">No products found</p>
            <p className="text-sm text-slate-400">Try selecting a different category</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3 sm:gap-4">
            {items.map((item) => (
              <div 
                key={item.id} 
                className="bg-white rounded-xl shadow-sm overflow-hidden border border-slate-100"
              >
                {/* Image with MRP tag - Click for composition */}
                <div 
                  className="relative aspect-square bg-slate-100 cursor-pointer"
                  onClick={() => item.composition && setShowComposition(showComposition === item.id ? null : item.id)}
                >
                  {item.image_url ? (
                    <img 
                      src={`${API_URL}${item.image_url}`} 
                      alt={item.item_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-4xl">📦</span>
                    </div>
                  )}
                  
                  {/* Composition Overlay */}
                  {showComposition === item.id && item.composition && (
                    <div className="absolute inset-0 bg-black/80 p-3 flex items-center justify-center">
                      <div className="text-white text-xs text-center">
                        <p className="font-semibold mb-1 text-amber-400">Composition</p>
                        <p className="leading-relaxed">{item.composition}</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Tap for composition hint */}
                  {item.composition && showComposition !== item.id && (
                    <div className="absolute bottom-1 left-1 right-1 text-center">
                      <span className="text-[10px] bg-black/50 text-white px-2 py-0.5 rounded-full">
                        Tap for composition
                      </span>
                    </div>
                  )}
                  
                  {/* MRP Tag */}
                  <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm rounded-lg px-2 py-1 shadow-sm">
                    <span className="text-xs text-slate-500">MRP</span>
                    <span className="text-sm font-bold text-slate-800 ml-1">₹{item.mrp}</span>
                  </div>
                  {/* Special Offer Badge */}
                  {item.special_offer && (
                    <div className="absolute top-2 left-2 bg-amber-500 text-white text-xs px-2 py-1 rounded-lg flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      <span>Special</span>
                    </div>
                  )}
                </div>
                
                {/* Product Info */}
                <div className="p-3">
                  <h3 className="font-semibold text-slate-800 text-sm line-clamp-2 mb-1">
                    {item.item_name}
                  </h3>
                  
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg font-bold text-emerald-600">₹{item.rate}</span>
                    {item.offer && (
                      <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                        {item.offer}
                      </span>
                    )}
                  </div>
                  
                  {item.special_offer && (
                    <p className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded mb-2 line-clamp-1">
                      {item.special_offer}
                    </p>
                  )}
                  
                  {/* Quantity Input - Text field for flexible entry */}
                  <div className="mt-2">
                    <Input
                      type="text"
                      value={quantities[item.id] || ''}
                      onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                      placeholder="Qty (e.g. 10, 1 case)"
                      className="w-full text-center text-sm h-9"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Floating Cart Summary */}
      {getCartCount() > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-50">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-slate-600" />
                <span className="font-medium text-slate-800">{getCartCount()} items</span>
              </div>
              <span className="text-lg font-bold text-emerald-600">₹{getTotalAmount().toLocaleString()}</span>
            </div>
            
            {/* Mobile Input */}
            <div className="flex gap-2 mb-3">
              <div className="flex-1">
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    type="tel"
                    placeholder="Enter mobile number"
                    value={mobile}
                    onChange={(e) => handleMobileChange(e.target.value)}
                    className="pl-10"
                  />
                </div>
                {doctorInfo && (
                  <p className="text-xs text-emerald-600 mt-1">Dr. {doctorInfo.name}</p>
                )}
              </div>
            </div>
            
            {/* Terms */}
            <div className="flex items-center gap-2 mb-3">
              <Checkbox
                id="terms"
                checked={termsAccepted}
                onCheckedChange={setTermsAccepted}
              />
              <Label htmlFor="terms" className="text-xs text-slate-500">
                I accept the terms and conditions
              </Label>
            </div>
            
            <Button
              onClick={handleSubmitOrder}
              disabled={submitting}
              className="w-full bg-emerald-600 hover:bg-emerald-700"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Place Order via WhatsApp
            </Button>
          </div>
        </div>
      )}

      {/* OTP Modal */}
      <Dialog open={showOTPModal} onOpenChange={setShowOTPModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Verify OTP</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-slate-500 mb-4">
              Enter the 4-digit OTP sent to your WhatsApp
            </p>
            <Input
              type="text"
              maxLength={4}
              placeholder="Enter OTP"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              className="text-center text-2xl tracking-widest"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOTPModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleVerifyOTP} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Verify & Place Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PublicShowcase;
