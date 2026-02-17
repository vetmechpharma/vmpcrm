import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { 
  Search, 
  Package,
  Tag,
  Loader2,
  Filter,
  X
} from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const CustomerItems = () => {
  const { customer } = useOutletContext();
  const [items, setItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchItems();
  }, []);

  useEffect(() => {
    filterItems();
  }, [search, selectedCategory, items]);

  const fetchItems = async () => {
    try {
      const token = localStorage.getItem('customerToken');
      const response = await axios.get(`${API_URL}/api/customer/items`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const itemsData = response.data || [];
      setItems(itemsData);
      
      // Extract unique categories
      const allCategories = new Set();
      itemsData.forEach(item => {
        (item.main_categories || []).forEach(cat => allCategories.add(cat));
      });
      setCategories(Array.from(allCategories));
    } catch (error) {
      console.error('Failed to fetch items');
    } finally {
      setLoading(false);
    }
  };

  const filterItems = () => {
    let filtered = [...items];
    
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(item =>
        item.item_name.toLowerCase().includes(searchLower) ||
        item.item_code?.toLowerCase().includes(searchLower) ||
        item.composition?.toLowerCase().includes(searchLower)
      );
    }
    
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(item =>
        (item.main_categories || []).includes(selectedCategory)
      );
    }
    
    setFilteredItems(filtered);
  };

  const getPrice = (item) => {
    // Get role-specific price
    if (customer?.role === 'doctor' && item.rate_doctors) return item.rate_doctors;
    if (customer?.role === 'medical' && item.rate_medicals) return item.rate_medicals;
    if (customer?.role === 'agency' && item.rate_agencies) return item.rate_agencies;
    return item.rate;
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="px-4 py-6 md:px-6 space-y-4">
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
          </div>
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`h-12 w-12 flex items-center justify-center rounded-xl transition-colors ${
              showFilters || selectedCategory !== 'all' 
                ? 'bg-emerald-600 text-white' 
                : 'bg-white text-slate-600 shadow-sm'
            }`}
            data-testid="filter-btn"
          >
            <Filter className="w-5 h-5" />
          </button>
        </div>
        
        {/* Category Filters */}
        {showFilters && categories.length > 0 && (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white text-slate-600 shadow-sm'
              }`}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === cat
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white text-slate-600 shadow-sm'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Results Count */}
      <p className="text-sm text-slate-500">
        {filteredItems.length} products found
      </p>

      {/* Products Grid */}
      {filteredItems.length === 0 ? (
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardContent className="py-12 text-center">
            <Package className="w-16 h-16 mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500">No products found</p>
            {search && (
              <button 
                onClick={() => setSearch('')}
                className="mt-3 text-emerald-600 text-sm font-medium"
              >
                Clear search
              </button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredItems.map((item) => {
            const price = getPrice(item);
            const offer = getOffer(item);
            const specialOffer = getSpecialOffer(item);
            
            return (
              <Card 
                key={item.id} 
                className="rounded-2xl border-0 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                data-testid={`product-${item.id}`}
              >
                {/* Product Image */}
                {item.image_url ? (
                  <div className="h-32 bg-slate-100 overflow-hidden">
                    <img 
                      src={`${API_URL}${item.image_url}`} 
                      alt={item.item_name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="h-32 bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center">
                    <Package className="w-12 h-12 text-slate-300" />
                  </div>
                )}
                
                <CardContent className="p-4">
                  {/* Categories */}
                  {item.main_categories?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {item.main_categories.slice(0, 2).map((cat) => (
                        <span key={cat} className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                          {cat}
                        </span>
                      ))}
                    </div>
                  )}
                  
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
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-lg font-bold text-emerald-600">₹{price}</p>
                        {item.mrp > price && (
                          <p className="text-xs text-slate-400 line-through">MRP: ₹{item.mrp}</p>
                        )}
                      </div>
                      {item.gst > 0 && (
                        <span className="text-xs text-slate-400">+{item.gst}% GST</span>
                      )}
                    </div>
                    
                    {/* Offers */}
                    {offer && (
                      <div className="mt-2 flex items-center gap-1">
                        <Tag className="w-3 h-3 text-amber-600" />
                        <span className="text-xs text-amber-700 font-medium">{offer}</span>
                      </div>
                    )}
                    {specialOffer && (
                      <div className="mt-1 p-2 bg-gradient-to-r from-rose-50 to-amber-50 rounded-lg">
                        <p className="text-xs text-rose-700 font-medium">{specialOffer}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CustomerItems;
