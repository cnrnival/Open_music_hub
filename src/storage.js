/**
 * [PT] Gerenciamento seguro do localStorage e Cache API.
 * [EN] Secure management of localStorage and Cache API.
 * 
 * [PT] Todas as informações ficam 100% restritas ao navegador do usuário.
 * [EN] All information stays 100% restricted to the user's browser.
 */

import { RECENTS_KEY, PROFILE_KEY } from './profile.mjs';

// [PT] Chaves de armazenamento / [EN] Storage keys
export const STORAGE_KEYS = Object.freeze({
    stats: "open-music-hub:stats",
    legacyStats: "clone-spotify:stats",
    preferences: "open-music-hub:preferences",
    history: RECENTS_KEY || "open-music-hub:recents",
    profile: PROFILE_KEY || "open-music-hub:profile",
    favorites: "open-music-hub:favorites",
    presaved: "presaved_tracks",
    pinned: "pinned_artists"
});

// [PT] Cache para áudios offline / [EN] Cache for offline audio
export const OFFLINE_CACHE_NAME = "open-music-hub-offline-tracks";
export const APP_SHELL_CACHE_NAME = "open-music-hub-shell-v1";

/**
 * [PT] Salva dados no localStorage de forma segura.
 * [EN] Safely saves data to localStorage.
 */
export function saveToStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (error) {
        console.error("[PT] Erro ao salvar no localStorage / [EN] Error saving to localStorage:", error);
        return false;
    }
}

/**
 * [PT] Carrega dados do localStorage de forma segura.
 * [EN] Safely loads data from localStorage.
 */
export function loadFromStorage(key, defaultValue = null) {
    try {
        const item = localStorage.getItem(key);
        if (item === null) return defaultValue;
        return JSON.parse(item);
    } catch (error) {
        console.error("[PT] Erro ao carregar do localStorage / [EN] Error loading from localStorage:", error);
        return defaultValue;
    }
}

/**
 * [PT] Remove item do localStorage.
 * [EN] Removes item from localStorage.
 */
export function removeFromStorage(key) {
    try {
        localStorage.removeItem(key);
        return true;
    } catch (error) {
        console.error("[PT] Erro ao remover do localStorage / [EN] Error removing from localStorage:", error);
        return false;
    }
}

/**
 * [PT] Verifica se o Cache API está disponível.
 * [EN] Checks if Cache API is available.
 */
export function isCacheApiAvailable() {
    return typeof caches !== 'undefined';
}

/**
 * [PT] Salva áudio offline no Cache API.
 * [EN] Saves audio offline to Cache API.
 */
export async function saveAudioOffline(track, audioBlob) {
    if (!isCacheApiAvailable()) {
        throw new Error("[PT] Cache API não disponível / [EN] Cache API not available");
    }
    
    try {
        const cache = await caches.open(OFFLINE_CACHE_NAME);
        const response = new Response(audioBlob, {
            headers: { 'Content-Type': audioBlob.type || 'audio/mp4' }
        });
        const cacheKey = `track:${track.id}:${track.provider}`;
        await cache.put(cacheKey, response);
        
        // [PT] Salva metadados / [EN] Save metadata
        const metadata = loadFromStorage('offline_tracks_metadata', {});
        metadata[cacheKey] = {
            id: track.id,
            provider: track.provider,
            title: track.title,
            artistName: track.artistName,
            image: track.image,
            savedAt: Date.now()
        };
        saveToStorage('offline_tracks_metadata', metadata);
        
        return true;
    } catch (error) {
        console.error("[PT] Erro ao salvar áudio offline / [EN] Error saving audio offline:", error);
        throw error;
    }
}

/**
 * [PT] Obtém áudio offline do Cache API.
 * [EN] Gets audio offline from Cache API.
 */
export async function getAudioOffline(track) {
    if (!isCacheApiAvailable()) return null;
    
    try {
        const cache = await caches.open(OFFLINE_CACHE_NAME);
        const cacheKey = `track:${track.id}:${track.provider}`;
        const response = await cache.match(cacheKey);
        return response || null;
    } catch (error) {
        console.error("[PT] Erro ao obter áudio offline / [EN] Error getting audio offline:", error);
        return null;
    }
}

/**
 * [PT] Remove áudio offline do Cache API.
 * [EN] Removes audio offline from Cache API.
 */
export async function removeAudioOffline(track) {
    if (!isCacheApiAvailable()) return false;
    
    try {
        const cache = await caches.open(OFFLINE_CACHE_NAME);
        const cacheKey = `track:${track.id}:${track.provider}`;
        await cache.delete(cacheKey);
        
        const metadata = loadFromStorage('offline_tracks_metadata', {});
        delete metadata[cacheKey];
        saveToStorage('offline_tracks_metadata', metadata);
        
        return true;
    } catch (error) {
        console.error("[PT] Erro ao remover áudio offline / [EN] Error removing audio offline:", error);
        return false;
    }
}

/**
 * [PT] Lista todas as faixas offline salvas.
 * [EN] Lists all saved offline tracks.
 */
export function getOfflineTracksList() {
    return loadFromStorage('offline_tracks_metadata', {});
}

// [PT] Exportação para uso global / [EN] Global export
if (typeof window !== 'undefined') {
    window.StorageManager = {
        STORAGE_KEYS,
        OFFLINE_CACHE_NAME,
        APP_SHELL_CACHE_NAME,
        saveToStorage,
        loadFromStorage,
        removeFromStorage,
        isCacheApiAvailable,
        saveAudioOffline,
        getAudioOffline,
        removeAudioOffline,
        getOfflineTracksList
    };
}
