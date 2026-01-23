import { useState, useEffect, useRef } from 'react';
import { itemsAPI } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Separator } from '../components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Loader2,
  Package,
  X,
  Save,
  PlusCircle,
  Upload,
  Image as ImageIcon
} from 'lucide-react';
import { formatDate } from '../lib/utils';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const Items = () => {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedItem, setSelectedItem] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const fileInputRef = useRef(null);

  // Form state
  const [formData, setFormData] = useState({
    item_name: '',
    item_code: '',
    category: '',
    main_category: '',
    subcategories: [],
    composition: '',
    offer: '',
    special_offer: '',
    mrp: '',
    rate: '',
    gst: '',
    custom_fields: [],
    image_base64: null,
  });

  // Image preview state
  const [imagePreview, setImagePreview] = useState(null);

  // New custom field state
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldValue, setNewFieldValue] = useState('');

  // New category input
  const [newCategory, setNewCategory] = useState('');
  const [showNewCategory, setShowNewCategory] = useState(false);

  useEffect(() => {
    fetchItems();
    fetchCategories();
  }, [search, categoryFilter]);

  const fetchItems = async () => {
    try {
      const params = {};
      if (search) params.search = search;
      if (categoryFilter && categoryFilter !== 'all') params.category = categoryFilter;
      const response = await itemsAPI.getAll(params);
      setItems(response.data);
    } catch (error) {
      toast.error('Failed to fetch items');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await itemsAPI.getCategories();
      setCategories(response.data);
    } catch (error) {
      console.error('Failed to fetch categories');
    }
  };

  const resetForm = () => {
    setFormData({
      item_name: '',
      item_code: '',
      category: '',
      main_category: '',
      subcategories: [],
      composition: '',
      offer: '',
      special_offer: '',
      mrp: '',
      rate: '',
      gst: '',
      custom_fields: [],
      image_base64: null,
    });
    setImagePreview(null);
    setNewFieldName('');
    setNewFieldValue('');
    setNewCategory('');
    setShowNewCategory(false);
  };

  const handleSelectItem = (item) => {
    setSelectedItem(item);
    setFormData({
      item_name: item.item_name,
      item_code: item.item_code || '',
      category: item.category || '',
      main_category: item.main_category || '',
      subcategories: item.subcategories || [],
      composition: item.composition || '',
      offer: item.offer || '',
      special_offer: item.special_offer || '',
      mrp: item.mrp.toString(),
      rate: item.rate.toString(),
      gst: item.gst.toString(),
      custom_fields: item.custom_fields || [],
      image_base64: null,
    });
    setImagePreview(item.image_url ? `${API_URL}${item.image_url}` : null);
    setIsEditing(false);
    setIsCreating(false);
  };

  const handleNewItem = () => {
    setSelectedItem(null);
    resetForm();
    setIsCreating(true);
    setIsEditing(false);
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    if (isCreating) {
      setIsCreating(false);
      resetForm();
    } else {
      setIsEditing(false);
      if (selectedItem) {
        setFormData({
          item_name: selectedItem.item_name,
          item_code: selectedItem.item_code || '',
          category: selectedItem.category || '',
          composition: selectedItem.composition || '',
          offer: selectedItem.offer || '',
          special_offer: selectedItem.special_offer || '',
          mrp: selectedItem.mrp.toString(),
          rate: selectedItem.rate.toString(),
          gst: selectedItem.gst.toString(),
          custom_fields: selectedItem.custom_fields || [],
          image_base64: null,
        });
        setImagePreview(selectedItem.image_url ? `${API_URL}${selectedItem.image_url}` : null);
      }
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Read and convert to base64
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target.result.split(',')[1]; // Remove data URL prefix
      setFormData({ ...formData, image_base64: base64 });
      setImagePreview(event.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = async () => {
    if (selectedItem && !isCreating) {
      try {
        await itemsAPI.deleteImage(selectedItem.id);
        toast.success('Image removed');
      } catch (error) {
        console.error('Failed to delete image');
      }
    }
    setFormData({ ...formData, image_base64: null });
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAddCustomField = () => {
    if (!newFieldName.trim()) {
      toast.error('Please enter a field name');
      return;
    }
    setFormData({
      ...formData,
      custom_fields: [
        ...formData.custom_fields,
        { field_name: newFieldName.trim(), field_value: newFieldValue.trim() }
      ]
    });
    setNewFieldName('');
    setNewFieldValue('');
  };

  const handleRemoveCustomField = (index) => {
    const updated = formData.custom_fields.filter((_, i) => i !== index);
    setFormData({ ...formData, custom_fields: updated });
  };

  const handleUpdateCustomField = (index, field, value) => {
    const updated = formData.custom_fields.map((cf, i) => 
      i === index ? { ...cf, [field]: value } : cf
    );
    setFormData({ ...formData, custom_fields: updated });
  };

  const handleCategoryChange = (value) => {
    if (value === '__new__') {
      setShowNewCategory(true);
      setFormData({ ...formData, category: '' });
    } else {
      setShowNewCategory(false);
      setFormData({ ...formData, category: value });
    }
  };

  const handleSave = async () => {
    if (!formData.item_name.trim()) {
      toast.error('Item name is required');
      return;
    }
    if (!formData.mrp || !formData.rate) {
      toast.error('MRP and Rate are required');
      return;
    }

    setFormLoading(true);
    try {
      const payload = {
        item_name: formData.item_name,
        item_code: formData.item_code || null,
        category: showNewCategory ? newCategory : (formData.category || null),
        composition: formData.composition || null,
        offer: formData.offer || null,
        special_offer: formData.special_offer || null,
        mrp: parseFloat(formData.mrp),
        rate: parseFloat(formData.rate),
        gst: parseFloat(formData.gst) || 0,
        custom_fields: formData.custom_fields,
      };

      // Only include image if a new one was uploaded
      if (formData.image_base64) {
        payload.image_base64 = formData.image_base64;
      }

      if (isCreating) {
        const response = await itemsAPI.create(payload);
        toast.success('Item created successfully');
        setSelectedItem(response.data);
        setIsCreating(false);
        setImagePreview(response.data.image_url ? `${API_URL}${response.data.image_url}` : null);
      } else {
        const response = await itemsAPI.update(selectedItem.id, payload);
        toast.success('Item updated successfully');
        setSelectedItem(response.data);
        setIsEditing(false);
        setImagePreview(response.data.image_url ? `${API_URL}${response.data.image_url}` : null);
      }
      fetchItems();
      fetchCategories();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save item');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedItem) return;
    
    if (!window.confirm(`Are you sure you want to delete "${selectedItem.item_name}"?`)) {
      return;
    }

    setFormLoading(true);
    try {
      await itemsAPI.delete(selectedItem.id);
      toast.success('Item deleted successfully');
      setSelectedItem(null);
      resetForm();
      fetchItems();
      fetchCategories();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete item');
    } finally {
      setFormLoading(false);
    }
  };

  const isFormMode = isEditing || isCreating;

  return (
    <div className="h-[calc(100vh-8rem)] animate-fade-in" data-testid="items-page">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Items / Products</h1>
          <p className="text-slate-500 mt-1">Manage your product inventory</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100%-5rem)]">
        {/* Left Panel - Items List */}
        <Card className="lg:col-span-1 flex flex-col h-full">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Items List</CardTitle>
              <Button size="sm" onClick={handleNewItem} data-testid="add-item-btn">
                <Plus className="w-4 h-4 mr-1" />
                Add
              </Button>
            </div>
            <div className="space-y-2 mt-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search items..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                  data-testid="search-items-input"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger data-testid="category-filter">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.name} value={cat.name}>
                      {cat.name} ({cat.count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto p-0">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              </div>
            ) : items.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {items.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleSelectItem(item)}
                    className={`p-3 cursor-pointer transition-colors hover:bg-slate-50 ${
                      selectedItem?.id === item.id ? 'bg-blue-50 border-l-2 border-blue-500' : ''
                    }`}
                    data-testid={`item-row-${item.id}`}
                  >
                    <div className="flex items-center gap-3">
                      {item.image_url ? (
                        <img 
                          src={`${API_URL}${item.image_url}`} 
                          alt={item.item_name}
                          className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Package className="w-5 h-5 text-slate-500" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 truncate">{item.item_name}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500">{item.item_code}</span>
                          {item.category && (
                            <span className="text-xs px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                              {item.category}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-slate-900">₹{item.rate}</p>
                        <p className="text-xs text-slate-400">MRP: ₹{item.mrp}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-32 text-slate-400">
                <Package className="w-8 h-8 mb-2" />
                <p className="text-sm">No items found</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Panel - Item Details / Form */}
        <Card className="lg:col-span-2 flex flex-col h-full">
          <CardHeader className="pb-3 flex-shrink-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                {isCreating ? 'New Item' : selectedItem ? selectedItem.item_name : 'Item Details'}
              </CardTitle>
              {(selectedItem || isCreating) && (
                <div className="flex items-center gap-2">
                  {isFormMode ? (
                    <>
                      <Button variant="outline" size="sm" onClick={handleCancel} disabled={formLoading}>
                        Cancel
                      </Button>
                      <Button size="sm" onClick={handleSave} disabled={formLoading} data-testid="save-item-btn">
                        {formLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                        Save
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="outline" size="sm" onClick={handleEdit} data-testid="edit-item-btn">
                        <Edit2 className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                      <Button variant="destructive" size="sm" onClick={handleDelete} disabled={formLoading} data-testid="delete-item-btn">
                        <Trash2 className="w-4 h-4 mr-1" />
                        Delete
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto">
            {!selectedItem && !isCreating ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <Package className="w-16 h-16 mb-4" />
                <p className="text-lg font-medium">Select an item or add a new one</p>
                <p className="text-sm">Click on an item from the list or click "Add" to create new</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Image Upload Section */}
                <div className="flex items-start gap-6">
                  <div className="flex flex-col items-center">
                    <div className="w-24 h-24 border-2 border-dashed border-slate-300 rounded-lg overflow-hidden flex items-center justify-center bg-slate-50 relative">
                      {imagePreview ? (
                        <>
                          <img 
                            src={imagePreview} 
                            alt="Item" 
                            className="w-full h-full object-cover"
                          />
                          {isFormMode && (
                            <button
                              onClick={handleRemoveImage}
                              className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </>
                      ) : (
                        <ImageIcon className="w-8 h-8 text-slate-300" />
                      )}
                    </div>
                    {isFormMode && (
                      <>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          ref={fileInputRef}
                          className="hidden"
                          data-testid="image-upload-input"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <Upload className="w-4 h-4 mr-1" />
                          Upload
                        </Button>
                        <p className="text-xs text-slate-400 mt-1">100x100 WebP, &lt;25KB</p>
                      </>
                    )}
                  </div>

                  {/* Item Code Display/Input */}
                  <div className="flex-1 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="item_code">Item Code</Label>
                      <Input
                        id="item_code"
                        value={formData.item_code}
                        onChange={(e) => setFormData({ ...formData, item_code: e.target.value })}
                        placeholder="Auto-generated if empty (e.g., ITM-0001)"
                        disabled={!isFormMode}
                        data-testid="item-code-input"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="category">Category</Label>
                      {isFormMode ? (
                        showNewCategory ? (
                          <div className="flex gap-2">
                            <Input
                              value={newCategory}
                              onChange={(e) => setNewCategory(e.target.value)}
                              placeholder="Enter new category"
                              data-testid="new-category-input"
                            />
                            <Button variant="outline" size="sm" onClick={() => setShowNewCategory(false)}>
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <Select value={formData.category} onValueChange={handleCategoryChange}>
                            <SelectTrigger data-testid="item-category-select">
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent>
                              {categories.map((cat) => (
                                <SelectItem key={cat.name} value={cat.name}>
                                  {cat.name}
                                </SelectItem>
                              ))}
                              <SelectItem value="__new__">
                                <span className="text-blue-600">+ Add New Category</span>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        )
                      ) : (
                        <Input
                          value={formData.category || '-'}
                          disabled
                        />
                      )}
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Basic Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2 space-y-2">
                    <Label htmlFor="item_name">Item Name *</Label>
                    <Input
                      id="item_name"
                      value={formData.item_name}
                      onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
                      placeholder="Enter item name"
                      disabled={!isFormMode}
                      data-testid="item-name-input"
                    />
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <Label htmlFor="composition">Composition</Label>
                    <Input
                      id="composition"
                      value={formData.composition}
                      onChange={(e) => setFormData({ ...formData, composition: e.target.value })}
                      placeholder="Enter composition details"
                      disabled={!isFormMode}
                      data-testid="item-composition-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mrp">MRP (₹) *</Label>
                    <Input
                      id="mrp"
                      type="number"
                      step="0.01"
                      value={formData.mrp}
                      onChange={(e) => setFormData({ ...formData, mrp: e.target.value })}
                      placeholder="0.00"
                      disabled={!isFormMode}
                      data-testid="item-mrp-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rate">Rate (₹) *</Label>
                    <Input
                      id="rate"
                      type="number"
                      step="0.01"
                      value={formData.rate}
                      onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                      placeholder="0.00"
                      disabled={!isFormMode}
                      data-testid="item-rate-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gst">GST (%)</Label>
                    <Input
                      id="gst"
                      type="number"
                      step="0.01"
                      value={formData.gst}
                      onChange={(e) => setFormData({ ...formData, gst: e.target.value })}
                      placeholder="0"
                      disabled={!isFormMode}
                      data-testid="item-gst-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="offer">Offer</Label>
                    <Input
                      id="offer"
                      value={formData.offer}
                      onChange={(e) => setFormData({ ...formData, offer: e.target.value })}
                      placeholder="e.g., 10% off, Buy 2 Get 1"
                      disabled={!isFormMode}
                      data-testid="item-offer-input"
                    />
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <Label htmlFor="special_offer" className="flex items-center gap-2">
                      Special Offer
                      <span className="text-xs px-2 py-0.5 bg-gradient-to-r from-pink-500 to-orange-500 text-white rounded-full">HOT</span>
                    </Label>
                    <Input
                      id="special_offer"
                      value={formData.special_offer}
                      onChange={(e) => setFormData({ ...formData, special_offer: e.target.value })}
                      placeholder="e.g., Buy 20 pcs at Rs.50/-"
                      disabled={!isFormMode}
                      data-testid="item-special-offer-input"
                      className="border-orange-200 focus:border-orange-400"
                    />
                    <p className="text-xs text-slate-500">Bulk/quantity-based special pricing</p>
                  </div>
                </div>

                <Separator />

                {/* Custom Fields Section */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <Label className="text-base font-semibold">Custom Fields</Label>
                  </div>

                  {/* Existing Custom Fields */}
                  {formData.custom_fields.length > 0 && (
                    <div className="space-y-3 mb-4">
                      {formData.custom_fields.map((cf, index) => (
                        <div key={index} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                          <div className="flex-1 grid grid-cols-2 gap-3">
                            <Input
                              value={cf.field_name}
                              onChange={(e) => handleUpdateCustomField(index, 'field_name', e.target.value)}
                              placeholder="Field Name"
                              disabled={!isFormMode}
                              className="bg-white"
                            />
                            <Input
                              value={cf.field_value}
                              onChange={(e) => handleUpdateCustomField(index, 'field_value', e.target.value)}
                              placeholder="Field Value"
                              disabled={!isFormMode}
                              className="bg-white"
                            />
                          </div>
                          {isFormMode && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveCustomField(index)}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add New Custom Field */}
                  {isFormMode && (
                    <div className="flex items-end gap-3 p-3 border-2 border-dashed border-slate-200 rounded-lg">
                      <div className="flex-1 grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-slate-500">Field Name</Label>
                          <Input
                            value={newFieldName}
                            onChange={(e) => setNewFieldName(e.target.value)}
                            placeholder="e.g., Batch No"
                            data-testid="custom-field-name-input"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-slate-500">Field Value</Label>
                          <Input
                            value={newFieldValue}
                            onChange={(e) => setNewFieldValue(e.target.value)}
                            placeholder="e.g., B12345"
                            data-testid="custom-field-value-input"
                          />
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleAddCustomField}
                        data-testid="add-custom-field-btn"
                      >
                        <PlusCircle className="w-4 h-4 mr-1" />
                        Add Field
                      </Button>
                    </div>
                  )}

                  {!isFormMode && formData.custom_fields.length === 0 && (
                    <p className="text-sm text-slate-400 italic">No custom fields added</p>
                  )}
                </div>

                {/* Timestamps */}
                {selectedItem && !isCreating && (
                  <>
                    <Separator />
                    <div className="flex items-center gap-6 text-sm text-slate-500">
                      <span>Created: {formatDate(selectedItem.created_at)}</span>
                      <span>Updated: {formatDate(selectedItem.updated_at)}</span>
                    </div>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
