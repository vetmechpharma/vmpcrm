import { mrAPI } from '../context/MRAuthContext';

const CACHE_PREFIX = 'mr_offline_';
const CACHE_KEYS = {
  customers: `${CACHE_PREFIX}customers`,
  items: `${CACHE_PREFIX}items`,
  orders: `${CACHE_PREFIX}orders`,
  dashboard: `${CACHE_PREFIX}dashboard`,
  visits: `${CACHE_PREFIX}visits`,
  followups: `${CACHE_PREFIX}followups`,
};

// Save data to localStorage with timestamp
function saveToCache(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({
      data,
      timestamp: Date.now(),
    }));
  } catch (e) {
    // localStorage full - clear oldest entries
    console.warn('[OfflineData] Cache save failed:', e.message);
    try {
      Object.values(CACHE_KEYS).forEach(k => {
        const stored = localStorage.getItem(k);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Date.now() - parsed.timestamp > 7 * 24 * 60 * 60 * 1000) {
            localStorage.removeItem(k);
          }
        }
      });
      localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
    } catch {
      // Still full - give up
    }
  }
}

// Get data from localStorage cache
function getFromCache(key) {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    return parsed.data;
  } catch {
    return null;
  }
}

// Fetch with automatic caching and offline fallback
export async function fetchWithOffline(apiFn, cacheKey, params = {}) {
  try {
    const res = await apiFn(params);
    const data = res.data;
    // Cache successful response
    saveToCache(cacheKey, data);
    return { data, fromCache: false };
  } catch (err) {
    // Network/API failed - try localStorage
    const cached = getFromCache(cacheKey);
    if (cached) {
      console.log(`[OfflineData] Serving cached: ${cacheKey}`);
      return { data: cached, fromCache: true };
    }
    throw err; // No cache available
  }
}

// Pre-fetch all essential data and store in localStorage (call on app load)
export async function prefetchEssentialData() {
  const fetches = [
    { fn: () => mrAPI.getCustomers({}), key: CACHE_KEYS.customers },
    { fn: () => mrAPI.getItems({}), key: CACHE_KEYS.items },
    { fn: () => mrAPI.getOrders(), key: CACHE_KEYS.orders },
    { fn: () => mrAPI.getDashboard(), key: CACHE_KEYS.dashboard },
  ];

  const results = await Promise.allSettled(
    fetches.map(async ({ fn, key }) => {
      try {
        const res = await fn();
        saveToCache(key, res.data);
        return { key, success: true };
      } catch {
        return { key, success: false };
      }
    })
  );

  const cached = results.filter(r => r.value?.success).length;
  console.log(`[OfflineData] Pre-cached ${cached}/${fetches.length} datasets`);
  return cached;
}

// Get cached customers (for order form offline fallback)
export function getCachedCustomers() {
  return getFromCache(CACHE_KEYS.customers) || [];
}

// Get cached items (for order form offline fallback)
export function getCachedItems() {
  return getFromCache(CACHE_KEYS.items) || [];
}

// Get cached orders
export function getCachedOrders() {
  return getFromCache(CACHE_KEYS.orders) || [];
}

export { CACHE_KEYS, saveToCache, getFromCache };
