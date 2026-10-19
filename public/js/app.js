const playButton = document.querySelector(".music-player__play");
const playIcon = playButton.querySelector(".music-player__play-icon");
const audio = document.querySelector(".music-player__audio");
const fileInput = document.querySelector(".music-player__file-input");
const title = document.querySelector(".Pplay-music__title");
const artist = document.querySelector(".Pplay-music__artist");
const status = document.querySelector(".music-player__status");
const currentTimeLabel = document.querySelector(".music-player__current-time");
const durationLabel = document.querySelector(".music-player__duration");
const progress = document.querySelector(".music-player__progress");
const timeline = document.querySelector(".music-player__timeline");
const volumeControl = document.querySelector(".music-player__volume-control");
const muteButton = document.querySelector(".music-player__mute");
const volumeIcon = muteButton.querySelector(".mdi");
const searchInput = document.querySelector("#input-search");
const dialog = document.querySelector(".app-dialog");
const dialogTitle = document.querySelector("#dialog-title");
const dialogBody = document.querySelector(".app-dialog__body");
const dialogConfirm = document.querySelector(".app-dialog__confirm");
const toast = document.querySelector(".toast");
const apiSettingsDialog = document.querySelector(".api-settings-dialog");
const spotifyClientIdInput = document.querySelector("#spotify-client-id");
const workspace = document.querySelector(".workspace");
const libraryPanel = document.querySelector(".library-panel");
const mainView = document.querySelector(".main-view");
const nowPlayingPanel = document.querySelector(".now-playing-panel");
const libraryList = document.querySelector(".library-list");
const homeContent = [...document.querySelectorAll(".content-section[data-content-type]")];
const searchableItems = [...document.querySelectorAll("[data-searchable]")];
const defaultTrackTitle = "Cristal (Remasterizado 2024)";
const detailView = document.querySelector(".detail-view");
const newsView = document.querySelector(".news-view");
const newsStatus = document.querySelector(".news-status");
const newsGrid = document.querySelector(".news-grid");
const detailHeaderArt = document.querySelector(".detail-header__art");
const detailKind = document.querySelector(".detail-kind");
const detailTitle = document.querySelector(".detail-title");
const detailDescription = document.querySelector(".detail-description");
const detailMeta = document.querySelector(".detail-meta");
const detailTrackList = document.querySelector(".detail-track-list");
const artistSupplemental = document.querySelector(".artist-supplemental");
const artistSupplementalStatus = document.querySelector(".artist-supplemental__status");
const artistDiscography = document.querySelector(".artist-discography");
const apiSearchSection = document.querySelector(".api-search-results");
const apiSearchGrid = document.querySelector(".api-search-grid");
const apiSearchStatus = document.querySelector(".api-search-status");
const storageKeys = Object.freeze({
    stats: "open-music-hub:stats",
    legacyStats: "clone-spotify:stats",
    clientId: "open-music-hub:client-id",
    legacyClientId: "clone-spotify:client-id",
    oauthState: "open-music-hub:oauth-state",
    oauthVerifier: "open-music-hub:oauth-verifier"
});

const localAudioUrls = new Set();
let currentTrack = {
    provider: "local",
    kind: "track",
    id: "initial-cristal",
    title: defaultTrackTitle,
    artistName: "lilberto33",
    durationSeconds: 0,
    previewUrl: "music/lil-giela-cristal.mp3"
};
let currentDetail;
let currentDetailTracks = [];
let spotifyAccessToken;
let spotifyTokenExpiresAt = 0;
let spotifyClientId = "";
let jamendoEnabled = false;
let audioDbEnabled = false;
let spotifyAuthState = "";
let spotifyAuthVerifier = "";
let searchRequestId = 0;
let searchDebounce;
let apiSearchAbortController;
let pendingPlayCount = false;
let hasPlayedCurrentTrack = false;
let providerSearchResults = [];
let playbackQueue = [];
let playbackQueueIndex = -1;
let previousVolume = Number(volumeControl.value);
let toastTimeout;
let installPrompt;
let libraryFilter = "all";
let homeFilter = "all";
let alphabeticalSort = false;
let librarySequence = libraryList.children.length;
const savedLibraryItems = new Map();
let isSeeking = false;
let isPointerSeeking = false;
let ignoreNextRangeChange = false;
let playbackRequestId = 0;
let jamendoFallbackAttemptId = 0;

libraryList.querySelectorAll(".library-item").forEach((item, index) => {
    item.dataset.sequence = String(librarySequence - index);
});

audio.volume = previousVolume;
audio.src = "music/lil-giela-cristal.mp3";
title.textContent = defaultTrackTitle;
artist.textContent = "lilberto33";
audio.load();

function showToast(message) {
    toast.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(toastTimeout);
    toastTimeout = window.setTimeout(() => toast.classList.remove("is-visible"), 2600);
}

function showDialog(heading, message, confirmText = "Entendi") {
    dialogTitle.textContent = heading;
    dialogBody.replaceChildren();
    const paragraph = document.createElement("p");
    paragraph.textContent = message;
    dialogBody.append(paragraph);
    dialogConfirm.textContent = confirmText;
    dialog.dataset.action = "";
    dialog.showModal();
}

// Render lyric responses as plain text so provider content is never interpreted as markup.
// Renderiza letras como texto para impedir que conteúdo externo seja interpretado como HTML.
async function showLyrics() {
    const trackArtist = currentTrack.artistName;
    const trackTitle = currentTrack.title;
    showDialog("Letra da música", "Buscando letras em Lyrics.ovh…", "Fechar");
    if (!trackArtist || trackArtist === "Arquivo local" || !trackTitle) {
        dialogBody.firstElementChild.textContent = "As letras precisam do nome do artista e da faixa. Procure a música no catálogo para tentar novamente.";
        return;
    }
    try {
        const payload = await fetchJson(API_CONFIG.providers.lyrics.searchPath(trackArtist, trackTitle));
        const lyrics = document.createElement("pre");
        lyrics.className = "lyrics-text";
        lyrics.textContent = payload.lyrics;
        dialogBody.replaceChildren(lyrics);
    } catch (error) {
        console.error("Could not load lyrics.", error);
        dialogBody.firstElementChild.textContent = `Não foi possível carregar a letra: ${error.message}`;
    }
}

function showPlaylistDialog() {
    dialogTitle.textContent = "Criar playlist";
    dialogBody.replaceChildren();
    const label = document.createElement("label");
    label.htmlFor = "new-playlist-name";
    label.textContent = "Nome da playlist";
    const input = document.createElement("input");
    input.id = "new-playlist-name";
    input.name = "playlist";
    input.maxLength = 60;
    input.required = true;
    input.placeholder = "Minha playlist";
    dialogBody.append(label, input);
    dialogConfirm.textContent = "Criar";
    dialog.dataset.action = "create-playlist";
    dialog.showModal();
    input.focus();
}

// Mantém as buscas dos provedores fora do HTML; normaliza os registros antes de renderizar.
// Keep provider searches out of the markup; records are normalized before rendering.
function normalizeDeezerItem(type, item) {
    const artistData = item.artist || {};
    const albumData = item.album || {};
    const picture = item.picture_big || item.picture_medium || item.cover_big || item.cover_medium
        || albumData.cover_big || albumData.cover_medium || "";

    return {
        provider: "deezer",
        kind: type,
        id: String(item.id),
        title: item.title || item.name || "Sem título",
        description: item.description || "",
        artistName: artistData.name || item.creator?.name || "",
        artistId: artistData.id ? String(artistData.id) : "",
        artistImage: artistData.picture_big || artistData.picture_medium || "",
        albumName: albumData.title || "",
        albumId: albumData.id ? String(albumData.id) : "",
        image: picture,
        previewUrl: item.preview || "",
        externalUrl: item.link || "",
        durationSeconds: Number(item.duration) || 0,
        trackCount: Number(item.nb_tracks) || 0,
        releaseDate: item.release_date || "",
        fanCount: Number(item.nb_fan) || 0,
        trackCountLabel: item.nb_tracks_human || ""
    };
}

// Normaliza registros do Spotify sem tratar a popularidade da API como reproduções reais.
// Normalize Spotify records without treating API popularity as actual play counts.
function normalizeSpotifyItem(type, item) {
    const track = type === "track" ? item : null;
    const album = track?.album || (type === "album" ? item : null);
    const primaryArtist = track?.artists?.[0] || album?.artists?.[0] || item.artists?.[0] || {};
    const firstImage = item.images?.[0]?.url || album?.images?.[0]?.url || track?.album?.images?.[0]?.url || "";

    return {
        provider: "spotify",
        kind: type,
        id: String(item.id),
        title: item.name || "Sem título",
        description: item.description || "",
        artistName: primaryArtist.name || item.owner?.display_name || "",
        artistId: primaryArtist.id ? String(primaryArtist.id) : "",
        artistImage: primaryArtist.images?.[0]?.url || "",
        albumName: album?.name || "",
        albumId: album?.id ? String(album.id) : "",
        image: firstImage,
        previewUrl: track?.preview_url || "",
        externalUrl: item.external_urls?.spotify || "",
        durationSeconds: track?.duration_ms ? Math.round(track.duration_ms / 1000) : 0,
        trackCount: item.tracks?.total || item.total_tracks || 0,
        releaseDate: album?.release_date || item.release_date || "",
        fanCount: item.followers?.total || 0,
        popularity: item.popularity || 0
    };
}

// Map only server-approved Jamendo fields into the shared track model.
// Mapeia somente campos Jamendo aprovados pelo servidor para o modelo de faixa compartilhado.
function normalizeJamendoItem(item) {
    return {
        provider: "jamendo",
        kind: "track",
        id: String(item.id),
        title: item.title || "Sem título",
        artistName: item.artistName || "Artista desconhecido",
        artistId: item.artistId || "",
        albumName: item.albumName || "",
        albumId: item.albumId || "",
        image: item.image || "",
        previewUrl: "",
        playbackUrl: item.playbackUrl || "",
        licenseUrl: item.licenseUrl || "",
        externalUrl: item.externalUrl || "",
        durationSeconds: Number(item.durationSeconds) || 0
    };
}

// Convert Invidious video metadata into the shared track shape without creating an audio stream URL.
// Converte metadados de vídeo do Invidious para o formato de faixa compartilhado sem criar URL de áudio.
function normalizeInvidiousItem(item) {
    const videoId = String(item.videoId || "");
    const thumbnail = [...(item.videoThumbnails || [])]
        .sort((left, right) => (right.width || 0) - (left.width || 0))[0];
    return {
        provider: "invidious",
        kind: "track",
        id: videoId,
        title: item.title || "Vídeo sem título",
        description: item.description || "",
        artistName: item.author || "Canal desconhecido",
        artistId: item.authorId || "",
        image: thumbnail?.url || "",
        previewUrl: "",
        externalUrl: videoId ? `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}` : "",
        durationSeconds: Number(item.lengthSeconds) || 0,
        viewCount: Number(item.viewCount) || 0
    };
}

// Lê as contagens deste navegador; elas não são estatísticas globais de reprodução do Spotify.
// Read only this browser's local interaction counters; they are not global Spotify play statistics.
function readLocalStats() {
    try {
        const storedStats = JSON.parse(
            localStorage.getItem(storageKeys.stats)
            || localStorage.getItem(storageKeys.legacyStats)
            || "{}"
        );
        if (!storedStats || typeof storedStats !== "object" || Array.isArray(storedStats)) {
            console.error("Stored local music statistics must be an object.");
            showToast("As estatísticas locais estão corrompidas; uma nova contagem será iniciada.");
            return {};
        }
        return storedStats;
    } catch (error) {
        console.error("Could not read local music statistics.", error);
        showToast("As estatísticas locais estão corrompidas; uma nova contagem será iniciada.");
        return {};
    }
}

// Salva contagens locais de reprodução e salvamento sem confundi-las com popularidade do catálogo.
// Save local play/save counts explicitly so provider popularity is never presented as user activity.
function updateLocalStats(item, update) {
    const stats = readLocalStats();
    const key = `${item.provider}:${item.kind}:${item.id}`;
    const stored = stats[key] || {};
    const previous = {
        plays: Number(stored.plays) || 0,
        saves: Number(stored.saves) || 0,
        saved: Boolean(stored.saved)
    };
    const next = update(previous);

    try {
        localStorage.setItem(storageKeys.stats, JSON.stringify({ ...stats, [key]: next }));
    } catch (error) {
        console.error("Could not save local music statistics.", error);
        showToast("Não foi possível salvar esta contagem neste navegador.");
    }
    return next;
}

// Cria links estáveis para detalhes de itens fornecidos pelas APIs.
// Build stable detail links for buttons whose content comes from the provider APIs.
function addDetailLink(parent, label, item, className = "detail-link") {
    if (!label) {
        return;
    }
    const link = document.createElement("button");
    link.className = className;
    link.type = "button";
    link.textContent = label;
    link.dataset.detailProvider = item.provider;
    link.dataset.detailKind = item.kind;
    link.dataset.detailId = item.id;
    link.addEventListener("click", () => openDetail(item));
    parent.append(link);
}

// Valida imagens dos provedores antes de usar as URLs como planos de fundo CSS.
// Validate provider images before using their URLs as CSS backgrounds.
function safeCoverUrl(value) {
    if (!value) {
        return "";
    }
    try {
        const url = new URL(value);
        const invidiousHost = new URL(API_CONFIG.providers.invidious.baseUrl).hostname;
        const audioDbHost = new URL(API_CONFIG.providers.audioDb.baseUrl).hostname;
        const allowedHost = url.protocol === "https:"
            && (url.hostname.endsWith(".dzcdn.net")
                || url.hostname.endsWith(".scdn.co")
                || url.hostname.endsWith(".ytimg.com")
                || url.hostname === "jamendo.com"
                || url.hostname.endsWith(".jamendo.com")
                || url.hostname === invidiousHost
                || url.hostname === audioDbHost
                || url.hostname.endsWith(".theaudiodb.com"));
        return allowedHost ? url.href : "";
    } catch (error) {
        console.error("A music provider returned an invalid cover URL.", error);
        return "";
    }
}

// Permite navegação externa somente para páginas oficiais retornadas pelo Deezer ou Spotify.
// Allow external navigation only to official Deezer or Spotify pages returned by those providers.
function safeProviderUrl(value) {
    if (!value) {
        return "";
    }
    try {
        const url = new URL(value);
        const approved = url.protocol === "https:"
            && (url.hostname === "spotify.com" || url.hostname.endsWith(".spotify.com")
                || url.hostname === "deezer.com" || url.hostname.endsWith(".deezer.com")
                || url.hostname === "jamendo.com" || url.hostname.endsWith(".jamendo.com")
                || url.hostname === "musicbrainz.org" || url.hostname.endsWith(".musicbrainz.org")
                || url.hostname === "creativecommons.org" || url.hostname.endsWith(".creativecommons.org")
                || url.hostname === "youtube.com" || url.hostname.endsWith(".youtube.com")
                || url.hostname === "youtu.be");
        return approved ? url.href : "";
    } catch (error) {
        console.error("A music provider returned an invalid external URL.", error);
        return "";
    }
}

// Cria a chave da contagem sem usar popularidade ou alcance estimado como reproduções.
// Return a counter key without using a provider's popularity or estimated reach as listens.
function localStatsFor(item) {
    const stats = readLocalStats();
    return stats[`${item.provider}:${item.kind}:${item.id}`] || { plays: 0, saves: 0, saved: false };
}

// Converte erros das APIs em mensagens claras e preserva detalhes técnicos no console.
// Turn provider API errors into readable UI messages while preserving diagnostic detail in the console.
async function fetchJson(url, options = {}) {
    const response = await fetch(url, options);
    let payload;
    try {
        payload = await response.json();
    } catch (error) {
        console.error(`Invalid JSON response from ${url}.`, error);
        throw new Error("O serviço de música retornou uma resposta inválida.");
    }
    if (!response.ok) {
        const message = payload.error?.message || payload.error_description || payload.error || response.statusText;
        throw new Error(String(message || `HTTP ${response.status}`));
    }
    return payload;
}

// O Spotify usa Authorization Code com PKCE; nenhum client secret é enviado ao navegador.
// Spotify uses Authorization Code with PKCE: no client secret is sent to the browser.
async function fetchSpotify(path) {
    if (!spotifyAccessToken || Date.now() >= spotifyTokenExpiresAt) {
        throw new Error("Conecte novamente sua conta Spotify para continuar.");
    }
    return fetchJson(new URL(path, API_CONFIG.providers.spotify.apiBaseUrl), {
        headers: { Authorization: `Bearer ${spotifyAccessToken}` }
    });
}

// O OAuth usa um verificador temporário por sessão e um Client ID público.
// OAuth uses a short-lived, per-session verifier and a public Client ID.
async function connectSpotify() {
    const clientId = spotifyClientIdInput.value.trim();
    if (!clientId) {
        document.querySelector(".api-settings-status").textContent = "Informe o Client ID público do Spotify Developer Dashboard.";
        spotifyClientIdInput.focus();
        return;
    }

    spotifyClientId = clientId;
    try {
        localStorage.setItem("clone-spotify:client-id", clientId);
    } catch (error) {
        console.error("Could not save the Spotify Client ID in this browser.", error);
        showToast("Não foi possível salvar o Client ID neste navegador.");
        return;
    }

    const stateBytes = crypto.getRandomValues(new Uint8Array(32));
    const verifierBytes = crypto.getRandomValues(new Uint8Array(48));
    spotifyAuthState = [...stateBytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    spotifyAuthVerifier = [...verifierBytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    sessionStorage.setItem(storageKeys.oauthState, spotifyAuthState);
    sessionStorage.setItem(storageKeys.oauthVerifier, spotifyAuthVerifier);

    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(spotifyAuthVerifier));
    const challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
    const redirectUri = new URL(API_CONFIG.providers.spotify.redirectPath, window.location.origin).href;
    const query = new URLSearchParams({
        client_id: spotifyClientId,
        response_type: "code",
        redirect_uri: redirectUri,
        code_challenge_method: "S256",
        code_challenge: challenge,
        state: spotifyAuthState,
        scope: API_CONFIG.providers.spotify.scopes
    });
    window.location.assign(`${API_CONFIG.providers.spotify.authorizationUrl}?${query}`);
}

// Troca o código de retorno somente após validar o estado OAuth armazenado nesta aba.
// Exchange the callback code only after checking the OAuth state stored in this tab.
async function finishSpotifyLogin() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (!code) {
        if (params.has("error")) {
            showToast(`Conexão Spotify cancelada: ${params.get("error")}.`);
            window.history.replaceState({}, "", window.location.pathname);
        }
        return;
    }

    const returnedState = params.get("state");
    const expectedState = sessionStorage.getItem(storageKeys.oauthState);
    const verifier = sessionStorage.getItem(storageKeys.oauthVerifier);
    if (!returnedState || returnedState !== expectedState || !verifier || !spotifyClientId) {
        window.history.replaceState({}, "", window.location.pathname);
        throw new Error("A validação de segurança do login Spotify falhou. Tente conectar novamente.");
    }

    const body = new URLSearchParams({
        client_id: spotifyClientId,
        grant_type: "authorization_code",
        code,
        redirect_uri: new URL(API_CONFIG.providers.spotify.redirectPath, window.location.origin).href,
        code_verifier: verifier
    });
    const token = await fetchJson(API_CONFIG.providers.spotify.tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body
    });
    spotifyAccessToken = token.access_token;
    spotifyTokenExpiresAt = Date.now() + Number(token.expires_in || 3600) * 1000 - 30000;
    sessionStorage.removeItem(storageKeys.oauthState);
    sessionStorage.removeItem(storageKeys.oauthVerifier);
    window.history.replaceState({}, "", window.location.pathname);
    apiSettingsDialog.close();
    showToast("Spotify conectado. A busca agora inclui resultados da sua conta.");
}

// Consulta cada provedor independentemente para manter o Deezer útil antes do login Spotify.
// Fetch both providers independently so Deezer search remains useful before Spotify login.
async function searchMusicProviders(query) {
    const requestId = ++searchRequestId;
    apiSearchAbortController?.abort();
    apiSearchAbortController = new AbortController();
    apiSearchSection.hidden = false;
    const searchingProviders = ["Deezer", "Invidious"];
    if (jamendoEnabled) {
        searchingProviders.push("Jamendo");
    }
    if (spotifyAccessToken && Date.now() < spotifyTokenExpiresAt) {
        searchingProviders.push("Spotify");
    }
    apiSearchStatus.textContent = `Buscando em ${searchingProviders.join(", ")}…`;
    apiSearchGrid.replaceChildren();

    const results = [];
    const errors = [];
    const successfulProviders = new Set();
    try {
        const deezer = await fetchJson(API_CONFIG.providers.deezer.searchPath(query), {
            signal: apiSearchAbortController.signal
        });
        successfulProviders.add("Deezer");
        for (const group of deezer.results || []) {
            for (const item of group.data || []) {
                results.push(normalizeDeezerItem(group.type, item));
            }
        }
    } catch (error) {
        if (error.name === "AbortError") {
            return;
        }
        console.error("Deezer search failed.", error);
        errors.push(`Deezer: ${error.message}`);
    }

    try {
        const invidious = await fetchJson(API_CONFIG.providers.invidious.searchPath(query), {
            signal: apiSearchAbortController.signal
        });
        successfulProviders.add("Invidious");
        for (const video of invidious.results || []) {
            results.push(normalizeInvidiousItem(video));
        }
    } catch (error) {
        if (error.name === "AbortError") {
            return;
        }
        console.error("Invidious search failed.", error);
        errors.push(`Invidious: ${error.message}`);
    }

    if (jamendoEnabled) {
        try {
            const jamendo = await fetchJson(API_CONFIG.providers.jamendo.searchPath(query), {
                signal: apiSearchAbortController.signal
            });
            successfulProviders.add("Jamendo");
            for (const item of jamendo.results || []) {
                results.push(normalizeJamendoItem(item));
            }
        } catch (error) {
            if (error.name === "AbortError") {
                return;
            }
            console.error("Jamendo search failed.", error);
            errors.push(`Jamendo: ${error.message}`);
        }
    }

    if (spotifyAccessToken && Date.now() < spotifyTokenExpiresAt) {
        try {
            const types = "track,artist,album,playlist";
            const spotify = await fetchSpotify(API_CONFIG.providers.spotify.endpoints.search(query, types));
            successfulProviders.add("Spotify");
            for (const type of ["track", "artist", "album", "playlist"]) {
                for (const item of spotify[`${type}s`]?.items || []) {
                    results.push(normalizeSpotifyItem(type, item));
                }
            }
        } catch (error) {
            console.error("Spotify search failed.", error);
            errors.push(`Spotify: ${error.message}`);
        }
    }

    if (requestId !== searchRequestId) {
        return;
    }
    providerSearchResults = results;
    renderApiSearchResults(results);
    const providerNames = [...successfulProviders].join("/");
    const spotifyConnected = spotifyAccessToken && Date.now() < spotifyTokenExpiresAt;
    const providerSummary = successfulProviders.size
        ? `${results.length} resultados de ${providerNames}${spotifyConnected ? "" : " • conecte o Spotify para incluir suas buscas"}${jamendoEnabled ? "" : " • configure Jamendo para faixas completas licenciadas"}`
        : "Nenhum provedor respondeu";
    apiSearchStatus.textContent = errors.length
        ? `${providerSummary}. Alguns provedores falharam: ${errors.join(" ")}`
        : providerSummary;
    if (errors.length && results.length === 0) {
        apiSearchSection.hidden = false;
    }
    if (errors.length && results.length === 0) {
        apiSearchStatus.setAttribute("role", "alert");
    } else {
        apiSearchStatus.removeAttribute("role");
    }
}

// Cria cartões com nós de texto para impedir que dados externos sejam interpretados como HTML.
// Create search cards using text nodes to prevent untrusted provider strings from becoming HTML.
function renderApiSearchResults(results) {
    apiSearchGrid.replaceChildren();
    const visibleResults = homeFilter === "all"
        ? results
        : results.filter((item) => homeFilter === "music" ? item.kind === "track" : item.kind === homeFilter);
    visibleResults.forEach((item, index) => {
        const card = document.createElement("button");
        card.className = "api-result-card";
        card.type = "button";
        card.dataset.resultIndex = String(index);

        const cover = document.createElement("span");
        cover.className = `api-result-card__cover mdi ${item.kind === "artist" ? "mdi-account-music" : "mdi-music"}`;
        const image = safeCoverUrl(item.image || item.artistImage);
        if (image) {
            cover.style.backgroundImage = `linear-gradient(#0002, #0002), url("${image}")`;
            cover.classList.add("has-cover");
        }

        const text = document.createElement("span");
        text.className = "api-result-card__text";
        const heading = document.createElement("strong");
        heading.textContent = item.title;
        const subheading = document.createElement("small");
        const providerNames = {
            deezer: "Deezer",
            invidious: "Invidious",
            jamendo: "Jamendo",
            spotify: "Spotify"
        };
        const providerName = providerNames[item.provider] || "Catálogo";
        subheading.textContent = `${item.kind === "artist" ? "Artista" : item.kind === "album" ? "Álbum" : item.kind === "playlist" ? "Playlist" : "Música"} • ${item.artistName || providerName} • ${providerName}`;
        text.append(heading, subheading);
        card.append(cover, text);
        card.addEventListener("click", () => openDetail(item));
        apiSearchGrid.append(card);
    });
    apiSearchSection.hidden = visibleResults.length === 0;
    updateHomeVisibility();
}

// Exibe contagens locais nos detalhes sem apresentá-las como números globais de ouvintes.
// Add local counts to detail headings without claiming that one browser has global listener totals.
function renderDetailStats(item) {
    const stats = localStatsFor(item);
    const listens = document.createElement("span");
    listens.className = "detail-meta__local-stat";
    listens.textContent = `${new Intl.NumberFormat("pt-BR").format(stats.plays)} reproduções neste dispositivo`;
    detailMeta.append(listens);
    const saves = document.createElement("span");
    saves.className = "detail-meta__local-stat";
    saves.textContent = `${new Intl.NumberFormat("pt-BR").format(stats.saves)} salvamentos neste dispositivo`;
    detailMeta.append(saves);
}

// Substitui a página inicial pelos detalhes de um artista, faixa, álbum ou playlist pública.
// Replace the home content with a profile, track, album, or public playlist detail page.
async function openDetail(item, { history = true } = {}) {
    currentDetail = item;
    currentDetailTracks = [];
    playbackQueue = [];
    playbackQueueIndex = -1;
    syncCurrentDetailSaveState();
    document.querySelector(".home-view").hidden = true;
    newsView.hidden = true;
    detailView.hidden = false;
    detailKind.textContent = item.kind === "artist"
        ? "Perfil do artista"
        : item.kind === "playlist"
            ? "Playlist pública"
            : item.kind === "album"
                ? "Álbum"
                : "Música";
    detailTitle.textContent = item.title;
    detailDescription.textContent = item.description || (
        item.kind === "artist"
            ? "Perfil do artista e músicas populares."
            : item.kind === "playlist"
                ? "Playlist pública do catálogo musical."
                : item.kind === "album"
                    ? "Álbum do catálogo musical."
                    : "Detalhes da faixa selecionada."
    );
    detailMeta.replaceChildren();
    if (item.artistName && item.kind !== "artist") {
        addDetailLink(detailMeta, item.artistName, {
            provider: item.provider,
            kind: "artist",
            id: item.artistId,
            title: item.artistName,
            image: item.artistImage
        }, "detail-link detail-meta__artist");
    }
    detailHeaderArt.style.backgroundImage = "";
    detailHeaderArt.classList.remove("has-cover");
    const image = safeCoverUrl(item.image || item.artistImage);
    if (image) {
        detailHeaderArt.style.backgroundImage = `linear-gradient(180deg, #0002, #1118), url("${image}")`;
        detailHeaderArt.classList.add("has-cover");
    }
    detailTrackList.replaceChildren();
    artistSupplemental.hidden = true;
    artistDiscography.replaceChildren();
    document.querySelector(".detail-empty").hidden = true;
    apiSearchSection.hidden = true;
    if (history) {
        window.history.pushState({ detail: item }, "", `#${item.kind}/${encodeURIComponent(item.provider)}/${encodeURIComponent(item.id)}`);
    }
    detailMeta.textContent = "Carregando dados do catálogo…";
    renderDetailStats(item);
    document.querySelector(".main-view").scrollTo({ top: 0, behavior: "smooth" });

    try {
        const detail = await fetchProviderDetail(item);
        if (currentDetail !== item) {
            return;
        }
        const updatedItem = { ...item, ...detail.item };
        currentDetail = updatedItem;
        detailKind.textContent = updatedItem.kind === "artist"
            ? "Perfil do artista"
            : updatedItem.kind === "playlist"
                ? "Playlist pública"
                : updatedItem.kind === "album"
                    ? "Álbum"
                    : "Música";
        detailTitle.textContent = updatedItem.title;
        detailDescription.textContent = updatedItem.description || detailDescription.textContent;
        detailMeta.replaceChildren();
        if (updatedItem.kind === "artist" && updatedItem.fanCount) {
            const fans = document.createElement("span");
            fans.textContent = `${new Intl.NumberFormat("pt-BR").format(updatedItem.fanCount)} ${updatedItem.provider === "deezer" ? "fãs" : "seguidores"}`;
            detailMeta.append(fans);
        }
        if (updatedItem.artistName && updatedItem.kind !== "artist") {
            addDetailLink(detailMeta, updatedItem.artistName, {
                provider: updatedItem.provider,
                kind: "artist",
                id: updatedItem.artistId,
                title: updatedItem.artistName,
                image: updatedItem.artistImage
            }, "detail-link detail-meta__artist");
        }
        const providerUrl = safeProviderUrl(updatedItem.externalUrl);
        if (providerUrl) {
            const providerLink = document.createElement("a");
            providerLink.className = "detail-link";
            providerLink.href = providerUrl;
            providerLink.target = "_blank";
            providerLink.rel = "noopener noreferrer";
            const providerNames = {
                deezer: "Deezer",
                spotify: "Spotify",
                jamendo: "Jamendo"
            };
            providerLink.textContent = `Abrir no ${providerNames[updatedItem.provider] || "provedor"}`;
            detailMeta.append(providerLink);
        }
        const licenseUrl = safeProviderUrl(updatedItem.licenseUrl);
        if (updatedItem.provider === "jamendo" && licenseUrl) {
            const licenseLink = document.createElement("a");
            licenseLink.className = "detail-link";
            licenseLink.href = licenseUrl;
            licenseLink.target = "_blank";
            licenseLink.rel = "noopener noreferrer";
            licenseLink.textContent = "Licença Creative Commons";
            detailMeta.append(licenseLink);
        }
        if (updatedItem.kind === "album" || updatedItem.kind === "playlist") {
            const total = document.createElement("span");
            total.textContent = `${detail.tracks.length} faixas`;
            detailMeta.append(total);
        }
        const detailStats = localStatsFor(updatedItem);
        const detailSave = document.querySelector(".detail-save");
        detailSave.setAttribute("aria-pressed", String(detailStats.saved));
        detailSave.setAttribute("aria-label", detailStats.saved ? "Remover dos salvos" : "Salvar na biblioteca");
        detailSave.querySelector(".mdi").className = detailStats.saved
            ? "mdi mdi-check-circle"
            : "mdi mdi-plus-circle-outline";
        renderDetailStats(updatedItem);
        const cover = safeCoverUrl(updatedItem.image || updatedItem.artistImage);
        if (cover) {
            detailHeaderArt.style.backgroundImage = `linear-gradient(180deg, #0002, #1118), url("${cover}")`;
            detailHeaderArt.classList.add("has-cover");
        }
        currentDetailTracks = detail.tracks.length ? detail.tracks : [updatedItem];
        playbackQueue = detail.tracks;
        playbackQueueIndex = -1;
        renderTrackRows(currentDetailTracks);
        if (updatedItem.kind === "artist") {
            void loadArtistSupplemental(updatedItem);
        }
    } catch (error) {
        console.error("Could not load music detail.", error);
        detailMeta.replaceChildren();
        const errorMessage = document.createElement("span");
        errorMessage.setAttribute("role", "alert");
        errorMessage.textContent = `Não foi possível carregar este conteúdo: ${error.message}`;
        detailMeta.append(errorMessage);
        document.querySelector(".detail-empty").hidden = false;
    }
}

// Load optional artist biography and discography without blocking the primary catalog page.
// Carrega biografia e discografia opcionais sem bloquear a página principal do catálogo.
async function loadArtistSupplemental(item) {
    artistSupplemental.hidden = false;
    artistSupplementalStatus.textContent = "Buscando biografia e discografia…";
    const [audioDbResult, musicBrainzResult] = await Promise.allSettled([
        audioDbEnabled
            ? fetchJson(API_CONFIG.providers.audioDb.artistSearchPath(item.title))
            : Promise.resolve(null),
        fetchJson(API_CONFIG.providers.musicBrainz.artistSearchPath(item.title))
    ]);
    if (currentDetail !== item) {
        return;
    }

    const errors = [];
    if (audioDbResult.status === "fulfilled" && audioDbResult.value?.results?.[0]) {
        const artistInfo = audioDbResult.value.results[0];
        if (artistInfo.biography) {
            detailDescription.textContent = artistInfo.biography;
        }
        const banner = safeCoverUrl(artistInfo.banner || artistInfo.thumb);
        if (banner) {
            detailHeaderArt.style.backgroundImage = `linear-gradient(180deg, #0002, #1118), url("${banner}")`;
            detailHeaderArt.classList.add("has-cover");
        }
        const facts = [artistInfo.genre, artistInfo.country].filter(Boolean);
        if (facts.length) {
            const fact = document.createElement("span");
            fact.textContent = facts.join(" • ");
            detailMeta.append(fact);
        }
    } else if (audioDbResult.status === "rejected") {
        console.error("TheAudioDB artist lookup failed.", audioDbResult.reason);
        errors.push("biografia TheAudioDB indisponível");
    } else if (!audioDbEnabled) {
        errors.push("biografia TheAudioDB indisponível");
    }

    if (musicBrainzResult.status === "fulfilled" && musicBrainzResult.value.artist) {
        const { artist: artistInfo, releases } = musicBrainzResult.value;
        if (artistInfo.country || artistInfo.disambiguation) {
            const facts = document.createElement("span");
            facts.textContent = [artistInfo.country, artistInfo.disambiguation].filter(Boolean).join(" • ");
            detailMeta.append(facts);
        }
        for (const release of releases) {
            const itemNode = document.createElement("li");
            const releaseLink = document.createElement("a");
            const safeId = /^[0-9a-f-]{36}$/i.test(release.id) ? release.id : "";
            releaseLink.textContent = release.title;
            if (safeId) {
                releaseLink.href = `https://musicbrainz.org/release-group/${encodeURIComponent(safeId)}`;
                releaseLink.target = "_blank";
                releaseLink.rel = "noopener noreferrer";
            }
            const releaseInfo = document.createElement("small");
            releaseInfo.textContent = [release.type, release.firstReleaseDate].filter(Boolean).join(" • ");
            itemNode.append(releaseLink, releaseInfo);
            artistDiscography.append(itemNode);
        }
        if (artistInfo.id) {
            const musicBrainzLink = document.createElement("a");
            musicBrainzLink.className = "detail-link";
            musicBrainzLink.href = `https://musicbrainz.org/artist/${encodeURIComponent(artistInfo.id)}`;
            musicBrainzLink.target = "_blank";
            musicBrainzLink.rel = "noopener noreferrer";
            musicBrainzLink.textContent = "MusicBrainz";
            detailMeta.append(musicBrainzLink);
        }
    } else if (musicBrainzResult.status === "rejected") {
        console.error("MusicBrainz artist lookup failed.", musicBrainzResult.reason);
        errors.push("discografia indisponível");
    }

    artistSupplementalStatus.textContent = artistDiscography.children.length
        ? `${artistDiscography.children.length} lançamentos catalogados${errors.length ? `; ${errors.join(" e ")}` : ""}.`
        : `Sem discografia disponível${errors.length ? `; ${errors.join(" e ")}` : ""}.`;
}

// Busca detalhes e faixas relacionadas pelo proxy local do Deezer ou pela Web API do Spotify.
// Request details and related tracks using either the local Deezer proxy or Spotify Web API.
async function fetchProviderDetail(item) {
    if (item.provider === "local") {
        return { item, tracks: item.kind === "artist" ? [] : [item] };
    }
    // Jamendo tracks are playable only when its server-side response confirms an authorized download.
    // Faixas Jamendo só são reproduzíveis quando a resposta do servidor confirma download autorizado.
    if (item.provider === "jamendo") {
        if (item.kind !== "artist") {
            return { item, tracks: [item] };
        }
        const search = await fetchJson(API_CONFIG.providers.deezer.searchPath(item.title));
        const artistResult = search.results
            .find((group) => group.type === "artist")
            ?.data?.find((entry) => entry.name.toLocaleLowerCase("pt-BR") === item.title.toLocaleLowerCase("pt-BR"));
        if (!artistResult) {
            return { item, tracks: [] };
        }
        const payload = await fetchJson(API_CONFIG.providers.deezer.detailPath("artist", artistResult.id));
        return {
            item: { ...item, image: item.image || artistResult.picture_big || "" },
            tracks: (payload.tracks || []).map((track) => normalizeDeezerItem("track", track))
        };
    }
    if (item.provider === "invidious") {
        const payload = await fetchJson(API_CONFIG.providers.invidious.detailPath(item.id));
        const detailedItem = normalizeInvidiousItem(payload.item);
        return { item: detailedItem, tracks: [detailedItem] };
    }
    if (item.provider === "deezer") {
        const payload = await fetchJson(API_CONFIG.providers.deezer.detailPath(item.kind, item.id));
        const tracks = (payload.tracks || []).map((track) => normalizeDeezerItem("track", track));
        if (item.kind === "track") {
            tracks.splice(0, tracks.length, normalizeDeezerItem("track", payload.item));
        }
        const related = item.kind === "artist" ? tracks : tracks;
        return {
            item: normalizeDeezerItem(item.kind, payload.item),
            tracks: related
        };
    }

    if (item.kind === "artist") {
        const [artistDetail, topTracks] = await Promise.all([
            fetchSpotify(API_CONFIG.providers.spotify.endpoints.artist(item.id)),
            fetchSpotify(API_CONFIG.providers.spotify.endpoints.artistTopTracks(item.id))
        ]);
        return {
            item: normalizeSpotifyItem("artist", artistDetail),
            tracks: (topTracks.tracks || []).map((track) => normalizeSpotifyItem("track", track))
        };
    }
    if (item.kind === "album") {
        const [album, tracks] = await Promise.all([
            fetchSpotify(API_CONFIG.providers.spotify.endpoints.album(item.id)),
            fetchSpotify(API_CONFIG.providers.spotify.endpoints.albumTracks(item.id))
        ]);
        return {
            item: normalizeSpotifyItem("album", album),
            tracks: (tracks.items || []).map((track) => normalizeSpotifyItem("track", { ...track, album }))
        };
    }
    if (item.kind === "playlist") {
        const playlist = await fetchSpotify(API_CONFIG.providers.spotify.endpoints.playlist(item.id));
        return {
            item: normalizeSpotifyItem("playlist", playlist),
            tracks: (playlist.tracks?.items || [])
                .map((entry) => entry.track)
                .filter(Boolean)
                .map((track) => normalizeSpotifyItem("track", track))
        };
    }
    const track = await fetchSpotify(API_CONFIG.providers.spotify.endpoints.track(item.id));
    return { item: normalizeSpotifyItem("track", track), tracks: [normalizeSpotifyItem("track", track)] };
}

// Renderiza faixas com imagens do catálogo e contagens locais de reprodução e salvamento.
// Render track rows with provider-provided artwork and local playback/save counts.
function renderTrackRows(tracks) {
    detailTrackList.replaceChildren();
    document.querySelector(".detail-empty").hidden = tracks.length > 0;
    tracks.forEach((track, index) => {
        const row = document.createElement("li");
        row.className = "detail-track";
        const number = document.createElement("span");
        number.className = "detail-track__number";
        number.textContent = String(index + 1);

        const info = document.createElement("span");
        info.className = "detail-track__info";
        const titleButton = document.createElement("button");
        titleButton.className = "detail-track__title";
        titleButton.type = "button";
        titleButton.textContent = track.title;
        titleButton.addEventListener("click", () => openDetail(track));
        const artistButton = document.createElement("button");
        artistButton.className = "detail-track__artist";
        artistButton.type = "button";
        artistButton.textContent = track.artistName || "Artista desconhecido";
        artistButton.addEventListener("click", () => openNamedArtist(track.artistName, track));
        info.append(titleButton, artistButton);

        const counts = document.createElement("span");
        counts.className = "detail-track__counts";
        counts.textContent = new Intl.NumberFormat("pt-BR").format(localStatsFor(track).plays);
        const duration = document.createElement("span");
        duration.className = "detail-track__duration";
        duration.textContent = formatTime(track.durationSeconds);

        const play = document.createElement("button");
        play.className = "detail-track__play";
        play.type = "button";
        play.setAttribute("aria-label", `Reproduzir ${track.title}`);
        play.innerHTML = '<span class="mdi mdi-play" aria-hidden="true"></span>';
        play.addEventListener("click", () => playTrack(track));

        const save = document.createElement("button");
        save.className = "detail-track__save";
        save.type = "button";
        const stats = localStatsFor(track);
        save.setAttribute("aria-label", stats.saved ? "Remover dos salvos" : "Salvar faixa");
        save.setAttribute("aria-pressed", String(stats.saved));
        save.innerHTML = `<span class="mdi ${stats.saved ? "mdi-check-circle" : "mdi-plus-circle-outline"}" aria-hidden="true"></span>`;
        save.addEventListener("click", () => {
            toggleSave(track);
            renderTrackRows(tracks);
        });

        row.append(number, info, counts, duration, play, save);
        detailTrackList.append(row);
    });
}

// Seleciona uma faixa; se não houver prévia, abre a página oficial do Spotify quando disponível.
// Select a track from either catalog; Spotify tracks without previews open their official page.
async function playTrack(track, { autoplay = true } = {}) {
    const requestId = ++playbackRequestId;
    currentTrack = track;
    hasPlayedCurrentTrack = false;
    pendingPlayCount = false;
    const queuedTrackIndex = playbackQueue.indexOf(track);
    playbackQueueIndex = queuedTrackIndex >= 0
        ? queuedTrackIndex
        : playbackQueue.findIndex((queuedTrack) => queuedTrack.id === track.id && queuedTrack.provider === track.provider);
    if (playbackQueueIndex < 0) {
        playbackQueue = [track];
        playbackQueueIndex = 0;
    }
    updateTrackLabels(track.title, track.artistName || "Artista desconhecido", false);
    syncCurrentTrackSaveState(track);
    document.querySelector(".now-playing-panel__track-title").textContent = track.title;
    document.querySelector(".now-playing-panel__artist").textContent = track.artistName || "Artista desconhecido";
    document.querySelector(".now-playing-panel__art").style.backgroundImage = "";
    document.querySelector(".now-playing-panel__art").classList.remove("has-cover");
    const playerCover = document.querySelector(".Pplay-music__cover");
    playerCover.style.backgroundImage = "";
    playerCover.querySelector(".mdi").hidden = false;
    const image = safeCoverUrl(track.image);
    if (image) {
        document.querySelector(".now-playing-panel__art").style.backgroundImage = `linear-gradient(#0002, #0002), url("${image}")`;
        document.querySelector(".now-playing-panel__art").classList.add("has-cover");
    }
    playerCover.style.backgroundImage = image ? `url("${image}")` : "";
    playerCover.querySelector(".mdi").hidden = Boolean(image);

    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    playButton.disabled = true;
    progress.disabled = true;
    let playableUrl = track.playbackUrl || track.previewUrl;
    let usingJamendoFallback = track.provider === "jamendo";
    if (jamendoEnabled
        && !track.playbackUrl
        && ["deezer", "spotify"].includes(track.provider)
        && track.title
        && track.artistName) {
        const jamendoMatch = await findLicensedJamendoMatch(track, requestId);
        if (requestId !== playbackRequestId) {
            return;
        }
        if (jamendoMatch) {
            playableUrl = jamendoMatch.playbackUrl;
            usingJamendoFallback = true;
            status.textContent = "Reproduzindo versão completa licenciada pelo Jamendo.";
        }
    }
    if (!playableUrl) {
        pendingPlayCount = false;
        playButton.disabled = true;
        progress.disabled = true;
        const providerUrl = safeProviderUrl(track.externalUrl);
        if (providerUrl) {
            window.open(providerUrl, "_blank", "noopener,noreferrer");
        }
        status.textContent = track.provider === "spotify"
            ? "Esta faixa não tem prévia disponível. A página oficial será aberta."
            : track.provider === "invidious"
                ? "O Invidious fornece metadados, não um stream de áudio licenciado. Abrindo o vídeo oficial."
                : "Esta faixa não tem prévia disponível no catálogo.";
        showToast(status.textContent);
        return;
    }

    if (!usingJamendoFallback) {
        status.textContent = "";
    }
    playButton.disabled = true;
    progress.disabled = true;
    audio.pause();
    audio.src = playableUrl;
    audio.load();
    audio.addEventListener("loadedmetadata", () => {
        if (currentTrack === track) {
            if (autoplay) {
                playAudio(true);
            } else {
                playButton.disabled = false;
                progress.disabled = false;
                updateProgress();
            }
        }
    }, { once: true });
}

// Find an exact, license-approved Jamendo match without accepting arbitrary provider URLs.
// Localiza uma correspondência exata e licenciada do Jamendo sem aceitar URLs externas arbitrárias.
async function findLicensedJamendoMatch(track, requestId) {
    if (!jamendoEnabled || !track.title || jamendoFallbackAttemptId === requestId) {
        return null;
    }
    jamendoFallbackAttemptId = requestId;
    status.textContent = "Procurando uma versão completa licenciada no Jamendo…";
    try {
        const { obterStreamAudioCompleto } = await import("./playback.mjs");
        const match = await obterStreamAudioCompleto(track.title, track.artistName, {
            searchUrl: API_CONFIG.providers.jamendo.searchPath(track.title),
            fetchImpl: fetch
        });
        if (requestId !== playbackRequestId) {
            return null;
        }
        return match || null;
    } catch (error) {
        if (requestId === playbackRequestId) {
            console.error("Jamendo playback fallback failed.", error);
        }
        return null;
    }
}

// Recover from a failed preview by resolving one authorized full-track match.
// Recupera uma prévia que falhou buscando uma faixa completa autorizada.
async function tryJamendoPlaybackFallback(track, requestId) {
    const match = await findLicensedJamendoMatch(track, requestId);
    if (!match || requestId !== playbackRequestId || currentTrack !== track) {
        return false;
    }
    status.textContent = "Reproduzindo versão completa licenciada pelo Jamendo.";
    audio.src = match.playbackUrl;
    audio.load();
    audio.addEventListener("loadedmetadata", () => {
        if (requestId === playbackRequestId && currentTrack === track) {
            playButton.disabled = false;
            progress.disabled = false;
            updateProgress();
            playAudio();
        }
    }, { once: true });
    return true;
}

// Alterna o salvamento local e sincroniza os controles visíveis.
// Toggle a saved item in local browser storage and synchronize all visible save controls.
function toggleSave(item) {
    const updated = updateLocalStats(item, (stats) => ({
        ...stats,
        saves: stats.saves + (stats.saved ? 0 : 1),
        saved: !stats.saved,
        title: item.title,
        artistName: item.artistName || ""
    }));
    showToast(updated.saved ? "Salvo neste dispositivo." : "Removido dos salvos neste dispositivo.");
    if (currentDetail?.provider === item.provider && currentDetail?.id === item.id) {
        detailMeta.querySelectorAll(".detail-meta__local-stat").forEach((stat) => stat.remove());
        renderDetailStats(currentDetail);
        document.querySelector(".detail-save").setAttribute("aria-pressed", String(updated.saved));
        document.querySelector(".detail-save .mdi").className = updated.saved
            ? "mdi mdi-check-circle"
            : "mdi mdi-plus-circle-outline";
    }
    if (currentTrack.provider === item.provider && currentTrack.id === item.id) {
        const saveButtons = [
            document.querySelector(".now-playing-panel__save"),
            document.querySelector(".music-player__add")
        ];
        saveButtons.forEach((button) => {
            button.setAttribute("aria-pressed", String(updated.saved));
            button.setAttribute("aria-label", updated.saved ? "Remover da biblioteca" : "Adicionar à biblioteca");
            button.querySelector(".mdi").className = updated.saved
                ? "mdi mdi-check-circle"
                : "mdi mdi-plus-circle-outline";
        });
    }
    if (["track", "artist", "album", "playlist"].includes(item.kind)) {
        syncSavedLibraryItem(item, updated.saved);
    }
    return updated;
}

// Mantém faixas salvas na biblioteca visível e restaura a lista em visitas futuras.
// Persist saved tracks in the visible library and restore them on the next visit.
function syncSavedLibraryItem(item, saved) {
    const key = `${item.provider}:${item.kind}:${item.id}`;
    const existing = savedLibraryItems.get(key);
    if (saved && !existing) {
        const categoryDetails = item.kind === "track"
            ? `Faixa • ${item.artistName || "Artista desconhecido"}`
            : item.kind === "album" && item.artistName
                ? `Álbum • ${item.artistName}`
                : item.kind === "playlist"
                    ? "Playlist salva"
                    : "Artista";
        savedLibraryItems.set(key, addLibraryItem(item.title, item.kind, categoryDetails));
    } else if (!saved && existing) {
        existing.remove();
        savedLibraryItems.delete(key);
        const index = searchableItems.indexOf(existing);
        if (index >= 0) {
            searchableItems.splice(index, 1);
        }
        updateLibraryVisibility();
    }
}

function restoreSavedLibraryItems() {
    const stats = readLocalStats();
    Object.entries(stats).forEach(([key, value]) => {
        const [provider, kind] = key.split(":");
        if (!["deezer", "invidious", "jamendo", "spotify", "local"].includes(provider)
            || !["track", "artist", "album", "playlist"].includes(kind)) {
            return;
        }
        if (!value?.saved || !value.title) {
            return;
        }
        const id = key.slice(key.indexOf(":", key.indexOf(":") + 1) + 1);
        const item = { provider, kind, id, title: value.title, artistName: value.artistName || "" };
        syncSavedLibraryItem(item, true);
    });
}

// Sincroniza os controles de salvamento quando outra faixa do catálogo passa a ser atual.
// Keep the two save controls synchronized when a different catalog track becomes current.
function syncCurrentTrackSaveState(item) {
    const saved = localStatsFor(item).saved;
    [document.querySelector(".now-playing-panel__save"), document.querySelector(".music-player__add")].forEach((button) => {
        button.setAttribute("aria-pressed", String(saved));
        button.setAttribute("aria-label", saved ? "Remover da biblioteca" : "Adicionar à biblioteca");
        button.querySelector(".mdi").className = saved
            ? "mdi mdi-check-circle"
            : "mdi mdi-plus-circle-outline";
    });
}

// Sincroniza a ação de salvar na página de detalhes com o estado local deste dispositivo.
// Synchronize the save action in the detail toolbar with the local, per-device state.
function syncCurrentDetailSaveState() {
    if (!currentDetail) {
        return;
    }
    const saved = localStatsFor(currentDetail).saved;
    const button = document.querySelector(".detail-save");
    button.setAttribute("aria-pressed", String(saved));
    button.setAttribute("aria-label", saved ? "Remover dos salvos" : "Salvar na biblioteca");
    button.querySelector(".mdi").className = saved
        ? "mdi mdi-check-circle"
        : "mdi mdi-plus-circle-outline";
}

// Exibe a página inicial sem descartar o estado de navegação voltar/avançar do navegador.
// Restore the home view without discarding the browser's back/forward navigation state.
function showHomeView() {
    currentDetail = null;
    detailView.hidden = true;
    newsView.hidden = true;
    document.querySelector(".home-view").hidden = false;
    window.history.replaceState({ home: true }, "", `${window.location.pathname}${window.location.search}`);
    mainView.scrollTo({ top: 0, behavior: "smooth" });
}

// Carrega lançamentos dos artistas salvos, sem interromper a tela quando um provedor falha.
// Load releases from saved artists without breaking the page when one provider is unavailable.
async function showNewsView({ history = true } = {}) {
    currentDetail = null;
    document.querySelector(".home-view").hidden = true;
    detailView.hidden = true;
    newsView.hidden = false;
    newsStatus.textContent = "Carregando lançamentos dos artistas salvos…";
    newsGrid.replaceChildren();
    if (history) {
        window.history.pushState({ news: true }, "", "#news");
    }
    mainView.scrollTo({ top: 0, behavior: "smooth" });

    const savedArtists = Object.entries(readLocalStats())
        .map(([key, value]) => {
            const [provider, kind, id] = key.split(":");
            return value?.saved && kind === "artist" && id
                ? { provider, kind, id, title: value.title || "Artista" }
                : null;
        })
        .filter((item) => item && ["deezer", "spotify"].includes(item.provider))
        .slice(-8);

    if (!savedArtists.length) {
        newsStatus.textContent = "Salve artistas dos resultados de busca para acompanhar os lançamentos deles.";
        return;
    }

    const errors = [];
    const releases = [];
    await Promise.all(savedArtists.map(async (savedArtist) => {
        try {
            let items;
            if (savedArtist.provider === "deezer") {
                const payload = await fetchJson(API_CONFIG.providers.deezer.artistAlbumsPath(savedArtist.id));
                items = (payload.results || []).map((album) => normalizeDeezerItem("album", album));
            } else if (spotifyAccessToken && Date.now() < spotifyTokenExpiresAt) {
                const payload = await fetchSpotify(API_CONFIG.providers.spotify.endpoints.artistAlbums(savedArtist.id));
                items = (payload.items || []).map((album) => normalizeSpotifyItem("album", album));
            } else {
                errors.push(`${savedArtist.title}: conecte o Spotify para consultar os lançamentos.`);
                return;
            }
            for (const release of items) {
                releases.push({ ...release, followedArtist: savedArtist.title });
            }
        } catch (error) {
            console.error(`Could not load releases for ${savedArtist.title}.`, error);
            errors.push(`${savedArtist.title}: ${error.message}`);
        }
    }));

    if (newsView.hidden) {
        return;
    }
    releases.sort((left, right) => (right.releaseDate || "").localeCompare(left.releaseDate || ""));
    const uniqueReleases = [...new Map(releases.map((release) => [`${release.provider}:${release.id}`, release])).values()]
        .slice(0, 24);
    for (const release of uniqueReleases) {
        const card = document.createElement("button");
        card.className = "news-card";
        card.type = "button";
        const cover = document.createElement("span");
        cover.className = "news-card__cover mdi mdi-album";
        const image = safeCoverUrl(release.image);
        if (image) {
            cover.style.backgroundImage = `url("${image}")`;
            cover.classList.add("has-cover");
        }
        const name = document.createElement("strong");
        name.textContent = release.title;
        const artistName = document.createElement("span");
        artistName.textContent = release.artistName || release.followedArtist;
        const date = document.createElement("time");
        date.textContent = release.releaseDate || "Data não informada";
        if (release.releaseDate) {
            date.dateTime = release.releaseDate;
        }
        card.append(cover, name, artistName, date);
        card.addEventListener("click", () => openDetail(release));
        newsGrid.append(card);
    }

    newsStatus.textContent = uniqueReleases.length
        ? `${uniqueReleases.length} lançamentos encontrados${errors.length ? `. Alguns catálogos falharam: ${errors.join(" • ")}` : "."}`
        : `Nenhum lançamento encontrado.${errors.length ? ` ${errors.join(" • ")}` : ""}`;
    if (errors.length && !uniqueReleases.length) {
        newsStatus.setAttribute("role", "alert");
    } else {
        newsStatus.removeAttribute("role");
    }
}

// Resolve links de artistas de demonstração mesmo quando não há IDs do catálogo.
// Resolve artist profile links even for local demo cards that have no catalog IDs.
async function openNamedArtist(name, sourceItem = currentTrack) {
    if (!name) {
        showToast("O nome do artista não está disponível.");
        return;
    }
    if (sourceItem?.artistId && sourceItem.artistName === name) {
        await openDetail({
            provider: sourceItem.provider,
            kind: "artist",
            id: sourceItem.artistId,
            title: name,
            image: sourceItem.artistImage
        });
        return;
    }
    try {
        const payload = await fetchJson(API_CONFIG.providers.deezer.searchPath(name));
        const artistResult = payload.results
            .find((group) => group.type === "artist")
            ?.data?.find((entry) => entry.name.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"));
        if (artistResult) {
            await openDetail(normalizeDeezerItem("artist", artistResult));
        } else {
            await openDetail({ provider: "local", kind: "artist", id: name, title: name, image: "" });
        }
    } catch (error) {
        console.error("Artist lookup failed.", error);
        showToast(`Não foi possível buscar o perfil do artista: ${error.message}`);
    }
}

// Lê o Client ID público do .env local e prioriza a configuração explícita do navegador.
// Load the public Client ID from local .env and prefer an explicit browser setting when present.
async function loadApiConfiguration() {
    try {
        const config = await fetchJson(API_CONFIG.serverRoutes.configuration);
        jamendoEnabled = config.jamendoEnabled === true;
        audioDbEnabled = config.audioDbEnabled === true;
        const storedClientId = localStorage.getItem(storageKeys.clientId)
            || localStorage.getItem(storageKeys.legacyClientId);
        spotifyClientId = storedClientId || config.spotifyClientId || "";
        spotifyClientIdInput.value = spotifyClientId;
        await finishSpotifyLogin();
    } catch (error) {
        console.error("Could not load API configuration.", error);
        document.querySelector(".api-settings-status").textContent = "Inicie o servidor local com `node server.js` para usar as APIs.";
        if (new URLSearchParams(window.location.search).has("code")) {
            showToast(error.message);
        }
    }
}

// Busca itens de demonstração no Deezer e mantém uma página local se não houver correspondência exata.
// Resolve local demo items through Deezer, preserving a usable local page if no exact catalog match exists.
async function openNamedCollection(name, kind) {
    try {
        const payload = await fetchJson(API_CONFIG.providers.deezer.searchPath(name));
        const groups = payload.results || [];
        const preferredGroups = kind === "track"
            ? ["track", "artist", "album", "playlist"]
            : [kind, "track", "artist", "album", "playlist"];
        for (const type of preferredGroups) {
            const item = groups
                .find((group) => group.type === type)
                ?.data?.find((entry) => (entry.title || entry.name || "").toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"));
            if (item) {
                const normalized = normalizeDeezerItem(type, item);
                if (type === "track") {
                    playTrack(normalized);
                }
                await openDetail(normalized);
                return;
            }
        }
        await openDetail({
            provider: "local",
            kind,
            id: name,
            title: name,
            description: "Conteúdo demonstrativo desta biblioteca musical."
        });
    } catch (error) {
        console.error(`Could not look up the ${kind} "${name}".`, error);
        showToast(`Não foi possível buscar este conteúdo: ${error.message}`);
    }
}

function addLibraryItem(name, category, details) {
    const item = document.createElement("button");
    item.className = "library-item";
    item.type = "button";
    item.dataset.searchable = "";
    item.dataset.category = category;
    item.dataset.sequence = String(librarySequence++);

    const icon = document.createElement("span");
    icon.className = `library-item__art mdi ${category === "playlist" ? "mdi-playlist-music" : category === "artist" ? "mdi-account-music" : "mdi-music"}`;
    icon.setAttribute("aria-hidden", "true");

    const info = document.createElement("span");
    const itemName = document.createElement("strong");
    itemName.textContent = name;
    const description = document.createElement("small");
    description.textContent = details;
    info.append(itemName, description);
    item.append(icon, info);
    libraryList.prepend(item);
    searchableItems.push(item);
    item.addEventListener("click", () => selectLibraryItem(item));
    updateLibraryVisibility();
    return item;
}

function selectLibraryItem(item) {
    libraryList.querySelectorAll(".library-item").forEach((entry) => {
        entry.classList.toggle("is-selected", entry === item);
    });
    const name = item.querySelector("strong").textContent;
    if (item.dataset.category === "artist") {
        openNamedArtist(name);
    } else {
        const kind = ["track", "album", "playlist"].includes(item.dataset.category) ? item.dataset.category : "playlist";
        openNamedCollection(name, kind);
    }
}

function updateVolume() {
    const volume = Number(volumeControl.value);
    audio.volume = volume;
    volumeControl.style.setProperty("--volume", `${volume * 100}%`);
    volumeControl.setAttribute("aria-valuetext", `${Math.round(volume * 100)}%`);
    muteButton.setAttribute("aria-label", volume === 0 ? "Ativar som" : "Silenciar");
    volumeIcon.className = volume === 0
        ? "mdi mdi-volume-off"
        : volume < 0.5
            ? "mdi mdi-volume-low"
            : "mdi mdi-volume-high";

    if (volume > 0) {
        previousVolume = volume;
    }
}

function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) {
        return "0:00";
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function setPlaybackState(isPlaying) {
    playButton.setAttribute("aria-pressed", String(isPlaying));
    playButton.setAttribute("aria-label", isPlaying ? "Pausar" : "Reproduzir");
    playIcon.classList.toggle("mdi-play", !isPlaying);
    playIcon.classList.toggle("mdi-pause", isPlaying);
}

function updateProgress() {
    if (isSeeking || audio.seeking) {
        return;
    }
    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    const currentTime = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    currentTimeLabel.textContent = formatTime(currentTime);
    durationLabel.textContent = formatTime(duration);
    progress.max = String(duration);
    progress.value = String(currentTime);
    progress.setAttribute("aria-valuetext", `${formatTime(currentTime)} de ${formatTime(duration)}`);
    progress.style.setProperty(
        "--progress",
        duration > 0 ? `${(currentTime / duration) * 100}%` : "0%"
    );
}

function previewProgress() {
    const previewTime = Number(progress.value);
    currentTimeLabel.textContent = formatTime(previewTime);
    progress.style.setProperty(
        "--progress",
        audio.duration > 0 ? `${(previewTime / audio.duration) * 100}%` : "0%"
    );
}

// Conta uma reprodução somente após o navegador confirmar que o áudio começou.
// Count a play only after the browser confirms playback has actually started.
function playAudio(countAsNew = !hasPlayedCurrentTrack) {
    const startingTrack = currentTrack;
    pendingPlayCount = countAsNew;
    audio.play().catch((error) => {
        if (currentTrack === startingTrack) {
            pendingPlayCount = false;
            status.textContent = "O navegador não conseguiu iniciar a reprodução.";
        }
        console.error("Falha ao iniciar a reprodução do áudio.", error);
    });
}

function updateLibraryVisibility() {
    const query = searchInput.value.trim().toLocaleLowerCase("pt-BR");
    libraryList.querySelectorAll(".library-item").forEach((item) => {
        const matchesCategory = libraryFilter === "all" || item.dataset.category === libraryFilter;
        const matchesSearch = item.textContent.toLocaleLowerCase("pt-BR").includes(query);
        item.hidden = !matchesCategory || !matchesSearch;
    });
}

function updateHomeVisibility() {
    const query = searchInput.value.trim().toLocaleLowerCase("pt-BR");
    searchableItems.forEach((item) => {
        if (item.closest(".library-list")) {
            return;
        }
        const matchesSearch = item.textContent.toLocaleLowerCase("pt-BR").includes(query);
        const matchesCategory = homeFilter === "all" || item.dataset.contentType === homeFilter;
        const expandedOnly = item.hasAttribute("data-expanded-only");
        const expanded = Boolean(item.closest(".artist-grid.is-expanded, .release-grid.is-expanded"));
        item.hidden = !matchesSearch || !matchesCategory || (expandedOnly && !expanded);
    });

    homeContent.forEach((section) => {
        const visibleCards = section.querySelectorAll("[data-searchable]:not([hidden])").length;
        section.hidden = visibleCards === 0;
    });

    const quickPicks = document.querySelector(".quick-picks");
    quickPicks.hidden = [...quickPicks.querySelectorAll("[data-searchable]")].every((item) => item.hidden);
    const hasMatches = homeContent.some((section) => !section.hidden)
        || !quickPicks.hidden
        || apiSearchGrid.childElementCount > 0;
    const emptyResults = document.querySelector(".empty-results");
    emptyResults.hidden = hasMatches;
    if (!hasMatches) {
        emptyResults.textContent = query
            ? `Nenhum resultado para "${searchInput.value.trim()}".`
            : homeFilter === "podcast"
                ? "Ainda não há podcasts disponíveis nesta biblioteca."
                : homeFilter === "audiobook"
                    ? "Ainda não há audiolivros disponíveis nesta biblioteca."
                    : "Nenhum conteúdo encontrado.";
    }
}

function filterLibrary(category) {
    libraryFilter = category;
    document.querySelectorAll("[data-library-filter]").forEach((button) => {
        button.classList.toggle("is-active", button.dataset.libraryFilter === category);
    });
    updateLibraryVisibility();
}

function updateTrackLabels(fileName, performer, stripExtension = true) {
    const trackName = stripExtension ? fileName.replace(/\.[^.]+$/, "") : fileName;
    title.textContent = trackName;
    artist.textContent = performer;
    document.querySelector(".now-playing-panel__track-title").textContent = trackName;
    document.querySelector(".now-playing-panel__artist").textContent = performer;
}

// Arquivos locais são a opção para reproduzir faixas completas autorizadas e formar uma fila privada.
// Local files provide complete playback for authorized tracks and create a private playback queue.
function loadAudioFiles(files) {
    const supportedAudioExtension = /\.(mp3|m4a|aac|wav|ogg|oga|opus|flac|aiff|alac|wma)$/i;
    const selectedFiles = [...files].filter((file) => (
        file.type.startsWith("audio/") || supportedAudioExtension.test(file.name)
    ));
    if (!selectedFiles.length) {
        status.textContent = "Selecione um ou mais arquivos de áudio compatíveis.";
        showToast(status.textContent);
        return;
    }

    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    for (const url of localAudioUrls) {
        URL.revokeObjectURL(url);
    }
    localAudioUrls.clear();
    playbackQueue = selectedFiles.map((file) => {
        const url = URL.createObjectURL(file);
        localAudioUrls.add(url);
        return {
            provider: "local",
            kind: "track",
            id: `file-${file.name}-${file.size}-${file.lastModified}`,
            title: file.name.replace(/\.[^.]+$/, ""),
            artistName: "Arquivo local",
            previewUrl: url,
            durationSeconds: 0
        };
    });
    playbackQueueIndex = -1;
    playTrack(playbackQueue[0], { autoplay: false });
    status.textContent = selectedFiles.length > 1
        ? `${selectedFiles.length} faixas completas carregadas na fila local.`
        : "Arquivo completo carregado; reprodução disponível neste dispositivo.";
}

// Seleciona a próxima faixa da fila ou uma faixa aleatória quando o modo aleatório está ativo.
// Select the next queue entry, optionally choosing a different random track when shuffle is active.
function advanceQueue(direction = 1) {
    if (playbackQueue.length < 2) {
        showToast("Não há outras faixas na fila.");
        return;
    }
    const shuffle = shuffleButton.getAttribute("aria-pressed") === "true";
    let nextIndex;
    if (shuffle) {
        const candidates = playbackQueue.map((_, index) => index).filter((index) => index !== playbackQueueIndex);
        nextIndex = candidates[Math.floor(Math.random() * candidates.length)];
    } else {
        nextIndex = playbackQueueIndex + direction;
        if (nextIndex < 0 || nextIndex >= playbackQueue.length) {
            showToast("Você chegou ao início ou ao fim da fila.");
            return;
        }
    }
    playTrack(playbackQueue[nextIndex]);
}

document.querySelector(".Pplay-music__cover").addEventListener("click", () => fileInput.click());
document.querySelector(".import-card__button").addEventListener("click", () => fileInput.click());
document.querySelector(".music-player__next").addEventListener("click", () => {
    advanceQueue();
});

fileInput.addEventListener("change", () => {
    if (fileInput.files?.length) {
        loadAudioFiles(fileInput.files);
    }
    fileInput.value = "";
});

audio.addEventListener("loadedmetadata", () => {
    if (!Number.isFinite(audio.duration)) {
        status.textContent = "Não foi possível ler a duração deste arquivo.";
        return;
    }
    playButton.disabled = false;
    progress.disabled = false;
    updateProgress();
});

audio.addEventListener("timeupdate", updateProgress);
audio.addEventListener("seeked", updateProgress);
audio.addEventListener("play", () => {
    setPlaybackState(true);
    status.textContent = "";
    if (pendingPlayCount && !hasPlayedCurrentTrack) {
        hasPlayedCurrentTrack = true;
        pendingPlayCount = false;
        updateLocalStats(currentTrack, (stats) => ({ ...stats, plays: stats.plays + 1 }));
        if (currentDetail?.provider === currentTrack.provider && currentDetail?.id === currentTrack.id) {
            detailMeta.querySelectorAll(".detail-meta__local-stat").forEach((stat) => stat.remove());
            renderDetailStats(currentDetail);
        }
        currentDetailTracks.forEach((track, index) => {
            if (track.provider === currentTrack.provider && track.id === currentTrack.id) {
                const count = detailTrackList.children[index]?.querySelector(".detail-track__counts");
                if (count) {
                    count.textContent = new Intl.NumberFormat("pt-BR").format(localStatsFor(track).plays);
                }
            }
        });
    }
});
audio.addEventListener("pause", () => setPlaybackState(false));
audio.addEventListener("ended", () => {
    setPlaybackState(false);
    updateProgress();
    if (!audio.loop && playbackQueueIndex >= 0 && playbackQueueIndex + 1 < playbackQueue.length) {
        advanceQueue();
    } else if (!audio.loop) {
        status.textContent = "Reprodução concluída.";
    }
});
audio.addEventListener("stalled", () => {
    if (currentTrack.provider !== "local" && !audio.paused) {
        status.textContent = "A fonte de áudio está demorando para responder…";
    }
});
audio.addEventListener("error", () => {
    const failedRequestId = playbackRequestId;
    if (currentTrack.provider !== "local"
        && currentTrack.provider !== "jamendo"
        && (currentTrack.previewUrl || currentTrack.playbackUrl)
        && jamendoEnabled
        && jamendoFallbackAttemptId !== failedRequestId) {
        void tryJamendoPlaybackFallback(currentTrack, failedRequestId).then((recovered) => {
            if (!recovered && failedRequestId === playbackRequestId) {
                playButton.disabled = true;
                progress.disabled = true;
                status.textContent = "O áudio não está disponível. Tente outra faixa ou carregue um arquivo local.";
            }
        });
        return;
    }
    playButton.disabled = true;
    progress.disabled = true;
    status.textContent = audio.error?.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED
        ? "Formato não compatível. Tente outra fonte ou carregue um arquivo MP3 ou WAV autorizado."
        : "Não foi possível carregar o áudio. Tente outra fonte ou carregue um arquivo local.";
});

playButton.addEventListener("click", () => {
    if (audio.paused) {
        playAudio();
    } else {
        audio.pause();
    }
});

function commitSeek(seekTime) {
    if (!Number.isFinite(audio.duration)) {
        isSeeking = false;
        return;
    }
    const targetTime = Math.max(0, Math.min(seekTime, audio.duration));
    audio.currentTime = targetTime;
    isSeeking = false;
    progress.value = String(targetTime);
    progress.setAttribute("aria-valuetext", `${formatTime(targetTime)} de ${formatTime(audio.duration)}`);
    previewProgress();
    showToast(`Reprodução avançada para ${formatTime(targetTime)}.`);
}

timeline.addEventListener("pointerdown", (event) => {
    if (event.target === progress && event.button === 0) {
        isSeeking = true;
        isPointerSeeking = true;
    }
});
timeline.addEventListener("pointerup", (event) => {
    if (!isPointerSeeking) {
        return;
    }
    const bounds = progress.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
    progress.value = String(ratio * Number(progress.max));
    isPointerSeeking = false;
    ignoreNextRangeChange = true;
    commitSeek(Number(progress.value));
    window.setTimeout(() => {
        ignoreNextRangeChange = false;
    }, 0);
});
progress.addEventListener("keydown", (event) => {
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"].includes(event.key)) {
        isSeeking = true;
    }
});
progress.addEventListener("input", previewProgress);
progress.addEventListener("change", () => {
    if (ignoreNextRangeChange) {
        ignoreNextRangeChange = false;
        return;
    }
    commitSeek(Number(progress.value));
});
timeline.addEventListener("pointercancel", () => {
    isSeeking = false;
    isPointerSeeking = false;
    updateProgress();
});

volumeControl.addEventListener("input", updateVolume);
muteButton.addEventListener("click", () => {
    volumeControl.value = audio.volume === 0 ? String(previousVolume || 0.75) : "0";
    updateVolume();
});

document.querySelector(".music-player__previous").addEventListener("click", () => {
    if (audio.currentTime > 3) {
        audio.currentTime = 0;
        updateProgress();
        showToast("A faixa voltou ao início.");
        return;
    }
    if (playbackQueueIndex > 0 && shuffleButton.getAttribute("aria-pressed") !== "true") {
        advanceQueue(-1);
        return;
    }
    if (playbackQueueIndex >= 0 && shuffleButton.getAttribute("aria-pressed") === "true") {
        advanceQueue(-1);
        return;
    }
    audio.currentTime = 0;
    updateProgress();
    showToast("A faixa voltou ao início.");
});

const shuffleButton = document.querySelector(".music-player__shuffle");
shuffleButton.addEventListener("click", () => {
    const isEnabled = shuffleButton.getAttribute("aria-pressed") !== "true";
    shuffleButton.setAttribute("aria-pressed", String(isEnabled));
    shuffleButton.setAttribute("aria-label", isEnabled ? "Desativar reprodução aleatória" : "Ativar reprodução aleatória");
    showToast(isEnabled
        ? "Aleatório ativado para as próximas faixas da fila."
        : "Reprodução aleatória desativada.");
});

const repeatButton = document.querySelector(".music-player__repeat");
repeatButton.addEventListener("click", () => {
    audio.loop = !audio.loop;
    repeatButton.setAttribute("aria-pressed", String(audio.loop));
    repeatButton.setAttribute("aria-label", audio.loop ? "Desativar repetição" : "Ativar repetição");
    showToast(audio.loop ? "A faixa será repetida." : "Repetição desativada.");
});

muteButton.addEventListener("click", () => {
    showToast(audio.volume === 0 ? "Som ativado." : "Som silenciado.");
});

searchInput.addEventListener("input", () => {
    if (!detailView.hidden) {
        showHomeView();
    }
    updateLibraryVisibility();
    updateHomeVisibility();
    window.clearTimeout(searchDebounce);
    const query = searchInput.value.trim();
    if (query.length < 2) {
        apiSearchAbortController?.abort();
        providerSearchResults = [];
        apiSearchGrid.replaceChildren();
        apiSearchSection.hidden = true;
        apiSearchStatus.textContent = "";
        return;
    }
    searchDebounce = window.setTimeout(() => {
        searchMusicProviders(query);
    }, API_CONFIG.searchDebounceMs);
});

document.querySelector(".library-search").addEventListener("click", () => searchInput.focus());

document.querySelectorAll("[data-library-filter]").forEach((button) => {
    button.addEventListener("click", () => filterLibrary(button.dataset.libraryFilter));
});

const libraryFilterCycle = ["all", "artist", "album", "podcast"];
document.querySelector(".library-panel__more").addEventListener("click", () => {
    const currentIndex = libraryFilterCycle.indexOf(libraryFilter);
    const nextFilter = libraryFilterCycle[(currentIndex + 1) % libraryFilterCycle.length];
    filterLibrary(nextFilter);
    const filterButton = document.querySelector(`[data-library-filter="${nextFilter}"]`);
    showToast(`Biblioteca filtrada: ${filterButton ? filterButton.textContent.trim() : "Artistas"}.`);
});

document.querySelector(".sort-button").addEventListener("click", (event) => {
    alphabeticalSort = !alphabeticalSort;
    const items = [...libraryList.querySelectorAll(".library-item")];
    if (alphabeticalSort) {
        items.sort((left, right) => left.querySelector("strong").textContent.localeCompare(
            right.querySelector("strong").textContent,
            "pt-BR"
        ));
    } else {
        items.sort((left, right) => Number(right.dataset.sequence) - Number(left.dataset.sequence));
    }
    items.forEach((item) => libraryList.append(item));
    event.currentTarget.firstChild.textContent = alphabeticalSort ? "A–Z " : "Recentes ";
    event.currentTarget.setAttribute(
        "aria-label",
        alphabeticalSort ? "Ordenar biblioteca: ordem alfabética" : "Ordenar biblioteca: recentes"
    );
});

document.querySelector(".import-card__close").addEventListener("click", () => {
    document.querySelector(".import-card").hidden = true;
});

document.querySelector(".library-panel__title").addEventListener("click", () => {
    const isCollapsed = libraryPanel.classList.toggle("is-collapsed");
    workspace.classList.toggle("is-library-collapsed", isCollapsed);
    document.querySelector(".library-panel__title").setAttribute(
        "aria-label",
        isCollapsed ? "Expandir biblioteca" : "Recolher biblioteca"
    );
});

document.querySelector(".library-panel__expand").addEventListener("click", (event) => {
    const isExpanded = workspace.classList.toggle("is-library-expanded");
    event.currentTarget.setAttribute("aria-pressed", String(isExpanded));
    event.currentTarget.setAttribute("aria-label", isExpanded ? "Restaurar visualização" : "Expandir biblioteca");
});

document.querySelector(".library-panel__actions .icon-button").addEventListener("click", showPlaylistDialog);
document.querySelector(".app-dialog__form").addEventListener("submit", (event) => {
    if (dialog.dataset.action !== "create-playlist") {
        return;
    }
    event.preventDefault();
    const nameInput = dialog.querySelector("#new-playlist-name");
    const name = nameInput.value.trim();
    if (!name) {
        nameInput.focus();
        return;
    }
    addLibraryItem(name, "playlist", "Playlist • 0 músicas");
    dialog.close();
    showToast(`Playlist "${name}" criada.`);
});

document.querySelector(".app-dialog__close").addEventListener("click", () => dialog.close());

// Salva localmente o Client ID público; o verificador privado do OAuth permanece restrito à aba.
// Save the public Spotify Client ID locally; the private OAuth verifier remains tab-scoped.
document.querySelector(".api-settings-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const clientId = spotifyClientIdInput.value.trim();
    try {
        if (clientId) {
            localStorage.setItem(storageKeys.clientId, clientId);
            localStorage.removeItem(storageKeys.legacyClientId);
        } else {
            localStorage.removeItem(storageKeys.clientId);
            localStorage.removeItem(storageKeys.legacyClientId);
        }
        spotifyClientId = clientId;
        document.querySelector(".api-settings-status").textContent = "Configuração salva neste navegador.";
        apiSettingsDialog.close();
    } catch (error) {
        console.error("Could not save API configuration.", error);
        document.querySelector(".api-settings-status").textContent = "Não foi possível salvar a configuração neste navegador.";
    }
});

document.querySelector(".api-settings-connect").addEventListener("click", async () => {
    try {
        await connectSpotify();
    } catch (error) {
        console.error("Could not start Spotify authorization.", error);
        document.querySelector(".api-settings-status").textContent = `Não foi possível iniciar a conexão: ${error.message}`;
    }
});

document.querySelector(".api-settings-close").addEventListener("click", () => apiSettingsDialog.close());

document.querySelector(".detail-back").addEventListener("click", () => {
    if (window.history.state?.detail) {
        window.history.back();
    } else {
        showHomeView();
    }
});

document.querySelector(".news-back").addEventListener("click", () => {
    window.history.back();
});

document.querySelector(".detail-play").addEventListener("click", () => {
    if (!currentDetailTracks.length) {
        showToast("Não há faixas disponíveis para reproduzir.");
        return;
    }
    playbackQueue = currentDetailTracks;
    playbackQueueIndex = -1;
    const shuffle = document.querySelector(".detail-shuffle").getAttribute("aria-pressed") === "true";
    const nextTrack = shuffle
        ? currentDetailTracks[Math.floor(Math.random() * currentDetailTracks.length)]
        : currentDetailTracks[0];
    playTrack(nextTrack);
});

document.querySelector(".detail-shuffle").addEventListener("click", (event) => {
    const enabled = event.currentTarget.getAttribute("aria-pressed") !== "true";
    event.currentTarget.setAttribute("aria-pressed", String(enabled));
    showToast(enabled ? "Aleatório ativado para esta seleção." : "Aleatório desativado.");
});

document.querySelector(".detail-save").addEventListener("click", () => {
    if (currentDetail) {
        toggleSave(currentDetail);
        syncCurrentDetailSaveState();
    }
});

document.querySelector(".now-playing-panel__track-link").addEventListener("click", () => openDetail(currentTrack));
document.querySelector(".now-playing-panel__artist-link").addEventListener("click", () => openNamedArtist(currentTrack.artistName));
document.querySelectorAll(".credit-artist-link").forEach((button) => {
    button.addEventListener("click", () => openNamedArtist(currentTrack.artistName));
});

document.querySelectorAll(".home-filters [data-home-filter]").forEach((button) => {
    button.addEventListener("click", () => {
        homeFilter = button.dataset.homeFilter;
        document.querySelectorAll(".home-filters [data-home-filter]").forEach((filter) => {
            filter.classList.toggle("is-active", filter === button);
        });
        renderApiSearchResults(providerSearchResults);
        updateHomeVisibility();
    });
});

document.querySelector(".show-all-artists").addEventListener("click", (event) => {
    const grid = document.querySelector(".artist-grid");
    const isExpanded = event.currentTarget.getAttribute("aria-expanded") !== "true";
    grid.classList.toggle("is-expanded", isExpanded);
    grid.querySelectorAll("[data-expanded-only]").forEach((item) => { item.hidden = !isExpanded; });
    event.currentTarget.setAttribute("aria-expanded", String(isExpanded));
    event.currentTarget.textContent = isExpanded ? "Mostrar menos" : "Mostrar tudo";
});

document.querySelector(".show-all-mixes").addEventListener("click", (event) => {
    const grid = document.querySelector(".release-grid");
    const isExpanded = event.currentTarget.getAttribute("aria-expanded") !== "true";
    grid.classList.toggle("is-expanded", isExpanded);
    grid.querySelectorAll("[data-expanded-only]").forEach((item) => { item.hidden = !isExpanded; });
    event.currentTarget.setAttribute("aria-expanded", String(isExpanded));
    event.currentTarget.textContent = isExpanded ? "Mostrar menos" : "Mostrar tudo";
});

document.querySelectorAll(".library-item").forEach((item) => {
    item.addEventListener("click", () => selectLibraryItem(item));
});

document.querySelectorAll(".quick-pick, .artist-card, .release-card").forEach((item) => {
    item.addEventListener("click", () => {
        const name = item.querySelector("strong").textContent;
        if (item.classList.contains("artist-card") || name === "zTokyo" || name === "Lil Peep") {
            openNamedArtist(name);
        } else {
            openNamedCollection(name, item.classList.contains("release-card") ? "playlist" : "track");
        }
    });
});

document.querySelector(".primary-button").addEventListener("click", playAudio);
document.querySelector(".featured-more").addEventListener("click", () => {
    openNamedCollection("Best of 2026: Global Hits", "playlist");
});

document.querySelector(".now-playing-panel__save").addEventListener("click", () => {
    toggleSave(currentTrack);
});

document.querySelector(".music-player__add").addEventListener("click", () => {
    document.querySelector(".now-playing-panel__save").click();
});

document.querySelector(".follow-button").addEventListener("click", (event) => {
    const isFollowing = event.currentTarget.getAttribute("aria-pressed") !== "true";
    event.currentTarget.setAttribute("aria-pressed", String(isFollowing));
    event.currentTarget.textContent = isFollowing ? "Seguindo" : "Seguir";
    showToast(isFollowing ? "Você está seguindo lilberto33." : "Você deixou de seguir lilberto33.");
});

document.querySelector(".credits-more").addEventListener("click", (event) => {
    const credits = document.querySelector(".credits-card");
    const extraCredit = document.querySelector(".credit-row--extra");
    const isExpanded = extraCredit.hidden;
    extraCredit.hidden = !isExpanded;
    credits.classList.toggle("is-expanded", isExpanded);
    event.currentTarget.textContent = isExpanded ? "Mostrar menos" : "Mostrar tudo";
});

document.querySelector(".close-now-playing").addEventListener("click", () => {
    nowPlayingPanel.hidden = true;
    document.querySelector(".restore-now-playing").hidden = false;
    workspace.style.gridTemplateColumns = "minmax(245px, 21%) minmax(360px, 1fr)";
});

document.querySelector(".restore-now-playing").addEventListener("click", () => {
    nowPlayingPanel.hidden = false;
    document.querySelector(".restore-now-playing").hidden = true;
    workspace.style.gridTemplateColumns = "";
});

document.querySelector(".music-player__extras [aria-label='Letra']").addEventListener("click", () => {
    void showLyrics();
});

document.querySelector(".music-player__extras [aria-label='Fila']").addEventListener("click", () => {
    showDialog("Fila", `Tocando agora: ${title.textContent}. Carregue outra faixa pelo botão de música para adicioná-la à fila.`);
});

document.querySelector(".music-player__extras [aria-label='Conectar a um dispositivo']").addEventListener("click", () => {
    showDialog("Conectar a um dispositivo", "A reprodução acontece neste navegador. A seleção de dispositivos Spotify não está disponível.");
});

document.querySelector(".music-player__extras [aria-label='Mini player']").addEventListener("click", (event) => {
    const isMini = workspace.classList.toggle("is-mini-player");
    document.querySelector(".music-player").classList.toggle("is-mini-player", isMini);
    event.currentTarget.setAttribute("aria-label", isMini ? "Restaurar player" : "Mini player");
});

document.querySelector(".music-player__extras [aria-label='Tela cheia']").addEventListener("click", async (event) => {
    try {
        if (document.fullscreenElement) {
            await document.exitFullscreen();
        } else {
            await document.documentElement.requestFullscreen();
        }
    } catch (error) {
        showToast("Não foi possível ativar a tela cheia neste navegador.");
        console.error("Falha ao alternar tela cheia.", error);
        return;
    }
    event.currentTarget.setAttribute(
        "aria-label",
        document.fullscreenElement ? "Sair da tela cheia" : "Tela cheia"
    );
});

document.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", async () => {
        switch (button.dataset.action) {
            case "explore":
                showDialog("Explorar música", "Use a busca para descobrir faixas, artistas, álbuns e playlists dos catálogos conectados.");
                break;
            case "install":
                if (installPrompt) {
                    await installPrompt.prompt();
                    installPrompt = null;
                } else {
                    showDialog("Instalar aplicativo", "Use a opção de instalação do navegador quando ela estiver disponível.");
                }
                break;
            case "notifications":
                await showNewsView();
                break;
            case "friends":
                showDialog("Atividade dos amigos", "A atividade de amigos não está conectada nesta demonstração.");
                break;
            case "profile":
                showDialog("Perfil", "Perfil local • nenhuma conta Spotify conectada.");
                break;
            case "queue":
                showDialog("Tocando agora", `Faixa atual: ${title.textContent}.`);
                break;
            case "track-options":
                showDialog("Opções da faixa", "Use o botão + para salvar a faixa ou os controles do player para reproduzir, repetir e ajustar o volume.");
                break;
            case "api-settings":
                document.querySelector(".api-settings-status").textContent = "";
                apiSettingsDialog.showModal();
                break;
        }
    });
});

document.querySelector(".topbar__home").addEventListener("click", () => {
    searchInput.value = "";
    homeFilter = "all";
    document.querySelectorAll(".home-filters [data-home-filter]").forEach((button) => {
        button.classList.toggle("is-active", button.dataset.homeFilter === "all");
    });
    updateLibraryVisibility();
    apiSearchAbortController?.abort();
    providerSearchResults = [];
    apiSearchGrid.replaceChildren();
    apiSearchSection.hidden = true;
    updateHomeVisibility();
    showHomeView();
});

document.querySelector(".brand").addEventListener("click", () => {
    document.querySelector(".topbar__home").click();
});

document.querySelector(".search-box__browse").addEventListener("click", () => {
    showDialog("Navegar", "Use os filtros Música, Podcasts e Audiolivros para explorar a biblioteca disponível.");
});

dialog.addEventListener("close", () => {
    dialog.dataset.action = "";
});

window.addEventListener("popstate", (event) => {
    if (event.state?.detail) {
        openDetail(event.state.detail, { history: false });
    } else if (event.state?.news) {
        showNewsView({ history: false });
    } else {
        showHomeView();
    }
});

window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
});

window.addEventListener("beforeunload", () => {
    for (const url of localAudioUrls) {
        URL.revokeObjectURL(url);
    }
    window.clearTimeout(toastTimeout);
});

updateVolume();
updateProgress();
updateLibraryVisibility();
updateHomeVisibility();
restoreSavedLibraryItems();
loadApiConfiguration();
