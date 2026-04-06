import { useEffect, useCallback } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const VAPID_KEY = process.env.REACT_APP_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export function usePushNotifications(userType = 'admin') {
  const getToken = useCallback(() => {
    if (userType === 'customer') return localStorage.getItem('customerToken');
    if (userType === 'mr') return localStorage.getItem('mr_token');
    return localStorage.getItem('token');
  }, [userType]);

  const subscribe = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !VAPID_KEY) return false;
    
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return false;

      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_KEY)
        });
      }

      const token = getToken();
      if (!token) return false;

      const endpoint = userType === 'customer' ? '/api/customer/push/subscribe' : '/api/push/subscribe';
      await axios.post(`${API_URL}${endpoint}`, {
        subscription: sub.toJSON(),
        user_type: userType
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      return true;
    } catch (err) {
      console.error('Push subscription error:', err);
      return false;
    }
  }, [userType, getToken]);

  const unsubscribe = useCallback(async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        const token = getToken();
        if (token) {
          await axios.post(`${API_URL}/api/push/unsubscribe`, { endpoint }, {
            headers: { Authorization: `Bearer ${token}` }
          });
        }
      }
    } catch (err) {
      console.error('Push unsubscribe error:', err);
    }
  }, [getToken]);

  return { subscribe, unsubscribe };
}

export function useAutoSubscribe(userType = 'admin') {
  const { subscribe } = usePushNotifications(userType);

  useEffect(() => {
    // Auto-subscribe after a short delay (don't block UI)
    const timer = setTimeout(() => {
      if (Notification.permission === 'granted') {
        subscribe();
      } else if (Notification.permission === 'default') {
        subscribe();
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [subscribe]);
}
