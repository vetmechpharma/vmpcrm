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
  Image as ImageIcon,
  Download,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle,
  FileText,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Settings2
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { formatDate } from '../lib/utils';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const Items = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const fileInputRef = useRef(null);
  const importFileRef = useRef(null);
  
  // Import modal state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  // Export state
  const [showExportModal, setShowExportModal] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportRole, setExportRole] = useState('doctor');

  // Subcategory order state
  const [showSubOrderModal, setShowSubOrderModal] = useState(false);
  const [subcategoryOrder, setSubcategoryOrder] = useState([]);
  const [savingOrder, setSavingOrder] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    item_name: '',
    item_code: '',
    main_categories: [],
    subcategories: [],
    composition: '',
    mrp: '',
    gst: '',
    custom_fields: [],
    image_base64: null,
    // Role-based pricing
    rate_doctors: '',
    offer_doctors: '',
    special_offer_doctors: '',
    rate_medicals: '',
    offer_medicals: '',
    special_offer_medicals: '',
    rate_agencies: '',
    offer_agencies: '',
    special_offer_agencies: '',
  });

  // Image preview state
  const [imagePreview, setImagePreview] = useState(null);

  // New custom field state
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldValue, setNewFieldValue] = useState('');
  
  // New subcategory state
  const [newSubcategory, setNewSubcategory] = useState('');
  const [showNewSubcategory, setShowNewSubcategory] = useState(false);
  
  // Default subcategories
  const defaultSubcategories = ['Injection', 'Dry Injections', 'Hormones', 'Schedule X Drugs', 'Liquids', 'Bolus', 'Powder', 'Feed Supplements', 'Shampoo / Soap', 'Spray / Ointments', 'Tablets', 'Syrups', 'Vaccines'];

  useEffect(() => {
    fetchItems();
  }, [search]);

  const fetchItems = async () => {
    try {
      const params = {};
      if (search) params.search = search;
      const response = await itemsAPI.getAll(params);
      setItems(response.data);
    } catch (error) {
      toast.error('Failed to fetch items');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      item_name: '',
      item_code: '',
      main_categories: [],
      subcategories: [],
      composition: '',
      offer: '',
      special_offer: '',
      mrp: '',
      rate: '',
      gst: '',
      custom_fields: [],
      image_base64: null,
      // Role-based pricing
      rate_doctors: '',
      offer_doctors: '',
      special_offer_doctors: '',
      rate_medicals: '',
      offer_medicals: '',
      special_offer_medicals: '',
      rate_agencies: '',
      offer_agencies: '',
      special_offer_agencies: '',
    });
    setImagePreview(null);
    setNewFieldName('');
    setNewFieldValue('');
  };

  const handleSelectItem = (item) => {
    setSelectedItem(item);
    setFormData({
      item_name: item.item_name,
      item_code: item.item_code || '',
      main_categories: item.main_categories || [],
      subcategories: item.subcategories || [],
      composition: item.composition || '',
      mrp: item.mrp.toString(),
      gst: item.gst.toString(),
      custom_fields: item.custom_fields || [],
      image_base64: null,
      // Role-based pricing
      rate_doctors: item.rate_doctors?.toString() || '',
      offer_doctors: item.offer_doctors || '',
      special_offer_doctors: item.special_offer_doctors || '',
      rate_medicals: item.rate_medicals?.toString() || '',
      offer_medicals: item.offer_medicals || '',
      special_offer_medicals: item.special_offer_medicals || '',
      rate_agencies: item.rate_agencies?.toString() || '',
      offer_agencies: item.offer_agencies || '',
      special_offer_agencies: item.special_offer_agencies || '',
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
          mrp: selectedItem.mrp.toString(),
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

  const handleSave = async () => {
    if (!formData.item_name.trim()) {
      toast.error('Item name is required');
      return;
    }
    if (!formData.mrp) {
      toast.error('MRP is required');
      return;
    }

    setFormLoading(true);
    try {
      const payload = {
        item_name: formData.item_name,
        item_code: formData.item_code || null,
        main_categories: formData.main_categories || [],
        subcategories: formData.subcategories || [],
        composition: formData.composition || null,
        offer: null,
        special_offer: null,
        mrp: parseFloat(formData.mrp),
        rate: 0,
        gst: parseFloat(formData.gst) || 0,
        custom_fields: formData.custom_fields,
        // Role-based pricing
        rate_doctors: formData.rate_doctors ? parseFloat(formData.rate_doctors) : null,
        offer_doctors: formData.offer_doctors || null,
        special_offer_doctors: formData.special_offer_doctors || null,
        rate_medicals: formData.rate_medicals ? parseFloat(formData.rate_medicals) : null,
        offer_medicals: formData.offer_medicals || null,
        special_offer_medicals: formData.special_offer_medicals || null,
        rate_agencies: formData.rate_agencies ? parseFloat(formData.rate_agencies) : null,
        offer_agencies: formData.offer_agencies || null,
        special_offer_agencies: formData.special_offer_agencies || null,
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
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete item');
    } finally {
      setFormLoading(false);
    }
  };

  // Import handlers
  const handleDownloadTemplate = async () => {
    try {
      const response = await itemsAPI.getImportTemplate();
      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'items_import_template.xlsx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Template downloaded successfully');
    } catch (error) {
      toast.error('Failed to download template');
    }
  };

  const handleImportFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        toast.error('Please select an Excel file (.xlsx or .xls)');
        return;
      }
      setImportFile(file);
      setImportResult(null);
    }
  };

  const handleBulkImport = async () => {
    if (!importFile) {
      toast.error('Please select a file to import');
      return;
    }

    setImporting(true);
    setImportResult(null);
    try {
      const response = await itemsAPI.bulkImport(importFile);
      setImportResult({
        success: true,
        message: response.data.message,
        created: response.data.items_created,
        updated: response.data.items_updated,
        errors: response.data.errors || []
      });
      toast.success(response.data.message);
      fetchItems();
    } catch (error) {
      const errorMessage = error.response?.data?.detail || 'Import failed';
      setImportResult({
        success: false,
        message: errorMessage,
        errors: []
      });
      toast.error(errorMessage);
    } finally {
      setImporting(false);
    }
  };

  const closeImportModal = () => {
    setShowImportModal(false);
    setImportFile(null);
    setImportResult(null);
    if (importFileRef.current) {
      importFileRef.current.value = '';
    }
  };

  // Export handlers
  const handleExport = async (format, mainCategory) => {
    setExporting(true);
    try {
      const fn = format === 'pdf' ? itemsAPI.exportPDF : itemsAPI.exportExcel;
      const res = await fn(mainCategory, exportRole);
      const blob = new Blob([res.data], { type: res.headers['content-type'] });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `items_${(mainCategory || 'all').replace(/\s/g, '_').toLowerCase()}_${exportRole}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success(`${format.toUpperCase()} exported`);
    } catch (e) { toast.error('Export failed'); }
    finally { setExporting(false); }
  };

  // Subcategory order handlers
  const fetchSubcategoryOrder = async () => {
    try {
      const res = await itemsAPI.getSubcategoryOrder();
      setSubcategoryOrder(res.data.order || []);
    } catch { setSubcategoryOrder([...defaultSubcategories]); }
  };

  const moveSubcategory = (index, direction) => {
    const newOrder = [...subcategoryOrder];
    const target = index + direction;
    if (target < 0 || target >= newOrder.length) return;
    [newOrder[index], newOrder[target]] = [newOrder[target], newOrder[index]];
    setSubcategoryOrder(newOrder);
  };

  const saveSubcategoryOrder = async () => {
    setSavingOrder(true);
    try {
      await itemsAPI.updateSubcategoryOrder(subcategoryOrder);
      toast.success('Subcategory order saved');
      setShowSubOrderModal(false);
    } catch { toast.error('Failed to save order'); }
    finally { setSavingOrder(false); }
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
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setShowExportModal(true)} data-testid="export-items-btn">
            <FileText className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" onClick={() => { fetchSubcategoryOrder(); setShowSubOrderModal(true); }} data-testid="subcat-order-btn">
            <Settings2 className="w-4 h-4 mr-2" />
            Subcategory Order
          </Button>
          <Button variant="outline" onClick={() => setShowImportModal(true)} data-testid="import-items-btn">
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Import Excel
          </Button>
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
                        <p className="font-semibold text-slate-900">MRP: ₹{item.mrp}</p>
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
                  </div>
                  
                  {/* Main Categories & Subcategories for Showcase */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div className="space-y-2">
                      <Label>Main Categories</Label>
                      {isFormMode ? (
                        <div className="flex flex-wrap gap-3 p-3 border rounded-lg bg-slate-50">
                          {['Large Animals', 'Poultry', 'Pets'].map((cat) => (
                            <label key={cat} className="flex items-center gap-2 text-sm cursor-pointer">
                              <input
                                type="checkbox"
                                checked={formData.main_categories?.includes(cat) || false}
                                onChange={(e) => {
                                  const current = formData.main_categories || [];
                                  if (e.target.checked) {
                                    setFormData({ ...formData, main_categories: [...current, cat] });
                                  } else {
                                    setFormData({ ...formData, main_categories: current.filter(c => c !== cat) });
                                  }
                                }}
                                className="rounded border-slate-300 w-4 h-4"
                              />
                              <span className="font-medium">{cat}</span>
                            </label>
                          ))}
                        </div>
                      ) : (
                        <Input value={formData.main_categories?.join(', ') || '-'} disabled />
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Subcategories</Label>
                      {isFormMode ? (
                        <div className="p-3 border rounded-lg bg-slate-50">
                          <div className="flex flex-wrap gap-2 mb-3">
                            {[...new Set([...defaultSubcategories, ...(formData.subcategories || [])])].map((sub) => (
                              <label key={sub} className="flex items-center gap-1 text-sm cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={formData.subcategories?.includes(sub) || false}
                                  onChange={(e) => {
                                    const current = formData.subcategories || [];
                                    if (e.target.checked) {
                                      setFormData({ ...formData, subcategories: [...current, sub] });
                                    } else {
                                      setFormData({ ...formData, subcategories: current.filter(s => s !== sub) });
                                    }
                                  }}
                                  className="rounded border-slate-300"
                                />
                                {sub}
                              </label>
                            ))}
                          </div>
                          {showNewSubcategory ? (
                            <div className="flex gap-2">
                              <Input
                                value={newSubcategory}
                                onChange={(e) => setNewSubcategory(e.target.value)}
                                placeholder="Enter new subcategory"
                                className="flex-1"
                              />
                              <Button 
                                type="button" 
                                size="sm"
                                onClick={() => {
                                  if (newSubcategory.trim()) {
                                    const current = formData.subcategories || [];
                                    if (!current.includes(newSubcategory.trim())) {
                                      setFormData({ ...formData, subcategories: [...current, newSubcategory.trim()] });
                                    }
                                    setNewSubcategory('');
                                    setShowNewSubcategory(false);
                                  }
                                }}
                              >
                                Add
                              </Button>
                              <Button type="button" variant="outline" size="sm" onClick={() => { setShowNewSubcategory(false); setNewSubcategory(''); }}>
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <Button 
                              type="button" 
                              variant="ghost" 
                              size="sm" 
                              className="text-blue-600"
                              onClick={() => setShowNewSubcategory(true)}
                            >
                              + Add New Subcategory
                            </Button>
                          )}
                        </div>
                      ) : (
                        <Input value={formData.subcategories?.join(', ') || '-'} disabled />
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
                </div>

                <Separator />

                {/* Role-Based Pricing Section */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Label className="text-base font-semibold">Customer Portal Pricing</Label>
                    <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">Optional</span>
                  </div>
                  <p className="text-sm text-slate-500 mb-4">Set different prices and offers for each customer type.</p>
                  
                  {/* Doctors Pricing */}
                  <div className="p-4 border border-blue-200 rounded-lg bg-blue-50/50 mb-4">
                    <h4 className="font-medium text-blue-800 mb-3 flex items-center gap-2">
                      <span className="w-6 h-6 bg-blue-600 text-white rounded flex items-center justify-center text-xs">D</span>
                      Doctor Pricing
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-500">Rate (₹)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.rate_doctors}
                          onChange={(e) => setFormData({ ...formData, rate_doctors: e.target.value })}
                          placeholder="Enter rate"
                          disabled={!isFormMode}
                          data-testid="rate-doctors-input"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-500">Offer</Label>
                        <Input
                          value={formData.offer_doctors}
                          onChange={(e) => setFormData({ ...formData, offer_doctors: e.target.value })}
                          placeholder="Enter offer"
                          disabled={!isFormMode}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-500">Special Offer</Label>
                        <Input
                          value={formData.special_offer_doctors}
                          onChange={(e) => setFormData({ ...formData, special_offer_doctors: e.target.value })}
                          placeholder="Enter special offer"
                          disabled={!isFormMode}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Medicals Pricing */}
                  <div className="p-4 border border-purple-200 rounded-lg bg-purple-50/50 mb-4">
                    <h4 className="font-medium text-purple-800 mb-3 flex items-center gap-2">
                      <span className="w-6 h-6 bg-purple-600 text-white rounded flex items-center justify-center text-xs">M</span>
                      Medical Store Pricing
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-500">Rate (₹)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.rate_medicals}
                          onChange={(e) => setFormData({ ...formData, rate_medicals: e.target.value })}
                          placeholder="Enter rate"
                          disabled={!isFormMode}
                          data-testid="rate-medicals-input"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-500">Offer</Label>
                        <Input
                          value={formData.offer_medicals}
                          onChange={(e) => setFormData({ ...formData, offer_medicals: e.target.value })}
                          placeholder="Enter offer"
                          disabled={!isFormMode}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-500">Special Offer</Label>
                        <Input
                          value={formData.special_offer_medicals}
                          onChange={(e) => setFormData({ ...formData, special_offer_medicals: e.target.value })}
                          placeholder="Enter special offer"
                          disabled={!isFormMode}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Agencies Pricing */}
                  <div className="p-4 border border-orange-200 rounded-lg bg-orange-50/50">
                    <h4 className="font-medium text-orange-800 mb-3 flex items-center gap-2">
                      <span className="w-6 h-6 bg-orange-600 text-white rounded flex items-center justify-center text-xs">A</span>
                      Agency Pricing
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-500">Rate (₹)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.rate_agencies}
                          onChange={(e) => setFormData({ ...formData, rate_agencies: e.target.value })}
                          placeholder="Enter rate"
                          disabled={!isFormMode}
                          data-testid="rate-agencies-input"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-500">Offer</Label>
                        <Input
                          value={formData.offer_agencies}
                          onChange={(e) => setFormData({ ...formData, offer_agencies: e.target.value })}
                          placeholder="Enter offer"
                          disabled={!isFormMode}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-500">Special Offer</Label>
                        <Input
                          value={formData.special_offer_agencies}
                          onChange={(e) => setFormData({ ...formData, special_offer_agencies: e.target.value })}
                          placeholder="Enter special offer"
                          disabled={!isFormMode}
                        />
                      </div>
                    </div>
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
                    </div>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Import Modal */}
      <Dialog open={showImportModal} onOpenChange={closeImportModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              Bulk Import Items
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-800 mb-2">Import Instructions</h4>
              <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
                <li>Download the template and fill in your items</li>
                <li>Multiple categories: separate with commas (e.g., "Large Animals, Poultry")</li>
                <li>Item Code is optional - auto-generated if empty</li>
                <li>Images can be added manually after import</li>
                <li>Maximum 500 items per import</li>
              </ul>
            </div>

            {/* Download Template */}
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div>
                <p className="font-medium text-slate-700">Download Template</p>
                <p className="text-sm text-slate-500">Excel template with sample data</p>
              </div>
              <Button variant="outline" onClick={handleDownloadTemplate} data-testid="download-template-btn">
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            </div>

            {/* File Upload */}
            <div className="space-y-2">
              <Label>Select Excel File</Label>
              <div className="flex gap-2">
                <Input
                  ref={importFileRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleImportFileSelect}
                  className="flex-1"
                  data-testid="import-file-input"
                />
              </div>
              {importFile && (
                <p className="text-sm text-green-600 flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" />
                  Selected: {importFile.name}
                </p>
              )}
            </div>

            {/* Import Result */}
            {importResult && (
              <div className={`p-4 rounded-lg border ${importResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <div className="flex items-start gap-2">
                  {importResult.success ? (
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                  )}
                  <div>
                    <p className={`font-medium ${importResult.success ? 'text-green-800' : 'text-red-800'}`}>
                      {importResult.message}
                    </p>
                    {importResult.success && (
                      <p className="text-sm text-green-700 mt-1">
                        Created: {importResult.created} | Updated: {importResult.updated}
                      </p>
                    )}
                    {importResult.errors && importResult.errors.length > 0 && (
                      <div className="mt-2">
                        <p className="text-sm font-medium text-red-700">Errors:</p>
                        <ul className="text-sm text-red-600 list-disc list-inside">
                          {importResult.errors.slice(0, 5).map((err, i) => (
                            <li key={i}>{err}</li>
                          ))}
                          {importResult.errors.length > 5 && (
                            <li>...and {importResult.errors.length - 5} more errors</li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeImportModal}>
              {importResult?.success ? 'Close' : 'Cancel'}
            </Button>
            {!importResult?.success && (
              <Button onClick={handleBulkImport} disabled={!importFile || importing} data-testid="start-import-btn">
                {importing && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {importing ? 'Importing...' : 'Start Import'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export Modal */}
      <Dialog open={showExportModal} onOpenChange={setShowExportModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Export Items
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <p className="text-sm text-slate-500">Export items grouped by subcategory. Columns: S.No, Item Code, Name, Composition, MRP, Rate, Offer, Special Offer.</p>
            
            {/* Role selector */}
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border">
              <span className="text-sm font-medium text-slate-600 whitespace-nowrap">Pricing for:</span>
              <div className="flex gap-1 flex-1">
                {[{val: 'doctor', label: 'Doctors'}, {val: 'medical', label: 'Medicals'}, {val: 'agency', label: 'Agencies'}].map(r => (
                  <Button key={r.val} size="sm" variant={exportRole === r.val ? 'default' : 'outline'} className="flex-1 text-xs" onClick={() => setExportRole(r.val)} data-testid={`role-${r.val}`}>
                    {r.label}
                  </Button>
                ))}
              </div>
            </div>

            <Separator />
            {['Large Animals', 'Poultry', 'Pets'].map(cat => (
              <div key={cat} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
                <span className="font-medium text-slate-700">{cat}</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleExport('pdf', cat)} disabled={exporting} data-testid={`export-pdf-${cat.toLowerCase().replace(/\s/g,'-')}`}>
                    {exporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
                    <span className="ml-1">PDF</span>
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleExport('excel', cat)} disabled={exporting} data-testid={`export-excel-${cat.toLowerCase().replace(/\s/g,'-')}`}>
                    {exporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileSpreadsheet className="w-3 h-3" />}
                    <span className="ml-1">Excel</span>
                  </Button>
                </div>
              </div>
            ))}
            <Separator />
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
              <span className="font-medium text-blue-700">All Categories</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => handleExport('pdf', null)} disabled={exporting}>
                  <FileText className="w-3 h-3 mr-1" />PDF
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleExport('excel', null)} disabled={exporting}>
                  <FileSpreadsheet className="w-3 h-3 mr-1" />Excel
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Subcategory Order Modal */}
      <Dialog open={showSubOrderModal} onOpenChange={setShowSubOrderModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="w-5 h-5" />
              Subcategory Display Order
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-500">Set the order in which subcategories appear in exports. Use arrows to reorder.</p>
          <div className="space-y-1 max-h-[400px] overflow-y-auto py-2">
            {subcategoryOrder.map((sub, idx) => (
              <div key={sub} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border" data-testid={`subcat-item-${idx}`}>
                <span className="w-6 h-6 rounded bg-slate-200 text-slate-600 text-xs flex items-center justify-center font-bold">{idx + 1}</span>
                <GripVertical className="w-4 h-4 text-slate-400" />
                <span className="flex-1 text-sm font-medium">{sub}</span>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => moveSubcategory(idx, -1)} disabled={idx === 0}>
                  <ArrowUp className="w-3 h-3" />
                </Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => moveSubcategory(idx, 1)} disabled={idx === subcategoryOrder.length - 1}>
                  <ArrowDown className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubOrderModal(false)}>Cancel</Button>
            <Button onClick={saveSubcategoryOrder} disabled={savingOrder} data-testid="save-subcat-order-btn">
              {savingOrder && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Save Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Items;