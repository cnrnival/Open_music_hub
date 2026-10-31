/**
 * [PT] Integração com APIs (Deezer, Invidious, TheAudioDB, Lyrics.ovh)
 * [EN] API integrations (Deezer, Invidious, TheAudioDB, Lyrics.ovh)
 * 
 * [PT] Resgate de dados e streaming de áudio completo do Invidious
 * [EN] Data fetching and full audio streaming from Invidious
 */

import API_CONFIG from './config.js';

/**
 * [PT] Função genérica para buscar JSON com tratamento de erros
 * [EN] Generic function to fetch JSON with error handling
 */
export async function fetchJSON(url, options = {}) {
    try {
        const response = await fetch(url, {
            ...options,
            headers: {
                'Accept': 'application/json',
                ...options.headers
            }
        });
        
        if (!response.ok) {
            throw new Error(`[PT] Erro HTTP ${response.status} / [EN] HTTP Error ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('[PT] Erro na requisição / [EN] Request error:', error);
        throw error;
    }
}

/**
 * [PT] Busca músicas no Deezer
 * [EN] Search music on Deezer
 */
export async function searchDeezer(query) {
    const url = API_CONFIG.providers.deezer.searchPath(query);
    return fetchJSON(url);
}

/**
 * [PT] Busca músicas no Invidious com fallback de instâncias
 * [EN] Search music on Invidious with instance fallback
 */
export async function searchInvidious(query) {
    const url = API_CONFIG.providers.invidious.searchPath(query);
    return fetchJSON(url);
}

/**
 * [PT] Obtém áudio completo do Invidious com timeout e fallback
 * [EN] Gets full audio from Invidious with timeout and fallback
 */
export async function getInvidiousAudio(videoId, quality = 'high') {
    try {
        const url = `${API_CONFIG.providers.invidious.audioPath}?id=${encodeURIComponent(videoId)}&quality=${quality}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);
        
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (!response.ok) throw new Error('Failed to get audio');
        return await response.json();
    } catch (error) {
        console.warn('[PT] Falha ao obter áudio, tentando fallback / [EN] Failed to get audio, trying fallback:', error);
        throw error;
    }
}

/**
 * [PT] Busca letras sincronizadas
 * [EN] Search synced lyrics
 */
export async function getLyrics(artist, title, synced = true) {
    const url = synced 
        ? API_CONFIG.providers.lyrics.syncedSearchPath(artist, title)
        : API_CONFIG.providers.lyrics.searchPath(artist, title);
    return fetchJSON(url);
}

/**
 * [PT] Busca tendências no TheAudioDB
 * [EN] Search trends on TheAudioDB
 */
export async function getTrends(country = 'us') {
    const url = `/api/audiodb?action=trending&country=${country}&type=itunes&format=albums`;
    return fetchJSON(url);
}

// [PT] Exportação global / [EN] Global export
if (typeof window !== 'undefined') {
    window.MusicAPI = {
        fetchJSON,
        searchDeezer,
        searchInvidious,
        getInvidiousAudio,
        getLyrics,
        getTrends
    };
}
