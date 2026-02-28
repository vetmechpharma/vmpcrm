import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/card';
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
  Plus,
  Minus,
  ShoppingCart,
  ChevronDown,
  Image as ImageIcon
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

  // Update available subcategories when main category changes
  useEffect(() => {
    if (selectedMainCategory === 'all') {
      // Show all subcategories
      const allSubs = new Set();
      items.forEach(item => {
        (item.subcategories || []).forEach(sub => allSubs.add(sub));
      });
      setSubCategories(Array.from(allSubs));
    } else {
      // Show subcategories for selected main category items only
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
      
      // Extract unique main categories
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
          qtyMap[cartItem.id] = cartItem.quantity;
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
    const qty = Math.max(0, parseInt(value) || 0);
    setQuantities(prev => ({
      ...prev,
      [itemId]: qty
    }));
  };

  const incrementQuantity = (itemId) => {
    setQuantities(prev => ({
      ...prev,
      [itemId]: (prev[itemId] || 0) + 1
    }));
  };

  const decrementQuantity = (itemId) => {
    setQuantities(prev => ({
      ...prev,
      [itemId]: Math.max(0, (prev[itemId] || 0) - 1)
    }));
  };

  const addToCart = (item) => {
    const qty = quantities[item.id] || 0;
    if (qty <= 0) {
      toast.error('Please enter quantity');
      return;
    }

    const price = getPrice(item);
    const cartItem = {
      id: item.id,
      item_id: item.id,
      item_code: item.item_code,
      item_name: item.item_name,
      quantity: qty,
      rate: price,
      gst: item.gst || 0,
      amount: qty * price,
      offer: getOffer(item),
      special_offer: getSpecialOffer(item)
    };

    // Update cart
    const existingIndex = cart?.findIndex(c => c.id === item.id);
    let newCart;
    if (existingIndex >= 0) {
      newCart = [...cart];
      newCart[existingIndex] = cartItem;
      toast.success(`Updated ${item.item_name} quantity to ${qty}`);
    } else {
      newCart = [...(cart || []), cartItem];
      toast.success(`Added ${item.item_name} to cart`);
    }
    
    setCart(newCart);
    // Save to localStorage
    localStorage.setItem('customerCart', JSON.stringify(newCart));
  };

  const getImageUrl = (item) => {
    if (!item.image_url) return null;
    // Handle both relative and absolute URLs
    if (item.image_url.startsWith('http')) {
      return item.image_url;
    }
    return `${API_URL}${item.image_url.startsWith('/') ? '' : '/'}${item.image_url}`;
  };

  const cartTotal = cart?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="px-4 py-6 md:px-6 space-y-4 pb-32">
      {/* Search Bar - Sticky */}
      <div className="sticky top-14 md:top-0 z-30 bg-slate-50 pb-3 -mx-4 px-4 md:mx-0 md:px-0">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products..."
              className="pl-10 h-12 rounded-xl border-0 bg-white shadow-sm text-base"
              data-testid="product-search"
            />
            {search && (
              <button 
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`h-12 w-12 flex items-center justify-center rounded-xl transition-colors relative ${
              showFilters || selectedMainCategory !== 'all' || selectedSubCategory !== 'all'
                ? 'bg-emerald-600 text-white' 
                : 'bg-white text-slate-600 shadow-sm'
            }`}
            data-testid="filter-btn"
          >
            <Filter className="w-5 h-5" />
            {(selectedMainCategory !== 'all' || selectedSubCategory !== 'all') && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></span>
            )}
          </button>
        </div>
        
        {/* Filters Panel */}
        {showFilters && (
          <div className="mt-3 bg-white rounded-xl p-4 shadow-sm space-y-4">
            {/* Main Categories */}
            <div>
              <p className="text-xs text-slate-500 font-medium mb-2">Main Category</p>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                <button
                  onClick={() => setSelectedMainCategory('all')}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
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
                    className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
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
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  <button
                    onClick={() => setSelectedSubCategory('all')}
                    className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
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
                      className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
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
            
            {/* Clear Filters */}
            {(selectedMainCategory !== 'all' || selectedSubCategory !== 'all') && (
              <button
                onClick={() => {
                  setSelectedMainCategory('all');
                  setSelectedSubCategory('all');
                }}
                className="text-sm text-red-600 font-medium flex items-center gap-1"
              >
                <X className="w-4 h-4" />
                Clear Filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {filteredItems.length} products found
        </p>
        {cartTotal > 0 && (
          <Badge className="bg-emerald-100 text-emerald-700">
            <ShoppingCart className="w-3 h-3 mr-1" />
            {cartTotal} items in cart
          </Badge>
        )}
      </div>

      {/* Products Grid */}
      {filteredItems.length === 0 ? (
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardContent className="py-12 text-center">
            <Package className="w-16 h-16 mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500">No products found</p>
            {(search || selectedMainCategory !== 'all' || selectedSubCategory !== 'all') && (
              <button 
                onClick={() => {
                  setSearch('');
                  setSelectedMainCategory('all');
                  setSelectedSubCategory('all');
                }}
                className="mt-3 text-emerald-600 text-sm font-medium"
              >
                Clear all filters
              </button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => {
            const price = getPrice(item);
            const offer = getOffer(item);
            const specialOffer = getSpecialOffer(item);
            const qty = quantities[item.id] || 0;
            const imageUrl = getImageUrl(item);
            const inCart = cart?.some(c => c.id === item.id);
            
            return (
              <Card 
                key={item.id} 
                className={`rounded-2xl border-0 shadow-sm hover:shadow-md transition-all overflow-hidden ${
                  inCart ? 'ring-2 ring-emerald-500' : ''
                }`}
                data-testid={`product-${item.id}`}
              >
                {/* Product Image */}
                <div className="h-36 bg-gradient-to-br from-slate-100 to-slate-50 overflow-hidden relative">
                  {imageUrl ? (
                    <img 
                      src={imageUrl} 
                      alt={item.item_name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div 
                    className={`absolute inset-0 flex items-center justify-center ${imageUrl ? 'hidden' : ''}`}
                    style={{ display: imageUrl ? 'none' : 'flex' }}
                  >
                    <Package className="w-14 h-14 text-slate-300" />
                  </div>
                  {inCart && (
                    <div className="absolute top-2 right-2 bg-emerald-500 text-white text-xs px-2 py-1 rounded-full">
                      In Cart
                    </div>
                  )}
                </div>
                
                <CardContent className="p-4">
                  {/* Categories */}
                  <div className="flex flex-wrap gap-1 mb-2">
                    {item.main_categories?.slice(0, 1).map((cat) => (
                      <span key={cat} className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">
                        {cat}
                      </span>
                    ))}
                    {item.subcategories?.slice(0, 1).map((sub) => (
                      <span key={sub} className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                        {sub}
                      </span>
                    ))}
                  </div>
                  
                  {/* Name & Code */}
                  <h3 className="font-semibold text-slate-800 text-sm line-clamp-2 mb-1">
                    {item.item_name}
                  </h3>
                  {item.item_code && (
                    <p className="text-xs text-slate-400 font-mono">{item.item_code}</p>
                  )}
                  
                  {/* Composition */}
                  {item.composition && (
                    <p className="text-xs text-slate-500 mt-1 line-clamp-1">{item.composition}</p>
                  )}
                  
                  {/* Price & Offers */}
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-xl font-bold text-emerald-600">₹{price}</p>
                        {item.mrp && item.mrp > price && (
                          <p className="text-xs text-slate-400 line-through">MRP: ₹{item.mrp}</p>
                        )}
                      </div>
                      {item.gst > 0 && (
                        <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded">+{item.gst}% GST</span>
                      )}
                    </div>
                    
                    {/* Offers */}
                    {offer && (
                      <div className="flex items-center gap-1 mb-1">
                        <Tag className="w-3 h-3 text-amber-600" />
                        <span className="text-xs text-amber-700 font-medium">{offer}</span>
                      </div>
                    )}
                    {specialOffer && (
                      <div className="mb-2 p-2 bg-gradient-to-r from-rose-50 to-amber-50 rounded-lg">
                        <p className="text-xs text-rose-700 font-medium">{specialOffer}</p>
                      </div>
                    )}
                    
                    {/* Quantity & Add to Cart */}
                    <div className="flex items-center gap-2 mt-3">
                      <div className="flex items-center bg-slate-100 rounded-xl overflow-hidden">
                        <button
                          onClick={() => decrementQuantity(item.id)}
                          className="w-10 h-10 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors"
                          data-testid={`qty-minus-${item.id}`}
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <input
                          type="number"
                          value={qty}
                          onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                          className="w-14 h-10 text-center bg-transparent border-0 font-semibold text-slate-800 focus:outline-none"
                          min="0"
                          data-testid={`qty-input-${item.id}`}
                        />
                        <button
                          onClick={() => incrementQuantity(item.id)}
                          className="w-10 h-10 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors"
                          data-testid={`qty-plus-${item.id}`}
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      <Button
                        onClick={() => addToCart(item)}
                        disabled={qty <= 0}
                        className={`flex-1 h-10 rounded-xl font-semibold ${
                          qty > 0 
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                            : 'bg-slate-200 text-slate-400'
                        }`}
                        data-testid={`add-cart-${item.id}`}
                      >
                        <ShoppingCart className="w-4 h-4 mr-1" />
                        {inCart ? 'Update' : 'Add'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      
      {/* Floating Cart Button */}
      {cartTotal > 0 && (
        <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-8 md:w-80 z-40">
          <Button
            onClick={() => window.location.href = '/portal/orders'}
            className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl shadow-xl flex items-center justify-between px-6"
            data-testid="view-cart-btn"
          >
            <div className="flex items-center gap-3">
              <ShoppingCart className="w-6 h-6" />
              <span className="font-semibold">{cartTotal} items</span>
            </div>
            <span className="font-bold">View Cart →</span>
          </Button>
        </div>
      )}
    </div>
  );
};

export default CustomerItems;
