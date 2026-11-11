// Testes E2E do Open Music Hub com Playwright
// Valida a aplicação em navegador real nos breakpoints Desktop e Mobile

import { test, expect } from '@playwright/test';

// ===== Testes que funcionam em Desktop e Mobile =====
test.describe('Open Music Hub - Carregamento Inicial', () => {
  test('carrega a home corretamente em desktop', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Open Music Hub/);
    await expect(page.locator('.topbar')).toBeVisible();
    await expect(page.locator('.music-player')).toBeVisible();
  });

  test('carrega a home corretamente em mobile', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.topbar')).toBeVisible();
    await expect(page.locator('.music-player')).toBeVisible();
  });
});

test.describe('Open Music Hub - Busca', () => {
  test('busca Deezer e exibe resultados em desktop', async ({ page }) => {
    await page.goto('/');
    const searchInput = page.locator('#input-search');
    await searchInput.click();
    await searchInput.fill('Daft Punk');
    await page.waitForTimeout(2500);

    const results = page.locator('.api-search-grid .api-result-card');
    await expect(results.first()).toBeVisible({ timeout: 15000 });
  });

  test('mostra estado vazio quando sem resultados em desktop', async ({ page }) => {
    await page.goto('/');
    const searchInput = page.locator('#input-search');
    await searchInput.click();
    await searchInput.fill('xyz123456789nonexistent');
    await page.waitForTimeout(2500);

    const emptyResults = page.locator('.empty-results');
    await expect(emptyResults).toBeVisible({ timeout: 10000 });
  });
});

// ===== Testes apenas Desktop (controles do player visíveis) =====
test.describe('Open Music Hub - Reprodução (Desktop)', () => {
  test('reproduz uma faixa de catálogo', async ({ page }) => {
    await page.goto('/');
    const searchInput = page.locator('#input-search');
    await searchInput.click();
    await searchInput.fill('Daft Punk');
    await page.waitForTimeout(3000);

    const firstResult = page.locator('.api-result-card').first();
    await firstResult.click();
    await page.waitForTimeout(3000);

    // Clicar no resultado abre a página de detalhes
    const detailView = page.locator('.detail-view');
    await expect(detailView).not.toBeHidden({ timeout: 10000 });

    // Clicar no botão de play na página de detalhes
    const detailPlay = page.locator('.detail-play');
    await expect(detailPlay).toBeVisible({ timeout: 5000 });
    await detailPlay.click();
    await page.waitForTimeout(3000);

    // Verificar se o player atualizou com a faixa
    const trackTitle = page.locator('.Pplay-music__title');
    await expect(trackTitle).not.toHaveText('Explore para ouvir', { timeout: 10000 });
  });
});

test.describe('Open Music Hub - Controles do Player (Desktop)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    const searchInput = page.locator('#input-search');
    await searchInput.click();
    await searchInput.fill('Daft Punk');
    await page.waitForTimeout(3000);
    const firstResult = page.locator('.api-result-card').first();
    await firstResult.click();
    await page.waitForTimeout(3000);

    // Iniciar reprodução para os controles estarem ativos
    const detailPlay = page.locator('.detail-play');
    if (await detailPlay.isVisible()) {
      await detailPlay.click();
      await page.waitForTimeout(2000);
    }
  });

  test('botão de mute funciona', async ({ page }) => {
    const muteButton = page.locator('.music-player__mute');
    await expect(muteButton).toBeVisible();

    await muteButton.click();
    await expect(muteButton).toHaveAttribute('aria-pressed', 'true');

    await muteButton.click();
    await expect(muteButton).toHaveAttribute('aria-pressed', 'false');
  });

  test('controle de volume funciona', async ({ page }) => {
    const volumeControl = page.locator('.music-player__volume-control');
    await expect(volumeControl).toBeVisible();

    await volumeControl.evaluate((el) => { el.value = 0; el.dispatchEvent(new Event('input')); });
    await page.waitForTimeout(500);
    await expect(volumeControl).toHaveAttribute('aria-valuetext', '0%');

    await volumeControl.evaluate((el) => { el.value = 0.75; el.dispatchEvent(new Event('input')); });
    await page.waitForTimeout(500);
    await expect(volumeControl).toHaveAttribute('aria-valuetext', '75%');
  });

  test('abre e fecha player expandido', async ({ page }) => {
    // O botão correto para abrir a vista expandida está no painel Now Playing
    const expandButton = page.locator('.now-playing-panel__expand');
    await expect(expandButton).toBeVisible();

    await expandButton.click({ force: true });
    const expandedView = page.locator('.expanded-view');
    await expect(expandedView).not.toBeHidden({ timeout: 5000 });

    const minimizeButton = page.locator('.expanded-view__minimize');
    await minimizeButton.click({ force: true });
    await expect(expandedView).toBeHidden();
  });

  test('abre letras sincronizadas', async ({ page }) => {
    const lyricsButton = page.locator(".music-player__extras [aria-label='Letra']");
    await expect(lyricsButton).toBeVisible();
    await lyricsButton.click();

    const expandedView = page.locator('.expanded-view');
    await expect(expandedView).not.toBeHidden({ timeout: 10000 });
  });

  test('clique na capa do player abre detalhes', async ({ page }) => {
    const cover = page.locator('.Pplay-music__cover');
    await expect(cover).toBeVisible();
    await cover.click();

    const detailView = page.locator('.detail-view');
    await expect(detailView).not.toBeHidden({ timeout: 10000 });
  });
});

// ===== Testes Biblioteca e Layout =====
test.describe('Open Music Hub - Biblioteca e Layout', () => {
  test('mostra estado vazio da biblioteca em desktop', async ({ page }) => {
    await page.goto('/');
    const libraryEmpty = page.locator('.library-empty');
    await expect(libraryEmpty).toBeVisible({ timeout: 5000 });
  });

  test('não há overflow horizontal em desktop', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);

    const mainView = page.locator('.main-view');
    const hasOverflow = await mainView.evaluate((el) => el.scrollWidth > el.clientWidth);
    expect(hasOverflow).toBe(false);
  });

  test('não há overflow horizontal em mobile', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);

    const mainView = page.locator('.main-view');
    const hasOverflow = await mainView.evaluate((el) => el.scrollWidth > el.clientWidth);
    expect(hasOverflow).toBe(false);
  });
});
