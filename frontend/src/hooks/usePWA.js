import { useState, useEffect, useCallback } from 'react';

export function usePWA() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineCount, setOfflineCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [swRegistered, setSWRegistered] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    // Listen for install prompt
    const onBeforeInstall = (e) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/mr-sw.js', { scope: '/mrvet/' })
        .then(() => {
          setSWRegistered(true);
          console.log('[MR-PWA] Service worker registered');
        })
        .catch((err) => console.error('[MR-PWA] SW registration failed:', err));

      // Listen for sync results
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'SYNC_RESULT') {
          setSyncing(false);
          setOfflineCount(event.data.remaining);
        }
        if (event.data?.type === 'QUEUE_COUNT') {
          setOfflineCount(event.data.count);
        }
      });
    }

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
    };
  }, []);

  // Check queue count periodically
  useEffect(() => {
    const check = () => {
      if (navigator.serviceWorker?.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'GET_QUEUE_COUNT' });
      }
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, [swRegistered]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && offlineCount > 0) {
      syncOfflineData();
    }
  }, [isOnline, offlineCount]);

  const syncOfflineData = useCallback(() => {
    if (!navigator.serviceWorker?.controller) return;
    setSyncing(true);
    navigator.serviceWorker.controller.postMessage({ type: 'SYNC_OFFLINE' });
  }, []);

  const installApp = useCallback(async () => {
    if (!installPrompt) return false;
    installPrompt.prompt();
    const result = await installPrompt.userChoice;
    setInstallPrompt(null);
    return result.outcome === 'accepted';
  }, [installPrompt]);

  return {
    isOnline,
    offlineCount,
    syncing,
    syncOfflineData,
    canInstall: !!installPrompt,
    installApp,
    swRegistered,
  };
}
