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
};

// Items APIs
export const itemsAPI = {
  getAll: (params) => api.get('/items', { params }),
  getOne: (id) => api.get(`/items/${id}`),
  create: (data) => api.post('/items', data),
  update: (id, data) => api.put(`/items/${id}`, data),
  delete: (id) => api.delete(`/items/${id}`),
  deleteImage: (id) => api.delete(`/items/${id}/image`),
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
};

// Company Settings APIs
export const companyAPI = {
  getSettings: () => api.get('/company-settings'),
  saveSettings: (data) => api.post('/company-settings', data),
};

// Orders APIs
export const ordersAPI = {
  getAll: (params) => api.get('/orders', { params }),
  create: (data) => api.post('/orders', data),
  updateStatus: (id, data) => api.put(`/orders/${id}/status`, data),
  updateTransport: (id, data) => api.put(`/orders/${id}/transport`, data),
  updateItems: (id, data) => api.put(`/orders/${id}/items`, data),
  updateCustomer: (id, data) => api.put(`/orders/${id}/customer`, data),
  lookupDoctor: (id) => api.get(`/orders/${id}/lookup-doctor`),
  searchCustomers: (q) => api.get('/customers/search', { params: { q } }),
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
  saveConfig: (data) => api.post('/whatsapp-config', data),
  testConfig: (mobile) => api.post(`/whatsapp-config/test?mobile=${mobile}`),
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

// Public APIs (no auth required)
export const publicAPI = {
  getCompanySettings: () => axios.get(`${API_URL}/api/public/company-settings`),
  getItems: (params) => axios.get(`${API_URL}/api/public/items`, { params }),
  getCategories: () => axios.get(`${API_URL}/api/public/categories`),
  getDoctorByMobile: (mobile) => axios.get(`${API_URL}/api/public/doctor/${mobile}`),
  sendOTP: (data) => axios.post(`${API_URL}/api/public/send-otp`, data),
  verifyOTP: (data) => axios.post(`${API_URL}/api/public/verify-otp`, data),
};

// Location APIs (public, no auth required)
export const locationAPI = {
  getStates: () => axios.get(`${API_URL}/api/public/states`),
  getDistricts: (state) => axios.get(`${API_URL}/api/public/districts/${encodeURIComponent(state)}`),
};

export default api;
