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
let musicBrainzQueue = Promise.resolve();
let lastMusicBrainzRequestAt = 0;
const mimeTypes = new Map([
    [".css", "text/css; charset=utf-8"],
    [".html", "text/html; charset=utf-8"],
    [".ico", "image/x-icon"],
    [".js", "text/javascript; charset=utf-8"],
    [".json", "application/json; charset=utf-8"],
    [".mp3", "audio/mpeg"],
    [".mp4", "video/mp4"],
    [".mjs", "text/javascript; charset=utf-8"],
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
        "X-Content-Type-Options": "nosniff",
        "Permissions-Policy": "camera=(), microphone=(), geolocation=()"
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
    const upstream = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!upstream.ok) {
        throw new Error(`Deezer responded with HTTP ${upstream.status}.`);
    }
    const payload = await upstream.json();
    if (payload.error) {
        throw new Error(payload.error.message || "Deezer could not complete the request.");
    }
    return payload;
}

async function fetchJsonFromProvider(baseUrl, resourcePath, headers = {}, timeoutMs = 8000) {
    const url = new URL(resourcePath, baseUrl);
    const upstream = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(timeoutMs)
    });
    if (!upstream.ok) {
        const error = new Error(`Provider responded with HTTP ${upstream.status}.`);
        error.statusCode = upstream.status;
        throw error;
    }
    return upstream.json();
}

function requiredQuery(url, names, maxLength = 120) {
    const values = names.map((name) => (url.searchParams.get(name) || "").trim());
    if (values.some((value) => !value || value.length > maxLength)) {
        return null;
    }
    return values;
}

function getAudioDbEntityList(payload, kind) {
    const collection = kind === "discography" ? payload.discography : payload[`${kind}s`];
    if (Array.isArray(collection)) {
        return collection;
    }
    if (collection && typeof collection === "object") {
        return [collection];
    }
    const singular = payload[kind];
    return singular && typeof singular === "object" ? [singular] : [];
}

// Keep the Premium API key on the server and send it only in TheAudioDB's required header.
// Mantém a chave Premium no servidor e a envia somente no cabeçalho exigido pela TheAudioDB.
async function fetchAudioDb(resourcePath) {
    const apiKey = environment[API_CONFIG.providers.audioDb.apiKeyEnvironmentVariable];
    if (!apiKey) {
        return { error: "Configure uma chave Premium em AUDIODB_API_KEY no arquivo .env local." };
    }
    const payload = await fetchJsonFromProvider(
        API_CONFIG.providers.audioDb.baseUrl,
        API_CONFIG.providers.audioDb.providerPath(resourcePath),
        { "X-API-KEY": apiKey }
    );
    if (payload.Message) {
        throw new Error(String(payload.Message));
    }
    return { payload };
}

function normalizeAudioDbArtist(artist) {
    return {
        id: String(artist.idArtist || ""),
        name: String(artist.strArtist || ""),
        biography: String(artist.strBiographyPT || artist.strBiographyEN || ""),
        thumb: String(artist.strArtistThumb || ""),
        banner: String(artist.strArtistFanart || ""),
        logo: String(artist.strArtistLogo || ""),
        genre: String(artist.strGenre || ""),
        country: String(artist.strCountry || "")
    };
}

async function handleAudioDbSearch(url, response, kind) {
    const [query] = requiredQuery(url, ["q"]) || [];
    if (!query) {
        sendJson(response, 400, { error: "A valid search term is required." });
        return;
    }
    const { error, payload } = await fetchAudioDb(
        API_CONFIG.providers.audioDb.endpoints.search[kind](query)
    );
    if (error) {
        sendJson(response, 503, { error });
        return;
    }
    const results = getAudioDbEntityList(payload, kind);
    sendJson(response, 200, {
        provider: "audiodb",
        results: kind === "artist" ? results.map(normalizeAudioDbArtist) : results
    });
}

async function handleAudioDbLookup(url, response, lookupKind) {
    const values = requiredQuery(url, ["id"]);
    const [kind, musicBrainzSuffix] = lookupKind.split("_");
    const musicBrainz = musicBrainzSuffix === "mb";
    const validId = musicBrainz
        ? /^[0-9a-f-]{36}$/i.test(values?.[0] || "")
        : /^\d+$/.test(values?.[0] || "");
    if (!validId || !["artist", "album", "track"].includes(kind)) {
        sendJson(response, 400, { error: "A valid TheAudioDB resource ID is required." });
        return;
    }
    const endpointName = musicBrainz ? `${kind}ByMusicBrainz` : kind;
    const { error, payload } = await fetchAudioDb(
        API_CONFIG.providers.audioDb.endpoints.lookup[endpointName](values[0])
    );
    if (error) {
        sendJson(response, 503, { error });
        return;
    }
    const results = getAudioDbEntityList(payload, kind);
    sendJson(response, 200, {
        provider: "audiodb",
        item: kind === "artist" && results[0] ? normalizeAudioDbArtist(results[0]) : results[0] || null
    });
}

async function handleAudioDbDiscography(url, response) {
    const [artistId] = requiredQuery(url, ["id"]) || [];
    if (!artistId || !/^\d+$/.test(artistId)) {
        sendJson(response, 400, { error: "A valid numeric artist ID is required." });
        return;
    }
    const { error, payload } = await fetchAudioDb(
        API_CONFIG.providers.audioDb.endpoints.list.discography(artistId)
    );
    if (error) {
        sendJson(response, 503, { error });
        return;
    }
    sendJson(response, 200, {
        provider: "audiodb",
        results: getAudioDbEntityList(payload, "discography")
    });
}

function fetchMusicBrainz(resourcePath) {
    const request = musicBrainzQueue.then(async () => {
        const delay = Math.max(0, 1100 - (Date.now() - lastMusicBrainzRequestAt));
        if (delay) {
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
        lastMusicBrainzRequestAt = Date.now();
        return fetchJsonFromProvider(
            API_CONFIG.providers.musicBrainz.baseUrl,
            resourcePath,
            { "User-Agent": "OpenMusicHub/1.0 (https://github.com/cnrnival/Clone_Spotify)" },
            3500
        );
    });
    musicBrainzQueue = request.catch(() => {});
    return request;
}

async function handleMusicBrainzArtist(url, response) {
    const [name] = requiredQuery(url, ["q"]) || [];
    if (!name) {
        sendJson(response, 400, { error: "A valid artist name is required." });
        return;
    }
    const search = await fetchMusicBrainz(API_CONFIG.providers.musicBrainz.endpoints.searchArtist(name));
    const artist = search.artists?.[0];
    if (!artist) {
        sendJson(response, 200, { provider: "musicbrainz", artist: null, releases: [] });
        return;
    }
    const releasePayload = await fetchMusicBrainz(
        API_CONFIG.providers.musicBrainz.endpoints.artistReleases(artist.id)
    );
    sendJson(response, 200, {
        provider: "musicbrainz",
        artist: {
            id: String(artist.id || ""),
            name: String(artist.name || ""),
            disambiguation: String(artist.disambiguation || ""),
            country: String(artist.country || ""),
            beginDate: String(artist["life-span"]?.begin || ""),
            endDate: String(artist["life-span"]?.end || "")
        },
        releases: (releasePayload["release-groups"] || []).map((release) => ({
            id: String(release.id || ""),
            title: String(release.title || ""),
            type: String(release["primary-type"] || ""),
            firstReleaseDate: String(release["first-release-date"] || "")
        }))
    });
}

async function handleLyrics(url, response) {
    const values = requiredQuery(url, ["artist", "title"]);
    if (!values) {
        sendJson(response, 400, { error: "Artist and track title are required." });
        return;
    }
    const [artist, title] = values;
    const resourcePath = `${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;
    let payload;
    try {
        payload = await fetchJsonFromProvider(API_CONFIG.providers.lyrics.baseUrl, resourcePath);
    } catch (error) {
        if (error.statusCode === 404) {
            sendJson(response, 404, { error: "Lyrics were not found for this track." });
            return;
        }
        throw error;
    }
    if (typeof payload.lyrics !== "string" || !payload.lyrics.trim()) {
        sendJson(response, 404, { error: "Lyrics were not found for this track." });
        return;
    }
    sendJson(response, 200, {
        provider: "lyrics.ovh",
        artist,
        title,
        lyrics: payload.lyrics
    });
}

// Restrict full-track playback to Jamendo's own HTTPS hosts.
// Restringe a reprodução de faixas completas aos domínios HTTPS oficiais do Jamendo.
function getJamendoPlaybackUrl(value) {
    if (typeof value !== "string") {
        return "";
    }
    try {
        const url = new URL(value);
        return url.protocol === "https:"
            && (url.hostname === "jamendo.com" || url.hostname.endsWith(".jamendo.com"))
            ? url.href
            : "";
    } catch {
        return "";
    }
}

// Require an official Creative Commons URL before exposing a downloadable full track.
// Exige uma URL oficial Creative Commons antes de liberar a faixa completa para reprodução.
function getJamendoLicenseUrl(value) {
    if (typeof value !== "string") {
        return "";
    }
    try {
        const url = new URL(value);
        return url.protocol === "https:"
            && (url.hostname === "creativecommons.org" || url.hostname.endsWith(".creativecommons.org"))
            ? url.href
            : "";
    } catch {
        return "";
    }
}

async function handleJamendoSearch(url, response) {
    const [query] = requiredQuery(url, ["q"]) || [];
    if (!query) {
        sendJson(response, 400, { error: "A valid search term is required." });
        return;
    }
    const clientId = environment.JAMENDO_CLIENT_ID;
    if (!clientId) {
        sendJson(response, 503, {
            error: "Jamendo is not configured. Set JAMENDO_CLIENT_ID in the local .env file."
        });
        return;
    }

    const endpoint = new URL(
        API_CONFIG.providers.jamendo.endpoints.search(query),
        API_CONFIG.providers.jamendo.baseUrl
    );
    endpoint.searchParams.set("client_id", clientId);
    const payload = await fetchJsonFromProvider(
        API_CONFIG.providers.jamendo.baseUrl,
        `${endpoint.pathname}${endpoint.search}`
    );
    if (payload.headers?.status && payload.headers.status !== "success") {
        throw new Error(payload.headers.error_message || "Jamendo could not complete the request.");
    }
    const tracks = (payload.results || []).map((track) => {
        const licenseUrl = getJamendoLicenseUrl(track.license_ccurl);
        const downloadable = track.audiodownload_allowed === true
            || track.audiodownload_allowed === "true"
            || track.audiodownload_allowed === 1;
        return {
            id: String(track.id || ""),
            title: String(track.name || ""),
            artistName: String(track.artist_name || ""),
            artistId: String(track.artist_id || ""),
            albumName: String(track.album_name || ""),
            albumId: String(track.album_id || ""),
            image: String(track.album_image || ""),
            durationSeconds: Number(track.duration) || 0,
            externalUrl: String(track.shareurl || ""),
            licenseUrl,
            playbackUrl: downloadable && licenseUrl
                ? getJamendoPlaybackUrl(track.audiodownload)
                : ""
        };
    }).filter((track) => track.id && track.title);
    sendJson(response, 200, { provider: "jamendo", results: tracks });
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
    const upstream = await fetch(url, { signal: AbortSignal.timeout(8000) });
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
                "X-Content-Type-Options": "nosniff",
                "Permissions-Policy": "camera=(), microphone=(), geolocation=()"
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
            "X-Content-Type-Options": "nosniff",
            "Permissions-Policy": "camera=(), microphone=(), geolocation=()"
        });
        fs.createReadStream(filePath).pipe(response);
    });
}

// Encaminha APIs da mesma origem e entrega somente arquivos da pasta pública.
// Route same-origin APIs and serve files only from the public directory.
async function handleRequest(request, response) {
    const url = new URL(request.url, "http://localhost");
    if (request.method !== "GET" && request.method !== "HEAD") {
        sendJson(response, 405, { error: "Only GET and HEAD requests are supported." });
        return;
    }

    try {
        if (url.pathname === API_CONFIG.serverRoutes.configuration) {
            sendJson(response, 200, {
                spotifyClientId: environment.SPOTIFY_CLIENT_ID || "",
                jamendoEnabled: Boolean(environment.JAMENDO_CLIENT_ID),
                audioDbEnabled: Boolean(environment[API_CONFIG.providers.audioDb.apiKeyEnvironmentVariable]),
                lyricsProviders: {
                    lyricsOvh: true,
                    genius: Boolean(environment.GENIUS_ACCESS_TOKEN),
                    musixmatch: Boolean(environment.MUSIXMATCH_API_KEY)
                }
            });
            return;
        }
        if (url.pathname === API_CONFIG.providers.audioDb.proxyBasePath) {
            const action = url.searchParams.get("action");
            const kind = url.searchParams.get("kind") || "";
            if (action === "search" && ["artist", "album", "track"].includes(kind)) {
                await handleAudioDbSearch(url, response, kind);
                return;
            }
            if (
                action === "lookup"
                && ["artist", "artist_mb", "album", "album_mb", "track", "track_mb"].includes(kind)
            ) {
                await handleAudioDbLookup(url, response, kind);
                return;
            }
            if (action === "discography") {
                await handleAudioDbDiscography(url, response);
                return;
            }
            sendJson(response, 400, { error: "Unsupported TheAudioDB action or resource." });
            return;
        }
        if (url.pathname === API_CONFIG.providers.musicBrainz.proxyBasePath) {
            await handleMusicBrainzArtist(url, response);
            return;
        }
        const audioDbSearch = url.pathname.match(
            new RegExp(`^${API_CONFIG.providers.audioDb.searchRoute}/(artist|album|track)$`)
        );
        if (audioDbSearch) {
            await handleAudioDbSearch(url, response, audioDbSearch[1]);
            return;
        }
        const audioDbLookup = url.pathname.match(
            new RegExp(`^${API_CONFIG.providers.audioDb.lookupRoute}/(artist|artist_mb|album|album_mb|track|track_mb)$`)
        );
        if (audioDbLookup) {
            await handleAudioDbLookup(url, response, audioDbLookup[1]);
            return;
        }
        if (url.pathname === API_CONFIG.providers.audioDb.discographyRoute) {
            await handleAudioDbDiscography(url, response);
            return;
        }
        if (url.pathname === API_CONFIG.providers.musicBrainz.artistSearchRoute) {
            await handleMusicBrainzArtist(url, response);
            return;
        }
        if (url.pathname === API_CONFIG.providers.lyrics.proxyPath) {
            await handleLyrics(url, response);
            return;
        }
        if (url.pathname === API_CONFIG.providers.jamendo.proxyBasePath) {
            await handleJamendoSearch(url, response);
            return;
        }
        if (url.pathname === API_CONFIG.providers.jamendo.searchRoute) {
            await handleJamendoSearch(url, response);
            return;
        }
        if (url.pathname === API_CONFIG.providers.deezer.proxyBasePath) {
            const action = url.searchParams.get("action");
            if (action === "search") {
                await handleDeezerSearch(url, response);
                return;
            }
            const id = url.searchParams.get("id") || "";
            if (action === "detail") {
                const resource = url.searchParams.get("resource") || "";
                url.pathname = `${API_CONFIG.providers.deezer.detailRoutePrefix}${encodeURIComponent(resource)}/${encodeURIComponent(id)}`;
                await handleDeezerDetail(url, response);
                return;
            }
            if (action === "artist-albums") {
                url.pathname = `${API_CONFIG.providers.deezer.detailRoutePrefix}artist/${encodeURIComponent(id)}/albums`;
                await handleDeezerDetail(url, response);
                return;
            }
            sendJson(response, 400, { error: "Unsupported Deezer action." });
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
        if (url.pathname === API_CONFIG.providers.invidious.proxyBasePath) {
            const action = url.searchParams.get("action");
            if (action === "search") {
                await handleInvidiousSearch(url, response);
                return;
            }
            if (action === "video") {
                const videoId = url.searchParams.get("id") || "";
                url.pathname = `${API_CONFIG.providers.invidious.detailRoutePrefix}${encodeURIComponent(videoId)}`;
                await handleInvidiousDetail(url, response);
                return;
            }
            sendJson(response, 400, { error: "Unsupported Invidious action." });
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
}

if (require.main === module) {
    // Usa loopback por padrão para não expor a configuração local da API à rede.
    // Listen on loopback by default so local API configuration is not exposed to the network.
    const port = Number(environment.PORT || 8765);
    http.createServer(handleRequest).listen(port, "127.0.0.1", () => {
        console.log(`Open Music Hub available at http://127.0.0.1:${port}`);
    });
}

module.exports = handleRequest;
