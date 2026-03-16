const CACHE_NAME = 'mr-field-app-v1';
const STATIC_CACHE = 'mr-static-v1';
const DATA_CACHE = 'mr-data-v1';
const SLIDE_CACHE = 'mr-slides-v1';

// Static assets to cache on install
const STATIC_ASSETS = [
  '/mrvet/login',
  '/mrvet/dashboard',
  '/mrvet/customers',
  '/mrvet/visits',
  '/mrvet/followups',
  '/mrvet/visual-aids',
  '/mrvet/orders',
];

// API endpoints to cache with network-first strategy
const CACHEABLE_API = [
  '/api/mr/dashboard',
  '/api/mr/customers',
  '/api/mr/visits',
  '/api/mr/followups',
  '/api/mr/visual-aids',
  '/api/mr/items',
  '/api/mr/orders',
];

// Install: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[MR-SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS).catch(() => {
        console.log('[MR-SW] Some static assets failed to cache');
      });
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== STATIC_CACHE && key !== DATA_CACHE && key !== SLIDE_CACHE)
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch: network-first for API, cache-first for static
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests (POST visits/orders go to queue)
  if (event.request.method !== 'GET') {
    // Queue offline mutations
    if (!navigator.onLine && url.pathname.startsWith('/api/mr/')) {
      event.respondWith(
        handleOfflineMutation(event.request)
      );
      return;
    }
    return;
  }

  // Slide images - cache first (they don't change often)
  if (url.pathname.includes('/visual-aids/') && url.pathname.includes('/slides')) {
    event.respondWith(cacheFirst(event.request, SLIDE_CACHE));
    return;
  }

  // API data - network first, fall back to cache
  if (CACHEABLE_API.some(api => url.pathname.startsWith(api))) {
    event.respondWith(networkFirst(event.request, DATA_CACHE));
    return;
  }

  // Static assets and pages
  if (url.pathname.startsWith('/mrvet/') || url.pathname.startsWith('/static/')) {
    event.respondWith(cacheFirst(event.request, STATIC_CACHE));
    return;
  }
});

// Network-first strategy
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      console.log('[MR-SW] Serving from cache:', request.url);
      return cached;
    }
    return new Response(JSON.stringify({ error: 'Offline', cached: false }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Cache-first strategy
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

// Handle offline mutations - store in IndexedDB for later sync
async function handleOfflineMutation(request) {
  try {
    const body = await request.clone().json();
    const offlineQueue = await getOfflineQueue();
    offlineQueue.push({
      url: request.url,
      method: request.method,
      body: body,
      timestamp: Date.now(),
      headers: Object.fromEntries(request.headers.entries()),
    });
    await saveOfflineQueue(offlineQueue);

    return new Response(JSON.stringify({
      message: 'Saved offline. Will sync when online.',
      offline: true,
      queued: true,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to queue' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// IndexedDB helpers for offline queue
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('mr-offline-db', 1);
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore('queue', { keyPath: 'timestamp' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getOfflineQueue() {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction('queue', 'readonly');
    const store = tx.objectStore('queue');
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => resolve([]);
  });
}

async function saveOfflineQueue(items) {
  const db = await openDB();
  const tx = db.transaction('queue', 'readwrite');
  const store = tx.objectStore('queue');
  store.clear();
  items.forEach(item => store.put(item));
}

// Listen for sync event
self.addEventListener('message', async (event) => {
  if (event.data?.type === 'SYNC_OFFLINE') {
    const queue = await getOfflineQueue();
    const results = [];
    const remaining = [];

    for (const item of queue) {
      try {
        const response = await fetch(item.url, {
          method: item.method,
          headers: item.headers,
          body: JSON.stringify(item.body),
        });
        results.push({ url: item.url, success: response.ok, status: response.status });
      } catch {
        remaining.push(item);
      }
    }

    await saveOfflineQueue(remaining);

    event.source?.postMessage({
      type: 'SYNC_RESULT',
      synced: results.length,
      remaining: remaining.length,
      results,
    });
  }

  if (event.data?.type === 'GET_QUEUE_COUNT') {
    const queue = await getOfflineQueue();
    event.source?.postMessage({
      type: 'QUEUE_COUNT',
      count: queue.length,
    });
  }
});
