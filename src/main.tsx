import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    if (import.meta.env.DEV) {
      navigator.serviceWorker
        .getRegistrations()
        .then(regs => Promise.all(regs.map(r => r.unregister())))
        .catch(() => {});
      if ('caches' in window) {
        caches
          .keys()
          .then(keys =>
            Promise.all(
              keys.filter(k => k.startsWith('mender-')).map(k => caches.delete(k))
            )
          )
          .catch(() => {});
      }
      return;
    }

    let isRefreshing = false;
    const hadController = Boolean(navigator.serviceWorker.controller);

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // Reload once when an existing active Service Worker transitions to a new build
      if (hadController && !isRefreshing) {
        isRefreshing = true;
        window.location.reload();
      }
    });

    navigator.serviceWorker
      .register('/sw.js', {updateViaCache: 'none'})
      .then(reg => {
        if (reg.waiting) {
          reg.waiting.postMessage({type: 'SKIP_WAITING'});
        }

        reg.addEventListener('updatefound', () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              installing.postMessage({type: 'SKIP_WAITING'});
            }
          });
        });

        reg.update().catch(() => {});

        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            reg.update().catch(() => {});
          }
        });
      })
      .catch(() => {
        // ignore registration error in restricted preview frames
      });
  });
}

createRoot(document.getElementById('root')!).render(<App />);
