/**
 * [PT] Renderização da interface e modais
 * [EN] Interface rendering and modals
 * 
 * [PT] Home reativa, "Pré-salve os lançamentos" e biblioteca vazia
 * [EN] Reactive home, "Pre-save releases" and empty library
 * 
 * [PT] Sistema de atualização em tempo real com eventos globais
 * [EN] Real-time update system with global events
 */

import { loadFromStorage, saveToStorage } from './storage.js';
import { getTrends, fetchJSON } from './api.js';
import API_CONFIG from './config.js';

// [PT] Chave para pré-salvos / [EN] Key for pre-saved tracks
const PRESAVED_KEY = 'presaved_tracks';
const PINNED_KEY = 'pinned_artists';

/**
 * [PT] Dispara evento global de atualização de dados
 * [EN] Dispatches global data update event
 */
export function dispatchDataUpdate(type = 'general') {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('dataUpdated', { 
            detail: { type, timestamp: Date.now() } 
        }));
    }
}

/**
 * [PT] Pré-salva uma música
 * [EN] Pre-saves a track
 */
export function presaveTrack(track) {
    const presaved = loadFromStorage(PRESAVED_KEY, []);
    
    // [PT] Verifica se já está pré-salvo / [EN] Check if already pre-saved
    const exists = presaved.find(item => item.id === track.id && item.provider === track.provider);
    if (exists) {
        // [PT] Remove se já existe (toggle) / [EN] Remove if exists (toggle)
        const filtered = presaved.filter(item => !(item.id === track.id && item.provider === track.provider));
        saveToStorage(PRESAVED_KEY, filtered);
        dispatchDataUpdate('presaved');
        return false;
    }
    
    // [PT] Adiciona aos pré-salvos / [EN] Add to pre-saved
    presaved.unshift({
        id: track.id,
        provider: track.provider,
        title: track.title,
        artistName: track.artistName,
        image: track.image,
        presavedAt: Date.now()
    });
    
    saveToStorage(PRESAVED_KEY, presaved);
    dispatchDataUpdate('presaved');
    return true;
}

/**
 * [PT] Fixa/desfixa artista/álbum na biblioteca
 * [EN] Pin/unpin artist/album in library
 */
export function togglePin(item) {
    const pinned = loadFromStorage(PINNED_KEY, []);
    const exists = pinned.find(p => p.id === item.id && p.provider === item.provider);
    
    if (exists) {
        const filtered = pinned.filter(p => !(p.id === item.id && p.provider === item.provider));
        saveToStorage(PINNED_KEY, filtered);
        dispatchDataUpdate('pinned');
        return false;
    }
    
    pinned.unshift({
        id: item.id,
        provider: item.provider,
        name: item.name || item.title,
        type: item.kind || 'artist',
        image: item.image,
        pinnedAt: Date.now()
    });
    
    saveToStorage(PINNED_KEY, pinned);
    dispatchDataUpdate('pinned');
    return true;
}

/**
 * [PT] Busca lançamentos futuros para pré-salvar
 * [EN] Fetches upcoming releases for pre-save
 */
async function fetchUpcomingReleases() {
    try {
        // [PT] Tenta buscar do Deezer - novos álbuns/populares
        // [EN] Try to fetch from Deezer - new albums/popular
        const chartUrl = '/api/deezer/search?q=release&type=album';
        const response = await fetch(chartUrl);
        if (response.ok) {
            const data = await response.json();
            if (data.results && data.results[0]?.data) {
                return data.results[0].data.slice(0, 8).map(album => ({
                    id: album.id,
                    provider: 'deezer',
                    title: album.title,
                    artistName: album.artist?.name,
                    image: album.cover_medium || album.cover_big,
                    releaseDate: album.release_date,
                    type: 'album'
                }));
            }
        }
    } catch (error) {
        console.error('[PT] Erro ao buscar lançamentos / [EN] Error fetching releases:', error);
    }
    
    // [PT] Fallback com dados estáticos dinâmicos
    // [EN] Fallback with dynamic static data
    return [
        { id: 'up1', provider: 'deezer', title: 'Novo Álbum', artistName: 'Artista Em Destaque', image: '', type: 'album' },
        { id: 'up2', provider: 'deezer', title: 'Single Lançamento', artistName: 'Artista Pop', image: '', type: 'track' },
        { id: 'up3', provider: 'deezer', title: 'EP Recente', artistName: 'Indie Artist', image: '', type: 'album' }
    ];
}

/**
 * [PT] Renderiza tela inicial reativa
 * [EN] Renders reactive home screen
 */
export function renderHomeView(container) {
    container.innerHTML = `
        <section class="home-section">
            <h1 class="home-title">[PT] Início / [EN] Home</h1>
            
            <!-- [PT] Atalhos Fixados no Topo / [EN] Pinned Shortcuts -->
            <div class="pinned-section">
                <h2 class="section-title">[PT] Atalhos do Topo / [EN] Top Shortcuts</h2>
                <div class="pinned-grid" id="pinnedGrid"></div>
            </div>
            
            <!-- [PT] Pré-salve os próximos lançamentos / [EN] Pre-save upcoming releases -->
            <div class="presave-section">
                <h2 class="section-title">[PT] Pré-salve os próximos lançamentos / [EN] Pre-save upcoming releases</h2>
                <div class="presave-grid" id="presaveGrid"></div>
            </div>
            
            <!-- [PT] Tendências do Momento (apenas na Home) / [EN] Trending Now (home only) -->
            <div class="trends-section">
                <h2 class="section-title">[PT] Tendências do Momento / [EN] Trending Now</h2>
                <div class="trends-grid" id="trendsGrid"></div>
            </div>
            
            <!-- [PT] Escutadas Recentemente / [EN] Recently Played -->
            <div class="recents-section">
                <h2 class="section-title">[PT] Escutadas Recentemente / [EN] Recently Played</h2>
                <div class="recents-grid" id="recentsGrid"></div>
            </div>
        </section>
    `;
    
    loadPinnedItems();
    loadPresaveItems();
    loadTrendsHome();
    loadRecentItems();
    
    // [PT] Escuta eventos de atualização em tempo real / [EN] Listen for real-time update events
    if (typeof window !== 'undefined') {
        window.removeEventListener('dataUpdated', window._homeDataUpdateHandler);
        window._homeDataUpdateHandler = () => {
            loadPinnedItems();
            loadPresaveItems();
            loadRecentItems();
        };
        window.addEventListener('dataUpdated', window._homeDataUpdateHandler);
    }
}

/**
 * [PT] Carrega atalhos fixados
 * [EN] Loads pinned shortcuts
 */
function loadPinnedItems() {
    const grid = document.getElementById('pinnedGrid');
    if (!grid) return;
    
    const pinned = loadFromStorage(PINNED_KEY, []);
    grid.innerHTML = '';
    
    if (pinned.length === 0) {
        grid.innerHTML = '<p class="empty-message">[PT] Fixe artistas/álbuns na biblioteca para ver aqui / [EN] Pin artists/albums in library to see here</p>';
        return;
    }
    
    pinned.slice(0, 8).forEach(item => {
        const card = document.createElement('button');
        card.className = 'pinned-card';
        card.type = 'button';
        card.innerHTML = `
            <div class="pinned-card__art">📌</div>
            <span class="pinned-card__name">${item.name || item.title}</span>
        `;
        card.addEventListener('click', () => {
            // [PT] Navega para o item fixado / [EN] Navigate to pinned item
            if (typeof window.openDetail === 'function' && item.id) {
                window.openDetail({ provider: item.provider, kind: item.type || 'artist', id: item.id, title: item.name });
            }
        });
        grid.appendChild(card);
    });
}

/**
 * [PT] Carrega itens pré-salvos
 * [EN] Loads presaved items
 */
async function loadPresaveItems() {
    const grid = document.getElementById('presaveGrid');
    if (!grid) return;
    
    // [PT] Busca lançamentos para pré-salvar / [EN] Fetch releases to pre-save
    const releases = await fetchUpcomingReleases();
    const presaved = loadFromStorage(PRESAVED_KEY, []);
    const presaved
