import assert from "node:assert/strict";
import test from "node:test";
import {
    CACHE_NAME,
    cleanFileName,
    extensionForMime,
    isOfflineCacheSupported,
    trackCacheKey
} from "../public/js/offline.mjs";

test("cleanFileName builds a safe Artist_Title extension name", () => {
    assert.equal(
        cleanFileName("Lil Peep & Friends", "Come Over When You're Sober", "m4a"),
        "Lil_Peep_Friends_Come_Over_When_You_re_Sober.m4a"
    );
});

test("cleanFileName falls back when artist or title is missing", () => {
    assert.equal(cleanFileName("", "", "webm"), "Artista_Faixa.webm");
    assert.equal(cleanFileName("Artista Exemplo", "Música", ".M4A"), "Artista_Exemplo_Musica.m4a");
});

test("extensionForMime maps the audio containers used by the download", () => {
    assert.equal(extensionForMime("audio/mp4; codecs=\"mp4a.40.2\"", "m4a"), "m4a");
    assert.equal(extensionForMime("audio/webm; codecs=\"opus\"", "webm"), "webm");
    assert.equal(extensionForMime("audio/mpeg", "", "https://cdn.example/track.mp3"), "mp3");
    assert.equal(extensionForMime("", "", ""), "m4a");
});

test("trackCacheKey is namespaced per provider, kind, and id", () => {
    assert.equal(trackCacheKey({ provider: "invidious", kind: "track", id: "abc 123" }), "/offline/invidious/track/abc%20123");
    assert.equal(trackCacheKey({ provider: "deezer", id: "42" }), "/offline/deezer/track/42");
    assert.equal(trackCacheKey({}), "");
    assert.equal(CACHE_NAME, "open-music-hub-cache");
});

test("isOfflineCacheSupported reflects the Cache API availability", () => {
    assert.equal(isOfflineCacheSupported(), typeof caches !== "undefined" && typeof caches.open === "function");
});
