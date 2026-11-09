/**
 * [PT] Temas visuais customizados e gradiente dinâmico
 * [EN] Custom visual themes and dynamic gradient
 * 
 * [PT] Temas estilo Spicetify: Roxo Pink, Roxo
 * [EN] Spicetify-style themes: Roxo Pink, Roxo
 */

export const THEMES = {
    pink: {
        name: 'Roxo Pink',
        nameEn: 'Roxo Pink',
        primary: '#c32974',
        primaryHover: '#d63b87',
        background: '#121212',
        surface: '#181818',
        gradient: 'linear-gradient(135deg, #c32974 0%, #d63b87 100%)'
    },
    purple: {
        name: 'Roxo',
        nameEn: 'Purple',
        primary: '#8b5cf6',
        primaryHover: '#a78bfa',
        background: '#0f0f23',
        surface: '#1a1a2e',
        gradient: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)'
    }
};

let currentTheme = 'pink';

/**
 * [PT] Aplica tema selecionado
 * [EN] Applies selected theme
 */
export function applyTheme(themeName) {
    const theme = THEMES[themeName] || THEMES.pink;
    const root = document.documentElement;
    
    root.style.setProperty('--theme-primary', theme.primary);
    root.style.setProperty('--theme-primary-hover', theme.primaryHover);
    root.style.setProperty('--theme-background', theme.background);
    root.style.setProperty('--theme-surface', theme.surface);
    root.style.setProperty('--theme-gradient', theme.gradient);
    
    currentTheme = themeName;
    localStorage.setItem('open-music-hub-theme', themeName);
    
    console.log(`[PT] Tema aplicado: ${theme.name} / [EN] Theme applied: ${theme.nameEn}`);
}

/**
 * [PT] Carrega tema salvo
 * [EN] Loads saved theme
 */
export function loadTheme() {
    const savedTheme = localStorage.getItem('open-music-hub-theme') || 'pink';
    applyTheme(savedTheme);
    return savedTheme;
}

/**
 * [PT] Gera gradiente dinâmico baseado na cor predominante da capa
 * [EN] Generates dynamic gradient based on dominant color of cover art
 */
export function generateDynamicGradient(imageUrl) {
    // [PT] Implementação simplificada - usa gradiente padrão
    // [EN] Simplified implementation - uses default gradient
    return 'linear-gradient(180deg, rgba(0,0,0,0.4) 0%, rgba(18,18,18,1) 100%)';
}

// [PT] Exportação global / [EN] Global export
if (typeof window !== 'undefined') {
    window.ThemeManager = {
        THEMES,
        applyTheme,
        loadTheme,
        generateDynamicGradient,
        getCurrentTheme: () => currentTheme
    };
}
