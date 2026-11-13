/* eslint-disable */
/**
 * Multiplayr service worker.
 *
 * This file is a TEMPLATE: PwaPlugin in webpack.config.js replaces the CONFIG
 * placeholder below with the build version and the precache lists, then
 * emits it as sw.js next to the HTML pages. Plain ES2017, no imports.
 *
 * Strategy
 *  - App shell (HTML pages, lib/rules/host/join bundles, pwa.js, manifest,
 *    icons): precached on install into a cache keyed to the build version and
 *    served cache-first, so a page and its bundles always come from the same
 *    build. A new deploy ships a new sw.js; it installs in the background and
 *    WAITS until the page's "Update available — reload" prompt posts
 *    SKIP_WAITING. Old caches are deleted on activate.
 *  - Per-game chunks (*.bundle.js not in the shell) and same-origin images /
 *    sounds: cached lazily on first use, also in a build-versioned cache since
 *    their file names are not content-hashed.
 *  - Allow-listed CDN libraries (jQuery, PeerJS from unpkg, Semantic UI,
 *    Font Awesome, Google Fonts): stale-while-revalidate in a long-lived cache.
 *  - Everything else (PeerJS signalling at *.peerjs.com, socket.io, WebRTC,
 *    any other cross-origin request, Range requests, non-GET): never touched —
 *    the SW does not call respondWith, so the browser handles it natively.
 *    (WebSocket and WebRTC traffic never reaches a fetch handler anyway.)
 */
'use strict';

const CONFIG = __MP_SW_CONFIG__;

const VERSION = CONFIG.version;
const SHELL_CACHE = 'mp-shell-' + VERSION;
const RUNTIME_CACHE = 'mp-runtime-' + VERSION;
const CDN_CACHE = 'mp-cdn-v1';
const KEEP = [SHELL_CACHE, RUNTIME_CACHE, CDN_CACHE];

const CDN_HOSTS = [
    'code.jquery.com',
    'unpkg.com',
    'cdnjs.cloudflare.com',
    'use.fontawesome.com',
    'fonts.googleapis.com',
    'fonts.gstatic.com',
];

const RUNTIME_EXT = /\.(?:js|png|jpe?g|gif|svg|webp|mp3|ogg|wav|woff2?|ttf)$/i;

const scopeUrl = new URL(self.registration.scope);

function resolve(path) {
    return new URL(path, scopeUrl).href;
}

function isNeverCached(url) {
    // PeerJS signalling server (0.peerjs.com etc.) and anything socket-ish.
    if (/(^|\.)peerjs\.com$/i.test(url.hostname)) { return true; }
    if (url.pathname.indexOf('/socket.io/') !== -1) { return true; }
    if (url.pathname.endsWith('/sw.js')) { return true; }
    return false;
}

self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(SHELL_CACHE);
        // cache: 'reload' bypasses the HTTP cache so we never precache a stale copy.
        await cache.addAll(CONFIG.precache.map((p) => new Request(resolve(p), { cache: 'reload' })));

        // Best-effort warm-up of the CDN scripts/styles the pages load, so the
        // shell renders offline after a single visit. Opaque (no-cors) responses
        // are fine to store; failures must not block install.
        const cdn = await caches.open(CDN_CACHE);
        await Promise.all(CONFIG.cdn.map(async (entry) => {
            try {
                if (await cdn.match(entry.url)) { return; }
                const res = await fetch(new Request(entry.url, { mode: entry.cors ? 'cors' : 'no-cors', credentials: 'omit' }));
                if (res.ok || res.type === 'opaque') { await cdn.put(entry.url, res); }
            } catch (e) { /* offline or blocked — runtime caching will pick it up later */ }
        }));
        // Deliberately no skipWaiting(): an update waits for the user's go-ahead.
    })());
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys
            .filter((k) => k.startsWith('mp-') && KEEP.indexOf(k) === -1)
            .map((k) => caches.delete(k)));
        await self.clients.claim();
    })());
});

self.addEventListener('message', (event) => {
    const data = event.data || {};
    if (data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    } else if (data.type === 'GET_VERSION' && event.ports && event.ports[0]) {
        event.ports[0].postMessage({ version: VERSION });
    }
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') { return; }
    if (req.headers.has('range')) { return; }   // media seeking; 206s can't be cached

    let url;
    try { url = new URL(req.url); } catch (e) { return; }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') { return; }
    if (isNeverCached(url)) { return; }

    if (url.origin !== self.location.origin) {
        if (CDN_HOSTS.indexOf(url.hostname) !== -1) {
            event.respondWith(staleWhileRevalidate(event, req));
        }
        return;   // other cross-origin: leave to the network
    }

    if (req.mode === 'navigate') {
        event.respondWith(handleNavigation(req));
        return;
    }

    event.respondWith(handleSameOrigin(event, req, url));
});

async function handleNavigation(req) {
    const shell = await caches.open(SHELL_CACHE);
    const url = new URL(req.url);
    const candidates = [req.url];
    // Server mode routes /host -> host.html etc.; the static build serves index.html at the root.
    if (!/\.[a-z0-9]+$/i.test(url.pathname)) {
        if (url.pathname.endsWith('/')) {
            candidates.push(new URL('index.html', url).href);
        } else {
            candidates.push(url.origin + url.pathname + '.html');
        }
    }
    for (const c of candidates) {
        const hit = await shell.match(c, { ignoreSearch: true });
        if (hit) { return hit; }
    }
    try {
        return await fetch(req);
    } catch (e) {
        const fallback = CONFIG.offlinePage
            ? await shell.match(resolve(CONFIG.offlinePage), { ignoreSearch: true })
            : null;
        return fallback || offlineResponse();
    }
}

async function handleSameOrigin(event, req, url) {
    const shell = await caches.open(SHELL_CACHE);
    const hit = await shell.match(req, { ignoreSearch: true });
    if (hit) { return hit; }

    if (!RUNTIME_EXT.test(url.pathname)) {
        return fetch(req);
    }

    const runtime = await caches.open(RUNTIME_CACHE);
    const cached = await runtime.match(req, { ignoreSearch: true });
    if (cached) { return cached; }
    const res = await fetch(req);
    if (res.ok && res.type === 'basic') {
        const copy = res.clone();
        event.waitUntil(runtime.put(req, copy).catch(() => {}));
    }
    return res;
}

async function staleWhileRevalidate(event, req) {
    const cache = await caches.open(CDN_CACHE);
    const cached = await cache.match(req, { ignoreVary: true });
    const network = fetch(req).then((res) => {
        if (res.ok || res.type === 'opaque') {
            const copy = res.clone();
            return cache.put(req, copy).then(() => res, () => res);
        }
        return res;
    });
    if (cached) {
        event.waitUntil(network.catch(() => {}));
        return cached;
    }
    return network;
}

function offlineResponse() {
    const html = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">'
        + '<meta name="viewport" content="width=device-width, initial-scale=1.0">'
        + '<title>Multiplayr: Offline</title><style>'
        + 'body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;'
        + 'background:#ece4d3;color:#221f1a;font-family:Inter,system-ui,sans-serif;padding:24px;text-align:center}'
        + 'h1{font-family:Outfit,system-ui,sans-serif;font-weight:800;margin:0 0 8px}'
        + 'p{color:#6b6455;max-width:28em;line-height:1.5}'
        + 'button{margin-top:16px;font:inherit;font-weight:600;padding:10px 20px;border:2px solid #221f1a;'
        + 'background:#fbf8f1;cursor:pointer}</style></head><body><main>'
        + '<h1>You&rsquo;re offline</h1>'
        + '<p>Multiplayr needs a network connection to load this page and to connect players. '
        + 'Check your connection and try again.</p>'
        + '<button onclick="location.reload()">Try again</button></main></body></html>';
    return new Response(html, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
