import { useState, useEffect } from 'react';
import { expensesAPI, expenseCategoriesAPI } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Loader2,
  Receipt,
  TrendingUp,
  TrendingDown,
  Calendar,
  Filter,
  CreditCard,
  Banknote,
  Smartphone,
  Building2,
  Truck,
  Tag
} from 'lucide-react';
import { formatDate } from '../lib/utils';

const PAYMENT_TYPES = [
  { value: 'cash', label: 'Cash', icon: Banknote },
  { value: 'card', label: 'Card', icon: CreditCard },
  { value: 'upi', label: 'UPI', icon: Smartphone },
  { value: 'net_banking', label: 'Net Banking', icon: Building2 },
];

const PAYMENT_ACCOUNTS = [
  { value: 'company_account', label: 'Company Account' },
  { value: 'admin_user', label: 'Admin User' },
  { value: 'employee_user', label: 'Employee User' },
];

export const Expenses = () => {
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [paymentTypeFilter, setPaymentTypeFilter] = useState('all');
  const [paymentAccountFilter, setPaymentAccountFilter] = useState('all');
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [formLoading, setFormLoading] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    category_id: '',
    date: new Date().toISOString().split('T')[0],
    amount: '',
    payment_type: 'cash',
    payment_account: 'company_account',
    paid_by: '',
    reason: '',
  });

  const [newCategory, setNewCategory] = useState({ name: '', description: '' });

  useEffect(() => {
    fetchData();
  }, [startDate, endDate, categoryFilter, paymentTypeFilter, paymentAccountFilter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [expensesRes, categoriesRes, statsRes] = await Promise.all([
        expensesAPI.getAll({
          start_date: startDate || undefined,
          end_date: endDate || undefined,
          category_id: categoryFilter !== 'all' ? categoryFilter : undefined,
          payment_type: paymentTypeFilter !== 'all' ? paymentTypeFilter : undefined,
          payment_account: paymentAccountFilter !== 'all' ? paymentAccountFilter : undefined,
        }),
        expenseCategoriesAPI.getAll(),
        expensesAPI.getMonthlyStats(),
      ]);
      setExpenses(expensesRes.data);
      setCategories(categoriesRes.data);
      setStats(statsRes.data);
    } catch (error) {
      toast.error('Failed to fetch expenses');
    } finally {
      setLoading(false);
    }
  };

  const handleAddExpense = async () => {
    if (!formData.category_id || !formData.amount || !formData.reason) {
      toast.error('Category, amount, and reason are required');
      return;
    }
    
    setFormLoading(true);
    try {
      await expensesAPI.create({
        ...formData,
        amount: parseFloat(formData.amount),
      });
      toast.success('Expense added successfully');
      setShowAddModal(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error('Failed to add expense');
    } finally {
      setFormLoading(false);
    }
  };

  const handleEditExpense = async () => {
    setFormLoading(true);
    try {
      await expensesAPI.update(selectedExpense.id, {
        ...formData,
        amount: parseFloat(formData.amount),
      });
      toast.success('Expense updated successfully');
      setShowEditModal(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error('Failed to update expense');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteExpense = async () => {
    setFormLoading(true);
    try {
      await expensesAPI.delete(selectedExpense.id);
      toast.success('Expense deleted successfully');
      setShowDeleteModal(false);
      setSelectedExpense(null);
      fetchData();
    } catch (error) {
      toast.error('Failed to delete expense');
    } finally {
      setFormLoading(false);
    }
  };

  const handleAddCategory = async () => {
    if (!newCategory.name) {
      toast.error('Category name is required');
      return;
    }
    
    setFormLoading(true);
    try {
      await expenseCategoriesAPI.create(newCategory);
      toast.success('Category added successfully');
      setNewCategory({ name: '', description: '' });
      const categoriesRes = await expenseCategoriesAPI.getAll();
      setCategories(categoriesRes.data);
    } catch (error) {
      toast.error('Failed to add category');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteCategory = async (categoryId) => {
    try {
      await expenseCategoriesAPI.delete(categoryId);
      toast.success('Category deleted successfully');
      const categoriesRes = await expenseCategoriesAPI.getAll();
      setCategories(categoriesRes.data);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete category');
    }
  };

  const openEditModal = (expense) => {
    setSelectedExpense(expense);
    setFormData({
      category_id: expense.category_id,
      date: expense.date,
      amount: expense.amount.toString(),
      payment_type: expense.payment_type,
      payment_account: expense.payment_account,
      paid_by: expense.paid_by || '',
      reason: expense.reason,
    });
    setShowEditModal(true);
  };

  const openDeleteModal = (expense) => {
    setSelectedExpense(expense);
    setShowDeleteModal(true);
  };

  const resetForm = () => {
    setFormData({
      category_id: '',
      date: new Date().toISOString().split('T')[0],
      amount: '',
      payment_type: 'cash',
      payment_account: 'company_account',
      paid_by: '',
      reason: '',
    });
  };

  const getPaymentTypeIcon = (type) => {
    const pt = PAYMENT_TYPES.find(p => p.value === type);
    return pt ? pt.icon : Banknote;
  };

  const getPaymentTypeLabel = (type) => {
    const pt = PAYMENT_TYPES.find(p => p.value === type);
    return pt ? pt.label : type;
  };

  const getPaymentAccountLabel = (account) => {
    const pa = PAYMENT_ACCOUNTS.find(p => p.value === account);
    return pa ? pa.label : account;
  };

  const totalFiltered = expenses.reduce((sum, exp) => sum + exp.amount, 0);

  return (
    <div className="space-y-6" data-testid="expenses-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Expenses</h1>
          <p className="text-slate-500">Track and manage all expenses</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowCategoryModal(true)}>
            <Tag className="w-4 h-4 mr-2" />
            Categories
          </Button>
          <Button onClick={() => setShowAddModal(true)} className="gap-2" data-testid="add-expense-btn">
            <Plus className="w-4 h-4" />
            Add Expense
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">This Month</p>
                  <p className="text-2xl font-bold text-slate-800">₹{stats.current_month_total.toLocaleString()}</p>
                </div>
                <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                  <Receipt className="w-6 h-6 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Last Month</p>
                  <p className="text-2xl font-bold text-slate-800">₹{stats.previous_month_total.toLocaleString()}</p>
                </div>
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-slate-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Change</p>
                  <p className={`text-2xl font-bold ${stats.change_percent >= 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {stats.change_percent >= 0 ? '+' : ''}{stats.change_percent}%
                  </p>
                </div>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${stats.change_percent >= 0 ? 'bg-red-100' : 'bg-emerald-100'}`}>
                  {stats.change_percent >= 0 ? (
                    <TrendingUp className="w-6 h-6 text-red-600" />
                  ) : (
                    <TrendingDown className="w-6 h-6 text-emerald-600" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Transactions</p>
                  <p className="text-2xl font-bold text-slate-800">{stats.expense_count}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <CreditCard className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex gap-2 flex-1">
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">Start Date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-40"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">End Date</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-40"
                />
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={paymentTypeFilter} onValueChange={setPaymentTypeFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Payment Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {PAYMENT_TYPES.map((pt) => (
                    <SelectItem key={pt.value} value={pt.value}>{pt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={paymentAccountFilter} onValueChange={setPaymentAccountFilter}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Payment Account" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Accounts</SelectItem>
                  {PAYMENT_ACCOUNTS.map((pa) => (
                    <SelectItem key={pa.value} value={pa.value}>{pa.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {(startDate || endDate || categoryFilter !== 'all' || paymentTypeFilter !== 'all' || paymentAccountFilter !== 'all') && (
            <div className="mt-4 pt-4 border-t flex items-center justify-between">
              <p className="text-sm text-slate-500">
                Showing {expenses.length} expenses • Total: <span className="font-semibold text-slate-800">₹{totalFiltered.toLocaleString()}</span>
              </p>
              <Button variant="ghost" size="sm" onClick={() => {
                setStartDate('');
                setEndDate('');
                setCategoryFilter('all');
                setPaymentTypeFilter('all');
                setPaymentAccountFilter('all');
              }}>
                Clear Filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Expenses List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        </div>
      ) : expenses.length > 0 ? (
        <div className="space-y-3">
          {expenses.map((expense) => {
            const PaymentIcon = getPaymentTypeIcon(expense.payment_type);
            return (
              <Card key={expense.id} className="card-hover" data-testid={`expense-card-${expense.id}`}>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        expense.is_auto_generated ? 'bg-amber-100' : 'bg-slate-100'
                      }`}>
                        {expense.transport_name ? (
                          <Truck className={`w-6 h-6 ${expense.is_auto_generated ? 'text-amber-600' : 'text-slate-600'}`} />
                        ) : (
                          <Receipt className="w-6 h-6 text-slate-600" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-slate-800">{expense.reason}</h3>
                          {expense.is_auto_generated && (
                            <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                              Auto
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-3 text-sm text-slate-500 mt-1">
                          <span className="flex items-center gap-1">
                            <Tag className="w-3 h-3" />
                            {expense.category_name}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(expense.date)}
                          </span>
                          <span className="flex items-center gap-1">
                            <PaymentIcon className="w-3 h-3" />
                            {getPaymentTypeLabel(expense.payment_type)}
                          </span>
                          <span>{getPaymentAccountLabel(expense.payment_account)}</span>
                          {expense.paid_by && (
                            <span className="text-slate-400">by {expense.paid_by}</span>
                          )}
                        </div>
                        {expense.transport_name && (
                          <p className="text-xs text-slate-400 mt-1">
                            Transport: {expense.transport_name} {expense.transport_location && `• ${expense.transport_location}`}
                            {expense.order_number && ` • Order #${expense.order_number}`}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="text-xl font-bold text-slate-800">₹{expense.amount.toLocaleString()}</p>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEditModal(expense)}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openDeleteModal(expense)} className="text-red-600 hover:text-red-700">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-16">
            <div className="flex flex-col items-center text-slate-400">
              <Receipt className="w-16 h-16 mb-4" />
              <h3 className="text-lg font-medium">No expenses found</h3>
              <p className="text-sm">Add your first expense to get started</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Expense Modal */}
      <Dialog open={showAddModal || showEditModal} onOpenChange={() => { setShowAddModal(false); setShowEditModal(false); resetForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{showEditModal ? 'Edit Expense' : 'Add New Expense'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Category *</Label>
              <Select value={formData.category_id} onValueChange={(v) => setFormData({...formData, category_id: v})}>
                <SelectTrigger data-testid="expense-category-select">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Amount *</Label>
                <Input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({...formData, amount: e.target.value})}
                  placeholder="0.00"
                  data-testid="expense-amount-input"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Payment Type</Label>
                <Select value={formData.payment_type} onValueChange={(v) => setFormData({...formData, payment_type: v})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_TYPES.map((pt) => (
                      <SelectItem key={pt.value} value={pt.value}>{pt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Payment Account</Label>
                <Select value={formData.payment_account} onValueChange={(v) => setFormData({...formData, payment_account: v})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_ACCOUNTS.map((pa) => (
                      <SelectItem key={pa.value} value={pa.value}>{pa.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {(formData.payment_account === 'admin_user' || formData.payment_account === 'employee_user') && (
              <div className="space-y-2">
                <Label>Paid By (Name)</Label>
                <Input
                  value={formData.paid_by}
                  onChange={(e) => setFormData({...formData, paid_by: e.target.value})}
                  placeholder="Enter name of person who paid"
                />
              </div>
            )}
            
            <div className="space-y-2">
              <Label>Reason / Description *</Label>
              <Textarea
                value={formData.reason}
                onChange={(e) => setFormData({...formData, reason: e.target.value})}
                placeholder="What was this expense for?"
                rows={3}
                data-testid="expense-reason-input"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddModal(false); setShowEditModal(false); resetForm(); }}>Cancel</Button>
            <Button onClick={showEditModal ? handleEditExpense : handleAddExpense} disabled={formLoading}>
              {formLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {showEditModal ? 'Update' : 'Add'} Expense
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category Management Modal */}
      <Dialog open={showCategoryModal} onOpenChange={setShowCategoryModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Expense Categories</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex gap-2">
              <Input
                value={newCategory.name}
                onChange={(e) => setNewCategory({...newCategory, name: e.target.value})}
                placeholder="New category name"
                className="flex-1"
              />
              <Button onClick={handleAddCategory} disabled={formLoading}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {categories.map((cat) => (
                <div key={cat.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <p className="font-medium text-slate-800">{cat.name}</p>
                    {cat.description && <p className="text-xs text-slate-500">{cat.description}</p>}
                  </div>
                  {!cat.is_default && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteCategory(cat.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                  {cat.is_default && (
                    <Badge variant="outline" className="text-xs">Default</Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600">Delete Expense</DialogTitle>
          </DialogHeader>
          <p className="py-4">
            Are you sure you want to delete this expense of <strong>₹{selectedExpense?.amount?.toLocaleString()}</strong>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
            <Button onClick={handleDeleteExpense} disabled={formLoading} className="bg-red-600 hover:bg-red-700">
              {formLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Expenses;
