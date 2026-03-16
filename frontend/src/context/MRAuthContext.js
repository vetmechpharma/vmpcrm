import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const mrApi = axios.create({ baseURL: `${API_URL}/api` });
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

  useEffect(() => {
    const token = localStorage.getItem('mr_token');
    const stored = localStorage.getItem('mr_user');
    if (token && stored) {
      setMR(JSON.parse(stored));
      mrApi.get('/mr/me')
        .then(res => setMR(res.data))
        .catch(() => { localStorage.removeItem('mr_token'); localStorage.removeItem('mr_user'); setMR(null); })
        .finally(() => setLoading(false));
    } else { setLoading(false); }
  }, []);

  const login = async (phone, password) => {
    const res = await mrApi.post('/mr/login', { phone, password });
    const { access_token, mr: mrData } = res.data;
    localStorage.setItem('mr_token', access_token);
    localStorage.setItem('mr_user', JSON.stringify(mrData));
    setMR(mrData);
    return mrData;
  };

  const logout = () => {
    localStorage.removeItem('mr_token');
    localStorage.removeItem('mr_user');
    setMR(null);
  };

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
