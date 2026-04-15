import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth APIs
export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  getMe: () => api.get('/auth/me'),
};

// Doctors APIs
export const doctorsAPI = {
  getAll: (params) => api.get('/doctors', { params }),
  getOne: (id) => api.get(`/doctors/${id}`),
  create: (data) => api.post('/doctors', data),
  update: (id, data) => api.put(`/doctors/${id}`, data),
  delete: (id) => api.delete(`/doctors/${id}`),
  bulkDelete: (ids) => api.post('/doctors/bulk-delete', ids),
  updateContact: (id) => api.put(`/doctors/${id}/contact`),
  // Notes
  getNotes: (id) => api.get(`/doctors/${id}/notes`),
  addNote: (id, data) => api.post(`/doctors/${id}/notes`, data),
  deleteNote: (id, noteId) => api.delete(`/doctors/${id}/notes/${noteId}`),
};

// Tasks APIs
export const tasksAPI = {
  getAll: (params) => api.get('/tasks', { params }),
  create: (data) => api.post('/tasks', data),
  update: (id, data) => api.put(`/tasks/${id}`, data),
  delete: (id) => api.delete(`/tasks/${id}`),
};

// Medicals APIs
export const medicalsAPI = {
  getAll: (params) => api.get('/medicals', { params }),
  getOne: (id) => api.get(`/medicals/${id}`),
  create: (data) => api.post('/medicals', data),
  update: (id, data) => api.put(`/medicals/${id}`, data),
  delete: (id) => api.delete(`/medicals/${id}`),
  bulkDelete: (ids) => api.post('/medicals/bulk-delete', ids),
  updateContact: (id) => api.put(`/medicals/${id}/contact`),
  // Notes
  getNotes: (id) => api.get(`/medicals/${id}/notes`),
  addNote: (id, data) => api.post(`/medicals/${id}/notes`, data),
  deleteNote: (id, noteId) => api.delete(`/medicals/${id}/notes/${noteId}`),
};

// Agencies APIs
export const agenciesAPI = {
  getAll: (params) => api.get('/agencies', { params }),
  getOne: (id) => api.get(`/agencies/${id}`),
  create: (data) => api.post('/agencies', data),
  update: (id, data) => api.put(`/agencies/${id}`, data),
  delete: (id) => api.delete(`/agencies/${id}`),
  bulkDelete: (ids) => api.post('/agencies/bulk-delete', ids),
  updateContact: (id) => api.put(`/agencies/${id}/contact`),
  // Notes
  getNotes: (id) => api.get(`/agencies/${id}/notes`),
  addNote: (id, data) => api.post(`/agencies/${id}/notes`, data),
  deleteNote: (id, noteId) => api.delete(`/agencies/${id}/notes/${noteId}`),
};

// Reminders APIs
export const remindersAPI = {
  getAll: (params) => api.get('/reminders', { params }),
  getToday: () => api.get('/reminders/today'),
  create: (data) => api.post('/reminders', data),
  update: (id, data) => api.put(`/reminders/${id}`, data),
  delete: (id) => api.delete(`/reminders/${id}`),
  markComplete: (id) => api.post(`/reminders/${id}/complete`),
  sendWhatsAppSummary: () => api.post('/reminders/send-whatsapp-summary'),
};

// Followup APIs
export const followupsAPI = {
  create: (data) => api.post('/followups', data),
  getHistory: (entityType, entityId) => api.get(`/followups/${entityType}/${entityId}`),
};

// Greeting Template APIs
export const greetingTemplatesAPI = {
  getAll: (params) => api.get('/greeting-templates', { params }),
  create: (data) => api.post('/greeting-templates', data),
  update: (id, data) => api.put(`/greeting-templates/${id}`, data),
  delete: (id) => api.delete(`/greeting-templates/${id}`),
  testSend: (params) => api.post('/greeting-templates/test-send', null, { params }),
  getLogs: (limit) => api.get('/greeting-logs', { params: { limit } }),
};

// SMTP Config APIs
export const smtpAPI = {
  getConfig: () => api.get('/smtp-config'),
  saveConfig: (data) => api.post('/smtp-config', data),
};

// Email APIs
export const emailAPI = {
  send: (data) => api.post('/send-email', data),
  getLogs: () => api.get('/email-logs'),
};

// Dashboard APIs
export const dashboardAPI = {
  getStats: () => api.get('/dashboard/stats'),
  getComprehensiveStats: () => api.get('/dashboard/comprehensive-stats'),
};

export const analyticsAPI = {
  getReports: (period = '6months') => api.get('/analytics/reports', { params: { period } }),
};

// Items APIs
export const itemsAPI = {
  getAll: (params) => api.get('/items', { params }),
  getOne: (id) => api.get(`/items/${id}`),
  create: (data) => api.post('/items', data),
  update: (id, data) => api.put(`/items/${id}`, data),
  delete: (id) => api.delete(`/items/${id}`),
  deleteImage: (id) => api.delete(`/items/${id}/image`),
  toggleStock: (id, outOfStock) => api.patch(`/items/${id}/stock`, { out_of_stock: outOfStock }),
  toggleVisibility: (id, isHidden) => api.patch(`/items/${id}/visibility`, { is_hidden: isHidden }),
  downloadImages: () => api.get('/items/images/download', { responseType: 'blob' }),
  getCategories: () => api.get('/item-categories'),
  // Bulk import
  getImportTemplate: () => api.get('/items/import/template', { responseType: 'blob' }),
  bulkImport: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/items/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  // Export
  exportPDF: (mainCategory, role) => api.get('/items/export/pdf', { params: { ...(mainCategory ? { main_category: mainCategory } : {}), ...(role ? { role } : {}) }, responseType: 'blob' }),
  exportExcel: (mainCategory, role) => api.get('/items/export/excel', { params: { ...(mainCategory ? { main_category: mainCategory } : {}), ...(role ? { role } : {}) }, responseType: 'blob' }),
  // Subcategory order
  getSubcategoryOrder: () => api.get('/subcategory-order'),
  updateSubcategoryOrder: (order) => api.put('/subcategory-order', { order }),
};

// Company Settings APIs
export const companyAPI = {
  getSettings: () => api.get('/company-settings'),
  saveSettings: (data) => api.post('/company-settings', data),
};

// Message Templates APIs
export const templatesAPI = {
  getAll: (category) => api.get('/message-templates', { params: category ? { category } : {} }),
  update: (key, data) => api.put(`/message-templates/${key}`, data),
  reset: (key) => api.post(`/message-templates/${key}/reset`),
};

// Orders APIs
export const ordersAPI = {
  getAll: (params) => api.get('/orders', { params }),
  create: (data) => api.post('/orders', data),
  updateStatus: (id, data) => api.put(`/orders/${id}/status`, data),
  updateTransport: (id, data) => api.put(`/orders/${id}/transport`, data),
  updateItems: (id, data) => api.put(`/orders/${id}/items`, data),
  updateCustomer: (id, data) => api.put(`/orders/${id}/customer`, data),
  delete: (id) => api.delete(`/orders/${id}`),
  lookupDoctor: (id) => api.get(`/orders/${id}/lookup-doctor`),
  searchCustomers: (q) => api.get('/customers/search', { params: { q } }),
  approveCancel: (id, data) => api.post(`/orders/${id}/approve-cancel`, data),
};

// Pending Items APIs
export const pendingItemsAPI = {
  getAll: () => api.get('/pending-items'),
  getStats: () => api.get('/pending-items/stats'),
  getByDoctor: (phone) => api.get(`/pending-items/doctor/${phone}`),
  getByItem: () => api.get('/pending-items/by-item'),
  delete: (id) => api.delete(`/pending-items/${id}`),
  notifyStockArrivedByItem: (itemCode) => api.post(`/pending-items/notify-stock-arrived/${itemCode}`),
  notifyStockArrivedSingle: (pendingId) => api.post(`/pending-items/${pendingId}/notify-stock-arrived`),
};

// Transport APIs
export const transportAPI = {
  getAll: () => api.get('/transports'),
  create: (data) => api.post('/transports', data),
  update: (id, data) => api.put(`/transports/${id}`, data),
  delete: (id) => api.delete(`/transports/${id}`),
};

// Expense APIs
export const expensesAPI = {
  getAll: (params) => api.get('/expenses', { params }),
  getOne: (id) => api.get(`/expenses/${id}`),
  create: (data) => api.post('/expenses', data),
  update: (id, data) => api.put(`/expenses/${id}`, data),
  delete: (id) => api.delete(`/expenses/${id}`),
  getMonthlyStats: () => api.get('/expenses/stats/monthly'),
};

// Expense Categories APIs
export const expenseCategoriesAPI = {
  getAll: () => api.get('/expense-categories'),
  create: (data) => api.post('/expense-categories', data),
  delete: (id) => api.delete(`/expense-categories/${id}`),
};

// WhatsApp Config APIs
export const whatsappAPI = {
  getConfig: () => api.get('/whatsapp-config'),
  getAllConfigs: () => api.get('/whatsapp-configs'),
  saveConfig: (data) => api.post('/whatsapp-config', data),
  updateConfig: (id, data) => api.put(`/whatsapp-config/${id}`, data),
  deleteConfig: (id) => api.delete(`/whatsapp-config/${id}`),
  activateConfig: (id) => api.put(`/whatsapp-config/${id}/activate`),
  testConfig: (mobile) => api.post(`/whatsapp-config/test?mobile=${mobile}`),
  testSpecificConfig: (id, mobile) => api.post(`/whatsapp-config/${id}/test?mobile=${mobile}`),
  sendDirect: (data) => api.post('/whatsapp/send-direct', data),
};

// Fallback OTP APIs
export const fallbackOTPAPI = {
  getAll: () => api.get('/fallback-otps'),
  create: (data) => api.post('/fallback-otps', data),
  toggle: (id) => api.put(`/fallback-otps/${id}/toggle`),
  delete: (id) => api.delete(`/fallback-otps/${id}`),
};

// WhatsApp Logs APIs
export const whatsappLogsAPI = {
  getAll: (params) => api.get('/whatsapp-logs', { params }),
  getStats: () => api.get('/whatsapp-logs/stats'),
  delete: (id) => api.delete(`/whatsapp-logs/${id}`),
  clearAll: () => api.delete('/whatsapp-logs'),
};

// Users Management APIs
export const usersAPI = {
  getAll: () => api.get('/users'),
  getOne: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
};

// Portal Customers APIs
export const portalCustomersAPI = {
  getAll: (params) => api.get('/customers', { params }),
  approve: (id, data) => api.put(`/customers/${id}/approve`, data),
};

// Support Tickets APIs  
export const supportAPI = {
  getTickets: (params) => api.get('/support/tickets', { params }),
  updateStatus: (id, status) => api.put(`/support/tickets/${id}/status?status=${status}`),
  addReply: (id, data) => api.post(`/support/tickets/${id}/reply`, data),
};

// Marketing APIs
export const marketingAPI = {
  // Templates
  getTemplates: () => api.get('/marketing/templates'),
  createTemplate: (data) => api.post('/marketing/templates', data),
  updateTemplate: (id, data) => api.put(`/marketing/templates/${id}`, data),
  deleteTemplate: (id) => api.delete(`/marketing/templates/${id}`),
  // Recipients
  getRecipients: (params) => api.get('/marketing/recipients', { params }),
  // Campaigns
  getCampaigns: (params) => api.get('/marketing/campaigns', { params }),
  getCampaign: (id) => api.get(`/marketing/campaigns/${id}`),
  createCampaign: (data) => api.post('/marketing/campaigns', data),
  sendCampaign: (id) => api.post(`/marketing/campaigns/${id}/send`),
  cancelCampaign: (id) => api.post(`/marketing/campaigns/${id}/cancel`),
  deleteCampaign: (id) => api.delete(`/marketing/campaigns/${id}`),
  getStats: () => api.get('/marketing/stats'),
};

// Public APIs (no auth required)
export const publicAPI = {
  getCompanySettings: () => axios.get(`${API_URL}/api/public/company-settings`),
  getItems: (params) => axios.get(`${API_URL}/api/public/items`, { params }),
  getCategories: () => axios.get(`${API_URL}/api/public/categories`),
  getDoctorByMobile: (mobile) => axios.get(`${API_URL}/api/public/doctor/${mobile}`),
  sendOTP: (data) => axios.post(`${API_URL}/api/public/send-otp`, data),
  verifyOTP: (data) => axios.post(`${API_URL}/api/public/verify-otp`, data),
};

// Catalogue settings API
export const catalogueAPI = {
  get: () => api.get('/catalogue-settings'),
  update: (catalogues) => api.put('/catalogue-settings', { catalogues }),
};

// Payment & Ledger APIs
export const paymentsAPI = {
  create: (data) => api.post('/payments', data),
  getAll: (params) => api.get('/payments', { params }),
  update: (id, data) => api.put(`/payments/${id}`, data),
  delete: (id) => api.delete(`/payments/${id}`),
  sendWhatsApp: (id) => api.post(`/payments/${id}/whatsapp`),
  sendReminder: (data) => api.post('/payments/send-reminder', data),
  getLedger: (customerType, customerId, params) => api.get(`/ledger/${customerType}/${customerId}`, { params }),
  updateOpeningBalance: (customerType, customerId, data) => api.put(`/customer-opening-balance/${customerType}/${customerId}`, data),
  getOutstanding: (params) => api.get('/outstanding', { params }),
  getAllCustomerLedgers: (params) => api.get('/all-customer-ledgers', { params }),
  exportLedgerPDF: (customerType, customerId, params) => api.get(`/ledger/export/pdf/${customerType}/${customerId}`, { params, responseType: 'blob' }),
  sendLedgerWhatsApp: (customerType, customerId, params) => api.post(`/ledger/${customerType}/${customerId}/whatsapp`, null, { params }),
};

// MR (Medical Representative) APIs
export const mrAPI = {
  getAll: (params) => api.get('/mrs', { params }),
  getOne: (id) => api.get(`/mrs/${id}`),
  create: (data) => api.post('/mrs', data),
  update: (id, data) => api.put(`/mrs/${id}`, data),
  delete: (id) => api.delete(`/mrs/${id}`),
};

// Visual Aid APIs
export const visualAidAPI = {
  getDecks: (params) => api.get('/visual-aids', { params }),
  getDeck: (id) => api.get(`/visual-aids/${id}`),
  createDeck: (data) => api.post('/visual-aids', data),
  updateDeck: (id, data) => api.put(`/visual-aids/${id}`, data),
  deleteDeck: (id) => api.delete(`/visual-aids/${id}`),
  addSlide: (deckId, data) => api.post(`/visual-aids/${deckId}/slides`, data),
  updateSlide: (deckId, slideId, data) => api.put(`/visual-aids/${deckId}/slides/${slideId}`, data),
  deleteSlide: (deckId, slideId) => api.delete(`/visual-aids/${deckId}/slides/${slideId}`),
  reorderSlides: (deckId, slideIds) => api.put(`/visual-aids/${deckId}/slides/reorder`, { slide_ids: slideIds }),
};

// MR Reports APIs
export const mrReportsAPI = {
  getReports: (params) => api.get('/mr-reports', { params }),
};

// Location APIs (public, no auth required)
export const locationAPI = {
  getStates: () => axios.get(`${API_URL}/api/public/states`),
  getDistricts: (state) => axios.get(`${API_URL}/api/public/districts/${encodeURIComponent(state)}`),
};

// Database Management APIs
export const databaseAPI = {
  getBackupSettings: () => api.get('/database/backup-settings'),
  updateBackupSettings: (data) => api.put('/database/backup-settings', data),
  getBackupHistory: () => api.get('/database/backup-history'),
  exportDatabase: () => api.get('/database/export'),
  triggerBackup: () => api.post('/database/trigger-backup'),
  factoryReset: () => api.post('/database/factory-reset'),
  sendEmailBackup: () => api.post('/database/send-email-backup'),
  deleteEmailLogs: () => api.delete('/email-logs'),
  deleteWhatsappLogs: () => api.delete('/whatsapp-logs'),
  restoreDatabase: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/database/restore', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  restoreDatabaseReplace: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/database/restore-replace', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
};

// Stock & Inventory APIs
export const stockAPI = {
  // Suppliers
  getSuppliers: () => api.get('/suppliers'),
  createSupplier: (data) => api.post('/suppliers', data),
  updateSupplier: (id, data) => api.put(`/suppliers/${id}`, data),
  deleteSupplier: (id) => api.delete(`/suppliers/${id}`),
  
  // Opening Balance
  getOpeningBalances: () => api.get('/stock/opening-balances'),
  setOpeningBalance: (data) => api.post('/stock/opening-balance', data),
  setOpeningBalanceBulk: (data) => api.post('/stock/opening-balance/bulk', data),
  
  // Purchases
  getPurchases: (params) => api.get('/stock/purchases', { params }),
  createPurchase: (data) => api.post('/stock/purchase', data),
  
  // Returns
  createPurchaseReturn: (data) => api.post('/stock/purchase-return', data),
  createSalesReturn: (data) => api.post('/stock/sales-return', data),
  getSalesReturns: () => api.get('/stock/sales-returns'),
  getCustomerOrders: (params) => api.get('/stock/customer-orders', { params }),
  // Stock Issues
  createStockIssue: (data) => api.post('/stock/issue', data),
  getStockIssues: () => api.get('/stock/issues'),
  // Edit/Delete transactions
  updateTransaction: (id, data) => api.put(`/stock/transaction/${id}`, data),
  deleteTransaction: (id) => api.delete(`/stock/transaction/${id}`),
  // Opening balance delete
  deleteOpeningBalance: (itemId) => api.delete(`/stock/opening-balance/${itemId}`),
  // Last selling rates for a customer
  getLastRates: (phone) => api.get('/stock/last-rates', { params: { phone } }),
  
  // Stock Status & Reports
  getStockStatus: (params) => api.get('/stock/status', { params }),
  getItemLedger: (itemId) => api.get(`/stock/item-ledger/${itemId}`),
  getUserLedger: (params) => api.get('/stock/user-ledger', { params }),
  getAvailability: () => api.get('/stock/availability'),
  getPeriodReport: (params) => api.get('/stock/period-report', { params }),
};

// Partner Reports APIs
export const partnersAPI = {
  getAll: () => api.get('/partners'),
  create: (data) => api.post('/partners', data),
  update: (id, data) => api.put(`/partners/${id}`, data),
  delete: (id) => api.delete(`/partners/${id}`),
  previewReport: (data) => api.post('/partner-reports/preview', data),
  sendReport: (data) => api.post('/partner-reports/send', data),
  getHistory: () => api.get('/partner-reports/history'),
  getSettings: () => api.get('/partner-reports/settings'),
  updateSettings: (data) => api.put('/partner-reports/settings', data),
};


export default api;
