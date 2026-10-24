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
const settingsDialog = document.querySelector(".settings-dialog");
const settingsStatus = document.querySelector(".settings-dialog__status");
const profileButton = document.querySelector(".profile-button");
const profileButtonContent = document.querySelector("#profileButtonContent");
const settingsLocalFileActions = document.querySelector("[data-local-files-actions]");
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
    preferences: "open-music-hub:preferences"
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
let jamendoEnabled = false;
let audioDbEnabled = false;
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

let isSeeking = false;
let isPointerSeeking = false;
let ignoreNextRangeChange = false;
let playbackRequestId = 0;
let jamendoFallbackAttemptId = 0;
let currentOfflineObjectUrl = "";
let importCardDismissed = false;
let autoplayPlayedIds = new Set();
let gaplessPreparedKey = "";

// Preferências locais: densidade, biblioteca, reprodução e perfil ficam só neste navegador.
// Local preferences: density, library, playback, and profile stay in this browser only.
const defaultPreferences = Object.freeze({
    density: "default",
    compactLibrary: false,
    showLocalFiles: false,
    showNowPlayingPanel: true,
    autoplay: true,
    gapless: false,
    quality: "normal",
    profileName: ""
});
let preferences = readPreferences();

// Lê e normaliza as preferências persistidas, ignorando valores desconhecidos.
// Read and normalize persisted preferences, ignoring unknown values.
function readPreferences() {
    try {
        const parsed = JSON.parse(localStorage.getItem(storageKeys.preferences) || "{}");
        const stored = parsed && typeof parsed === "object" ? parsed : {};
        const profileName = typeof stored.profileName === "string" ? stored.profileName.trim().slice(0, 40) : "";
        return {
            density: ["dense", "default", "wide"].includes(stored.density) ? stored.density : defaultPreferences.density,
            compactLibrary: typeof stored.compactLibrary === "boolean" ? stored.compactLibrary : defaultPreferences.compactLibrary,
            showLocalFiles: typeof stored.showLocalFiles === "boolean" ? stored.showLocalFiles : defaultPreferences.showLocalFiles,
            showNowPlayingPanel: typeof stored.showNowPlayingPanel === "boolean"
                ? stored.showNowPlayingPanel
                : defaultPreferences.showNowPlayingPanel,
            autoplay: typeof stored.autoplay === "boolean" ? stored.autoplay : defaultPreferences.autoplay,
            gapless: typeof stored.gapless === "boolean" ? stored.gapless : defaultPreferences.gapless,
            quality: ["low", "normal", "high"].includes(stored.quality) ? stored.quality : defaultPreferences.quality,
            profileName
        };
    } catch (error) {
        console.error("Could not read local preferences.", error);
        return { ...defaultPreferences };
    }
}

// Persiste o objeto completo para manter o formato estável entre versões.
// Persist the whole object so the stored shape stays stable across versions.
function savePreferences() {
    try {
        localStorage.setItem(storageKeys.preferences, JSON.stringify(preferences));
        return true;
    } catch (error) {
        console.error("Could not save local preferences.", error);
        showToast("Não foi possível salvar as configurações neste navegador.");
        return false;
    }
}

function setPreference(key, value) {
    preferences = { ...preferences, [key]: value };
    savePreferences();
    applyPreferences();
}

// Library starts empty by default - items are added via search/pin and persisted in localStorage
// A biblioteca inicia vazia por padrão - itens são adicionados via busca/pin e persistidos no localStorage
libraryList.replaceChildren();

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

// As letras agora vivem na vista "Em exibição" expandida, sincronizadas com o áudio.
// Lyrics now live in the expanded "Now Playing" view, synced with the audio.


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

// Convert Invidious video metadata into the shared track shape, extracting the direct audio URL from adaptiveFormats.
// Converte metadados de vídeo do Invidious para o formato de faixa compartilhado, extraindo a URL de áudio direto de adaptiveFormats.
function normalizeInvidiousItem(item) {
    const videoId = String(item.videoId || "");
    const thumbnail = [...(item.videoThumbnails || [])]
        .sort((left, right) => (right.width || 0) - (left.width || 0))[0];
    // Usa a URL de áudio já resolvida pelo servidor (proxy de mesma origem) ou extrai de adaptiveFormats.
    // Use the server-resolved audio URL (same-origin proxy) or extract it from adaptiveFormats.
    let audioUrl = item.audioUrl || "";
    if (!audioUrl && Array.isArray(item.adaptiveFormats)) {
        const audioFormat = item.adaptiveFormats.find((format) => format.container && (format.container === "webm" || format.container === "m4a"));
        if (audioFormat && audioFormat.url) {
            audioUrl = audioFormat.url;
        }
    }
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
        // Áudio completo obtido via adaptiveFormats (nunca a prévia de 30 segundos).
        // Full audio obtained from adaptiveFormats (never the 30-second preview).
        audioUrl,
        directAudioUrl: item.directAudioUrl || "",
        audioMimeType: item.audioMimeType || "",
        audioContainer: item.audioContainer || "",
        externalUrl: videoId ? `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}` : "",
        durationSeconds: Number(item.lengthSeconds) || 0,
        viewCount: Number(item.viewCount) || 0
    };
}

// Lê as contagens deste navegador; elas não são estatísticas globais de nenhum catálogo.
// Read only this browser's local interaction counters; they are not any catalog's global play statistics.
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

// Permite navegação externa somente para páginas oficiais dos provedores suportados.
// Allow external navigation only to official pages from supported providers.
function safeProviderUrl(value) {
    if (!value) {
        return "";
    }
    try {
        const url = new URL(value);
        const approved = url.protocol === "https:"
            && (url.hostname === "deezer.com" || url.hostname.endsWith(".deezer.com")
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

// Consulta cada provedor independentemente para manter o Deezer útil mesmo se outro falhar.
// Fetch each provider independently so Deezer stays useful even when another one fails.
async function searchMusicProviders(query) {
    const requestId = ++searchRequestId;
    apiSearchAbortController?.abort();
    apiSearchAbortController = new AbortController();
    apiSearchSection.hidden = false;
    const searchingProviders = ["Deezer", "Invidious"];
    if (jamendoEnabled) {
        searchingProviders.push("Jamendo");
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

    if (requestId !== searchRequestId) {
        return;
    }
    providerSearchResults = results;
    renderApiSearchResults(results);
    // As sugestões derivam dos resultados: reflete a lista assim que ela chega.
    // Suggestions derive from the results: refresh them as soon as the list arrives.
    renderSearchSuggestions();
    const providerNames = [...successfulProviders].join("/");
    const providerSummary = successfulProviders.size
        ? `${results.length} resultados de ${providerNames}`
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
    // Devolve os registros para a navegação por Enter (resultados ou artista exato).
    // Return the records so Enter navigation can pick results or an exact artist.
    return results;
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
            jamendo: "Jamendo"
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

// Busca detalhes e faixas relacionadas pelos provedores públicos suportados.
// Request details and related tracks from the supported public providers.
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
        // A instância pública pode falhar em um momento isolado; a faixa continua tocável.
        // The public instance may fail intermittently; the track stays playable.
        try {
            const payload = await fetchJson(API_CONFIG.providers.invidious.detailPath(item.id));
            const detailedItem = normalizeInvidiousItem(payload.item);
            return { item: { ...item, ...detailedItem }, tracks: [detailedItem] };
        } catch (error) {
            console.error("Could not load Invidious metadata.", error);
            return { item, tracks: [item] };
        }
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

    // Itens antigos de provedores removidos continuam abrindo com os dados guardados.
    // Legacy entries from removed providers still open with their stored metadata.
    return { item, tracks: [] };
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

// Resolve (e memoriza) a URL de áudio completo do Invidious para uma faixa.
// Resolve (and memoize) the full Invidious audio URL for a track.
async function ensureInvidiousAudioUrl(track, requestId, { silent = false } = {}) {
    if (!track || track.provider !== "invidious" || !track.id) {
        return "";
    }
    // A URL memorizada vale apenas para a qualidade atual; trocar de qualidade força nova resolução.
    // The memoized URL is valid only for the current quality; changing it forces a new resolution.
    if ((track.audioUrl || track.directAudioUrl) && track.audioQuality === preferences.quality) {
        return track.directAudioUrl || track.audioUrl;
    }
    if (track.audioUrl || track.directAudioUrl) {
        track.audioUrl = "";
        track.directAudioUrl = "";
    }
    if (!silent) {
        status.textContent = "Extraindo o áudio completo no Invidious…";
    }
    // A instância pública falha em rajadas; uma segunda tentativa evita erro transitório.
    // The public instance fails in bursts; one more attempt avoids a transient error.
    for (let attempt = 1; attempt <= 2; attempt += 1) {
        try {
            // A qualidade escolhida nas configurações viaja até a seleção de adaptiveFormats.
            // The quality chosen in settings travels down to the adaptiveFormats selection.
            const payload = await fetchJson(API_CONFIG.providers.invidious.audioPath(track.id, preferences.quality));
            if (requestId !== undefined && requestId !== playbackRequestId) {
                return "";
            }
            const audioUrl = payload.audioUrl || payload.audio?.url || "";
            const directAudioUrl = payload.directAudioUrl || payload.audio?.directUrl || "";
            if (!audioUrl && !directAudioUrl) {
                return "";
            }
            track.audioUrl = audioUrl;
            track.directAudioUrl = directAudioUrl;
            track.audioQuality = preferences.quality;
            track.audioMimeType = payload.audio?.mimeType || "";
            track.audioContainer = payload.audio?.container || "";
            // Reproduz pela URL direta (IP do usuário) e mantém o proxy de mesma origem como alternativa.
            // Play from the direct URL (user's IP) keeping the same-origin proxy as a fallback.
            return directAudioUrl || audioUrl;
        } catch (error) {
            console.error("Could not resolve the Invidious audio stream.", error);
            if (attempt === 1) {
                await new Promise((resolve) => window.setTimeout(resolve, 800));
            }
        }
    }
    return "";
}

// Procura o áudio completo de uma faixa de outro catálogo no Invidious (sem prévias de 30s).
// Look up a catalog track's full audio on Invidious (never the 30-second previews).
async function findInvidiousAudioForTrack(track, requestId) {
    const query = [track.artistName, track.title].filter(Boolean).join(" ").trim();
    if (!query) {
        return "";
    }
    status.textContent = "Buscando o áudio completo no Invidious…";
    try {
        const payload = await fetchJson(API_CONFIG.providers.invidious.searchPath(query));
        if (requestId !== undefined && requestId !== playbackRequestId) {
            return "";
        }
        const video = (payload.results || []).find((entry) => entry.videoId);
        if (!video) {
            return "";
        }
        const resolved = { provider: "invidious", kind: "track", id: String(video.videoId) };
        const audioUrl = await ensureInvidiousAudioUrl(resolved, requestId);
        if (!audioUrl) {
            return "";
        }
        track.invidiousVideoId = resolved.id;
        track.audioUrl = resolved.audioUrl || audioUrl;
        track.directAudioUrl = resolved.directAudioUrl || "";
        track.audioMimeType = resolved.audioMimeType || "";
        track.audioContainer = resolved.audioContainer || "";
        return audioUrl;
    } catch (error) {
        console.error("Could not find a full Invidious audio source.", error);
        return "";
    }
}

// Atualiza os botões de download conforme a faixa está (ou não) guardada para uso offline.
// Update download buttons according to whether the current track is stored offline.
async function updateDownloadIndicators() {
    const buttons = [
        document.querySelector("[data-download-current]"),
        document.querySelector(".detail-download")
    ].filter(Boolean);
    let cached = false;
    try {
        if (currentTrack && currentTrack.provider !== "local") {
            const offline = await import("./offline.mjs");
            cached = await offline.hasOfflineCopy(currentTrack);
        }
    } catch (error) {
        console.warn("Could not inspect the offline cache.", error);
    }
    buttons.forEach((button) => {
        button.dataset.downloaded = String(cached);
        button.setAttribute("aria-label", cached ? "Disponível offline — baixar novamente" : "Baixar para ouvir offline");
        const icon = button.querySelector(".mdi");
        if (icon) {
            icon.className = cached ? "mdi mdi-download-circle" : "mdi mdi-download-outline";
        }
    });
}

// Baixa o áudio da faixa: guarda no Cache API e salva o arquivo no dispositivo do usuário.
// Download the track audio: store it in the Cache API and save the file to the user's device.
async function downloadTrackAudio(track = currentTrack) {
    if (!track || !track.title) {
        showToast("Nenhuma faixa selecionada para download.");
        return;
    }
    if (track.provider === "local") {
        showToast("Este arquivo já está no seu dispositivo.");
        return;
    }
    let offline;
    try {
        offline = await import("./offline.mjs");
    } catch (error) {
        console.error("Offline module unavailable.", error);
        showToast("Recurso offline indisponível neste navegador.");
        return;
    }
    if (!offline.isOfflineCacheSupported()) {
        showToast("Este navegador não suporta armazenamento offline.");
        return;
    }
    try {
        let blob = await offline.getOfflineBlob(track);
        if (!blob) {
            let source = "";
            if (track.provider === "invidious") {
                await ensureInvidiousAudioUrl(track);
                // O proxy de mesma origem evita CORS no fetch; a URL direta é o plano B.
                // The same-origin proxy avoids fetch CORS; the direct URL is the fallback.
                source = track.audioUrl || track.directAudioUrl || "";
            } else {
                source = track.playbackUrl || await findInvidiousAudioForTrack(track);
            }
            if (!source) {
                showToast("Não foi possível obter o áudio para download.");
                return;
            }
            showToast("Baixando o áudio completo…");
            const response = await fetch(source);
            if (!response.ok) {
                throw new Error("HTTP " + response.status);
            }
            blob = await response.blob();
            if (!blob.size) {
                throw new Error("arquivo vazio");
            }
            await offline.saveOfflineBlob(track, blob);
        }
        const fileName = offline.saveBlobToDevice(track, blob);
        await updateDownloadIndicators();
        showToast(fileName + " disponível para ouvir offline.");
    } catch (error) {
        console.error("Could not download the track audio.", error);
        showToast("Não foi possível baixar o áudio: " + error.message);
    }
}

// Se a URL direta do YouTube for recusada (403/limite), troca para o proxy de mesma origem.
// If the direct YouTube URL is refused (403/rate limit), switch to the same-origin proxy.
function installMediaFallback(track, source) {
    if (!track?.audioUrl || !track?.directAudioUrl || source !== track.directAudioUrl) {
        return;
    }
    audio.addEventListener("error", () => {
        if (String(audio.currentSrc || audio.src || "").includes("action=stream")) {
            return;
        }
        status.textContent = "Fonte direta bloqueada; tentando o proxy local…";
        audio.src = track.audioUrl;
        audio.load();
        playAudio(true);
    }, { once: true });
}

// Seleciona uma faixa e resolve o áudio completo, priorizando a cópia offline do Cache API.
// Select a track and resolve the full audio, preferring the offline Cache API copy.
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
    // O painel da direita segue a preferência "mostrar ao clicar no play".
    // The right-side panel follows the "show on play" preference.
    if (preferences.showNowPlayingPanel) {
        showNowPlayingPanel();
    } else {
        hideNowPlayingPanel();
    }
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
    let playableUrl = "";
    let usingJamendoFallback = false;
    let usingOfflineCopy = false;

    if (currentOfflineObjectUrl) {
        URL.revokeObjectURL(currentOfflineObjectUrl);
        currentOfflineObjectUrl = "";
    }

    // 1) Prioriza a cópia offline no Cache API para permitir escuta sem rede.
    // 1) Prefer the offline copy in the Cache API so playback works without network.
    try {
        const offline = await import("./offline.mjs");
        const cachedUrl = await offline.getOfflineBlobUrl(track);
        if (requestId !== playbackRequestId) {
            if (cachedUrl) {
                URL.revokeObjectURL(cachedUrl);
            }
            return;
        }
        if (cachedUrl) {
            playableUrl = cachedUrl;
            currentOfflineObjectUrl = cachedUrl;
            usingOfflineCopy = true;
            status.textContent = "Reproduzindo do cache offline.";
        }
    } catch (error) {
        console.warn("Offline cache unavailable.", error);
    }

    // 2) Invidious: extrai o fluxo de áudio completo (adaptiveFormats) quando ainda não resolvido.
    // 2) Invidious: extract the full audio stream (adaptiveFormats) when not resolved yet.
    if (!playableUrl && track.provider === "invidious") {
        playableUrl = await ensureInvidiousAudioUrl(track, requestId);
        if (requestId !== playbackRequestId) {
            return;
        }
        if (playableUrl) {
            status.textContent = "";
        }
    }

    // 3) Demais provedores: Jamendo licenciado e, depois, áudio completo no Invidious.
    // As prévias de 30 segundos das lojas não são usadas.
    // 3) Other providers: licensed Jamendo, then full Invidious audio.
    // The stores' 30-second previews are never used.
    if (!playableUrl) {
        if (track.provider === "local") {
            playableUrl = track.previewUrl || "";
        } else {
            if (jamendoEnabled && !track.playbackUrl && track.title && track.artistName) {
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
            if (!playableUrl && track.provider !== "jamendo" && track.title) {
                playableUrl = await findInvidiousAudioForTrack(track, requestId);
                if (requestId !== playbackRequestId) {
                    return;
                }
            }
        }
    }

    if (!playableUrl) {
        pendingPlayCount = false;
        playButton.disabled = true;
        progress.disabled = true;
        status.textContent = ["invidious", "deezer"].includes(track.provider)
            ? "Não foi possível obter o áudio completo desta faixa. Tente outra versão."
            : "Esta faixa não tem áudio disponível no catálogo.";
        showToast(status.textContent);
        return;
    }

    if (!usingJamendoFallback && !usingOfflineCopy) {
        status.textContent = "";
    }
    playButton.disabled = true;
    progress.disabled = true;
    audio.pause();
    audio.src = playableUrl;
    audio.load();
    installMediaFallback(track, playableUrl);
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
    void updateDownloadIndicators();
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
        setLibraryEntry(item, updated.saved);
    }
    return updated;
}

// Biblioteca persistida somente neste navegador: começa vazia e guarda favoritos/fixados.
// Browser-persisted library: starts empty and keeps favorited/pinned items.
const libraryStorageKey = "open-music-hub:library";
let librarySort = "recent";

function readLibrary() {
    try {
        const parsed = JSON.parse(localStorage.getItem(libraryStorageKey) || "[]");
        if (!Array.isArray(parsed)) {
            return [];
        }
        return parsed.filter((entry) => entry && entry.provider && entry.title);
    } catch (error) {
        console.error("Could not read the saved library.", error);
        return [];
    }
}

function writeLibrary(entries) {
    try {
        localStorage.setItem(libraryStorageKey, JSON.stringify(entries));
        return true;
    } catch (error) {
        console.error("Could not persist the saved library.", error);
        showToast("Não foi possível salvar a biblioteca neste navegador.");
        return false;
    }
}

function libraryEntryKey(entry) {
    return entry.provider + ":" + (entry.kind || "track") + ":" + (entry.id || entry.title);
}

function libraryCategoryLabel(kind) {
    return { artist: "Artista", album: "Álbum", playlist: "Playlist", track: "Música" }[kind] || "Item";
}

function libraryCategoryIcon(kind) {
    return { artist: "mdi-account-music", album: "mdi-album", playlist: "mdi-playlist-music", track: "mdi-music" }[kind] || "mdi-music";
}

// Itens fixados aparecem primeiro; o restante segue a ordenação escolhida.
// Pinned items come first; the rest follow the selected sort order.
function sortedLibraryEntries() {
    const entries = readLibrary();
    entries.sort((left, right) => {
        if (Boolean(right.pinned) !== Boolean(left.pinned)) {
            return Number(Boolean(right.pinned)) - Number(Boolean(left.pinned));
        }
        if (librarySort === "alphabetical") {
            return String(left.title).localeCompare(String(right.title), "pt-BR");
        }
        return (Number(right.addedAt) || 0) - (Number(left.addedAt) || 0);
    });
    return entries;
}

// Adiciona ou remove um item salvo e persiste a lista no localStorage.
// Add or remove a saved item and persist the list in localStorage.
function setLibraryEntry(item, saved) {
    if (!item || !["artist", "album", "playlist", "track"].includes(item.kind)) {
        return;
    }
    const entries = readLibrary();
    const key = libraryEntryKey(item);
    const index = entries.findIndex((entry) => libraryEntryKey(entry) === key);
    if (saved && index < 0) {
        entries.push({
            provider: item.provider,
            kind: item.kind,
            id: String(item.id || ""),
            title: item.title,
            artistName: item.artistName || "",
            image: item.image || "",
            pinned: false,
            addedAt: Date.now()
        });
    } else if (saved && index >= 0) {
        entries[index] = { ...entries[index], title: item.title, artistName: item.artistName || entries[index].artistName };
    } else if (!saved && index >= 0) {
        entries.splice(index, 1);
    } else {
        return;
    }
    writeLibrary(entries);
    renderLibrary();
}

// Fixa ou desafixa um item, mantendo-o no topo da biblioteca.
// Pin or unpin an item, keeping it at the top of the library.
function toggleLibraryPin(entryKey) {
    const entries = readLibrary();
    const stored = entries.find((entry) => libraryEntryKey(entry) === entryKey);
    if (!stored) {
        return;
    }
    stored.pinned = !stored.pinned;
    writeLibrary(entries);
    renderLibrary();
    showToast(stored.pinned ? `${stored.title} fixado no topo da biblioteca.` : `${stored.title} desafixado.`);
}

async function openLibraryEntry(entry) {
    closeLibraryDrawerIfOpen();
    await openDetail({
        provider: entry.provider,
        kind: entry.kind || "track",
        id: entry.id,
        title: entry.title,
        artistName: entry.artistName || (entry.kind === "artist" ? entry.title : ""),
        image: entry.image || ""
    });
}

// Renderiza a lista vazia ou os itens salvos com o botão de fixar (📌).
// Render either the empty state or the saved items with the pin control (📌).
function renderLibrary() {
    libraryList.replaceChildren();
    const entries = sortedLibraryEntries();
    if (!entries.length) {
        const empty = document.createElement("p");
        empty.className = "library-empty";
        empty.textContent = "Sua biblioteca está vazia. Favorite artistas, álbuns e playlists com o botão +.";
        libraryList.append(empty);
        updateLibraryVisibility();
        return;
    }
    entries.forEach((entry) => {
        const key = libraryEntryKey(entry);
        const card = document.createElement("div");
        card.className = `library-item${entry.pinned ? " pinned" : ""}`;
        card.dataset.searchable = "";
        card.dataset.category = entry.kind;
        card.dataset.provider = entry.provider;
        card.dataset.kind = entry.kind;
        card.dataset.id = entry.id || "";

        const openButton = document.createElement("button");
        openButton.className = "library-item__open";
        openButton.type = "button";
        const icon = document.createElement("span");
        icon.className = `library-item__art mdi ${libraryCategoryIcon(entry.kind)}`;
        icon.setAttribute("aria-hidden", "true");
        const info = document.createElement("span");
        const name = document.createElement("strong");
        name.textContent = entry.title;
        const description = document.createElement("small");
        const details = libraryCategoryLabel(entry.kind) + (entry.artistName && entry.kind !== "artist" ? ` • ${entry.artistName}` : "");
        description.textContent = entry.pinned ? `📌 ${details}` : details;
        info.append(name, description);
        openButton.append(icon, info);
        openButton.addEventListener("click", () => {
            void openLibraryEntry(entry);
        });

        const pinButton = document.createElement("button");
        pinButton.className = "library-item__pin-button";
        pinButton.type = "button";
        pinButton.setAttribute("aria-pressed", String(Boolean(entry.pinned)));
        pinButton.setAttribute("aria-label", entry.pinned ? `Desafixar ${entry.title}` : `Fixar ${entry.title}`);
        pinButton.title = entry.pinned ? "Desafixar" : "Fixar no topo";
        pinButton.innerHTML = `<span class="mdi ${entry.pinned ? "mdi-pin" : "mdi-pin-outline"}" aria-hidden="true"></span>`;
        pinButton.addEventListener("click", (event) => {
            event.stopPropagation();
            toggleLibraryPin(key);
        });

        card.append(openButton, pinButton);
        libraryList.append(card);
    });
    updateLibraryVisibility();
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
async function showHomeView() {
    currentDetail = null;
    detailView.hidden = true;
    newsView.hidden = true;
    document.querySelector(".home-view").hidden = false;
    // Carregar tendências do momento ao abrir a tela inicial
    // Load moment's trends when opening the home screen
    await loadTrends();
    window.history.replaceState({ home: true }, "", `${window.location.pathname}${window.location.search}`);
    mainView.scrollTo({ top: 0, behavior: "smooth" });
}

// Carrega lançamentos dos artistas salvos, sem interromper a tela quando um provedor falha.
// Load releases from saved artists without breaking the page when one provider is unavailable.

// Extrai o ID do YouTube das URLs dos provedores para abrir a faixa no Invidious.
// Extract the YouTube ID from provider URLs so trending cards open playable Invidious tracks.
function extractYouTubeVideoId(value) {
    if (!value) {
        return "";
    }
    const match = String(value).match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{6,32})/);
    return match ? match[1] : "";
}

// Converte uma linha de tendência do TheAudioDB no modelo de cartão compartilhado.
// Convert a TheAudioDB trending row into the shared card model.
function normalizeAudioDbTrend(item) {
    const title = item.strAlbum || item.strTrack || "";
    if (!title) {
        return null;
    }
    return {
        provider: "audiodb",
        kind: "album",
        id: String(item.idAlbum || item.idTrack || item.idTrend || ""),
        title,
        artistName: item.strArtist || "",
        image: item.strAlbumThumb || item.strTrackThumb || item.strArtistThumb || "",
        externalUrl: item.strMusicVid || "",
        chartPlace: Number(item.intChartPlace) || 0,
        country: String(item.strCountry || "").toUpperCase()
    };
}

// Abre uma tendência tocando o áudio completo pelo Invidious.
// Open a trend by playing its full audio through Invidious.
async function openTrendItem(trend) {
    const knownVideoId = extractYouTubeVideoId(trend.externalUrl);
    if (knownVideoId) {
        await openDetail({
            provider: "invidious",
            kind: "track",
            id: knownVideoId,
            title: trend.title,
            artistName: trend.artistName,
            image: trend.image
        });
        return;
    }
    const query = [trend.artistName, trend.title].filter(Boolean).join(" ").trim();
    if (!query) {
        return;
    }
    showToast(`Procurando "${trend.title}" no Invidious…`);
    try {
        const payload = await fetchJson(API_CONFIG.providers.invidious.searchPath(query));
        const video = (payload.results || []).find((entry) => entry.videoId);
        if (!video) {
            showToast("Não encontramos essa tendência no Invidious.");
            return;
        }
        await openDetail({
            provider: "invidious",
            kind: "track",
            id: String(video.videoId),
            title: video.title || trend.title,
            artistName: video.author || trend.artistName,
            image: video.videoThumbnails?.[0]?.url || trend.image
        });
    } catch (error) {
        console.error("Could not open the trending item.", error);
        showToast(`Não foi possível abrir a tendência: ${error.message}`);
    }
}

// Carrega as "Tendências do Momento" do TheAudioDB (trending.php) na tela inicial.
// Load the home "Tendências do Momento" row from TheAudioDB (trending.php).
async function loadTrends() {
    const section = document.querySelector(".trends-section");
    const grid = document.querySelector(".trends-grid");
    const trendsStatus = document.querySelector(".trends-status");
    if (!section || !grid) {
        return;
    }
    section.hidden = false;
    grid.replaceChildren();
    if (trendsStatus) {
        trendsStatus.textContent = "Carregando tendências do momento…";
        trendsStatus.removeAttribute("role");
    }
    try {
        // O /trending.php devolve poucos itens por país, então combinamos alguns charts.
        // /trending.php returns few rows per country, so we merge a few charts.
        const trendCountries = ["us", "gb", "de", "fr", "it", "br"];
        const responses = await Promise.allSettled(trendCountries.map((country) => (
            fetchJson(API_CONFIG.providers.audioDb.trendingPath(country, "itunes", "albums"))
        )));
        const fulfilled = responses.filter((result) => result.status === "fulfilled");
        if (!fulfilled.length) {
            throw new Error(responses[0]?.reason?.message || "O TheAudioDB não respondeu.");
        }
        const seenTrends = new Set();
        const trends = [];
        for (const result of fulfilled) {
            for (const row of Array.isArray(result.value.results) ? result.value.results : []) {
                const trend = normalizeAudioDbTrend(row);
                if (!trend) {
                    continue;
                }
                const trendKey = `${trend.artistName}:${trend.title}`.toLocaleLowerCase("pt-BR");
                if (seenTrends.has(trendKey)) {
                    continue;
                }
                seenTrends.add(trendKey);
                trends.push(trend);
                if (trends.length >= 12) {
                    break;
                }
            }
        }
        if (!trends.length) {
            section.hidden = true;
            if (trendsStatus) {
                trendsStatus.textContent = "";
            }
            return;
        }
        trends.forEach((trend) => {
            const card = document.createElement("button");
            card.className = "quick-pick";
            card.type = "button";
            card.dataset.searchable = "true";
            card.dataset.contentType = "music";
            const cover = document.createElement("span");
            cover.className = "quick-pick__art mdi mdi-album";
            const image = safeCoverUrl(trend.image);
            if (image) {
                cover.style.backgroundImage = `linear-gradient(#0002, #0002), url("${image}")`;
                cover.classList.add("has-cover");
            }
            const text = document.createElement("span");
            const heading = document.createElement("strong");
            heading.textContent = trend.title;
            const subheading = document.createElement("small");
            subheading.textContent = [trend.artistName || "Artista desconhecido", trend.chartPlace ? `#${trend.chartPlace} no chart` : "TheAudioDB"].filter(Boolean).join(" • ");
            text.append(heading, subheading);
            card.append(cover, text);
            card.addEventListener("click", () => openTrendItem(trend));
            grid.append(card);
        });
        if (trendsStatus) {
            trendsStatus.textContent = `${trends.length} tendências do TheAudioDB • toque para ouvir no Invidious`;
        }
    } catch (error) {
        console.error("Could not load music trends.", error);
        section.hidden = true;
        if (trendsStatus) {
            trendsStatus.textContent = `Não foi possível carregar as tendências: ${error.message}`;
            trendsStatus.setAttribute("role", "alert");
        }
    }
}

// Mostra a página de notícias
// Show the news page
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
        .filter((item) => item && item.provider === "deezer")
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
            } else {
                errors.push(`${savedArtist.title}: provedor sem suporte a lançamentos.`);
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

// Descobre no servidor apenas quais provedores opcionais estão configurados.
// Ask the server only which optional providers are configured.
async function loadApiConfiguration() {
    try {
        const config = await fetchJson(API_CONFIG.serverRoutes.configuration);
        jamendoEnabled = config.jamendoEnabled === true;
        audioDbEnabled = config.audioDbEnabled === true;
    } catch (error) {
        // O app continua útil offline; os catálogos apenas ficam indisponíveis.
        // The app stays usable offline; only the catalogs become unavailable.
        console.error("Could not load the optional provider configuration.", error);
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

// Arquivos locais só entram quando a preferência correspondente está ativa.
// Local files are only accepted while the matching preference is enabled.
function requestLocalAudioFiles() {
    if (!preferences.showLocalFiles) {
        showToast("Ative “Mostrar arquivos locais” nas configurações para escolher arquivos do dispositivo.");
        openSettings("settings-library");
        return;
    }
    fileInput.click();
}

document.querySelector(".Pplay-music__cover").addEventListener("click", requestLocalAudioFiles);
document.querySelector(".import-card__button").addEventListener("click", requestLocalAudioFiles);
document.querySelector(".music-player__next").addEventListener("click", () => {
    advanceQueue();
});

// Busca no Invidious uma faixa parecida com a atual e retoma a reprodução.
// Look up an Invidious track similar to the current one and resume playback.
async function playSimilarTrack() {
    const query = currentTrack.artistName && currentTrack.artistName !== "Arquivo local"
        ? currentTrack.artistName
        : currentTrack.title;
    if (!query) {
        return false;
    }
    status.textContent = "Autoplay: buscando uma faixa parecida…";
    try {
        const payload = await fetchJson(API_CONFIG.providers.invidious.searchPath(query));
        const nextVideo = (payload.results || []).find((video) => (
            video.videoId
            && video.videoId !== currentTrack.id
            && !autoplayPlayedIds.has(video.videoId)
        ));
        if (!nextVideo) {
            return false;
        }
        autoplayPlayedIds.add(nextVideo.videoId);
        // Mantém a memória curta para não crescer durante uma escuta longa.
        // Keep the memory short so it does not grow during a long listening session.
        if (autoplayPlayedIds.size > 50) {
            autoplayPlayedIds = new Set([...autoplayPlayedIds].slice(-25));
        }
        showToast(`Autoplay: ${nextVideo.title}`);
        await playTrack(normalizeInvidiousItem(nextVideo), { autoplay: true });
        return true;
    } catch (error) {
        console.error("Autoplay lookup failed.", error);
        return false;
    }
}

// Prepara a próxima faixa da fila nos últimos segundos para reduzir a pausa entre músicas.
// Prepare the next queue track in the final seconds to reduce the gap between songs.
function maybePrepareGaplessTrack() {
    if (!preferences.gapless || audio.loop) {
        return;
    }
    const nextTrack = playbackQueue[playbackQueueIndex + 1];
    if (!nextTrack || !Number.isFinite(audio.duration)) {
        return;
    }
    const remaining = audio.duration - audio.currentTime;
    if (remaining > 20 || remaining < 0) {
        return;
    }
    const nextKey = `${nextTrack.provider}:${nextTrack.kind || "track"}:${nextTrack.id}`;
    if (gaplessPreparedKey === nextKey) {
        return;
    }
    gaplessPreparedKey = nextKey;
    if (nextTrack.provider === "invidious" && !nextTrack.audioUrl) {
        void ensureInvidiousAudioUrl(nextTrack, undefined, { silent: true }).catch((error) => {
            console.warn("Could not prepare the next track.", error);
        });
    }
}

fileInput.addEventListener("change", () => {
    if (fileInput.files?.length && preferences.showLocalFiles) {
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

audio.addEventListener("timeupdate", () => {
    updateProgress();
    maybePrepareGaplessTrack();
});
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
audio.addEventListener("ended", async () => {
    setPlaybackState(false);
    updateProgress();
    gaplessPreparedKey = "";
    if (audio.loop) {
        return;
    }
    if (playbackQueueIndex >= 0 && playbackQueueIndex + 1 < playbackQueue.length) {
        advanceQueue();
        return;
    }
    // Fila terminou: com o autoplay ligado, busca uma faixa parecida no Invidious.
    // Queue finished: with autoplay on, look up a similar Invidious track.
    if (preferences.autoplay && await playSimilarTrack()) {
        return;
    }
    status.textContent = "Reprodução concluída.";
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
        closeSearchSuggestions();
        return;
    }
    searchDebounce = window.setTimeout(() => {
        searchMusicProviders(query);
    }, API_CONFIG.searchDebounceMs);
    renderSearchSuggestions();
});

// ===== Caixa de sugestões e navegação com Enter / Suggestions box and Enter navigation =====
const searchSuggestions = document.querySelector(".search-suggestions");

// Fecha a caixa de sugestões (Enter, Esc, campo vazio ou clique fora).
// Close the suggestions box (Enter, Esc, empty field, or outside click).
function closeSearchSuggestions() {
    searchSuggestions.hidden = true;
    searchSuggestions.replaceChildren();
}

// Mostra até seis sugestões derivadas dos resultados já carregados dos provedores.
// Show up to six suggestions derived from provider results already loaded.
function renderSearchSuggestions() {
    const query = searchInput.value.trim();
    if (query.length < 2 || document.activeElement !== searchInput) {
        closeSearchSuggestions();
        return;
    }
    const normalizedQuery = query.toLocaleLowerCase("pt-BR");
    const matches = providerSearchResults
        .filter((item) => `${item.title} ${item.artistName || ""}`.toLocaleLowerCase("pt-BR").includes(normalizedQuery))
        .slice(0, 6);
    if (matches.length === 0) {
        closeSearchSuggestions();
        return;
    }
    const fragment = document.createDocumentFragment();
    for (const item of matches) {
        const option = document.createElement("button");
        option.type = "button";
        option.className = "search-suggestions__item";
        option.setAttribute("role", "option");
        const icon = document.createElement("span");
        icon.className = `mdi ${item.kind === "artist" ? "mdi-account-music" : item.kind === "album" ? "mdi-album" : item.kind === "playlist" ? "mdi-playlist-music" : "mdi-music"}`;
        icon.setAttribute("aria-hidden", "true");
        const labels = document.createElement("span");
        labels.className = "search-suggestions__labels";
        const name = document.createElement("strong");
        name.textContent = item.title;
        const meta = document.createElement("small");
        const kindLabel = item.kind === "artist" ? "Artista" : item.kind === "album" ? "Álbum" : item.kind === "playlist" ? "Playlist" : "Música";
        meta.textContent = `${kindLabel}${item.artistName ? ` • ${item.artistName}` : ""}`;
        labels.append(name, meta);
        option.append(icon, labels);
        // O pointerdown acontece antes do blur do campo, então a seleção não se perde.
        // pointerdown fires before the field blurs, so the selection is not lost.
        option.addEventListener("pointerdown", (event) => {
            event.preventDefault();
            closeSearchSuggestions();
            void openDetail(item);
        });
        fragment.append(option);
    }
    searchSuggestions.replaceChildren(fragment);
    searchSuggestions.hidden = false;
}

searchInput.addEventListener("focus", renderSearchSuggestions);

searchInput.addEventListener("blur", () => {
    // Aguarda o clique na sugestão antes de fechar / Wait for a suggestion click before closing.
    window.setTimeout(closeSearchSuggestions, 150);
});

// Enter fecha as sugestões e vai direto para os resultados ou para a página do artista.
// Enter closes the suggestions and goes straight to the results view or the artist page.
searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        closeSearchSuggestions();
        return;
    }
    if (event.key !== "Enter") {
        return;
    }
    event.preventDefault();
    const query = searchInput.value.trim();
    closeSearchSuggestions();
    if (query.length < 2) {
        return;
    }
    window.clearTimeout(searchDebounce);
    void openSearchResults(query);
});

// Abre a vista de resultados; com um artista de nome exato, abre a página dele.
// Open the results view; with an exact artist name, open that artist's page instead.
async function openSearchResults(query, { history = true } = {}) {
    if (!detailView.hidden || !newsView.hidden) {
        currentDetail = null;
        detailView.hidden = true;
        newsView.hidden = true;
        document.querySelector(".home-view").hidden = false;
    }
    if (searchInput.value.trim() !== query) {
        // Restaura a consulta ao voltar/avançar no histórico / Restore the query on back/forward.
        searchInput.value = query;
        updateLibraryVisibility();
        updateHomeVisibility();
    }
    const results = await searchMusicProviders(query);
    if (!results) {
        // Outra busca assumiu o controle / Another search took control.
        return;
    }
    const normalizedQuery = query.toLocaleLowerCase("pt-BR");
    // Uma faixa com o título da busca é o destino mais provável do que um artista homônimo obscuro.
    // A track titled like the query beats an obscure same-named artist as the intended destination.
    const trackTitleMatches = results.some((item) =>
        item.kind === "track"
        && String(item.title || "").trim().toLocaleLowerCase("pt-BR").startsWith(normalizedQuery)
    );
    const artistMatch = trackTitleMatches ? null : results.find((item) =>
        item.kind === "artist"
        && String(item.title || "").trim().toLocaleLowerCase("pt-BR") === normalizedQuery
    );
    closeLibraryDrawerIfOpen();
    if (artistMatch) {
        await openDetail(artistMatch, { history });
        return;
    }
    if (history && window.history.state?.search !== query) {
        window.history.pushState({ search: query }, "", `#search/${encodeURIComponent(query)}`);
    }
    updateHomeVisibility();
    if (!apiSearchSection.hidden) {
        apiSearchSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }
}

document.querySelector(".library-search").addEventListener("click", () => searchInput.focus());

document.querySelectorAll("[data-library-filter]").forEach((button) => {
    button.addEventListener("click", () => filterLibrary(button.dataset.libraryFilter));
});

// Pin/unpin library items - toggle 📌 state and persist to localStorage
// Fixar/desfixar itens da biblioteca - alterna estado 📌 e persist no localStorage
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
    librarySort = alphabeticalSort ? "alphabetical" : "recent";
    renderLibrary();
    event.currentTarget.firstChild.textContent = alphabeticalSort ? "A–Z " : "Recentes ";
    event.currentTarget.setAttribute(
        "aria-label",
        alphabeticalSort ? "Ordenar biblioteca: ordem alfabética" : "Ordenar biblioteca: recentes"
    );
});

document.querySelector(".import-card__close").addEventListener("click", () => {
    importCardDismissed = true;
    applyLocalFileVisibility();
});

// No celular a biblioteca vira uma gaveta; no desktop ela apenas recolhe para uma faixa estreita.
// On phones the library becomes a drawer; on desktop it just collapses into a narrow rail.
function closeLibraryDrawerIfOpen() {
    if (!libraryPanel.classList.contains("is-open")) {
        return;
    }
    libraryPanel.classList.remove("is-open");
    document.body.classList.remove("library-drawer-open");
    document.querySelector("#hamburgerButton")?.setAttribute("aria-expanded", "false");
}

const toggleLibraryPanel = () => {
    const isMobile = window.matchMedia("(max-width: 760px)").matches;
    const hamburger = document.querySelector("#hamburgerButton");
    if (isMobile) {
        const isOpen = libraryPanel.classList.toggle("is-open");
        document.body.classList.toggle("library-drawer-open", isOpen);
        hamburger?.setAttribute("aria-expanded", String(isOpen));
        hamburger?.setAttribute("aria-label", isOpen ? "Fechar biblioteca" : "Abrir biblioteca");
        return;
    }
    const isCollapsed = libraryPanel.classList.toggle("is-collapsed");
    workspace.classList.toggle("is-library-collapsed", isCollapsed);
    const titleBtn = document.querySelector(".library-panel__title");
    if (titleBtn) {
        titleBtn.setAttribute(
            "aria-label",
            isCollapsed ? "Expandir biblioteca" : "Recolher biblioteca"
        );
    }
};

document.querySelector(".library-panel__title").addEventListener("click", toggleLibraryPanel);

document.querySelector("#hamburgerButton").addEventListener("click", toggleLibraryPanel);

// Tocar fora da gaveta fecha a biblioteca no celular.
// Tapping outside the drawer closes the library on phones.
document.addEventListener("click", (event) => {
    if (!libraryPanel.classList.contains("is-open")) {
        return;
    }
    if (event.target.closest(".library-panel") || event.target.closest("#hamburgerButton")) {
        return;
    }
    closeLibraryDrawerIfOpen();
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
    setLibraryEntry({ provider: "local", kind: "playlist", id: `playlist-${Date.now()}`, title: name }, true);
    dialog.close();
    showToast(`Playlist "${name}" criada.`);
});

document.querySelector(".app-dialog__close").addEventListener("click", () => dialog.close());

// ===== Configurações locais / Local settings =====

// Formata bytes com uma casa decimal no padrão brasileiro.
// Format bytes with one decimal in the Brazilian number style.
function formatStorageSize(bytes) {
    const value = Math.max(0, Number(bytes) || 0);
    if (value < 1024) {
        return `${Math.round(value)} B`;
    }
    if (value < 1024 * 1024) {
        return `${(value / 1024).toFixed(1).replace(".", ",")} kB`;
    }
    return `${(value / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

function setSettingsStatus(message) {
    if (settingsStatus) {
        settingsStatus.textContent = message;
    }
}

// Soma o tamanho real dos áudios guardados no Cache API do offline.
// Sum the real size of the audio blobs stored in the offline Cache API.
async function measureOfflineDownloads() {
    if (typeof caches === "undefined") {
        return { count: 0, bytes: 0, supported: false };
    }
    try {
        const offline = await import("./offline.mjs");
        const cache = await caches.open(offline.CACHE_NAME);
        const requests = await cache.keys();
        let bytes = 0;
        for (const request of requests) {
            const response = await cache.match(request);
            if (response) {
                bytes += (await response.clone().blob()).size || 0;
            }
        }
        return { count: requests.length, bytes, supported: true };
    } catch (error) {
        console.warn("Could not measure the offline downloads.", error);
        return { count: 0, bytes: 0, supported: false };
    }
}

// Mede o localStorage somando chaves e valores em UTF-16, como o navegador faz.
// Measure localStorage by summing keys and values in UTF-16, as the browser accounts for it.
function measureLocalStorageBytes() {
    let bytes = 0;
    try {
        for (let index = 0; index < localStorage.length; index += 1) {
            const key = localStorage.key(index) || "";
            const value = localStorage.getItem(key) || "";
            bytes += (key.length + value.length) * 2;
        }
    } catch (error) {
        console.warn("Could not measure localStorage.", error);
    }
    return bytes;
}

// Usa a Storage API quando disponível e cai para o localStorage quando não.
// Use the Storage API when available and fall back to localStorage when it is not.
async function measureBrowserCacheBytes() {
    let bytes = measureLocalStorageBytes();
    try {
        if (navigator.storage && typeof navigator.storage.estimate === "function") {
            const estimate = await navigator.storage.estimate();
            if (Number.isFinite(estimate.usage)) {
                bytes = Math.max(bytes, estimate.usage);
            }
        }
    } catch (error) {
        console.warn("Could not read the storage estimate.", error);
    }
    return bytes;
}

async function refreshStorageSummary() {
    if (!settingsDialog) {
        return;
    }
    const downloadsLabel = settingsDialog.querySelector('[data-storage="downloads"]');
    const browserLabel = settingsDialog.querySelector('[data-storage="browser"]');
    if (downloadsLabel) {
        downloadsLabel.textContent = "Calculando…";
    }
    if (browserLabel) {
        browserLabel.textContent = "Calculando…";
    }
    const [downloads, browserBytes] = await Promise.all([
        measureOfflineDownloads(),
        measureBrowserCacheBytes()
    ]);
    if (downloadsLabel) {
        downloadsLabel.textContent = downloads.supported
            ? `${downloads.count} ${downloads.count === 1 ? "música" : "músicas"} • ${formatStorageSize(downloads.bytes)}`
            : "Cache API indisponível neste navegador";
    }
    if (browserLabel) {
        browserLabel.textContent = `Aproximadamente ${formatStorageSize(browserBytes)} neste navegador`;
    }
}

// Remove apenas os áudios baixados, preservando biblioteca, perfil e preferências.
// Remove only downloaded audio, preserving library, profile, and preferences.
async function removeDownloadedAudio() {
    if (typeof caches === "undefined") {
        setSettingsStatus("Este navegador não oferece a Cache API.");
        return;
    }
    try {
        const offline = await import("./offline.mjs");
        const cache = await caches.open(offline.CACHE_NAME);
        const removedCount = (await cache.keys()).length;
        await caches.delete(offline.CACHE_NAME);
        await updateDownloadIndicators();
        const message = removedCount
            ? `${removedCount} ${removedCount === 1 ? "música baixada removida" : "músicas baixadas removidas"} do cache offline.`
            : "Não havia músicas baixadas neste navegador.";
        setSettingsStatus(message);
        showToast(message);
        void refreshStorageSummary();
    } catch (error) {
        console.error("Could not remove the downloaded audio.", error);
        setSettingsStatus("Não foi possível remover as músicas baixadas.");
    }
}

// Limpa contagens e dados temporários mantendo favoritos fixados e o perfil local.
// Clear counters and temporary data while keeping pinned favorites and the local profile.
function clearHistoryKeepingFavorites() {
    try {
        const stats = readLocalStats();
        // Só entram no novo objeto os favoritos, com as contagens zeradas.
        // Only favorites survive the reset, with their counters back to zero.
        const kept = Object.fromEntries(
            Object.entries(stats)
                .filter(([, value]) => value && value.saved)
                .map(([key, value]) => [key, { ...value, plays: 0, saves: 0, saved: true }])
        );
        localStorage.setItem(storageKeys.stats, JSON.stringify(kept));
        localStorage.removeItem(storageKeys.legacyStats);
        sessionStorage.clear();
        // Chaves de versões antigas que guardavam credenciais; não são mais usadas.
        // Legacy keys that stored credentials; no longer used.
        localStorage.removeItem("open-music-hub:client-id");
        localStorage.removeItem("clone-spotify:client-id");
    } catch (error) {
        console.error("Could not clear the local history.", error);
        showToast("Não foi possível limpar o cache e o histórico.");
        return;
    }
    renderLibrary();
    if (currentDetail) {
        detailMeta.querySelectorAll(".detail-meta__local-stat").forEach((stat) => stat.remove());
        renderDetailStats(currentDetail);
        syncCurrentDetailSaveState();
    }
    const message = "Cache e histórico limpos. Favoritos fixados e perfil preservados.";
    setSettingsStatus(message);
    showToast(message);
    void refreshStorageSummary();
}

// Sincroniza o diálogo com as preferências carregadas do navegador.
// Synchronize the dialog with the preferences loaded from the browser.
function renderSettingsControls() {
    if (!settingsDialog) {
        return;
    }
    settingsDialog.querySelectorAll(".settings-switch[data-setting]").forEach((button) => {
        button.setAttribute("aria-checked", String(Boolean(preferences[button.dataset.setting])));
    });
    settingsDialog.querySelectorAll("select[data-setting]").forEach((select) => {
        select.value = preferences[select.dataset.setting];
    });
    settingsDialog.querySelectorAll("[data-density-option]").forEach((button) => {
        button.setAttribute("aria-pressed", String(button.dataset.densityOption === preferences.density));
    });
    const profileInput = settingsDialog.querySelector('[data-setting="profileName"]');
    if (profileInput && document.activeElement !== profileInput) {
        profileInput.value = preferences.profileName;
    }
    if (settingsLocalFileActions) {
        settingsLocalFileActions.hidden = !preferences.showLocalFiles;
    }
}

// Mostra ou oculta as entradas de arquivos locais conforme a preferência.
// Show or hide the local file entry points according to the preference.
function applyLocalFileVisibility() {
    const importCard = document.querySelector(".import-card");
    if (importCard) {
        importCard.hidden = !preferences.showLocalFiles || importCardDismissed;
    }
    const coverButton = document.querySelector(".Pplay-music__cover");
    if (coverButton) {
        coverButton.disabled = !preferences.showLocalFiles;
        coverButton.title = preferences.showLocalFiles
            ? "Carregar músicas completas do dispositivo"
            : "Ative “Mostrar arquivos locais” nas configurações";
    }
    fileInput.disabled = !preferences.showLocalFiles;
}

// Usa a inicial do nome local como avatar do botão do perfil.
// Use the local name's initial as the profile button avatar.
function applyProfileIdentity() {
    if (!profileButton || !profileButtonContent) {
        return;
    }
    const name = preferences.profileName.trim() || "Ouvinte";
    const initial = (name.match(/[\p{L}\p{N}]/u) || ["O"])[0].toLocaleUpperCase("pt-BR");
    profileButtonContent.textContent = initial;
    profileButton.setAttribute("aria-label", `Perfil local: ${name}`);
    profileButton.title = `Perfil local • ${name}`;
}

// Aplica densidade, arquivos locais e identidade do perfil em tempo real.
// Apply density, local files, and profile identity in real time.
function applyPreferences() {
    document.documentElement.dataset.density = preferences.density;
    document.documentElement.dataset.libraryDensity = preferences.compactLibrary ? "compact" : "comfortable";
    applyLocalFileVisibility();
    applyProfileIdentity();
    renderSettingsControls();
}

function openSettings(sectionId = "") {
    if (!settingsDialog) {
        return;
    }
    if (!settingsDialog.open) {
        settingsDialog.showModal();
    }
    renderSettingsControls();
    void refreshStorageSummary();
    if (sectionId) {
        const section = settingsDialog.querySelector(`#${sectionId}`);
        if (section) {
            section.scrollIntoView({ block: "start" });
        }
        if (sectionId === "settings-profile") {
            settingsDialog.querySelector('[data-setting="profileName"]')?.focus({ preventScroll: true });
        }
    }
}

function closeSettings() {
    if (settingsDialog?.open) {
        settingsDialog.close();
    }
}

if (settingsDialog) {
    settingsDialog.querySelectorAll(".settings-switch[data-setting]").forEach((button) => {
        button.addEventListener("click", () => {
            const key = button.dataset.setting;
            const next = !preferences[key];
            setPreference(key, next);
            if (key === "showLocalFiles") {
                setSettingsStatus(next
                    ? "Arquivos locais liberados: use “Escolher arquivos do dispositivo” ou o botão da capa."
                    : "Arquivos locais ocultados.");
            }
        });
    });

    settingsDialog.querySelectorAll("select[data-setting]").forEach((select) => {
        select.addEventListener("change", () => {
            setPreference(select.dataset.setting, select.value);
            setSettingsStatus(`Qualidade de áudio: ${select.selectedOptions[0]?.textContent || select.value}.`);
        });
    });

    settingsDialog.querySelectorAll("[data-density-option]").forEach((button) => {
        button.addEventListener("click", () => {
            setPreference("density", button.dataset.densityOption);
            setSettingsStatus(`Densidade do layout: ${button.textContent.trim()}.`);
        });
    });

    // O nome é salvo a cada tecla, direto no navegador.
    // The name is saved on every keystroke, right into the browser.
    settingsDialog.querySelector('[data-setting="profileName"]')?.addEventListener("input", (event) => {
        preferences = { ...preferences, profileName: event.currentTarget.value.slice(0, 40) };
        savePreferences();
        applyProfileIdentity();
    });

    settingsDialog.querySelectorAll("[data-settings-action]").forEach((button) => {
        button.addEventListener("click", async () => {
            switch (button.dataset.settingsAction) {
                case "remove-downloads":
                    await removeDownloadedAudio();
                    break;
                case "clear-history":
                    clearHistoryKeepingFavorites();
                    break;
                case "pick-files":
                    if (preferences.showLocalFiles) {
                        fileInput.click();
                    }
                    break;
            }
        });
    });

    settingsDialog.querySelector("[data-settings-close]")?.addEventListener("click", closeSettings);
    // Clique no fundo (backdrop) fecha o diálogo sem salvar nada além do que já foi aplicado.
    // Clicking the backdrop closes the dialog; every change is already applied.
    settingsDialog.addEventListener("click", (event) => {
        if (event.target === settingsDialog) {
            closeSettings();
        }
    });
    settingsDialog.addEventListener("close", () => setSettingsStatus(""));
}

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

// Oculta/mostra o painel "tocando agora" com uma classe, mantendo o layout responsivo válido.
// Hide/show the now-playing panel with a class so the responsive layout stays valid.
function hideNowPlayingPanel() {
    nowPlayingPanel.hidden = true;
    document.querySelector(".restore-now-playing").hidden = false;
    workspace.classList.add("is-now-playing-hidden");
    workspace.style.gridTemplateColumns = "";
}

function showNowPlayingPanel() {
    nowPlayingPanel.hidden = false;
    document.querySelector(".restore-now-playing").hidden = true;
    workspace.classList.remove("is-now-playing-hidden");
    workspace.style.gridTemplateColumns = "";
}

document.querySelector(".close-now-playing").addEventListener("click", hideNowPlayingPanel);
document.querySelector(".restore-now-playing").addEventListener("click", showNowPlayingPanel);

// ===== Vista "Em exibição" expandida e letras sincronizadas =====
// Expanded "Now Playing" view and synced lyrics =====

const expandedView = document.querySelector(".expanded-view");
const expandedViewArt = document.querySelector(".expanded-view__art");
const expandedViewTitle = document.querySelector(".expanded-view__title");
const expandedViewArtist = document.querySelector(".expanded-view__artist");
const expandedViewClock = document.querySelector(".expanded-view__clock");
const expandNowPlayingButton = document.querySelector(".now-playing-panel__expand");
const minimizeExpandedButton = document.querySelector(".expanded-view__minimize");
const lyricsStatus = document.querySelector(".lyrics-synced__status");
const lyricsLines = document.querySelector(".lyrics-synced__lines");

const lyricsCache = new Map();
let lyricsHelpers = null;
let lyricsHelpersPromise = null;
let lyricsRequestSerial = 0;
let lyricsRenderedKey = "";
let renderedLyricLines = [];
let activeLyricIndex = -1;
let expandedRenderedTrackKey = "";
let savedMainViewScroll = 0;

// O app.js é um script clássico, então o módulo de letras entra por import dinâmico.
// app.js is a classic script, so the lyrics module is loaded with a dynamic import.
function loadLyricsHelpers() {
    if (!lyricsHelpersPromise) {
        lyricsHelpersPromise = import("./lyrics.mjs").then((module) => {
            lyricsHelpers = module;
            syncLyricsHighlight({ force: true });
            return module;
        });
    }
    return lyricsHelpersPromise;
}

// Chave da faixa atual para casar cache de letra e vista expandida.
// Current track key used to match the lyrics cache and the expanded view.
function currentTrackLyricsKey() {
    return `${currentTrack.provider || "local"}:${currentTrack.id || ""}:${currentTrack.title || ""}`;
}

// Gradiente de reserva quando a capa não pode ser lida (sem imagem ou sem CORS).
// Fallback gradient when the cover cannot be read (no image or no CORS).
function fallbackCoverGradient(seedText = "") {
    let hash = 0;
    for (const character of seedText) {
        hash = (hash * 31 + character.charCodeAt(0)) % 360;
    }
    return `linear-gradient(160deg, hsl(${hash}, 42%, 27%) 0%, hsl(${(hash + 40) % 360}, 38%, 15%) 60%, #0c0c10 100%)`;
}

// Carrega a capa com CORS liberado, resolvendo por eventos e com limite de tempo.
// decode() pode ficar pendente numa janela em segundo plano e deixaria o fundo sem cor.
// Load the cover with CORS enabled, resolving through events with a time limit.
// decode() can stay pending in a background window, leaving the background uncolored.
function loadCoverImage(imageUrl) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.decoding = "async";
        let settled = false;
        const finish = (error) => {
            if (settled) {
                return;
            }
            settled = true;
            window.clearTimeout(timeoutId);
            if (error || image.naturalWidth === 0) {
                reject(error || new Error("Cover image failed to load."));
                return;
            }
            resolve(image);
        };
        const timeoutId = window.setTimeout(() => finish(new Error("Cover image timed out.")), 8000);
        image.addEventListener("load", () => finish(null));
        image.addEventListener("error", () => finish(new Error("Cover image failed to load.")));
        image.src = imageUrl;
        if (image.complete) {
            finish(null);
        }
    });
}

// Lê os pixels da capa e monta um gradiente dinâmico para o fundo expandido.
// Read the cover pixels and build a dynamic gradient for the expanded background.
async function buildCoverGradient(imageUrl, seedText = "") {
    if (!imageUrl) {
        return fallbackCoverGradient(seedText);
    }
    try {
        const image = await loadCoverImage(imageUrl);
        const canvas = document.createElement("canvas");
        canvas.width = 8;
        canvas.height = 8;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        context.drawImage(image, 0, 0, 8, 8);
        const pixels = context.getImageData(0, 0, 8, 8).data;
        const halves = [
            { r: 0, g: 0, b: 0, count: 0 },
            { r: 0, g: 0, b: 0, count: 0 }
        ];
        for (let index = 0; index < pixels.length; index += 4) {
            const y = Math.floor(index / 4 / 8);
            const half = halves[y < 4 ? 0 : 1];
            half.r += pixels[index];
            half.g += pixels[index + 1];
            half.b += pixels[index + 2];
            half.count += 1;
        }
        // Converte a cor média em HSL e escurece a luminosidade: capas claras continuam
        // legíveis com texto branco por cima.
        // Convert the average color to HSL and force a dark lightness: light covers stay
        // readable under white text.
        const toColor = (half, lightness) => {
            const red = half.r / half.count / 255;
            const green = half.g / half.count / 255;
            const blue = half.b / half.count / 255;
            const max = Math.max(red, green, blue);
            const min = Math.min(red, green, blue);
            const delta = max - min;
            const level = (max + min) / 2;
            let hue = 0;
            let saturation = 0;
            if (delta > 0) {
                saturation = delta / (1 - Math.abs(2 * level - 1));
                if (max === red) {
                    hue = ((green - blue) / delta) % 6;
                } else if (max === green) {
                    hue = (blue - red) / delta + 2;
                } else {
                    hue = (red - green) / delta + 4;
                }
                hue *= 60;
                if (hue < 0) {
                    hue += 360;
                }
            }
            // Saturação mínima evita um fundo cinza morto; a luminosidade fica sempre baixa.
            // A minimum saturation avoids a lifeless gray background; lightness always stays low.
            const safeSaturation = Math.round(Math.min(72, Math.max(24, saturation * 100)));
            return `hsl(${Math.round(hue)}, ${safeSaturation}%, ${lightness}%)`;
        };
        return `linear-gradient(160deg, ${toColor(halves[0], 22)} 0%, ${toColor(halves[1], 14)} 62%, #0c0c10 100%)`;
    } catch (error) {
        console.error("Could not read cover colors for the gradient.", error);
        return fallbackCoverGradient(seedText);
    }
}

function updateExpandedClock() {
    if (!lyricsHelpers) {
        return;
    }
    const elapsed = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    expandedViewClock.textContent = lyricsHelpers.formatarTempo(elapsed);
}

// Atualiza capa, título e gradiente dinâmico da vista expandida.
// Update the expanded view cover, title, and dynamic gradient.
async function refreshExpandedView() {
    const trackKey = currentTrackLyricsKey();
    expandedRenderedTrackKey = trackKey;
    expandedViewTitle.textContent = currentTrack.title || title.textContent;
    expandedViewArtist.textContent = currentTrack.artistName || artist.textContent;
    const imageUrl = safeCoverUrl(currentTrack.image || currentTrack.artistImage);
    expandedViewArt.classList.toggle("has-cover", Boolean(imageUrl));
    expandedViewArt.style.backgroundImage = imageUrl ? `url("${imageUrl}")` : "";
    const gradient = await buildCoverGradient(
        imageUrl,
        `${currentTrack.title || ""} ${currentTrack.artistName || ""}`
    );
    if (expandedRenderedTrackKey !== trackKey || expandedView.hidden) {
        // A faixa mudou ou a vista fechou durante a leitura / Track changed or view closed while reading.
        return;
    }
    expandedView.style.setProperty("--expanded-gradient", gradient);
    updateExpandedClock();
}

// Abre a vista expandida na área central preservando o scroll anterior.
// Open the expanded view in the center area, preserving the previous scroll position.
function openExpandedView() {
    if (!expandedView.hidden) {
        return;
    }
    savedMainViewScroll = mainView.scrollTop;
    expandedView.hidden = false;
    document.body.classList.add("player-focus-mode");
    expandNowPlayingButton.setAttribute("aria-expanded", "true");
    expandNowPlayingButton.setAttribute("aria-label", "Minimizar em exibição");
    expandNowPlayingButton.querySelector(".mdi").className = "mdi mdi-arrow-collapse";
    mainView.scrollTo({ top: 0 });
    void loadLyricsHelpers();
    void refreshExpandedView();
    void loadSyncedLyrics();
}

// Minimiza e restaura imediatamente o layout anterior de três colunas.
// Minimize and immediately restore the previous three-column layout.
function closeExpandedView() {
    if (expandedView.hidden) {
        return;
    }
    expandedView.hidden = true;
    document.body.classList.remove("player-focus-mode");
    expandNowPlayingButton.setAttribute("aria-expanded", "false");
    expandNowPlayingButton.setAttribute("aria-label", "Expandir em exibição");
    expandNowPlayingButton.querySelector(".mdi").className = "mdi mdi-arrow-expand";
    mainView.scrollTo({ top: savedMainViewScroll });
}

function toggleExpandedView() {
    if (expandedView.hidden) {
        openExpandedView();
    } else {
        closeExpandedView();
    }
}

expandNowPlayingButton.addEventListener("click", toggleExpandedView);
minimizeExpandedButton.addEventListener("click", closeExpandedView);

// Esc fecha a caixa de sugestões antes do modo expandido; diálogos fecham sozinhos.
// Esc closes the suggestions box before the expanded mode; native dialogs close themselves.
document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
        return;
    }
    if (dialog.open || settingsDialog?.open) {
        return;
    }
    if (!searchSuggestions.hidden) {
        closeSearchSuggestions();
        return;
    }
    closeExpandedView();
});

// Carrega a letra da faixa: LRC sincronizado pelo LrcLib, com fallback para letra simples.
// Load the track's lyrics: synced LRC through LrcLib, falling back to plain lyrics.
async function loadSyncedLyrics({ force = false } = {}) {
    const helpers = await loadLyricsHelpers();
    const trackKey = currentTrackLyricsKey();
    if (lyricsRenderedKey !== trackKey) {
        // Troca de faixa limpa as linhas e o destaque antigos / Changing tracks clears old lines and highlight.
        lyricsRenderedKey = "";
        renderedLyricLines = [];
        activeLyricIndex = -1;
        lyricsLines.replaceChildren();
    }
    if (!force && lyricsRenderedKey === trackKey && renderedLyricLines.length > 0) {
        return;
    }
    if (lyricsCache.has(trackKey)) {
        renderLyrics(trackKey, lyricsCache.get(trackKey));
        return;
    }
    const trackArtist = currentTrack.artistName;
    const trackTitle = currentTrack.title;
    if (!trackArtist || !trackTitle) {
        lyricsStatus.textContent = "A letra precisa do nome do artista e da faixa.";
        return;
    }
    const serial = ++lyricsRequestSerial;
    lyricsStatus.textContent = "Buscando letras sincronizadas…";
    try {
        const payload = await fetchJson(API_CONFIG.providers.lyrics.syncedPath(trackArtist, trackTitle));
        if (serial !== lyricsRequestSerial || trackKey !== currentTrackLyricsKey()) {
            return;
        }
        const entry = payload.synced && payload.syncedLyrics
            ? { synced: true, lines: helpers.parseLrc(payload.syncedLyrics) }
            : { synced: false, lines: helpers.linhasDeTexto(payload.lyrics || "") };
        if (entry.synced && entry.lines.length === 0) {
            entry.synced = false;
            entry.lines = helpers.linhasDeTexto(payload.lyrics || "");
        }
        lyricsCache.set(trackKey, entry);
        renderLyrics(trackKey, entry);
    } catch (error) {
        if (serial !== lyricsRequestSerial) {
            return;
        }
        console.error("Could not load lyrics.", error);
        if (error.message === "Lyrics were not found for this track.") {
            const miss = { synced: false, lines: [] };
            lyricsCache.set(trackKey, miss);
            renderLyrics(trackKey, miss);
            return;
        }
        lyricsStatus.textContent = `Não foi possível carregar a letra: ${error.message}`;
        lyricsLines.replaceChildren();
        lyricsRenderedKey = "";
        renderedLyricLines = [];
        activeLyricIndex = -1;
    }
}

// Renderiza as linhas; cada linha sincronizada mostra mm:ss e busca esse trecho ao clicar.
// Render the lines; every synced line shows mm:ss and seeks to that timestamp on click.
function renderLyrics(trackKey, entry) {
    if (!lyricsHelpers) {
        return;
    }
    lyricsRenderedKey = trackKey;
    activeLyricIndex = -1;
    const fragment = document.createDocumentFragment();
    entry.lines.forEach((line, index) => {
        const row = document.createElement(entry.synced ? "button" : "div");
        row.className = "lyrics-synced__line";
        if (entry.synced) {
            row.type = "button";
            const stamp = document.createElement("span");
            stamp.className = "lyrics-synced__stamp";
            stamp.textContent = lyricsHelpers.formatarTempo(line.time);
            row.append(stamp);
            row.addEventListener("click", () => {
                audio.currentTime = line.time;
            });
        }
        const text = document.createElement("span");
        text.className = "lyrics-synced__text";
        // textContent impede que a letra seja interpretada como HTML / textContent keeps lyrics out of HTML parsing.
        text.textContent = line.text || " ";
        row.append(text);
        row.dataset.index = String(index);
        fragment.append(row);
    });
    lyricsLines.replaceChildren(fragment);
    renderedLyricLines = entry.lines;
    lyricsStatus.textContent = entry.synced
        ? "Letra sincronizada — toque em uma linha para pular para esse trecho."
        : entry.lines.length > 0
            ? "Esta letra não tem marcação de tempo; nenhuma linha é destacada."
            : "Letra não encontrada para esta faixa.";
    syncLyricsHighlight({ force: true });
}

// Centraliza a linha ativa na área de letras com scroll suave.
// Center the active lyric line inside the lyrics area with smooth scrolling.
function centerActiveLyricLine() {
    const activeRow = lyricsLines.children[activeLyricIndex];
    if (!activeRow || expandedView.hidden) {
        return;
    }
    const target = Math.max(0, activeRow.offsetTop - lyricsLines.clientHeight / 2 + activeRow.offsetHeight / 2);
    const startScroll = lyricsLines.scrollTop;
    if (Math.abs(startScroll - target) < 4) {
        return;
    }
    lyricsLines.scrollTo({ top: target, behavior: "smooth" });
    // Se a rolagem suave for suprimida (aba oculta, movimento reduzido), salta direto.
    // If smooth scrolling is suppressed (hidden tab, reduced motion), jump straight there.
    window.setTimeout(() => {
        if (Math.abs(lyricsLines.scrollTop - startScroll) < 4 && Math.abs(lyricsLines.scrollTop - target) > 4) {
            lyricsLines.scrollTop = target;
        }
    }, 400);
}

// Destaque em tempo real: acompanha o currentTime, mostra o mm:ss e rola suavemente.
// Real-time highlight: follows currentTime, shows mm:ss, and scrolls smoothly.
function syncLyricsHighlight({ force = false } = {}) {
    if (!lyricsHelpers) {
        return;
    }
    const elapsed = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    updateExpandedClock();

    const trackKey = currentTrackLyricsKey();
    if (lyricsRenderedKey !== trackKey) {
        // Nova faixa: recarrega letra e capa enquanto a vista estiver aberta.
        // New track: reload lyrics and cover while the view stays open.
        activeLyricIndex = -1;
        if (!expandedView.hidden) {
            if (expandedRenderedTrackKey !== trackKey && (currentTrack.title || currentTrack.artistName)) {
                void refreshExpandedView();
            }
            if (currentTrack.title || currentTrack.artistName) {
                void loadSyncedLyrics();
            }
        }
        return;
    }
    if (renderedLyricLines.length === 0) {
        return;
    }

    const rows = [...lyricsLines.children];
    const index = lyricsHelpers.linhaAtiva(renderedLyricLines, elapsed);
    if (force || index !== activeLyricIndex) {
        const previousRow = rows[activeLyricIndex];
        if (previousRow?.classList.contains("is-active")) {
            previousRow.classList.remove("is-active");
            const previousStamp = previousRow.querySelector(".lyrics-synced__stamp");
            if (previousStamp) {
                previousStamp.textContent = lyricsHelpers.formatarTempo(renderedLyricLines[activeLyricIndex]?.time ?? 0);
            }
        }
        activeLyricIndex = index;
        const activeRow = rows[index];
        if (activeRow) {
            activeRow.classList.add("is-active");
            const stamp = activeRow.querySelector(".lyrics-synced__stamp");
            if (stamp) {
                // Segundos decorridos na própria linha de destaque / Elapsed seconds on the highlighted line.
                stamp.textContent = lyricsHelpers.formatarTempo(elapsed);
            }
            // Scroll suave automático para a linha ativa / Smooth auto-scroll to the active line.
            centerActiveLyricLine();
        }
        return;
    }

    // Mesma linha ativa: só os segundos decorridos mudam no destaque.
    // Same active line: only the elapsed seconds change on the highlight.
    const activeRow = rows[index];
    if (activeRow?.classList.contains("is-active")) {
        const stamp = activeRow.querySelector(".lyrics-synced__stamp");
        if (stamp) {
            stamp.textContent = lyricsHelpers.formatarTempo(elapsed);
        }
    }
}

audio.addEventListener("timeupdate", syncLyricsHighlight);
audio.addEventListener("seeked", syncLyricsHighlight);

// Redimensionar a janela muda a altura das linhas: recentraliza a linha ativa.
// Resizing the window changes line heights: re-center the active line.
let lyricsRecenterTimeout;
window.addEventListener("resize", () => {
    window.clearTimeout(lyricsRecenterTimeout);
    lyricsRecenterTimeout = window.setTimeout(centerActiveLyricLine, 220);
});

// O botão Letra do player abre a vista expandida com a letra sincronizada.
// The player's Letra button opens the expanded view with synced lyrics.
document.querySelector(".music-player__extras [aria-label='Letra']").addEventListener("click", () => {
    // No celular o player em tela cheia cobre o centro: recolhe antes de abrir a letra.
    // On phones the full-screen player covers the center: collapse it before opening the lyrics.
    const musicPlayer = document.querySelector(".music-player");
    if (musicPlayer.classList.contains("is-expanded")) {
        musicPlayer.classList.remove("is-expanded");
        document.body.classList.remove("player-expanded");
        const button = document.querySelector(".music-player__expand");
        button.setAttribute("aria-expanded", "false");
        button.setAttribute("aria-label", "Expandir player");
        button.querySelector(".mdi").className = "mdi mdi-chevron-up";
    }
    openExpandedView();
});

document.querySelector(".music-player__extras [aria-label='Fila']").addEventListener("click", () => {
    showDialog("Fila", `Tocando agora: ${title.textContent}. Carregue outra faixa pelo botão de música para adicioná-la à fila.`);
});

document.querySelector(".music-player__extras [aria-label='Conectar a um dispositivo']").addEventListener("click", () => {            showDialog("Conectar a um dispositivo", "A reprodução acontece neste navegador; não há envio de áudio para alto-falantes externos nem necessidade de login.");
});

// Download e escuta offline da faixa atual (player inferior e página de detalhes).
// Download and offline playback for the current track (bottom player and detail page).
document.querySelector(".music-player__extras [data-download-current]").addEventListener("click", () => {
    void downloadTrackAudio(currentTrack);
});

document.querySelector(".detail-download").addEventListener("click", () => {
    void downloadTrackAudio(currentDetail || currentTrack);
});

// Player em tela cheia no celular: mostra capa grande, letras e o botão de download.
// Full-screen player on phones: shows large artwork, lyrics, and the download button.
const expandPlayerButton = document.querySelector(".music-player__expand");
expandPlayerButton.addEventListener("click", () => {
    const musicPlayer = document.querySelector(".music-player");
    const isExpanded = musicPlayer.classList.toggle("is-expanded");
    document.body.classList.toggle("player-expanded", isExpanded);
    expandPlayerButton.setAttribute("aria-expanded", String(isExpanded));
    expandPlayerButton.setAttribute("aria-label", isExpanded ? "Recolher player" : "Expandir player");
    expandPlayerButton.querySelector(".mdi").className = isExpanded ? "mdi mdi-chevron-down" : "mdi mdi-chevron-up";
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
                // O perfil é local: abre direto a seção editável do diálogo de configurações.
                // The profile is local: open the editable section of the settings dialog.
                openSettings("settings-profile");
                break;
            case "queue":
                showDialog("Tocando agora", `Faixa atual: ${title.textContent}.`);
                break;
            case "track-options":
                showDialog("Opções da faixa", "Use o botão + para salvar a faixa ou os controles do player para reproduzir, repetir e ajustar o volume.");
                break;
            case "settings":
                openSettings();
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
    // Voltar/avançar sempre sai do modo expandido antes de trocar de página.
    // Back/forward always leaves the expanded mode before switching pages.
    closeExpandedView();
    if (event.state?.detail) {
        openDetail(event.state.detail, { history: false });
    } else if (event.state?.news) {
        showNewsView({ history: false });
    } else if (typeof event.state?.search === "string") {
        // Restaura a vista de resultados ao voltar/avançar / Restore the results view on back/forward.
        void openSearchResults(event.state.search, { history: false });
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
renderLibrary();
// Densidade, arquivos locais e nome do perfil são aplicados antes da primeira interação.
// Density, local files, and the profile name are applied before the first interaction.
applyPreferences();
loadApiConfiguration();
// Carrega as "Tendências do Momento" já na abertura inicial da tela.
// Load the "Tendências do Momento" row as soon as the home screen opens.
void loadTrends();

// Offline-first: registra o Service Worker (cache do shell); o áudio já usa a Cache API.
// Offline-first: register the Service Worker (shell cache); audio already uses the Cache API.
if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("./sw.js").catch((error) => {
            console.error("Service Worker registration failed.", error);
        });
    });
}
