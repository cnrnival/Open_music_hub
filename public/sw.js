// Service Worker do Open Music Hub: mantém o shell do aplicativo disponível offline.
// Open Music Hub Service Worker: keeps the app shell available offline.
//
// - Navegações usam rede primeiro e caem para o cache (e para o index.html) offline.
//   Navigations use network first, falling back to cache (and index.html) offline.
// - Arquivos estáticos usam cache primeiro com revalidação em segundo plano.
//   Static assets use cache first with background revalidation.
// - /api/ e provedores externos nunca passam por aqui; o áudio usa a Cache API no app.
//   /api/ and external providers never go through here; audio uses the app's Cache API.

const CACHE_NAME = "omh-shell-v2";

const SHELL_ASSETS = [
    "./",
    "./index.html",
    "./privacy.html",
    "./css/styles.css",
    "./css/tailwind.css",
    "./js/config.js",
    "./js/app.js",
    "./js/lyrics.mjs",
    "./js/offline.mjs",
    "./js/playback.mjs"
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(SHELL_ASSETS))
            .then(() => self.skipWaiting())
    );
});

// Remove caches de versões antigas ao ativar uma nova versão do worker.
// Remove caches from older versions when a new worker version activates.
self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

async function handleNavigation(request) {
    try {
        const response = await fetch(request);
        const cache = await caches.open(CACHE_NAME);
        // Guarda a cópia nova para a próxima abertura offline.
        // Store the fresh copy for the next offline launch.
        await cache.put(request, response.clone());
        return response;
    } catch {
        const cached = await caches.match(request);
        return cached || (await caches.match("./index.html"));
    }
}

async function handleStatic(request) {
    const cached = await caches.match(request);
    const networkPromise = fetch(request)
        .then((response) => {
            if (response.ok) {
                const copy = response.clone();
                caches.open(CACHE_NAME)
                    .then((cache) => cache.put(request, copy))
                    .catch(() => {});
            }
            return response;
        })
        .catch(() => cached);
    return cached || networkPromise;
}

self.addEventListener("fetch", (event) => {
    const { request } = event;
    if (request.method !== "GET") {
        return;
    }
    const url = new URL(request.url);
    if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) {
        // APIs da mesma origem e provedores externos sempre vão para a rede.
        // Same-origin APIs and external providers always go to the network.
        return;
    }
    if (request.mode === "navigate") {
        event.respondWith(handleNavigation(request));
        return;
    }
    event.respondWith(handleStatic(request));
});
