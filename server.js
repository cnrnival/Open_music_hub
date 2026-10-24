// Servidor local de mesma origem: entrega a aplicação pública e encaminha Deezer e Invidious.
// Same-origin server: serves the public app and proxies Deezer and Invidious.
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { Readable } = require("node:stream");
const API_CONFIG = require("./public/js/config.js");

// Resolve caminhos relativos à pasta do projeto e mantenha privado o arquivo de ambiente local.
// Resolve all static paths relative to this project and keep the local environment file private.
const projectRoot = __dirname;
const publicRoot = path.join(projectRoot, "public");
const localEnvPath = path.join(projectRoot, ".env");
const environment = { ...process.env };
let musicBrainzQueue = Promise.resolve();
let lastMusicBrainzRequestAt = 0;
// Cache de URLs de áudio resolvidas para evitar consultar o Invidious a cada requisição de stream.
// Cache resolved audio URLs so seeking and downloading do not refetch video metadata every time.
const invidiousAudioCache = new Map();
const INVIDIOUS_AUDIO_CACHE_TTL_MS = 30 * 60 * 1000;
// Arquivos de áudio são transferidos por vários minutos; um timeout curto abortaria a metade do fluxo.
// Audio files stream for minutes; a short timeout would abort the transfer halfway through.
const INVIDIOUS_MEDIA_TIMEOUT_MS = 5 * 60 * 1000;
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

function getAudioDbEntityList(payload, collectionName) {
    const collection = payload[collectionName];
    if (Array.isArray(collection)) {
        return collection;
    }
    return collection && typeof collection === "object" ? [collection] : [];
}

async function fetchAudioDb(resourcePath) {
    return fetchJsonFromProvider(
        API_CONFIG.providers.audioDb.baseUrl,
        API_CONFIG.providers.audioDb.providerPath(resourcePath)
    );
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

function requiredAudioDbId(value, musicBrainz = false) {
    return musicBrainz
        ? /^[0-9a-f-]{36}$/i.test(value)
        : /^\d+$/.test(value);
}

async function handleAudioDbAction(url, response) {
    const config = API_CONFIG.providers.audioDb;
    const action = url.searchParams.get("action") || "";
    const artistId = url.searchParams.get("id") || "";
    let resourcePath = "";
    let collectionName = "";
    let item = false;
    let normalizeArtist = false;

    switch (action) {
        case "search-artist": {
            const [artist] = requiredQuery(url, ["artist"]) || [];
            if (artist) {
                resourcePath = config.endpoints.searchArtist(artist);
                collectionName = "artists";
                normalizeArtist = true;
            }
            break;
        }
        case "search-discography": {
            const [artist] = requiredQuery(url, ["artist"]) || [];
            if (artist) {
                resourcePath = config.endpoints.searchDiscography(artist);
                collectionName = "album";
            }
            break;
        }
        case "search-discography-mb": {
            const [mbid] = requiredQuery(url, ["mbid"]) || [];
            if (mbid && requiredAudioDbId(mbid, true)) {
                resourcePath = config.endpoints.searchDiscographyMB(mbid);
                collectionName = "album";
            }
            break;
        }
        case "search-album": {
            const values = requiredQuery(url, ["artist", "album"]);
            if (values) {
                resourcePath = config.endpoints.searchAlbum(...values);
                collectionName = "album";
            }
            break;
        }
        case "search-track": {
            const values = requiredQuery(url, ["artist", "track"]);
            if (values) {
                resourcePath = config.endpoints.searchTrack(...values);
                collectionName = "track";
            }
            break;
        }
        case "lookup-artist":
        case "lookup-artist-mb":
        case "lookup-artist-social":
        case "lookup-album":
        case "lookup-album-by-album-id":
        case "lookup-album-mb":
        case "lookup-track-by-album":
        case "lookup-track-by-id":
        case "lookup-track-mb": {
            const musicBrainz = action.endsWith("-mb");
            if (!requiredAudioDbId(artistId, musicBrainz)) {
                break;
            }
            const endpointByAction = {
                "lookup-artist": ["lookupArtist", "artists", true],
                "lookup-artist-mb": ["lookupArtistMB", "artists", true],
                "lookup-artist-social": ["lookupArtistSocial", "artists", false],
                "lookup-album": ["lookupAlbum", "album", false],
                "lookup-album-by-album-id": ["lookupAlbumByAlbumId", "album", false],
                "lookup-album-mb": ["lookupAlbumMB", "album", false],
                "lookup-track-by-album": ["lookupTrackByAlbum", "track", false],
                "lookup-track-by-id": ["lookupTrackById", "track", false],
                "lookup-track-mb": ["lookupTrackMB", "track", false]
            };
            const [endpointName, collection, normalize] = endpointByAction[action];
            resourcePath = config.endpoints[endpointName](artistId);
            collectionName = collection;
            item = true;
            normalizeArtist = normalize;
            break;
        }
        case "music-videos":
        case "music-videos-mb": {
            const musicBrainz = action.endsWith("-mb");
            if (!requiredAudioDbId(artistId, musicBrainz)) {
                break;
            }
            resourcePath = musicBrainz
                ? config.endpoints.musicVideosMB(artistId)
                : config.endpoints.musicVideos(artistId);
            collectionName = "mvids";
            break;
        }
        case "track-top10": {
            const [artist] = requiredQuery(url, ["artist"]) || [];
            if (artist) {
                resourcePath = config.endpoints.trackTop10(artist);
                collectionName = "track";
            }
            break;
        }
        case "most-loved-tracks":
            resourcePath = config.endpoints.mostLovedTracks;
            collectionName = "track";
            break;
        case "most-loved-albums":
            resourcePath = config.endpoints.mostLovedAlbums;
            collectionName = "album";
            break;
        case "trending": {
            const country = url.searchParams.get("country") || "us";
            const type = url.searchParams.get("type") || "itunes";
            const format = url.searchParams.get("format") || "albums";
            if (!/^[a-z]{2}$/i.test(country) || !/^[a-z]{1,20}$/i.test(type)
                || !["albums", "tracks"].includes(format)) {
                break;
            }
            resourcePath = config.endpoints.trending(country, type, format);
            collectionName = "trending";
            break;
        }
        default:
            break;
    }

    if (!resourcePath) {
        sendJson(response, 400, { error: "Unsupported TheAudioDB action or invalid parameters." });
        return;
    }

    const payload = await fetchAudioDb(resourcePath);
    if (payload.Message) {
        const error = new Error(String(payload.Message));
        error.statusCode = 404;
        error.provider = "audiodb";
        throw error;
    }
    const results = getAudioDbEntityList(payload, collectionName);
    if (item) {
        const result = results[0] || null;
        sendJson(response, 200, {
            provider: "audiodb",
            item: result && normalizeArtist ? normalizeAudioDbArtist(result) : result
        });
        return;
    }
    sendJson(response, 200, {
        provider: "audiodb",
        results: normalizeArtist ? results.map(normalizeAudioDbArtist) : results
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

// Busca letra com marcação de tempo (LRC) no LrcLib para sincronizar com o áudio.
// Fetch time-synced lyrics (LRC) from LrcLib so they can follow audio playback.
async function fetchSyncedLyrics(artist, title) {
    const lrclib = API_CONFIG.providers.lyrics.lrclib;
    const payload = await fetchJsonFromProvider(
        lrclib.baseUrl,
        lrclib.lookupPath(artist, title),
        { "User-Agent": lrclib.userAgent },
        6000
    );
    const syncedLyrics = typeof payload.syncedLyrics === "string" ? payload.syncedLyrics.trim() : "";
    const plainLyrics = typeof payload.plainLyrics === "string" ? payload.plainLyrics.trim() : "";
    if (syncedLyrics) {
        return { synced: true, lyrics: plainLyrics, syncedLyrics };
    }
    if (plainLyrics) {
        return { synced: false, lyrics: plainLyrics, syncedLyrics: "" };
    }
    return null;
}

async function handleLyrics(url, response) {
    const values = requiredQuery(url, ["artist", "title"]);
    if (!values) {
        sendJson(response, 400, { error: "Artist and track title are required." });
        return;
    }
    const [artist, title] = values;

    if (url.searchParams.get("format") === "synced") {
        try {
            const synced = await fetchSyncedLyrics(artist, title);
            if (synced) {
                sendJson(response, 200, {
                    provider: "lrclib",
                    artist,
                    title,
                    synced: synced.synced,
                    lyrics: synced.lyrics,
                    syncedLyrics: synced.syncedLyrics
                });
                return;
            }
        } catch (error) {
            // O LrcLib responde 404 quando não conhece a faixa; só então tentamos o Lyrics.ovh.
            // LrcLib answers 404 for unknown tracks; only then do we try Lyrics.ovh.
            if (error.statusCode !== 404) {
                console.error("LrcLib lookup failed.", error.message);
            }
        }
        // Sem LRC disponível: cai para a letra simples do Lyrics.ovh abaixo.
        // No LRC available: falls through to plain Lyrics.ovh lyrics below.
    }

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
        synced: false,
        lyrics: payload.lyrics,
        syncedLyrics: ""
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

function delay(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

// Consulta metadados no Invidious. A instância pública falha de forma intermitente (5xx),
// então repetimos algumas vezes com backoff antes de desistir.
// Fetch Invidious metadata. The public instance fails intermittently (5xx),
// so we retry a few times with backoff before giving up.
async function fetchInvidious(resourcePath, { attempts = 4 } = {}) {
    const url = new URL(resourcePath, API_CONFIG.providers.invidious.baseUrl);
    // 403/408/425/429 e 5xx são falhas transitórias da instância pública e valem nova tentativa.
    // 403/408/425/429 and 5xx are transient public-instance failures and are worth retrying.
    const retryableStatuses = new Set([403, 408, 425, 429]);
    let lastError;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        try {
            const upstream = await fetch(url, { signal: AbortSignal.timeout(10000) });
            if (upstream.ok) {
                const payload = await upstream.json();
                if (payload.error) {
                    throw new Error(String(payload.error));
                }
                return payload;
            }
            lastError = new Error(`Invidious responded with HTTP ${upstream.status}.`);
            if (upstream.status < 500 && !retryableStatuses.has(upstream.status)) {
                throw lastError;
            }
        } catch (error) {
            lastError = error;
        }
        if (attempt < attempts) {
            // Backoff com jitter para não sincronizar novas tentativas no mesmo instante.
            // Backoff with jitter so retries do not all fire at the same moment.
            await delay(400 * attempt + Math.floor(Math.random() * 250));
        }
    }
    throw lastError;
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

// Normaliza a qualidade pedida pelo player; desconhecida cai na maior disponível.
// Normalize the quality requested by the player; unknown values fall back to the best one.
function normalizeStreamQuality(value) {
    const quality = String(value || "").toLowerCase();
    return ["low", "normal", "high"].includes(quality) ? quality : "high";
}

// Escolhe um fluxo somente de áudio (m4a/webm) em adaptiveFormats, ignorando vídeo muxado.
// Pick an audio-only stream (m4a/webm) from adaptiveFormats, ignoring muxed video tracks.
// - low: menor bitrate • normal: mais próximo de 128 kbps • high: maior bitrate.
// - low: lowest bitrate • normal: closest to 128 kbps • high: highest bitrate.
function selectInvidiousAudioFormat(video, quality = "high") {
    const formats = Array.isArray(video?.adaptiveFormats) ? video.adaptiveFormats : [];
    const audioFormats = formats.filter((format) => {
        if (!format || !format.url) {
            return false;
        }
        const mimeType = String(format.type || format.encoding || "").toLowerCase();
        const container = String(format.container || "").toLowerCase();
        if (mimeType.startsWith("video/")) {
            return false;
        }
        return mimeType.startsWith("audio/")
            || container === "m4a"
            || container === "webm"
            || container === "mp4";
    });
    const tier = normalizeStreamQuality(quality);
    audioFormats.sort((left, right) => (Number(left.bitrate) || 0) - (Number(right.bitrate) || 0));
    let selected;
    if (tier === "low") {
        selected = audioFormats[0];
    } else if (tier === "normal") {
        selected = audioFormats.reduce((closest, format) => (
            Math.abs((Number(format.bitrate) || 0) - 128000)
                < Math.abs((Number(closest.bitrate) || 0) - 128000)
                ? format
                : closest
        ), audioFormats[0]);
    } else {
        selected = audioFormats[audioFormats.length - 1];
    }
    if (!selected) {
        return null;
    }
    return {
        url: String(selected.url),
        mimeType: String(selected.type || ""),
        container: String(selected.container || ""),
        bitrate: Number(selected.bitrate) || 0,
        contentLength: Number(selected.clen || selected.contentLength) || 0
    };
}

// Resolve (e memoriza) o fluxo de áudio de um vídeo do Invidious.
// Resolve (and memoize) a video's audio stream from Invidious.
// Com allowMissing, a falta de áudio devolve apenas os metadados em vez de falhar a página inteira.
// With allowMissing, a missing audio stream returns metadata instead of failing the whole page.
async function resolveInvidiousAudio(videoId, { allowMissing = false, force = false, quality = "high" } = {}) {
    const tier = normalizeStreamQuality(quality);
    // O cache separa as qualidades: o mesmo vídeo pode ter mais de um fluxo escolhido.
    // The cache is keyed by quality: the same video can map to more than one chosen stream.
    const cacheKey = `${videoId}|${tier}`;
    const cached = invidiousAudioCache.get(cacheKey);
    if (!force && cached && Date.now() - cached.resolvedAt < INVIDIOUS_AUDIO_CACHE_TTL_MS) {
        return cached;
    }
    let video;
    try {
        video = await fetchInvidious(API_CONFIG.providers.invidious.endpoints.video(videoId));
    } catch (error) {
        // Se a instância falhar depois de todas as tentativas, reutilizamos o último resultado conhecido.
        // If the instance fails after every attempt, reuse the last known good result.
        if (cached?.audio) {
            console.warn(`Serving stale Invidious metadata for ${videoId}.`, error.message);
            invidiousAudioCache.set(cacheKey, { ...cached, resolvedAt: Date.now() });
            return cached;
        }
        throw error;
    }
    const audio = selectInvidiousAudioFormat(video, tier);
    if (!audio) {
        if (allowMissing) {
            return { item: normalizeInvidiousMetadata(video), audio: null, resolvedAt: Date.now() };
        }
        const error = new Error("No audio-only stream is available for this video.");
        error.statusCode = 404;
        throw error;
    }
    // Resolve URLs relativas contra a instância para que o proxy sempre busque um host HTTPS.
    // Resolve relative URLs against the instance so the proxy always targets an HTTPS host.
    const absoluteUrl = new URL(audio.url, API_CONFIG.providers.invidious.baseUrl);
    if (absoluteUrl.protocol !== "https:") {
        const error = new Error("Invidious returned a non-HTTPS audio stream.");
        error.statusCode = 502;
        throw error;
    }
    const resolved = {
        item: normalizeInvidiousMetadata(video),
        audio: { ...audio, url: absoluteUrl.href },
        resolvedAt: Date.now()
    };
    invidiousAudioCache.set(cacheKey, resolved);
    return resolved;
}

function invidiousStreamPath(videoId, quality = "high") {
    const tier = normalizeStreamQuality(quality);
    return `${API_CONFIG.providers.invidious.proxyBasePath}?action=stream&id=${encodeURIComponent(videoId)}&quality=${tier}`;
}

// Devolve metadados e a URL de áudio de mesma origem usada pelo player e pelo download offline.
// Return metadata plus the same-origin audio URL used by the player and offline download.
async function handleInvidiousDetail(url, response) {
    const videoId = url.pathname.slice(API_CONFIG.providers.invidious.detailRoutePrefix.length);
    if (!/^[A-Za-z0-9_-]{1,32}$/.test(videoId)) {
        sendJson(response, 400, { error: "Invalid Invidious video ID." });
        return;
    }
    const quality = normalizeStreamQuality(url.searchParams.get("quality"));
    const resolved = await resolveInvidiousAudio(videoId, { allowMissing: true, quality });
    const streamPath = resolved.audio ? invidiousStreamPath(videoId, quality) : "";
    sendJson(response, 200, {
        provider: "invidious",
        item: {
            ...resolved.item,
            audioUrl: streamPath,
            directAudioUrl: resolved.audio?.url || "",
            audioMimeType: resolved.audio?.mimeType || "",
            audioContainer: resolved.audio?.container || "",
            audioBitrate: resolved.audio?.bitrate || 0
        },
        audioUrl: streamPath,
        directAudioUrl: resolved.audio?.url || "",
        audio: resolved.audio
            ? {
                url: streamPath,
                directUrl: resolved.audio.url,
                mimeType: resolved.audio.mimeType,
                container: resolved.audio.container,
                bitrate: resolved.audio.bitrate
            }
            : null
    });
}

// Ação dedicada que devolve apenas a URL de áudio, usada quando a busca não trouxe o formato.
// Dedicated action returning just the audio URL when search results lacked media formats.
async function handleInvidiousAudio(url, response) {
    const videoId = url.searchParams.get("id") || "";
    if (!/^[A-Za-z0-9_-]{1,32}$/.test(videoId)) {
        sendJson(response, 400, { error: "Invalid Invidious video ID." });
        return;
    }
    const quality = normalizeStreamQuality(url.searchParams.get("quality"));
    const resolved = await resolveInvidiousAudio(videoId, { quality });
    sendJson(response, 200, {
        provider: "invidious",
        videoId,
        item: resolved.item,
        audioUrl: invidiousStreamPath(videoId, quality),
        directAudioUrl: resolved.audio.url,
        audio: {
            url: invidiousStreamPath(videoId, quality),
            directUrl: resolved.audio.url,
            mimeType: resolved.audio.mimeType,
            container: resolved.audio.container,
            bitrate: resolved.audio.bitrate
        }
    });
}

// Encaminha o fluxo de áudio do Invidious pela mesma origem, preservando Range para seek e download.
// Proxy the Invidious audio stream same-origin while preserving Range for seeking and downloads.
async function handleInvidiousStream(request, response, url) {
    const videoId = url.searchParams.get("id") || "";
    if (!/^[A-Za-z0-9_-]{1,32}$/.test(videoId)) {
        sendJson(response, 400, { error: "Invalid Invidious video ID." });
        return;
    }
    const headers = {};
    if (request.headers.range) {
        headers.Range = request.headers.range;
    }
    const fetchMedia = (audioUrl) => fetch(audioUrl, {
        headers,
        signal: AbortSignal.timeout(INVIDIOUS_MEDIA_TIMEOUT_MS)
    });
    const quality = normalizeStreamQuality(url.searchParams.get("quality"));
    let resolved = await resolveInvidiousAudio(videoId, { quality });
    let upstream = await fetchMedia(resolved.audio.url);
    // URLs do YouTube expiram ou são recusadas; uma segunda resolução costuma gerar uma URL válida.
    // YouTube URLs expire or get rejected; resolving again usually yields a valid URL.
    if ([403, 404, 410].includes(upstream.status)) {
        console.warn(`Invidious media refused with HTTP ${upstream.status}; resolving again.`);
        resolved = await resolveInvidiousAudio(videoId, { force: true, quality });
        upstream = await fetchMedia(resolved.audio.url);
    }
    if (!upstream.ok && upstream.status !== 206) {
        throw new Error(`Invidious media responded with HTTP ${upstream.status}.`);
    }
    const mimeType = resolved.audio.mimeType.split(";")[0].trim();
    const responseHeaders = {
        "Content-Type": mimeType.startsWith("audio/") ? mimeType : "audio/mp4",
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff"
    };
    const contentLength = upstream.headers.get("content-length");
    const contentRange = upstream.headers.get("content-range");
    if (contentLength) {
        responseHeaders["Content-Length"] = contentLength;
    }
    if (contentRange) {
        responseHeaders["Content-Range"] = contentRange;
    }
    response.writeHead(upstream.status === 206 ? 206 : 200, responseHeaders);
    if (!upstream.body) {
        response.end();
        return;
    }
    // Sem tratamento de erro, um abort do cliente (ex.: seek ou download cancelado) derrubaria o processo.
    // Without error handling, a client abort (seek or cancelled download) would crash the process.
    const stream = Readable.fromWeb(upstream.body);
    stream.on("error", (error) => {
        console.warn("Invidious media stream interrupted.", error.message);
        if (!response.writableEnded) {
            response.destroy();
        }
    });
    response.on("close", () => {
        stream.destroy();
    });
    stream.pipe(response);
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
                jamendoEnabled: Boolean(environment.JAMENDO_CLIENT_ID),
                audioDbEnabled: true,
                lyricsProviders: {
                    lyricsOvh: true,
                    genius: Boolean(environment.GENIUS_ACCESS_TOKEN),
                    musixmatch: Boolean(environment.MUSIXMATCH_API_KEY)
                }
            });
            return;
        }
        if (url.pathname === API_CONFIG.providers.audioDb.proxyBasePath) {
            await handleAudioDbAction(url, response);
            return;
        }
        if (url.pathname === API_CONFIG.providers.musicBrainz.proxyBasePath) {
            await handleMusicBrainzArtist(url, response);
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
            if (action === "audio") {
                await handleInvidiousAudio(url, response);
                return;
            }
            if (action === "stream") {
                await handleInvidiousStream(request, response, url);
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
            const statusCode = error.statusCode === 404 ? 404 : 502;
            sendJson(response, statusCode, {
                error: error.provider === "audiodb"
                    ? "TheAudioDB did not find a matching resource."
                    : "Music provider request failed. Try again later."
            });
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
module.exports.selectInvidiousAudioFormat = selectInvidiousAudioFormat;
