import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { Search, Package, ShoppingCart, Loader2, Filter } from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const CustomerItems = () => {
  const { customer } = useOutletContext();
  const [items, setItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [categories, setCategories] = useState([]);
  const [cart, setCart] = useState([]);

  useEffect(() => {
    fetchItems();
  }, []);

  useEffect(() => {
    filterItems();
  }, [search, categoryFilter, items]);

  const fetchItems = async () => {
    try {
      const token = localStorage.getItem('customerToken');
      const response = await axios.get(`${API_URL}/api/customer/items`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setItems(response.data || []);
      
      // Extract unique categories
      const cats = new Set();
      response.data.forEach(item => {
        (item.main_categories || []).forEach(c => cats.add(c));
      });
      setCategories(Array.from(cats).sort());
    } catch (error) {
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
        item.item_name.toLowerCase().includes(searchLower) ||
        item.item_code.toLowerCase().includes(searchLower) ||
        (item.composition || '').toLowerCase().includes(searchLower)
      );
    }
    
    if (categoryFilter && categoryFilter !== 'all') {
      filtered = filtered.filter(item => 
        (item.main_categories || []).includes(categoryFilter)
      );
    }
    
    setFilteredItems(filtered);
  };

  const addToCart = (item) => {
    const existing = cart.find(c => c.id === item.id);
    if (existing) {
      setCart(cart.map(c => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      setCart([...cart, { ...item, quantity: 1 }]);
    }
    toast.success(`${item.item_name} added to cart`);
  };

  const getCartTotal = () => {
    return cart.reduce((total, item) => total + (item.rate * item.quantity), 0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Products</h1>
        <p className="text-slate-500">Browse products with your special pricing</p>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products..."
            className="pl-10"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(cat => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Cart Summary */}
      {cart.length > 0 && (
        <Card className="mb-6 bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShoppingCart className="w-5 h-5 text-blue-600" />
                <span className="font-medium">{cart.length} items in cart</span>
                <span className="text-slate-500">•</span>
                <span className="font-bold text-blue-600">₹{getCartTotal().toFixed(2)}</span>
              </div>
              <Button size="sm">
                Place Order
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Products Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredItems.map((item) => (
          <Card key={item.id} className="overflow-hidden hover:shadow-lg transition-shadow">
            <div className="aspect-square bg-slate-100 relative">
              {item.image_url ? (
                <img
                  src={`${API_URL}${item.image_url}`}
                  alt={item.item_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="w-16 h-16 text-slate-300" />
                </div>
              )}
              <Badge className="absolute top-2 right-2 bg-green-600">
                MRP ₹{item.mrp}
              </Badge>
            </div>
            <CardContent className="p-4">
              <p className="text-xs text-slate-500 mb-1">{item.item_code}</p>
              <h3 className="font-semibold text-slate-800 mb-2 line-clamp-2">{item.item_name}</h3>
              
              {item.composition && (
                <p className="text-xs text-slate-500 mb-2 line-clamp-1">{item.composition}</p>
              )}
              
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs text-slate-500">Your Price</p>
                  <p className="text-lg font-bold text-blue-600">₹{item.rate}</p>
                </div>
                {item.offer && (
                  <Badge variant="outline" className="text-orange-600 border-orange-300">
                    {item.offer}
                  </Badge>
                )}
              </div>
              
              {item.special_offer && (
                <p className="text-xs text-green-600 mb-3 bg-green-50 p-2 rounded">
                  {item.special_offer}
                </p>
              )}
              
              <Button 
                className="w-full" 
                size="sm"
                onClick={() => addToCart(item)}
              >
                <ShoppingCart className="w-4 h-4 mr-2" />
                Add to Cart
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredItems.length === 0 && (
        <div className="text-center py-12">
          <Package className="w-16 h-16 mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500">No products found</p>
        </div>
      )}
    </div>
  );
};

export default CustomerItems;
