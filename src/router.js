/**
 * [PT] Roteador e controle de visibilidade das telas
 * [EN] Router and screen visibility control
 * 
 * [PT] Tendências aparecem EXCLUSIVAMENTE na Home
 * [EN] Trends appear EXCLUSIVELY on Home
 */

export let currentRoute = 'home';

/**
 * [PT] Renderiza view com limpeza completa do container
 * [EN] Renders view with complete container cleanup
 */
export function renderView(route, data = {}) {
    const mainContent = document.getElementById('main-content') || document.querySelector('.main-view');
    
    if (!mainContent) {
        console.error('[PT] Container principal não encontrado / [EN] Main container not found');
        return;
    }
    
    // [PT] 1. Limpa completamente o container para remover visualizações anteriores
    // [EN] 1. Completely clears container to remove previous views
    mainContent.innerHTML = '';
    
    currentRoute = route;
    
    // [PT] 2. Renderiza apenas o conteúdo correspondente à rota atual
    // [EN] 2. Renders only content corresponding to current route
    switch (route) {
        case 'home':
            // [PT] Somente na Home exibe as Tendências do Momento
            // [EN] Shows Trending Section ONLY on Home route
            if (typeof window.renderHomeView === 'function') {
                window.renderHomeView(mainContent);
            }
            break;
            
        case 'artist':
            // [PT] Oculta tendências e renderiza apenas o Perfil do Artista
            // [EN] Hides trending and renders only Artist Profile
            if (typeof window.renderArtistProfile === 'function') {
                window.renderArtistProfile(mainContent, data);
            }
            break;
            
        case 'search':
            // [PT] Renderiza apenas os Resultados de Busca
            // [EN] Renders Search Results only
            if (typeof window.renderSearchResults === 'function') {
                window.renderSearchResults(mainContent, data);
            }
            break;
            
        case 'profile':
            // [PT] Renderiza a página do Perfil do Usuário
            // [EN] Renders User Profile page
            if (typeof window.renderUserProfile === 'function') {
                window.renderUserProfile(mainContent);
            }
            break;
            
        default:
            console.warn(`[PT] Rota desconhecida / [EN] Unknown route: ${route}`);
            break;
    }
}

/**
 * [PT] Navega para uma rota
 * [EN] Navigates to a route
 */
export function navigateTo(route, data = {}) {
    renderView(route, data);
    // [PT] Atualiza URL sem recarregar página / [EN] Update URL without reloading
    if (typeof history !== 'undefined') {
        history.pushState({ route, data }, '', `#${route}`);
    }
}

// [PT] Exportação global / [EN] Global export
if (typeof window !== 'undefined') {
    window.AppRouter = {
        renderView,
        navigateTo,
        getCurrentRoute: () => currentRoute
    };
}
