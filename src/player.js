/**
 * [PT] Motor de áudio completo e controles do player
 * [EN] Complete audio engine and player controls
 * 
 * [PT] Fallback de instâncias Invidious e limpeza de erros visuais
 * [EN] Invidious instance fallback and visual error cleanup
 */

import { getInvidiousAudio } from './api.js';
import { getAudioOffline, saveAudioOffline } from './storage.js';

// [PT] Instâncias públicas do Invidious para fallback / [EN] Public Invidious instances for fallback
export const INVIDIOUS_INSTANCES = [
    'https://invidious.f5.si',
    'https://inv.us.projectsegfau.lt',
    'https://invidious.nerdvpn.de',
    'https://invidious.drgns.space'
];

/**
 * [PT] Inicializa o player de áudio
 * [EN] Initializes the audio player
 */
export function initializePlayer() {
    const audio = document.querySelector('.music-player__audio');
    const playButton = document.querySelector('.music-player__play');
    
    if (!audio || !playButton) {
        console.warn('[PT] Elementos do player não encontrados / [EN] Player elements not found');
        return null;
    }
    
    // [PT] Limpa mensagens de erro visuais / [EN] Clear visual error messages
    const statusEl = document.querySelector('.music-player__status');
    if (statusEl) {
        statusEl.textContent = '';
        statusEl.style.display = 'none';
    }
    
    return { audio, playButton };
}

/**
 * [PT] Toca música completa com fallback de instâncias Invidious
 * [EN] Plays full music with Invidious instance fallback
 */
export async function playTrack(track) {
    const { audio } = initializePlayer() || {};
    if (!audio) return;
    
    try {
        // [PT] Tenta reproduzir offline primeiro / [EN] Try to play offline first
        const offlineResponse = await getAudioOffline(track);
        if (offlineResponse) {
            const blob = await offlineResponse.blob();
            const objectUrl = URL.createObjectURL(blob);
            audio.src = objectUrl;
            await audio.play();
            updatePlayerUI(track);
            return;
        }
        
        // [PT] Busca áudio online com fallback / [EN] Search online audio with fallback
        if (track.provider === 'invidious' || track.videoId) {
            const videoId = track.videoId || track.id;
            const audioData = await getInvidiousAudio(videoId);
            if (audioData && audioData.audioUrl) {
                audio.src = audioData.audioUrl;
                await audio.play();
                updatePlayerUI(track);
                return;
            }
        }
        
        // [PT] Para outros provedores, usa previewUrl se disponível
        // [EN] For other providers, use previewUrl if available
        if (track.previewUrl) {
            audio.src = track.previewUrl;
            await audio.play();
            updatePlayerUI(track);
            return;
        }
        
    } catch (error) {
        console.error('[PT] Erro ao reproduzir faixa / [EN] Error playing track:', error);
        // [PT] Não exibe erro visual ao usuário / [EN] Don't show visual error to user
    }
}

/**
 * [PT] Atualiza interface do player
 * [EN] Updates player UI
 */
function updatePlayerUI(track) {
    const titleEl = document.querySelector('.Pplay-music__title');
    const artistEl = document.querySelector('.Pplay-music__artist');
    
    if (titleEl) titleEl.textContent = track.title || 'Sem título';
    if (artistEl) artistEl.textContent = track.artistName || '';
}

// [PT] Exportação global / [EN] Global export
if (typeof window !== 'undefined') {
    window.MusicPlayer = {
        INVIDIOUS_INSTANCES,
        initializePlayer,
        playTrack,
        updatePlayerUI
    };
}
