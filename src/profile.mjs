// Perfil local e histórico de escuta do Open Music Hub.
// Local profile and listening history for Open Music Hub.
//
// - Nada aqui fala com servidor: perfil e recentes vivem no localStorage deste navegador.
//   Nothing here talks to a server: profile and recents live in this browser's localStorage.
// - As funções são puras para poderem ser testadas no Node sem DOM.
//   The functions are pure so they can be tested in Node without a DOM.

export const PROFILE_KEY = "open-music-hub:profile";
// Mesmo nome usado pelo app e pelas configurações: os downloads ficam nesta cache.
// Same name used by the app and settings: downloads live in this cache.
export const RECENTS_KEY = "open-music-hub:recents";

export const PROFILE_LIMITS = Object.freeze({
    name: 40,
    bio: 160,
    maxRecent: 24,
    // ~3 MB de data URL por imagem: duas imagens cabem com folga no localStorage.
    // ~3 MB data URL per image: two images fit comfortably in localStorage.
    imageChars: 3_000_000
});

// Limites de tamanho por uso; o app redimensiona antes de salvar.
// Size limits per use case; the app resizes before saving.
export const IMAGE_PRESETS = Object.freeze({
    avatar: { width: 320, height: 320 },
    banner: { width: 1280, height: 400 }
});

const DATA_URL_PATTERN = /^data:image\/(?:png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/;
const SHAREABLE_HOSTS = ["youtube.com", "youtu.be", "deezer.com"];

export function defaultProfile() {
    return { name: "", bio: "", avatar: "", banner: "" };
}

// Só aceita imagens embutidas e com tamanho previsível; qualquer outra origem é descartada.
// Accept only embedded images with a predictable size; any other source is discarded.
export function isProfileImage(value) {
    return typeof value === "string"
        && value.length <= PROFILE_LIMITS.imageChars
        && DATA_URL_PATTERN.test(value);
}

export function sanitizeProfile(raw) {
    const profile = defaultProfile();
    if (!raw || typeof raw !== "object") {
        return profile;
    }
    const name = typeof raw.name === "string" ? raw.name.trim() : "";
    const bio = typeof raw.bio === "string" ? raw.bio.trim() : "";
    profile.name = name.slice(0, PROFILE_LIMITS.name);
    profile.bio = bio.slice(0, PROFILE_LIMITS.bio);
    profile.avatar = isProfileImage(raw.avatar) ? raw.avatar : "";
    profile.banner = isProfileImage(raw.banner) ? raw.banner : "";
    return profile;
}

// Interpreta um JSON salvo sem deixar dados corrompidos quebrarem a página.
// Parse stored JSON without letting corrupted data break the page.
export function parseStoredProfile(value) {
    if (!value) {
        return defaultProfile();
    }
    try {
        return sanitizeProfile(JSON.parse(value));
    } catch (error) {
        return defaultProfile();
    }
}

function parseShareableUrl(value) {
    if (typeof value !== "string" || !value) {
        return null;
    }
    let url;
    try {
        url = new URL(value);
    } catch (error) {
        return null;
    }
    if (url.protocol !== "https:") {
        return null;
    }
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    const allowed = SHAREABLE_HOSTS.some((candidate) => host === candidate || host.endsWith(`.${candidate}`));
    return allowed ? url.href : null;
}

// Link compartilhável é o endereço canônico do provedor, nunca a URL efêmera do stream.
// A shareable link is the provider's canonical page, never the short-lived stream URL.
export function shareLinkFor(track) {
    if (!track) {
        return "";
    }
    return parseShareableUrl(track.externalUrl) || parseShareableUrl(track.url) || "";
}

function trackKey(track) {
    const provider = track.provider || "local";
    const kind = track.kind || "track";
    const id = track.id || track.title || "";
    return `${provider}:${kind}:${id}`;
}

// Fotografia mínima da faixa: o histórico precisa continuar legível depois de recarregar.
// Minimal track snapshot: the history must stay readable after a reload.
export function trackSnapshot(track) {
    if (!track || !track.title) {
        return null;
    }
    return {
        key: trackKey(track),
        provider: track.provider || "local",
        kind: track.kind || "track",
        id: String(track.id || ""),
        title: String(track.title),
        artistName: String(track.artistName || ""),
        image: typeof track.image === "string" ? track.image : "",
        externalUrl: typeof track.externalUrl === "string" ? track.externalUrl : "",
        url: typeof track.url === "string" ? track.url : "",
        durationSeconds: Number(track.durationSeconds) || 0
    };
}

export function normalizeRecents(raw) {
    if (!Array.isArray(raw)) {
        return [];
    }
    return raw
        .filter((entry) => entry && entry.title && entry.key)
        .slice(0, PROFILE_LIMITS.maxRecent)
        .map((entry) => ({
            key: String(entry.key),
            provider: String(entry.provider || "local"),
            kind: String(entry.kind || "track"),
            id: String(entry.id || ""),
            title: String(entry.title),
            artistName: String(entry.artistName || ""),
            image: typeof entry.image === "string" ? entry.image : "",
            externalUrl: typeof entry.externalUrl === "string" ? entry.externalUrl : "",
            url: typeof entry.url === "string" ? entry.url : "",
            durationSeconds: Number(entry.durationSeconds) || 0,
            playedAt: Number(entry.playedAt) || 0
        }));
}

export function parseStoredRecents(value) {
    if (!value) {
        return [];
    }
    try {
        return normalizeRecents(JSON.parse(value));
    } catch (error) {
        return [];
    }
}

// A faixa recém-tocada vai para o topo e não se repete na lista.
// The freshly played track goes to the top and never repeats in the list.
export function pushRecent(list, track, now = Date.now()) {
    const snapshot = trackSnapshot(track);
    if (!snapshot) {
        return normalizeRecents(list);
    }
    const rest = normalizeRecents(list).filter((entry) => entry.key !== snapshot.key);
    return [{ ...snapshot, playedAt: Number(now) || Date.now() }, ...rest]
        .slice(0, PROFILE_LIMITS.maxRecent);
}

// Recria o objeto de faixa aceito pelo player para tocar direto do histórico.
// Rebuild the track object accepted by the player so history entries play directly.
export function trackFromRecent(entry) {
    if (!entry || !entry.title) {
        return null;
    }
    return {
        provider: entry.provider || "local",
        kind: entry.kind || "track",
        id: entry.id || "",
        title: entry.title,
        artistName: entry.artistName || "",
        image: entry.image || "",
        externalUrl: entry.externalUrl || "",
        url: entry.url || "",
        durationSeconds: Number(entry.durationSeconds) || 0
    };
}

// Texto curto em português para o histórico; datas antigas caem no formato dd/mm.
// Short Portuguese label for the history; older dates fall back to dd/mm.
export function relativeTime(timestamp, now = Date.now()) {
    const then = Number(timestamp) || 0;
    if (!then) {
        return "";
    }
    const seconds = Math.max(0, Math.round((Number(now) - then) / 1000));
    if (seconds < 60) {
        return "agora";
    }
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
        return `há ${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
        return `há ${hours} h`;
    }
    const days = Math.floor(hours / 24);
    if (days < 7) {
        return `há ${days} ${days === 1 ? "dia" : "dias"}`;
    }
    try {
        return new Date(then).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    } catch (error) {
        return "";
    }
}

// Lista de favoritos vem da biblioteca salva, sem inventar itens.
// The favorites list comes from the saved library without inventing items.
export function favoritesFromLibrary(entries) {
    if (!Array.isArray(entries)) {
        return [];
    }
    return entries
        .filter((entry) => entry && entry.title && entry.provider)
        .map((entry) => ({
            provider: entry.provider,
            kind: entry.kind || "track",
            id: String(entry.id || ""),
            title: String(entry.title),
            artistName: String(entry.artistName || ""),
            image: typeof entry.image === "string" ? entry.image : "",
            pinned: Boolean(entry.pinned),
            addedAt: Number(entry.addedAt) || 0
        }))
        .sort((left, right) => {
            if (left.pinned !== right.pinned) {
                return Number(right.pinned) - Number(left.pinned);
            }
            return right.addedAt - left.addedAt;
        });
}

// Iniciais exibidas quando não há foto: até duas letras do nome.
// Initials shown when there is no photo: up to two letters of the name.
export function initialsFor(name) {
    const clean = String(name || "").trim();
    if (!clean) {
        return "O";
    }
    const words = clean.split(/\s+/).filter(Boolean);
    const letters = words.slice(0, 2).map((word) => [...word][0] || "");
    return letters.join("").toLocaleUpperCase("pt-BR") || "O";
}
