import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { 
  Search, 
  Package,
  Tag,
  Loader2,
  Filter,
  X,
  ShoppingCart,
  ChevronDown
} from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const CustomerItems = () => {
  const { customer, cart, setCart } = useOutletContext();
  const [items, setItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [mainCategories, setMainCategories] = useState([]);
  const [subCategories, setSubCategories] = useState([]);
  const [selectedMainCategory, setSelectedMainCategory] = useState('all');
  const [selectedSubCategory, setSelectedSubCategory] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [quantities, setQuantities] = useState({});

  useEffect(() => {
    fetchItems();
  }, []);

  useEffect(() => {
    filterItems();
  }, [search, selectedMainCategory, selectedSubCategory, items]);

  useEffect(() => {
    if (selectedMainCategory === 'all') {
      const allSubs = new Set();
      items.forEach(item => {
        (item.subcategories || []).forEach(sub => allSubs.add(sub));
      });
      setSubCategories(Array.from(allSubs));
    } else {
      const subs = new Set();
      items
        .filter(item => (item.main_categories || []).includes(selectedMainCategory))
        .forEach(item => {
          (item.subcategories || []).forEach(sub => subs.add(sub));
        });
      setSubCategories(Array.from(subs));
    }
    setSelectedSubCategory('all');
  }, [selectedMainCategory, items]);

  const fetchItems = async () => {
    try {
      const token = localStorage.getItem('customerToken');
      const response = await axios.get(`${API_URL}/api/customer/items`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const itemsData = response.data || [];
      setItems(itemsData);
      
      const mainCats = new Set();
      const subCats = new Set();
      itemsData.forEach(item => {
        (item.main_categories || []).forEach(cat => mainCats.add(cat));
        (item.subcategories || []).forEach(sub => subCats.add(sub));
      });
      setMainCategories(Array.from(mainCats));
      setSubCategories(Array.from(subCats));
      
      // Initialize quantities from existing cart
      if (cart) {
        const qtyMap = {};
        cart.forEach(cartItem => {
          qtyMap[cartItem.id] = cartItem.quantity_text || String(cartItem.quantity);
        });
        setQuantities(qtyMap);
      }
    } catch (error) {
      console.error('Failed to fetch items');
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const filterItems = () => {
    let filtered = [...items];
    
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(item =>
        item.item_name?.toLowerCase().includes(searchLower) ||
        item.item_code?.toLowerCase().includes(searchLower) ||
        item.composition?.toLowerCase().includes(searchLower)
      );
    }
    
    if (selectedMainCategory !== 'all') {
      filtered = filtered.filter(item =>
        (item.main_categories || []).includes(selectedMainCategory)
      );
    }
    
    if (selectedSubCategory !== 'all') {
      filtered = filtered.filter(item =>
        (item.subcategories || []).includes(selectedSubCategory)
      );
    }
    
    setFilteredItems(filtered);
  };

  const getPrice = (item) => {
    if (customer?.role === 'doctor' && item.rate_doctors) return item.rate_doctors;
    if (customer?.role === 'medical' && item.rate_medicals) return item.rate_medicals;
    if (customer?.role === 'agency' && item.rate_agencies) return item.rate_agencies;
    return item.rate || item.mrp || 0;
  };

  const getOffer = (item) => {
    if (customer?.role === 'doctor' && item.offer_doctors) return item.offer_doctors;
    if (customer?.role === 'medical' && item.offer_medicals) return item.offer_medicals;
    if (customer?.role === 'agency' && item.offer_agencies) return item.offer_agencies;
    return item.offer;
  };

  const getSpecialOffer = (item) => {
    if (customer?.role === 'doctor' && item.special_offer_doctors) return item.special_offer_doctors;
    if (customer?.role === 'medical' && item.special_offer_medicals) return item.special_offer_medicals;
    if (customer?.role === 'agency' && item.special_offer_agencies) return item.special_offer_agencies;
    return item.special_offer;
  };

  const handleQuantityChange = (itemId, value) => {
    setQuantities(prev => ({
      ...prev,
      [itemId]: value
    }));
  };

  const parseQuantityText = (text) => {
    // Parse quantity text like "10", "10+5", "1 case", "2+1" etc.
    if (!text || text.trim() === '') return 0;
    
    const cleaned = text.trim().toLowerCase();
    
    // Handle addition expressions like "10+5"
    if (cleaned.includes('+')) {
      const parts = cleaned.split('+');
      let total = 0;
      for (const part of parts) {
        const num = parseInt(part.trim());
        if (!isNaN(num)) total += num;
      }
      return total > 0 ? total : text; // Return original text if can't parse
    }
    
    // Try to extract number from text like "1 case", "2 box"
    const numMatch = cleaned.match(/^(\d+)/);
    if (numMatch) {
      return parseInt(numMatch[1]);
    }
    
    return text; // Return original text for display
  };

  const addToCart = (item) => {
    const qtyText = quantities[item.id] || '';
    if (!qtyText.trim()) {
      toast.error('Please enter quantity');
      return;
    }

    const price = getPrice(item);
    const parsedQty = parseQuantityText(qtyText);
    const numericQty = typeof parsedQty === 'number' ? parsedQty : 1;

    const cartItem = {
      id: item.id,
      item_id: item.id,
      item_code: item.item_code,
      item_name: item.item_name,
      quantity: numericQty,
      quantity_text: qtyText, // Store original text
      rate: price,
      gst: item.gst || 0,
      amount: numericQty * price,
      offer: getOffer(item),
      special_offer: getSpecialOffer(item)
    };

    const existingIndex = cart?.findIndex(c => c.id === item.id);
    let newCart;
    if (existingIndex >= 0) {
      newCart = [...cart];
      newCart[existingIndex] = cartItem;
      toast.success(`Updated ${item.item_name}`);
    } else {
      newCart = [...(cart || []), cartItem];
      toast.success(`Added ${item.item_name}`);
    }
    
    setCart(newCart);
    localStorage.setItem('customerCart', JSON.stringify(newCart));
  };

  const getImageUrl = (item) => {
    if (!item.image_url) return null;
    if (item.image_url.startsWith('http')) return item.image_url;
    return `${API_URL}${item.image_url.startsWith('/') ? '' : '/'}${item.image_url}`;
  };

  const cartTotal = cart?.length || 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="px-2 py-4 space-y-3 pb-32" data-testid="customer-items-page">
      {/* Search & Filter - Sticky */}
      <div className="sticky top-14 z-30 bg-slate-50 pb-2 -mx-2 px-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products..."
              className="pl-9 h-10 rounded-lg border-slate-200 bg-white text-sm"
              data-testid="product-search"
            />
          </div>
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`h-10 px-3 flex items-center gap-1 rounded-lg transition-colors text-sm font-medium ${
              showFilters || selectedMainCategory !== 'all' || selectedSubCategory !== 'all'
                ? 'bg-emerald-600 text-white' 
                : 'bg-white text-slate-600 border border-slate-200'
            }`}
            data-testid="filter-btn"
          >
            <Filter className="w-4 h-4" />
            Filter
            {(selectedMainCategory !== 'all' || selectedSubCategory !== 'all') && (
              <span className="w-2 h-2 bg-red-500 rounded-full"></span>
            )}
          </button>
        </div>
        
        {/* Filters Panel */}
        {showFilters && (
          <div className="mt-2 bg-white rounded-lg p-3 shadow-sm border border-slate-100 space-y-3">
            {/* Main Categories */}
            <div>
              <p className="text-xs text-slate-500 font-medium mb-2">Main Category</p>
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                <button
                  onClick={() => setSelectedMainCategory('all')}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                    selectedMainCategory === 'all'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  All
                </button>
                {mainCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedMainCategory(cat)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                      selectedMainCategory === cat
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Sub Categories */}
            {subCategories.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 font-medium mb-2">Sub Category</p>
                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                  <button
                    onClick={() => setSelectedSubCategory('all')}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                      selectedSubCategory === 'all'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    All
                  </button>
                  {subCategories.map((sub) => (
                    <button
                      key={sub}
                      onClick={() => setSelectedSubCategory(sub)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                        selectedSubCategory === sub
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {sub}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between px-1">
        <p className="text-xs text-slate-500">
          {filteredItems.length} products
        </p>
        {cartTotal > 0 && (
          <Badge className="bg-emerald-100 text-emerald-700 text-xs">
            <ShoppingCart className="w-3 h-3 mr-1" />
            {cartTotal} in cart
          </Badge>
        )}
      </div>

      {/* Products Grid - 2 columns */}
      {filteredItems.length === 0 ? (
        <div className="py-12 text-center">
          <Package className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 text-sm">No products found</p>
          {(search || selectedMainCategory !== 'all' || selectedSubCategory !== 'all') && (
            <button 
              onClick={() => {
                setSearch('');
                setSelectedMainCategory('all');
                setSelectedSubCategory('all');
              }}
              className="mt-2 text-emerald-600 text-xs font-medium"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-3">
          {filteredItems.map((item) => {
            const price = getPrice(item);
            const offer = getOffer(item);
            const specialOffer = getSpecialOffer(item);
            const qtyText = quantities[item.id] || '';
            const imageUrl = getImageUrl(item);
            const inCart = cart?.some(c => c.id === item.id);
            
            return (
              <div 
                key={item.id} 
                className={`bg-white rounded-xl overflow-hidden shadow-sm border ${
                  inCart ? 'border-emerald-400 ring-1 ring-emerald-400' : 'border-slate-100'
                }`}
                data-testid={`product-${item.id}`}
              >
                {/* Product Image */}
                <div className="relative aspect-square bg-slate-50 overflow-hidden">
                  {imageUrl ? (
                    <img 
                      src={imageUrl} 
                      alt={item.item_name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-10 h-10 text-slate-200" />
                    </div>
                  )}
                  
                  {/* In Cart Badge */}
                  {inCart && (
                    <div className="absolute top-1.5 right-1.5 bg-emerald-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-medium">
                      In Cart
                    </div>
                  )}
                  
                  {/* Discount Badge */}
                  {item.mrp && item.mrp > price && (
                    <div className="absolute top-1.5 left-1.5 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded font-bold">
                      {Math.round((1 - price / item.mrp) * 100)}% OFF
                    </div>
                  )}
                </div>
                
                {/* Product Info */}
                <div className="p-2">
                  {/* Name */}
                  <h3 className="font-medium text-slate-800 text-xs leading-tight line-clamp-2 min-h-[2rem]">
                    {item.item_name}
                  </h3>
                  
                  {/* Code */}
                  <p className="text-[10px] text-slate-400 mt-0.5">{item.item_code}</p>
                  
                  {/* Price Section */}
                  <div className="flex items-baseline gap-1.5 mt-1.5">
                    <span className="text-base font-bold text-slate-900">₹{price}</span>
                    {item.mrp && item.mrp > price && (
                      <span className="text-[10px] text-slate-400 line-through">₹{item.mrp}</span>
                    )}
                  </div>
                  
                  {/* Offer */}
                  {offer && (
                    <div className="flex items-center gap-1 mt-1">
                      <Tag className="w-2.5 h-2.5 text-amber-600" />
                      <span className="text-[10px] text-amber-700 font-medium line-clamp-1">{offer}</span>
                    </div>
                  )}
                  
                  {/* Special Offer */}
                  {specialOffer && (
                    <div className="mt-1 p-1.5 bg-gradient-to-r from-rose-50 to-amber-50 rounded text-[10px] text-rose-700 font-medium line-clamp-1">
                      {specialOffer}
                    </div>
                  )}
                  
                  {/* Quantity Input & Add Button */}
                  <div className="mt-2 space-y-1.5">
                    <input
                      type="text"
                      value={qtyText}
                      onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                      placeholder="Qty: 10, 10+5, 1 case"
                      className="w-full h-8 px-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                      data-testid={`qty-input-${item.id}`}
                    />
                    <button
                      onClick={() => addToCart(item)}
                      disabled={!qtyText.trim()}
                      className={`w-full h-8 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors ${
                        qtyText.trim()
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                          : 'bg-slate-100 text-slate-400'
                      }`}
                      data-testid={`add-cart-${item.id}`}
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                      {inCart ? 'Update' : 'Add'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      
      {/* Floating Cart Button */}
      {cartTotal > 0 && (
        <div className="fixed bottom-20 left-3 right-3 z-40">
          <button
            onClick={() => window.location.href = '/portal/orders'}
            className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-lg flex items-center justify-between px-4 font-medium"
            data-testid="view-cart-btn"
          >
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              <span>{cartTotal} items</span>
            </div>
            <span className="font-semibold">View Cart →</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default CustomerItems;
