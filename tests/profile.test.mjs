import assert from "node:assert/strict";
import test from "node:test";
import {
    PROFILE_LIMITS,
    RECENTS_KEY,
    initialsFor,
    normalizeRecents,
    parseStoredRecents,
    pushRecent,
    relativeTime,
    trackFromRecent,
    trackSnapshot
} from "../public/js/profile.mjs";

test("RECENTS_KEY matches the storage key the app writes the history to", () => {
    // O app (js/app.js) grava o histórico sob este mesmo nome.
    // The app (js/app.js) writes the history under this same name.
    assert.equal(RECENTS_KEY, "open-music-hub:recents");
});

test("pushRecent puts the newest track first and deduplicates it", () => {
    const first = pushRecent([], { provider: "invidious", kind: "track", id: "abc", title: "Faixa A" }, 1000);
    const second = pushRecent(first, { provider: "invidious", kind: "track", id: "def", title: "Faixa B" }, 2000);
    assert.equal(second.length, 2);
    assert.equal(second[0].title, "Faixa B");
    assert.equal(second[0].playedAt, 2000);
    // Tocar a mesma faixa de novo mova para o topo sem duplicar.
    // Playing the same track again moves it to the top without duplicating.
    const third = pushRecent(second, { provider: "invidious", kind: "track", id: "abc", title: "Faixa A" }, 3000);
    assert.equal(third.length, 2);
    assert.equal(third[0].title, "Faixa A");
    assert.equal(third[0].playedAt, 3000);
});

test("pushRecent keeps the list capped and ignores empty tracks", () => {
    let list = [];
    for (let index = 0; index < PROFILE_LIMITS.maxRecent + 5; index += 1) {
        list = pushRecent(list, { provider: "deezer", id: String(index), title: `Faixa ${index}` }, 1000 + index);
    }
    assert.equal(list.length, PROFILE_LIMITS.maxRecent);
    // Sem título não gera entrada.
    // No title means no entry.
    assert.equal(pushRecent(list, { provider: "deezer", id: "x" }).length, PROFILE_LIMITS.maxRecent);
});

test("normalizeRecents and parseStoredRecents keep only usable entries", () => {
    assert.deepEqual(normalizeRecents("not-an-array"), []);
    const raw = [
        { key: "a", title: "Válida" },
        { title: "Sem key é descartada" },
        null,
        { key: "b", title: "Outra válida", artistName: "Artista", playedAt: "123" }
    ];
    const normalized = normalizeRecents(raw);
    assert.equal(normalized.length, 2);
    assert.equal(normalized[1].playedAt, 123);
    // JSON corrompido devolve lista vazia em vez de lançar.
    // Corrupted JSON returns an empty list instead of throwing.
    assert.deepEqual(parseStoredRecents("{corrupt"), []);
    assert.deepEqual(parseStoredRecents(""), []);
});

test("trackFromRecent rebuilds a player track", () => {
    const entry = normalizeRecents([{ key: "k", provider: "invidious", id: "vid", title: "Faixa", artistName: "Autor" }])[0];
    const track = trackFromRecent(entry);
    assert.equal(track.provider, "invidious");
    assert.equal(track.id, "vid");
    assert.equal(track.title, "Faixa");
    assert.equal(track.artistName, "Autor");
    // Entrada sem título não vira faixa.
    // An entry without a title does not become a track.
    assert.equal(trackFromRecent({ key: "k" }), null);
});

test("trackSnapshot requires a title and captures the minimal fields", () => {
    assert.equal(trackSnapshot({}), null);
    const snapshot = trackSnapshot({ provider: "local", kind: "track", id: 7, title: "Faixa", artistName: "Alguém", durationSeconds: "90" });
    assert.equal(snapshot.title, "Faixa");
    assert.equal(snapshot.id, "7");
    assert.equal(snapshot.durationSeconds, 90);
});

test("relativeTime uses short Portuguese labels", () => {
    const now = 1_000_000_000_000;
    assert.equal(relativeTime(now, now), "agora");
    assert.equal(relativeTime(now - 5 * 60_000, now), "há 5 min");
    assert.equal(relativeTime(now - 3 * 3_600_000, now), "há 3 h");
    assert.equal(relativeTime(now - 2 * 86_400_000, now), "há 2 dias");
    assert.equal(relativeTime(0, now), "");
});

test("initialsFor derives up to two letters", () => {
    assert.equal(initialsFor(""), "O");
    assert.equal(initialsFor("Gustavo"), "G");
    assert.equal(initialsFor("Gustavo Santos"), "GS");
});
