import { useState, useEffect, useRef } from 'react';
import { expensesAPI, expenseCategoriesAPI, companyAPI } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Card, CardContent } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
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
  CreditCard,
  Banknote,
  Smartphone,
  Building2,
  Truck,
  Tag,
  Printer,
  FileText,
  Download,
  Filter
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

const MONTHS = [
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

// Generate years from 2020 to current year + 1
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: currentYear - 2019 }, (_, i) => ({
  value: String(2020 + i),
  label: String(2020 + i)
})).reverse();

export const Expenses = () => {
  const { user, isAdmin, hasPermission } = useAuth();
  const canAdd = isAdmin || hasPermission('expenses_add');
  const canEdit = isAdmin || hasPermission('expenses_edit');
  const canDelete = isAdmin || hasPermission('expenses_delete');
  const [expenses, setExpenses] = useState([]);
  const [allExpenses, setAllExpenses] = useState([]); // For print filtering
  const [categories, setCategories] = useState([]);
  const [stats, setStats] = useState(null);
  const [companySettings, setCompanySettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const printRef = useRef(null);
  
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
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [formLoading, setFormLoading] = useState(false);

  // Print options
  const [printOptions, setPrintOptions] = useState({
    filterType: 'all', // all, date_range, month_year
    startDate: '',
    endDate: '',
    month: '',
    year: String(currentYear),
    category: 'all',
    paymentAccount: 'all',
    paidBy: '',
  });

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
    fetchAllExpenses();
    fetchCompanySettings();
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

  const fetchAllExpenses = async () => {
    try {
      const response = await expensesAPI.getAll({});
      setAllExpenses(response.data);
    } catch (error) {
      console.error('Failed to fetch all expenses');
    }
  };

  const fetchCompanySettings = async () => {
    try {
      const response = await companyAPI.getSettings();
      setCompanySettings(response.data);
    } catch (error) {
      console.error('Failed to fetch company settings');
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
      fetchAllExpenses();
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
      fetchAllExpenses();
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
      fetchAllExpenses();
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

  // Get filtered expenses for print
  const getFilteredExpensesForPrint = () => {
    let filtered = [...allExpenses];
    
    // Filter by date
    if (printOptions.filterType === 'date_range') {
      if (printOptions.startDate) {
        filtered = filtered.filter(exp => exp.date >= printOptions.startDate);
      }
      if (printOptions.endDate) {
        filtered = filtered.filter(exp => exp.date <= printOptions.endDate);
      }
    } else if (printOptions.filterType === 'month_year') {
      if (printOptions.month && printOptions.year) {
        const monthStart = `${printOptions.year}-${printOptions.month}-01`;
        const lastDay = new Date(parseInt(printOptions.year), parseInt(printOptions.month), 0).getDate();
        const monthEnd = `${printOptions.year}-${printOptions.month}-${lastDay}`;
        filtered = filtered.filter(exp => exp.date >= monthStart && exp.date <= monthEnd);
      } else if (printOptions.year) {
        filtered = filtered.filter(exp => exp.date.startsWith(printOptions.year));
      }
    }
    
    // Filter by category
    if (printOptions.category !== 'all') {
      filtered = filtered.filter(exp => exp.category_id === printOptions.category);
    }
    
    // Filter by payment account
    if (printOptions.paymentAccount !== 'all') {
      filtered = filtered.filter(exp => exp.payment_account === printOptions.paymentAccount);
    }
    
    // Filter by paid by (user)
    if (printOptions.paidBy.trim()) {
      const searchTerm = printOptions.paidBy.toLowerCase();
      filtered = filtered.filter(exp => 
        exp.paid_by && exp.paid_by.toLowerCase().includes(searchTerm)
      );
    }
    
    return filtered;
  };

  const handlePrint = () => {
    const filteredExpenses = getFilteredExpensesForPrint();
    const printWindow = window.open('', '_blank');
    
    const companyName = companySettings?.company_name || 'Company Name';
    const companyAddress = companySettings?.address || '';
    const companyPhone = companySettings?.phone || '';
    
    // Build report title based on filters
    let reportPeriod = 'All Time';
    let filterDetails = [];
    
    if (printOptions.filterType === 'date_range') {
      if (printOptions.startDate && printOptions.endDate) {
        reportPeriod = `${formatDate(printOptions.startDate)} to ${formatDate(printOptions.endDate)}`;
      } else if (printOptions.startDate) {
        reportPeriod = `From ${formatDate(printOptions.startDate)}`;
      } else if (printOptions.endDate) {
        reportPeriod = `Until ${formatDate(printOptions.endDate)}`;
      }
    } else if (printOptions.filterType === 'month_year') {
      if (printOptions.month && printOptions.year) {
        const monthName = MONTHS.find(m => m.value === printOptions.month)?.label || '';
        reportPeriod = `${monthName} ${printOptions.year}`;
      } else if (printOptions.year) {
        reportPeriod = `Year ${printOptions.year}`;
      }
    }
    
    if (printOptions.category !== 'all') {
      const catName = categories.find(c => c.id === printOptions.category)?.name || 'Unknown';
      filterDetails.push(`Category: ${catName}`);
    }
    
    if (printOptions.paymentAccount !== 'all') {
      const accName = PAYMENT_ACCOUNTS.find(a => a.value === printOptions.paymentAccount)?.label || 'Unknown';
      filterDetails.push(`Account: ${accName}`);
    }
    
    if (printOptions.paidBy.trim()) {
      filterDetails.push(`Paid By: ${printOptions.paidBy}`);
    }
    
    const totalAmount = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    
    // Group by category for summary
    const byCategory = {};
    filteredExpenses.forEach(exp => {
      const cat = exp.category_name || 'Uncategorized';
      byCategory[cat] = (byCategory[cat] || 0) + exp.amount;
    });
    
    // Group by payment account for summary
    const byAccount = {};
    filteredExpenses.forEach(exp => {
      const acc = getPaymentAccountLabel(exp.payment_account);
      byAccount[acc] = (byAccount[acc] || 0) + exp.amount;
    });

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Expense Report - ${companyName}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 20px; color: #333; font-size: 12px; }
          .header { text-align: center; margin-bottom: 25px; border-bottom: 2px solid #333; padding-bottom: 15px; }
          .company-name { font-size: 22px; font-weight: bold; margin-bottom: 3px; }
          .company-details { font-size: 11px; color: #666; }
          .report-title { font-size: 16px; margin-top: 12px; font-weight: bold; }
          .report-meta { font-size: 11px; color: #666; margin-top: 5px; }
          .filters { font-size: 10px; color: #888; margin-top: 3px; }
          .summary-section { margin: 20px 0; }
          .summary-title { font-size: 13px; font-weight: bold; margin-bottom: 10px; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
          .summary-grid { display: flex; gap: 30px; flex-wrap: wrap; }
          .summary-box { flex: 1; min-width: 150px; padding: 12px; background: #f8f8f8; border-radius: 5px; }
          .summary-box-title { font-size: 10px; color: #666; text-transform: uppercase; }
          .summary-box-value { font-size: 18px; font-weight: bold; margin-top: 5px; }
          .breakdown { margin-top: 15px; }
          .breakdown-title { font-size: 11px; font-weight: bold; margin-bottom: 8px; }
          .breakdown-item { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dotted #ddd; }
          .breakdown-item:last-child { border-bottom: none; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background: #f0f0f0; font-weight: bold; font-size: 11px; }
          td { font-size: 11px; }
          tr:nth-child(even) { background: #fafafa; }
          .amount { text-align: right; font-weight: 500; }
          .total-row { font-weight: bold; background: #e8e8e8 !important; }
          .total-row td { font-size: 12px; }
          .footer { margin-top: 25px; text-align: center; font-size: 10px; color: #666; border-top: 1px solid #ddd; padding-top: 12px; }
          .badge { display: inline-block; padding: 2px 6px; border-radius: 8px; font-size: 9px; }
          .badge-auto { background: #fef3c7; color: #92400e; }
          @media print { 
            body { padding: 10px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-name">${companyName}</div>
          ${companyAddress ? `<div class="company-details">${companyAddress}</div>` : ''}
          ${companyPhone ? `<div class="company-details">Phone: ${companyPhone}</div>` : ''}
          <div class="report-title">EXPENSE REPORT</div>
          <div class="report-meta">Period: ${reportPeriod}</div>
          ${filterDetails.length > 0 ? `<div class="filters">${filterDetails.join(' | ')}</div>` : ''}
        </div>
        
        <div class="summary-section">
          <div class="summary-title">Summary</div>
          <div class="summary-grid">
            <div class="summary-box">
              <div class="summary-box-title">Total Expenses</div>
              <div class="summary-box-value">₹${totalAmount.toLocaleString()}</div>
            </div>
            <div class="summary-box">
              <div class="summary-box-title">Transactions</div>
              <div class="summary-box-value">${filteredExpenses.length}</div>
            </div>
          </div>
          
          <div style="display: flex; gap: 30px; margin-top: 15px;">
            <div class="breakdown" style="flex: 1;">
              <div class="breakdown-title">By Category</div>
              ${Object.entries(byCategory).map(([cat, amt]) => `
                <div class="breakdown-item">
                  <span>${cat}</span>
                  <span>₹${amt.toLocaleString()}</span>
                </div>
              `).join('')}
            </div>
            <div class="breakdown" style="flex: 1;">
              <div class="breakdown-title">By Payment Account</div>
              ${Object.entries(byAccount).map(([acc, amt]) => `
                <div class="breakdown-item">
                  <span>${acc}</span>
                  <span>₹${amt.toLocaleString()}</span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th style="width: 4%">#</th>
              <th style="width: 10%">Date</th>
              <th style="width: 14%">Category</th>
              <th style="width: 28%">Reason</th>
              <th style="width: 10%">Type</th>
              <th style="width: 14%">Account</th>
              <th style="width: 10%">Paid By</th>
              <th style="width: 10%" class="amount">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${filteredExpenses.map((exp, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td>${formatDate(exp.date)}</td>
                <td>${exp.category_name}${exp.is_auto_generated ? ' <span class="badge badge-auto">Auto</span>' : ''}</td>
                <td>${exp.reason}${exp.transport_name ? `<br><small style="color:#666">Transport: ${exp.transport_name}</small>` : ''}</td>
                <td>${getPaymentTypeLabel(exp.payment_type)}</td>
                <td>${getPaymentAccountLabel(exp.payment_account)}</td>
                <td>${exp.paid_by || '-'}</td>
                <td class="amount">₹${exp.amount.toLocaleString()}</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td colspan="7" style="text-align: right;">TOTAL</td>
              <td class="amount">₹${totalAmount.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
        
        <div class="footer">
          <p>This is a computer-generated report. No signature required.</p>
          <p>${companyName} | Generated on ${new Date().toLocaleString()}</p>
        </div>
      </body>
      </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
      printWindow.print();
      setShowPrintModal(false);
    }, 300);
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

  const resetPrintOptions = () => {
    setPrintOptions({
      filterType: 'all',
      startDate: '',
      endDate: '',
      month: '',
      year: String(currentYear),
      category: 'all',
      paymentAccount: 'all',
      paidBy: '',
    });
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

  // Get unique paid_by users for suggestions
  const uniqueUsers = [...new Set(allExpenses.filter(e => e.paid_by).map(e => e.paid_by))];

  return (
    <div className="space-y-6" data-testid="expenses-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Expenses</h1>
          <p className="text-slate-500">Track and manage all expenses</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setShowPrintModal(true)} className="gap-2" data-testid="print-btn">
            <Printer className="w-4 h-4" />
            Print Report
          </Button>
          {canAdd && (
            <>
              <Button variant="outline" onClick={() => setShowCategoryModal(true)}>
                <Tag className="w-4 h-4 mr-2" />
                Categories
              </Button>
              <Button onClick={() => setShowAddModal(true)} className="gap-2" data-testid="add-expense-btn">
                <Plus className="w-4 h-4" />
                Add Expense
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">This Month</p>
                  <p className="text-2xl font-bold text-slate-800">₹{stats.current_month_total.toLocaleString()}</p>
                </div>
                <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                  <Receipt className="w-5 h-5 text-emerald-600" />
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
                <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-slate-600" />
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
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${stats.change_percent >= 0 ? 'bg-red-100' : 'bg-emerald-100'}`}>
                  {stats.change_percent >= 0 ? (
                    <TrendingUp className="w-5 h-5 text-red-600" />
                  ) : (
                    <TrendingDown className="w-5 h-5 text-emerald-600" />
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
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-blue-600" />
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
            <div className="flex gap-2 flex-1 flex-wrap">
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">Start Date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-36"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">End Date</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-36"
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
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Account" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Accounts</SelectItem>
                  {PAYMENT_ACCOUNTS.map((pa) => (
                    <SelectItem key={pa.value} value={pa.value}>{pa.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {(startDate || endDate || categoryFilter !== 'all' || paymentTypeFilter !== 'all' || paymentAccountFilter !== 'all') && (
                <Button variant="ghost" size="sm" onClick={() => {
                  setStartDate('');
                  setEndDate('');
                  setCategoryFilter('all');
                  setPaymentTypeFilter('all');
                  setPaymentAccountFilter('all');
                }} className="text-slate-500">
                  Clear
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Expenses Table */}
      <Card ref={printRef}>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
          ) : expenses.length > 0 ? (
            <>
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="w-[50px] text-center">#</TableHead>
                      <TableHead className="w-[100px]">Date</TableHead>
                      <TableHead className="w-[140px]">Category</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead className="w-[100px]">Type</TableHead>
                      <TableHead className="w-[130px]">Account</TableHead>
                      <TableHead className="w-[110px] text-right">Amount</TableHead>
                      <TableHead className="w-[80px] text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenses.map((expense, index) => (
                      <TableRow key={expense.id} className="hover:bg-slate-50" data-testid={`expense-row-${expense.id}`}>
                        <TableCell className="text-center text-slate-500">{index + 1}</TableCell>
                        <TableCell className="font-medium">{formatDate(expense.date)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span>{expense.category_name}</span>
                            {expense.is_auto_generated && (
                              <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                                Auto
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <span>{expense.reason}</span>
                            {expense.transport_name && (
                              <p className="text-xs text-slate-400 mt-0.5">
                                <Truck className="w-3 h-3 inline mr-1" />
                                {expense.transport_name} {expense.transport_location && `• ${expense.transport_location}`}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-normal">
                            {getPaymentTypeLabel(expense.payment_type)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div>
                            <span className="text-sm">{getPaymentAccountLabel(expense.payment_account)}</span>
                            {expense.paid_by && (
                              <p className="text-xs text-slate-400">by {expense.paid_by}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-semibold">₹{expense.amount.toLocaleString()}</TableCell>
                        <TableCell>
                          <div className="flex justify-center gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openEditModal(expense)} className="h-8 w-8 p-0">
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => openDeleteModal(expense)} className="h-8 w-8 p-0 text-red-600 hover:text-red-700">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Total Row */}
                    <TableRow className="bg-slate-100 font-semibold">
                      <TableCell colSpan={6} className="text-right">TOTAL</TableCell>
                      <TableCell className="text-right text-lg">₹{totalFiltered.toLocaleString()}</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
              <p className="text-sm text-slate-500 mt-4">
                Showing {expenses.length} expense{expenses.length !== 1 ? 's' : ''}
              </p>
            </>
          ) : (
            <div className="flex flex-col items-center text-slate-400 py-12">
              <Receipt className="w-16 h-16 mb-4" />
              <h3 className="text-lg font-medium">No expenses found</h3>
              <p className="text-sm">Add your first expense to get started</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Print Options Modal */}
      <Dialog open={showPrintModal} onOpenChange={(open) => { setShowPrintModal(open); if (!open) resetPrintOptions(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="w-5 h-5" />
              Print Expense Report
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-4">
            {/* Period Selection */}
            <div className="space-y-3">
              <Label className="font-medium">Report Period</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={printOptions.filterType === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPrintOptions({...printOptions, filterType: 'all'})}
                >
                  All Time
                </Button>
                <Button
                  type="button"
                  variant={printOptions.filterType === 'date_range' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPrintOptions({...printOptions, filterType: 'date_range'})}
                >
                  Date Range
                </Button>
                <Button
                  type="button"
                  variant={printOptions.filterType === 'month_year' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPrintOptions({...printOptions, filterType: 'month_year'})}
                >
                  Month/Year
                </Button>
              </div>
              
              {printOptions.filterType === 'date_range' && (
                <div className="flex gap-3 mt-3">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs text-slate-500">Start Date</Label>
                    <Input
                      type="date"
                      value={printOptions.startDate}
                      onChange={(e) => setPrintOptions({...printOptions, startDate: e.target.value})}
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs text-slate-500">End Date</Label>
                    <Input
                      type="date"
                      value={printOptions.endDate}
                      onChange={(e) => setPrintOptions({...printOptions, endDate: e.target.value})}
                    />
                  </div>
                </div>
              )}
              
              {printOptions.filterType === 'month_year' && (
                <div className="flex gap-3 mt-3">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs text-slate-500">Month</Label>
                    <Select value={printOptions.month} onValueChange={(v) => setPrintOptions({...printOptions, month: v})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select month" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All Months</SelectItem>
                        {MONTHS.map((m) => (
                          <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs text-slate-500">Year</Label>
                    <Select value={printOptions.year} onValueChange={(v) => setPrintOptions({...printOptions, year: v})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select year" />
                      </SelectTrigger>
                      <SelectContent>
                        {YEARS.map((y) => (
                          <SelectItem key={y.value} value={y.value}>{y.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>

            {/* Category Filter */}
            <div className="space-y-2">
              <Label className="font-medium">Category</Label>
              <Select value={printOptions.category} onValueChange={(v) => setPrintOptions({...printOptions, category: v})}>
                <SelectTrigger>
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Payment Account Filter */}
            <div className="space-y-2">
              <Label className="font-medium">Payment Account</Label>
              <Select value={printOptions.paymentAccount} onValueChange={(v) => setPrintOptions({...printOptions, paymentAccount: v})}>
                <SelectTrigger>
                  <SelectValue placeholder="All Accounts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Accounts</SelectItem>
                  {PAYMENT_ACCOUNTS.map((pa) => (
                    <SelectItem key={pa.value} value={pa.value}>{pa.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Paid By (User) Filter */}
            <div className="space-y-2">
              <Label className="font-medium">Paid By (User)</Label>
              <Input
                value={printOptions.paidBy}
                onChange={(e) => setPrintOptions({...printOptions, paidBy: e.target.value})}
                placeholder="Enter name to filter by user"
                list="paid-by-suggestions"
              />
              {uniqueUsers.length > 0 && (
                <datalist id="paid-by-suggestions">
                  {uniqueUsers.map((user, idx) => (
                    <option key={idx} value={user} />
                  ))}
                </datalist>
              )}
              <p className="text-xs text-slate-400">Leave empty to include all users</p>
            </div>

            {/* Preview */}
            <div className="bg-slate-50 p-3 rounded-lg">
              <p className="text-sm font-medium text-slate-700">Preview</p>
              <p className="text-xs text-slate-500 mt-1">
                {getFilteredExpensesForPrint().length} expense(s) • 
                Total: ₹{getFilteredExpensesForPrint().reduce((sum, exp) => sum + exp.amount, 0).toLocaleString()}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowPrintModal(false); resetPrintOptions(); }}>Cancel</Button>
            <Button onClick={handlePrint} className="gap-2">
              <Printer className="w-4 h-4" />
              Print Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
