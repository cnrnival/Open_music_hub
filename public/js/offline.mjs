// Recurso de download e reprodução offline (100% no cliente, compatível com Vercel).
// Client-side offline download and playback (no server storage, Vercel compatible).
export const CACHE_NAME = "open-music-hub-cache";

// Normaliza um texto para um nome de arquivo seguro, sem acentos nem caracteres especiais.
// Normalize text into a safe filename without accents or special characters.
function slugify(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^A-Za-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
}

// Gera o nome do arquivo baixado, por exemplo "Artista_Faixa.m4a".
// Build the downloaded filename, for example "Artist_Title.m4a".
export function cleanFileName(artist, title, extension = "m4a") {
    const artistPart = slugify(artist) || "Artista";
    const titlePart = slugify(title) || "Faixa";
    const safeExtension = String(extension || "m4a").replace(/^\./, "").toLowerCase() || "m4a";
    return `${artistPart}_${titlePart}.${safeExtension}`;
}

// Descobre a extensão correta a partir do tipo MIME, contêiner ou URL do fluxo.
// Derive the correct extension from the stream MIME type, container, or URL.
export function extensionForMime(mimeType, container, url = "") {
    const mime = String(mimeType || "").toLowerCase();
    const type = String(container || "").toLowerCase();
    const path = String(url || "").toLowerCase().split("?")[0];
    if (mime.includes("mpeg") || path.endsWith(".mp3")) {
        return "mp3";
    }
    if (mime.includes("webm") || mime.includes("opus") || type === "webm" || path.endsWith(".webm")) {
        return "webm";
    }
    if (mime.includes("ogg") || path.endsWith(".ogg") || path.endsWith(".opus")) {
        return "ogg";
    }
    if (mime.includes("wav") || path.endsWith(".wav")) {
        return "wav";
    }
    return "m4a";
}

// Chave estável de cache por provedor, tipo e ID da faixa.
// Stable cache key per provider, kind, and track ID.
export function trackCacheKey(track) {
    if (!track || !track.provider || track.id === undefined || track.id === null || track.id === "") {
        return "";
    }
    const kind = track.kind || "track";
    return `/offline/${encodeURIComponent(track.provider)}/${encodeURIComponent(kind)}/${encodeURIComponent(track.id)}`;
}

export function isOfflineCacheSupported() {
    return typeof caches !== "undefined" && typeof caches.open === "function";
}

// Recupera o Blob salvo, permitindo tocar sem rede quando já baixado.
// Retrieve the stored Blob so the track can play without network once downloaded.
export async function getOfflineBlob(track) {
    if (!isOfflineCacheSupported()) {
        return null;
    }
    const key = trackCacheKey(track);
    if (!key) {
        return null;
    }
    try {
        const cache = await caches.open(CACHE_NAME);
        const response = await cache.match(key);
        return response ? await response.blob() : null;
    } catch (error) {
        console.warn("Could not read the offline cache.", error);
        return null;
    }
}

export async function getOfflineBlobUrl(track) {
    const blob = await getOfflineBlob(track);
    return blob ? URL.createObjectURL(blob) : "";
}

export async function hasOfflineCopy(track) {
    const key = trackCacheKey(track);
    if (!isOfflineCacheSupported() || !key) {
        return false;
    }
    try {
        const cache = await caches.open(CACHE_NAME);
        return Boolean(await cache.match(key));
    } catch (error) {
        console.warn("Could not check the offline cache.", error);
        return false;
    }
}

// Salva o Blob no Cache Storage associado à faixa para escuta offline posterior.
// Store the Blob in the Cache Storage under the track identity for later offline playback.
export async function saveOfflineBlob(track, blob) {
    const key = trackCacheKey(track);
    if (!isOfflineCacheSupported() || !key || !blob) {
        return false;
    }
    try {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(key, new Response(blob, {
            headers: { "Content-Type": blob.type || "audio/mp4" }
        }));
        return true;
    } catch (error) {
        console.warn("Could not store the offline copy.", error);
        return false;
    }
}

export async function removeOfflineCopy(track) {
    const key = trackCacheKey(track);
    if (!isOfflineCacheSupported() || !key) {
        return false;
    }
    try {
        const cache = await caches.open(CACHE_NAME);
        return cache.delete(key);
    } catch (error) {
        console.warn("Could not remove the offline copy.", error);
        return false;
    }
}

// Dispara o download no dispositivo do usuário com um nome de arquivo limpo.
// Trigger the download on the user's device using a clean filename.
export function saveBlobToDevice(track, blob) {
    const extension = extensionForMime(track.audioMimeType, track.audioContainer, track.audioUrl || "");
    const fileName = cleanFileName(track.artistName, track.title, extension);
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = fileName;
    anchor.rel = "noopener";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 4000);
    return fileName;
}
