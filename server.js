// Servidor local de mesma origem: entrega a aplicação pública e encaminha Deezer e Invidious.
// Same-origin server: serves the public app and proxies Deezer and Invidious.
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const API_CONFIG = require("./public/js/config.js");

// Resolve caminhos relativos à pasta do projeto e mantenha privado o arquivo de ambiente local.
// Resolve all static paths relative to this project and keep the local environment file private.
const projectRoot = __dirname;
const publicRoot = path.join(projectRoot, "public");
const localEnvPath = path.join(projectRoot, ".env");
const environment = { ...process.env };
const mimeTypes = new Map([
    [".css", "text/css; charset=utf-8"],
    [".html", "text/html; charset=utf-8"],
    [".ico", "image/x-icon"],
    [".js", "text/javascript; charset=utf-8"],
    [".json", "application/json; charset=utf-8"],
    [".mp3", "audio/mpeg"],
    [".mp4", "video/mp4"],
    [".png", "image/png"],
    [".svg", "image/svg+xml"],
    [".webp", "image/webp"]
]);

// Carrega apenas configurações KEY=VALUE locais não sobrescritas; arquivos de ambiente nunca são servidos.
// Load only local, non-overridden KEY=VALUE settings; no environment file is ever served to clients.
if (fs.existsSync(localEnvPath)) {
    const lines = fs.readFileSync(localEnvPath, "utf8").split(/\r?\n/);
    for (const line of lines) {
        const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
        if (match && environment[match[1]] === undefined) {
            environment[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
        }
    }
}

// Retorna erros JSON explícitos em vez de transformar falhas externas em buscas vazias.
// Send explicit JSON errors instead of converting upstream failures into empty search results.
function sendJson(response, statusCode, payload) {
    response.writeHead(statusCode, {
        "Cache-Control": "no-store",
        "Content-Type": "application/json; charset=utf-8",
        "X-Content-Type-Options": "nosniff"
    });
    response.end(JSON.stringify(payload));
}

// Aceita somente os tipos de recurso conhecidos do Deezer; os IDs devem ser numéricos.
// Accept only the known Deezer resource types; resource IDs are numeric.
function deezerResourcePath(resource, id) {
    if (!["artist", "album", "playlist", "track"].includes(resource) || !/^\d+$/.test(id)) {
        return null;
    }
    const endpoints = API_CONFIG.providers.deezer.endpoints;
    if (resource === "artist") {
        return [endpoints.artist(id), endpoints.artistTopTracks(id)];
    }
    if (resource === "album") {
        return [endpoints.album(id), endpoints.albumTracks(id)];
    }
    if (resource === "playlist") {
        return [endpoints.playlist(id), endpoints.playlistTracks(id)];
    }
    return [endpoints.track(id)];
}

// Consulta o Deezer sem expor a chave RapidAPI compartilhada; a API pública não exige chave.
// Fetch Deezer without exposing the RapidAPI key supplied in chat; the public API needs no key.
async function fetchDeezer(resourcePath) {
    const url = new URL(resourcePath, API_CONFIG.providers.deezer.baseUrl);
    const upstream = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!upstream.ok) {
        throw new Error(`Deezer responded with HTTP ${upstream.status}.`);
    }
    const payload = await upstream.json();
    if (payload.error) {
        throw new Error(payload.error.message || "Deezer could not complete the request.");
    }
    return payload;
}

// Encaminha os endpoints públicos de busca para evitar restrições de origem cruzada no navegador.
// Proxy the public search endpoints to avoid browser cross-origin restrictions.
async function handleDeezerSearch(url, response) {
    const query = (url.searchParams.get("q") || "").trim();
    if (!query || query.length > 120) {
        sendJson(response, 400, { error: "A search term of 1 to 120 characters is required." });
        return;
    }

    const resourceTypes = ["track", "artist", "album", "playlist"];
    const results = await Promise.all(resourceTypes.map(async (type) => {
        const endpoint = API_CONFIG.providers.deezer.endpoints.search(type, query);
        const payload = await fetchDeezer(endpoint);
        return { type, data: Array.isArray(payload.data) ? payload.data : [] };
    }));
    sendJson(response, 200, { provider: "deezer", results });
}

// Obtém metadados de artista, álbum, playlist ou faixa e uma lista limitada de faixas relacionadas.
// Resolve artist, album, playlist, or track metadata and a bounded list of related tracks.
async function handleDeezerDetail(url, response) {
    const segments = url.pathname.split("/").filter(Boolean);
    const resource = segments[2];
    const id = segments[3] || "";
    if (resource === "artist" && segments[4] === "albums" && /^\d+$/.test(id)) {
        const payload = await fetchDeezer(API_CONFIG.providers.deezer.endpoints.artistAlbums(id));
        sendJson(response, 200, {
            provider: "deezer",
            results: Array.isArray(payload.data) ? payload.data : []
        });
        return;
    }
    const paths = deezerResourcePath(resource, id);
    if (!paths) {
        sendJson(response, 400, { error: "Unsupported Deezer resource or invalid ID." });
        return;
    }

    const [item, tracks] = await Promise.all(paths.map(fetchDeezer));
    sendJson(response, 200, {
        provider: "deezer",
        resource,
        item,
        tracks: Array.isArray(tracks?.data) ? tracks.data : tracks?.data?.data || []
    });
}

// Request only video metadata from Invidious and omit every direct media stream field.
// Consulta apenas metadados de vídeo no Invidious e omite todos os campos de streams de mídia.
async function fetchInvidious(resourcePath) {
    const url = new URL(resourcePath, API_CONFIG.providers.invidious.baseUrl);
    const upstream = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!upstream.ok) {
        throw new Error(`Invidious responded with HTTP ${upstream.status}.`);
    }
    const payload = await upstream.json();
    if (payload.error) {
        throw new Error(String(payload.error));
    }
    return payload;
}

// Return only fields used for catalog cards and detail pages, never adaptive or audio formats.
// Retorna somente campos usados nos cards e detalhes, nunca formatos adaptativos ou de áudio.
function normalizeInvidiousMetadata(video) {
    return {
        videoId: String(video.videoId || ""),
        title: String(video.title || ""),
        description: String(video.description || ""),
        author: String(video.author || ""),
        authorId: String(video.authorId || ""),
        authorUrl: String(video.authorUrl || ""),
        videoThumbnails: Array.isArray(video.videoThumbnails)
            ? video.videoThumbnails.map((thumbnail) => ({
                quality: String(thumbnail.quality || ""),
                url: String(thumbnail.url || ""),
                width: Number(thumbnail.width) || 0,
                height: Number(thumbnail.height) || 0
            }))
            : [],
        lengthSeconds: Number(video.lengthSeconds) || 0,
        viewCount: Number(video.viewCount) || 0,
        publishedText: String(video.publishedText || "")
    };
}

// Search the configured public instance and expose only safe metadata for matching videos.
// Busca na instância pública configurada e expõe somente metadados dos vídeos correspondentes.
async function handleInvidiousSearch(url, response) {
    const query = (url.searchParams.get("q") || "").trim();
    if (!query || query.length > 120) {
        sendJson(response, 400, { error: "A search term of 1 to 120 characters is required." });
        return;
    }
    const results = await fetchInvidious(API_CONFIG.providers.invidious.endpoints.search(query));
    const videos = Array.isArray(results)
        ? results.filter((video) => video.type === "video" && video.videoId).slice(0, 12).map(normalizeInvidiousMetadata)
        : [];
    sendJson(response, 200, { provider: "invidious", results: videos });
}

// Fetch one video's descriptive metadata without forwarding playback formats or stream URLs.
// Busca os metadados descritivos do vídeo sem encaminhar formatos de reprodução ou URLs de streams.
async function handleInvidiousDetail(url, response) {
    const videoId = url.pathname.slice(API_CONFIG.providers.invidious.detailRoutePrefix.length);
    if (!/^[A-Za-z0-9_-]{1,32}$/.test(videoId)) {
        sendJson(response, 400, { error: "Invalid Invidious video ID." });
        return;
    }
    const video = await fetchInvidious(API_CONFIG.providers.invidious.endpoints.video(videoId));
    sendJson(response, 200, {
        provider: "invidious",
        item: normalizeInvidiousMetadata(video)
    });
}

// Transmite arquivos com suporte a intervalos de bytes para permitir avançar no áudio local.
// Stream files with byte-range support so the native audio element can seek through local music.
function serveStaticFile(request, response, filePath) {
    const extension = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes.get(extension);
    if (!contentType) {
        response.writeHead(404).end();
        return;
    }

    fs.stat(filePath, (statError, fileInfo) => {
        if (statError || !fileInfo.isFile()) {
            response.writeHead(404).end();
            return;
        }

        const range = request.headers.range;
        if (range && contentType.startsWith("audio/")) {
            const match = /^bytes=(\d*)-(\d*)$/.exec(range);
            if (!match) {
                response.writeHead(416, { "Content-Range": `bytes */${fileInfo.size}` }).end();
                return;
            }
            const start = match[1] ? Number(match[1]) : 0;
            const end = match[2] ? Math.min(Number(match[2]), fileInfo.size - 1) : fileInfo.size - 1;
            if (start >= fileInfo.size || end < start) {
                response.writeHead(416, { "Content-Range": `bytes */${fileInfo.size}` }).end();
                return;
            }
            response.writeHead(206, {
                "Accept-Ranges": "bytes",
                "Content-Length": end - start + 1,
                "Content-Range": `bytes ${start}-${end}/${fileInfo.size}`,
                "Content-Type": contentType,
                "Referrer-Policy": "no-referrer",
                "X-Frame-Options": "DENY",
                "X-Content-Type-Options": "nosniff"
            });
            fs.createReadStream(filePath, { start, end }).pipe(response);
            return;
        }

        response.writeHead(200, {
            "Accept-Ranges": contentType.startsWith("audio/") ? "bytes" : "none",
            "Content-Length": fileInfo.size,
            "Content-Type": contentType,
            "Referrer-Policy": "no-referrer",
            "X-Frame-Options": "DENY",
            "X-Content-Type-Options": "nosniff"
        });
        fs.createReadStream(filePath).pipe(response);
    });
}

// Encaminha APIs da mesma origem e entrega somente arquivos da pasta pública.
// Route same-origin APIs and serve files only from the public directory.
const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, "http://localhost");
    if (request.method !== "GET" && request.method !== "HEAD") {
        sendJson(response, 405, { error: "Only GET and HEAD requests are supported." });
        return;
    }

    try {
        if (url.pathname === API_CONFIG.serverRoutes.configuration) {
            sendJson(response, 200, {
                spotifyClientId: environment.SPOTIFY_CLIENT_ID || ""
            });
            return;
        }
        if (url.pathname === API_CONFIG.providers.deezer.searchRoute) {
            await handleDeezerSearch(url, response);
            return;
        }
        if (url.pathname.startsWith(API_CONFIG.providers.deezer.detailRoutePrefix)) {
            await handleDeezerDetail(url, response);
            return;
        }
        if (url.pathname === API_CONFIG.providers.invidious.searchRoute) {
            await handleInvidiousSearch(url, response);
            return;
        }
        if (url.pathname.startsWith(API_CONFIG.providers.invidious.detailRoutePrefix)) {
            await handleInvidiousDetail(url, response);
            return;
        }
        if (url.pathname.startsWith("/api/")) {
            sendJson(response, 404, { error: "API endpoint not found." });
            return;
        }

        const decodedPath = decodeURIComponent(url.pathname);
        const relativePath = decodedPath === "/" ? "index.html" : decodedPath.slice(1);
        const filePath = path.resolve(publicRoot, relativePath);
        if (
            !filePath.startsWith(`${publicRoot}${path.sep}`)
            || relativePath.split(/[\\/]/).some((segment) => segment.startsWith("."))
        ) {
            response.writeHead(404).end();
            return;
        }
        serveStaticFile(request, response, filePath);
    } catch (error) {
        console.error("Local API request failed.", error);
        if (!response.headersSent) {
            sendJson(response, 502, { error: "Music provider request failed. Try again later." });
        } else {
            response.destroy(error);
        }
    }
});

// Usa loopback por padrão para não expor a configuração local da API à rede.
// Listen on loopback by default so local API configuration is not exposed to the network.
const port = Number(environment.PORT || 8765);
server.listen(port, "127.0.0.1", () => {
    console.log(`Open Music Hub available at http://127.0.0.1:${port}`);
});
