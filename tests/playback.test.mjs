import assert from "node:assert/strict";
import test from "node:test";
import { obterStreamAudioCompleto } from "../public/js/playback.mjs";

const licensedTrack = {
    id: "123",
    title: "Música Exemplo",
    artistName: "Artista Exemplo",
    playbackUrl: "https://storage.jamendo.com/track.mp3",
    licenseUrl: "https://creativecommons.org/licenses/by-nc-sa/3.0/"
};

function responseWith(results, ok = true, status = 200) {
    return {
        ok,
        status,
        async json() {
            return { results };
        }
    };
}

test("returns an exact track with a Jamendo HTTPS stream and Creative Commons license", async () => {
    const result = await obterStreamAudioCompleto("Musica Exemplo", "Artista Exemplo", {
        searchUrl: "/api/jamendo/search?q=Musica",
        fetchImpl: async () => responseWith([licensedTrack])
    });
    assert.equal(result.id, licensedTrack.id);
});

test("rejects title or artist mismatches", async () => {
    const result = await obterStreamAudioCompleto("Outra Música", "Artista Exemplo", {
        searchUrl: "/api/jamendo/search?q=Outra",
        fetchImpl: async () => responseWith([licensedTrack])
    });
    assert.equal(result, null);
});

test("rejects non-Jamendo streams and missing or non-CC licenses", async () => {
    const unsafeTracks = [
        { ...licensedTrack, playbackUrl: "https://attacker.example/track.mp3" },
        { ...licensedTrack, licenseUrl: "" },
        { ...licensedTrack, licenseUrl: "https://example.com/license" }
    ];
    const result = await obterStreamAudioCompleto("Música Exemplo", "Artista Exemplo", {
        searchUrl: "/api/jamendo/search?q=Musica",
        fetchImpl: async () => responseWith(unsafeTracks)
    });
    assert.equal(result, null);
});

test("reports failed provider responses instead of silently hiding them", async () => {
    await assert.rejects(
        obterStreamAudioCompleto("Música", "Artista", {
            searchUrl: "/api/jamendo/search?q=Musica",
            fetchImpl: async () => responseWith([], false, 503)
        }),
        /HTTP 503/
    );
});

test("requires title, artist and configured search route", async () => {
    await assert.rejects(obterStreamAudioCompleto("Música", "Artista"), TypeError);
});
