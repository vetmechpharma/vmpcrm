import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const mrApi = axios.create({ baseURL: `${API_URL}/api` });

// Request interceptor - attach token
mrApi.interceptors.request.use(config => {
  const token = localStorage.getItem('mr_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const MRAuthContext = createContext(null);

export const useMRAuth = () => {
  const ctx = useContext(MRAuthContext);
  if (!ctx) throw new Error('useMRAuth must be used within MRAuthProvider');
  return ctx;
};

export const MRAuthProvider = ({ children }) => {
  const [mr, setMR] = useState(null);
  const [loading, setLoading] = useState(true);

  const clearSession = useCallback(() => {
    localStorage.removeItem('mr_token');
    localStorage.removeItem('mr_user');
    setMR(null);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('mr_token');
    const stored = localStorage.getItem('mr_user');

    if (token && stored) {
      // Restore session immediately from localStorage
      try { setMR(JSON.parse(stored)); } catch { /* ignore parse error */ }

      // Validate token in background — only clear on 401, not on network errors
      mrApi.get('/mr/me')
        .then(res => {
          setMR(res.data);
          localStorage.setItem('mr_user', JSON.stringify(res.data));
        })
        .catch(err => {
          const status = err?.response?.status;
          if (status === 401 || status === 403) {
            // Token expired or account deactivated — force logout
            clearSession();
          }
          // Network error / offline — keep existing session
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [clearSession]);

  // Response interceptor — auto-logout on 401 during any API call
  useEffect(() => {
    const id = mrApi.interceptors.response.use(
      res => res,
      err => {
        if (err?.response?.status === 401) {
          clearSession();
        }
        return Promise.reject(err);
      }
    );
    return () => mrApi.interceptors.response.eject(id);
  }, [clearSession]);

  const login = async (phone, password) => {
    const res = await mrApi.post('/mr/login', { phone, password });
    const { access_token, mr: mrData } = res.data;
    localStorage.setItem('mr_token', access_token);
    localStorage.setItem('mr_user', JSON.stringify(mrData));
    setMR(mrData);
    return mrData;
  };

  const logout = () => clearSession();

  return (
    <MRAuthContext.Provider value={{ mr, loading, login, logout, isAuthenticated: !!mr }}>
      {children}
    </MRAuthContext.Provider>
  );
};

// MR API helper (reuses the same axios instance with MR token)
export const mrAPI = {
  getDashboard: () => mrApi.get('/mr/dashboard'),
  getCustomers: (params) => mrApi.get('/mr/customers', { params }),
  getVisits: (params) => mrApi.get('/mr/visits', { params }),
  createVisit: (data) => mrApi.post('/mr/visits', data),
  updateVisit: (id, data) => mrApi.put(`/mr/visits/${id}`, data),
  getFollowups: (params) => mrApi.get('/mr/followups', { params }),
  getVisualAids: () => mrApi.get('/mr/visual-aids'),
  getVisualAidDeck: (id) => mrApi.get(`/mr/visual-aids/${id}`),
  getItems: (params) => mrApi.get('/mr/items', { params }),
  getOrders: () => mrApi.get('/mr/orders'),
  createOrder: (data) => mrApi.post('/mr/orders', data),
  cancelOrder: (id, data) => mrApi.post(`/mr/orders/${id}/cancel-request`, data),
};
