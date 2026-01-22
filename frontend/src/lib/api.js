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
};

// Company Settings APIs
export const companyAPI = {
  getSettings: () => api.get('/company-settings'),
  saveSettings: (data) => api.post('/company-settings', data),
};

// Orders APIs
export const ordersAPI = {
  getAll: (params) => api.get('/orders', { params }),
  updateStatus: (id, data) => api.put(`/orders/${id}/status`, data),
  updateTransport: (id, data) => api.put(`/orders/${id}/transport`, data),
  updateItems: (id, data) => api.put(`/orders/${id}/items`, data),
  updateCustomer: (id, data) => api.put(`/orders/${id}/customer`, data),
  lookupDoctor: (id) => api.get(`/orders/${id}/lookup-doctor`),
};

// Pending Items APIs
export const pendingItemsAPI = {
  getAll: () => api.get('/pending-items'),
  getStats: () => api.get('/pending-items/stats'),
  getByDoctor: (phone) => api.get(`/pending-items/doctor/${phone}`),
  delete: (id) => api.delete(`/pending-items/${id}`),
};

// Transport APIs
export const transportAPI = {
  getAll: () => api.get('/transports'),
  create: (data) => api.post('/transports', data),
  delete: (id) => api.delete(`/transports/${id}`),
};

// WhatsApp Config APIs
export const whatsappAPI = {
  getConfig: () => api.get('/whatsapp-config'),
  saveConfig: (data) => api.post('/whatsapp-config', data),
  testConfig: (mobile) => api.post(`/whatsapp-config/test?mobile=${mobile}`),
};

// Public APIs (no auth required)
export const publicAPI = {
  getCompanySettings: () => axios.get(`${API_URL}/api/public/company-settings`),
  getItems: () => axios.get(`${API_URL}/api/public/items`),
  getDoctorByMobile: (mobile) => axios.get(`${API_URL}/api/public/doctor/${mobile}`),
  sendOTP: (data) => axios.post(`${API_URL}/api/public/send-otp`, data),
  verifyOTP: (data) => axios.post(`${API_URL}/api/public/verify-otp`, data),
};

export default api;
