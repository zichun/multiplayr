/**
 * PWA bootstrap, loaded by every host/join/index page as `pwa.js`.
 *
 *  - Registers the service worker (sw.js, emitted by PwaPlugin in webpack.config.js)
 *    with a scope of the page's own directory, so it works at a domain root and
 *    under a GitHub Pages sub-path alike.
 *  - When a new build's worker has installed and is waiting, shows an
 *    "update available" prompt; Reload tells the worker to take over and then
 *    reloads once it controls the page. Nothing updates silently.
 *  - Shows an offline banner while the browser has no network connection,
 *    since games need one to reach the signalling server and other players.
 */

const STYLE_ID = 'mp-pwa-style';
const UPDATE_CHECK_MS = 30 * 60 * 1000;

function injectStyle() {
    if (document.getElementById(STYLE_ID)) {
        return;
    }
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
.mp-pwa-toast, .mp-pwa-offline {
    position: fixed; left: 50%; transform: translateX(-50%); z-index: 2147483000;
    box-sizing: border-box; max-width: calc(100vw - 24px);
    font-family: 'Inter', system-ui, sans-serif; font-size: 14px; line-height: 1.4;
    color: #221f1a; background: #fbf8f1; border: 2px solid #221f1a;
    box-shadow: 4px 4px 0 #221f1a;
}
.mp-pwa-toast {
    bottom: 16px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
    padding: 10px 12px 10px 16px;
}
.mp-pwa-toast strong { font-family: 'Outfit', system-ui, sans-serif; font-weight: 700; }
.mp-pwa-toast button {
    font: inherit; font-weight: 600; cursor: pointer; padding: 6px 14px;
    border: 2px solid #221f1a; background: #e3a81e; color: #221f1a;
}
.mp-pwa-toast button.mp-pwa-later { background: transparent; border-color: transparent; color: #6b6455; }
.mp-pwa-offline {
    top: 12px; padding: 8px 16px; background: #221f1a; color: #fbf8f1; border-color: #221f1a;
    box-shadow: 4px 4px 0 #e1553a; text-align: center;
}
`;
    document.head.appendChild(style);
}

function onReady(fn: () => void) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
        fn();
    }
}

// ---------------------------------------------------------------------------
// Offline banner
// ---------------------------------------------------------------------------

let offlineEl: HTMLElement | null = null;

function renderOffline() {
    if (navigator.onLine) {
        if (offlineEl) {
            offlineEl.remove();
            offlineEl = null;
        }
        return;
    }
    if (offlineEl) {
        return;
    }
    injectStyle();
    offlineEl = document.createElement('div');
    offlineEl.className = 'mp-pwa-offline';
    offlineEl.setAttribute('role', 'status');
    offlineEl.textContent = 'You’re offline. Games need a network connection to connect players — they’ll work again once you’re back online.';
    document.body.appendChild(offlineEl);
}

// ---------------------------------------------------------------------------
// Update prompt
// ---------------------------------------------------------------------------

let toastEl: HTMLElement | null = null;
let reloadRequested = false;

function showUpdatePrompt(worker: ServiceWorker) {
    if (toastEl) {
        return;
    }
    injectStyle();
    toastEl = document.createElement('div');
    toastEl.className = 'mp-pwa-toast';
    toastEl.setAttribute('role', 'alert');

    const text = document.createElement('span');
    text.innerHTML = '<strong>Update available.</strong> Reload to get the latest Multiplayr.';

    const reload = document.createElement('button');
    reload.type = 'button';
    reload.textContent = 'Reload';
    reload.addEventListener('click', () => {
        reloadRequested = true;
        reload.disabled = true;
        reload.textContent = 'Updating…';
        worker.postMessage({ type: 'SKIP_WAITING' });
        // Safety net if controllerchange never arrives (e.g. worker became redundant).
        setTimeout(() => window.location.reload(), 4000);
    });

    const later = document.createElement('button');
    later.type = 'button';
    later.className = 'mp-pwa-later';
    later.textContent = 'Later';
    later.addEventListener('click', () => {
        toastEl?.remove();
        toastEl = null;
    });

    toastEl.appendChild(text);
    toastEl.appendChild(reload);
    toastEl.appendChild(later);
    document.body.appendChild(toastEl);
}

function watchRegistration(reg: ServiceWorkerRegistration) {
    // Only prompt when an existing worker controls the page; the very first
    // install just activates and starts caching.
    const promptIfWaiting = () => {
        if (reg.waiting && navigator.serviceWorker.controller) {
            showUpdatePrompt(reg.waiting);
        }
    };

    promptIfWaiting();

    reg.addEventListener('updatefound', () => {
        const installing = reg.installing;
        if (!installing) {
            return;
        }
        installing.addEventListener('statechange', () => {
            if (installing.state === 'installed') {
                promptIfWaiting();
            }
        });
    });

    const check = () => {
        reg.update().catch(() => { /* offline — try again later */ });
    };
    setInterval(check, UPDATE_CHECK_MS);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            check();
        }
    });
    window.addEventListener('online', check);
}

function register() {
    if (!('serviceWorker' in navigator)) {
        return;
    }
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        return;
    }

    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloadRequested) {
            reloadRequested = false;
            window.location.reload();
        }
    });

    navigator.serviceWorker
        .register('sw.js', { scope: './', updateViaCache: 'none' })
        .then(watchRegistration)
        .catch((err) => {
            console.warn('[multiplayr] service worker registration failed', err);
        });
}

onReady(() => {
    renderOffline();
    window.addEventListener('online', renderOffline);
    window.addEventListener('offline', renderOffline);
});

if (document.readyState === 'complete') {
    register();
} else {
    window.addEventListener('load', register, { once: true });
}
