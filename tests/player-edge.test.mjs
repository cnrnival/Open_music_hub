import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { initializePlayer, playTrack } from "../src/player.js";

const originalDocument = globalThis.document;
const originalFetch = globalThis.fetch;
const originalCaches = globalThis.caches;
const originalURL = globalThis.URL;

function createAudioElement({ play = async () => {} } = {}) {
    return {
        src: "",
        playCalls: 0,
        async play() {
            this.playCalls += 1;
            return play();
        }
    };
}

function installPlayerDom({ audio = createAudioElement(), playButton = {} } = {}) {
    const status = { textContent: "Erro anterior", style: { display: "block" } };
    const title = { textContent: "" };
    const artist = { textContent: "" };
    const elements = new Map([
        [".music-player__audio", audio],
        [".music-player__play", playButton],
        [".music-player__status", status],
        [".Pplay-music__title", title],
        [".Pplay-music__artist", artist]
    ]);
    globalThis.document = {
        querySelector(selector) {
            return elements.get(selector) || null;
        }
    };
    return { audio, playButton, status, title, artist };
}

function restoreGlobals() {
    globalThis.document = originalDocument;
    globalThis.fetch = originalFetch;
    if (originalCaches === undefined) {
        delete globalThis.caches;
    } else {
        globalThis.caches = originalCaches;
    }
    globalThis.URL = originalURL;
}

afterEach(restoreGlobals);

test("initializePlayer retorna null quando os elementos obrigatórios não existem", () => {
    globalThis.document = { querySelector: () => null };
    assert.equal(initializePlayer(), null);
});

test("initializePlayer limpa o status visual e retorna os controles encontrados", () => {
    const dom = installPlayerDom();
    const result = initializePlayer();

    assert.equal(result.audio, dom.audio);
    assert.equal(result.playButton, dom.playButton);
    assert.equal(dom.status.textContent, "");
    assert.equal(dom.status.style.display, "none");
});

test("playTrack usa preview de provedor quando não há cópia offline", async () => {
    const dom = installPlayerDom();
    await playTrack({ provider: "deezer", title: "Faixa curta", artistName: "Artista", previewUrl: "https://cdn.example/preview.mp3" });

    assert.equal(dom.audio.src, "https://cdn.example/preview.mp3");
    assert.equal(dom.audio.playCalls, 1);
    assert.equal(dom.title.textContent, "Faixa curta");
    assert.equal(dom.artist.textContent, "Artista");
});

test("playTrack não tenta reproduzir uma faixa sem preview ou fonte Invidious", async () => {
    const dom = installPlayerDom();
    await playTrack({ provider: "deezer", title: "Sem fonte", artistName: "Artista" });

    assert.equal(dom.audio.src, "");
    assert.equal(dom.audio.playCalls, 0);
});

test("playTrack prioriza a cópia offline antes do preview", async () => {
    const dom = installPlayerDom();
    globalThis.caches = {
        open: async () => ({
            match: async () => ({
                async blob() {
                    return new Blob(["audio"], { type: "audio/mpeg" });
                }
            })
        })
    };
    globalThis.URL = {
        createObjectURL: () => "blob:offline-track"
    };

    await playTrack({ provider: "deezer", id: "offline-1", title: "Offline", artistName: "Artista", previewUrl: "https://cdn.example/preview.mp3" });

    assert.equal(dom.audio.src, "blob:offline-track");
    assert.equal(dom.audio.playCalls, 1);
});

test("playTrack usa o áudio resolvido para uma faixa Invidious", async () => {
    const dom = installPlayerDom();
    globalThis.fetch = async () => ({
        ok: true,
        async json() {
            return { audioUrl: "https://media.example/full-track.webm" };
        }
    });

    await playTrack({ provider: "invidious", id: "video-123", title: "Faixa completa", artistName: "Artista" });

    assert.equal(dom.audio.src, "https://media.example/full-track.webm");
    assert.equal(dom.audio.playCalls, 1);
});

test("playTrack absorve falha de autoplay sem lançar exceção", async () => {
    const dom = installPlayerDom({
        audio: createAudioElement({
            play: async () => {
                throw new Error("autoplay blocked");
            }
        })
    });

    const originalConsoleError = console.error;
    console.error = () => {};
    try {
        await assert.doesNotReject(() => playTrack({
            provider: "deezer",
            title: "Autoplay bloqueado",
            artistName: "Artista",
            previewUrl: "https://cdn.example/preview.mp3"
        }));
    } finally {
        console.error = originalConsoleError;
    }
    assert.equal(dom.audio.playCalls, 1);
});
