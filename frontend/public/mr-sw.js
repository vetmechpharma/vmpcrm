const CACHE_VERSION = 'v2';
const STATIC_CACHE = `mr-static-${CACHE_VERSION}`;
const DATA_CACHE = `mr-data-${CACHE_VERSION}`;
const SLIDE_CACHE = `mr-slides-${CACHE_VERSION}`;

const VALID_CACHES = [STATIC_CACHE, DATA_CACHE, SLIDE_CACHE];

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

// Install: cache the app shell (index.html)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[MR-SW] Caching app shell');
      return cache.addAll(['/', '/index.html']).catch((err) => {
        console.log('[MR-SW] App shell cache failed:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => !VALID_CACHES.includes(key)).map((key) => {
          console.log('[MR-SW] Deleting old cache:', key);
          return caches.delete(key);
        })
      )
    )
  );
  self.clients.claim();
});

// Fetch handler
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Non-GET: try network, queue if offline
  if (event.request.method !== 'GET') {
    if (url.pathname.startsWith('/api/mr/')) {
      event.respondWith(handleMutation(event.request));
    }
    return;
  }

  // Slide images - cache first
  if (url.pathname.includes('/visual-aid') && url.pathname.includes('/slide')) {
    event.respondWith(cacheFirst(event.request, SLIDE_CACHE));
    return;
  }

  // API data - network first with cache fallback
  if (CACHEABLE_API.some((api) => url.pathname.startsWith(api))) {
    event.respondWith(networkFirst(event.request, DATA_CACHE));
    return;
  }

  // SPA navigation requests for /mrvet/* - serve cached index.html
  if (event.request.mode === 'navigate' && url.pathname.startsWith('/mrvet')) {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match('/index.html').then((r) => r || caches.match('/'))
      )
    );
    return;
  }

  // Static assets (JS/CSS bundles, fonts, images)
  if (
    url.pathname.startsWith('/static/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.ico') ||
    url.pathname.endsWith('.woff2')
  ) {
    event.respondWith(cacheFirst(event.request, STATIC_CACHE));
    return;
  }
});

// Network-first: try network, cache response, fallback to cache
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) {
      console.log('[MR-SW] Serving cached:', request.url);
      return cached;
    }
    return new Response(JSON.stringify({ error: 'Offline', cached: false }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Cache-first: check cache, fallback to network and cache
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

// Handle POST/PUT mutations: try network first, queue on failure
async function handleMutation(request) {
  try {
    const response = await fetch(request.clone());
    return response;
  } catch (err) {
    // Network failed - queue for later sync
    try {
      const body = await request.clone().json();
      const queue = await getOfflineQueue();
      queue.push({
        url: request.url,
        method: request.method,
        body: body,
        timestamp: Date.now(),
        headers: {
          'Content-Type': 'application/json',
          Authorization: request.headers.get('Authorization') || '',
        },
      });
      await saveOfflineQueue(queue);

      // Notify clients about queued item
      const clients = await self.clients.matchAll();
      clients.forEach((client) =>
        client.postMessage({ type: 'QUEUE_COUNT', count: queue.length })
      );

      return new Response(
        JSON.stringify({
          message: 'Saved offline. Will sync when online.',
          offline: true,
          queued: true,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch {
      return new Response(JSON.stringify({ error: 'Failed to queue offline' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
}

// === IndexedDB helpers ===
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
  items.forEach((item) => store.put(item));
}

// === Message handler for sync ===
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
        results.push({
          url: item.url,
          success: response.ok,
          status: response.status,
        });
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
