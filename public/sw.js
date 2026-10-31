// Service Worker do Open Music Hub: mantém o shell do aplicativo disponível offline.
// Open Music Hub Service Worker: keeps the app shell available offline.
//
// - Navegações usam rede primeiro e caem para o cache (e para o index.html) offline.
//   Navigations use network first, falling back to cache (and index.html) offline.
// - Arquivos estáticos usam cache primeiro com revalidação em segundo plano.
//   Static assets use cache first with background revalidation.
// - /api/ e provedores externos nunca passam por aqui; o áudio usa a Cache API no app.
//   /api/ and external providers never go through here; audio uses the app's Cache API.
//
// [PT] O cache do shell (open-music-hub-shell-v1) é separado do cache de faixas offline do
//       utilizador (open-music-hub-cache, definido em js/offline.mjs). A ativação limpa apenas
//       caches de shell antigos e NUNCA toca no áudio baixado pelo utilizador.
// [EN] The shell cache (open-music-hub-shell-v1) is separate from the user's offline tracks
//       cache (open-music-hub-cache, defined in js/offline.mjs). Activation cleans only old
//       shell caches and NEVER touches the user's downloaded audio.

const SHELL_CACHE_NAME = "open-music-hub-shell-v1";
// Precisa casar com CACHE_NAME de js/offline.mjs, onde o áudio baixado é persistido.
// Must match CACHE_NAME in js/offline.mjs, where downloaded audio is persisted.
const OFFLINE_TRACKS_CACHE_NAME = "open-music-hub-cache";
// Prefixos de cache geridos por este SW. Qualquer outro cache (ex.: o de faixas offline) é preservado.
// Cache prefixes managed by this SW. Any other cache (e.g. offline tracks) is preserved.
const SHELL_CACHE_PREFIXES = ["open-music-hub-shell-", "omh-shell-"];

const SHELL_ASSETS = [
    "./",
    "./index.html",
    "./privacy.html",
    "./css/styles.css",
    "./css/tailwind.css",
    "./js/config.js",
    "./js/app.js",
    "./js/profile.mjs",
    "./js/lyrics.mjs",
    "./js/offline.mjs",
    "./js/playback.mjs"
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(SHELL_CACHE_NAME)
            .then((cache) => cache.addAll(SHELL_ASSETS))
            .then(() => self.skipWaiting())
    );
});

// Ativação: remove apenas caches de versões antigas do shell. NUNCA remove o cache de
// faixas offline do utilizador (open-music-hub-cache) nem nenhum cache desconhecido.
// Activation: removes only caches from older shell versions. It NEVER removes the user's
// offline tracks cache (open-music-hub-cache) or any unknown cache.
self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys
                    .filter((key) => key !== SHELL_CACHE_NAME && key !== OFFLINE_TRACKS_CACHE_NAME)
                    .filter((key) => SHELL_CACHE_PREFIXES.some((prefix) => key.startsWith(prefix)))
                    .map((key) => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

async function handleNavigation(request) {
    try {
        const response = await fetch(request);
        const cache = await caches.open(SHELL_CACHE_NAME);
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
                caches.open(SHELL_CACHE_NAME)
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

// Recebe comandos diretos do cliente, como avisos de atualização de cache.
// Receives direct commands from the client, such as cache-update notices.
self.addEventListener("message", (event) => {
    if (!event.data || typeof event.data !== "object") {
        return;
    }
    if (event.data.type === "SKIP_WAITING") {
        self.skipWaiting();
    }
});
