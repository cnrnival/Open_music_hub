import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import handleRequest from "../server.js";

const require = createRequire(import.meta.url);
const apiConfig = require("../public/js/config.js");

function createResponse() {
    return {
        statusCode: 0,
        headers: {},
        body: "",
        writeHead(statusCode, headers = {}) {
            this.statusCode = statusCode;
            this.headers = headers;
            return this;
        },
        end(body = "") {
            this.body = body;
            return this;
        }
    };
}

async function request(path) {
    const response = createResponse();
    await handleRequest({ method: "GET", url: path, headers: {} }, response);
    return response;
}

test("all configured API paths fit Vercel's single-segment function route", () => {
    const paths = [
        apiConfig.providers.deezer.searchPath("Daft Punk"),
        apiConfig.providers.deezer.detailPath("artist", "42"),
        apiConfig.providers.deezer.artistAlbumsPath("42"),
        apiConfig.providers.audioDb.artistSearchPath("Daft Punk"),
        apiConfig.providers.audioDb.searchPath("track", "Daft Punk", "Around the World"),
        apiConfig.providers.audioDb.lookupPath("artist", "42", true),
        apiConfig.providers.audioDb.discographyPath("Daft Punk"),
        apiConfig.providers.audioDb.discographyByMusicBrainzPath("cc197bad-dc9c-440d-a5b5-d52ba2e14234"),
        apiConfig.providers.audioDb.albumByAlbumIdPath("42"),
        apiConfig.providers.audioDb.trackByAlbumPath("42"),
        apiConfig.providers.audioDb.trackByIdPath("42"),
        apiConfig.providers.audioDb.musicVideosPath("42"),
        apiConfig.providers.audioDb.trackTop10Path("Daft Punk"),
        apiConfig.providers.audioDb.mostLovedTracksPath(),
        apiConfig.providers.audioDb.mostLovedAlbumsPath(),
        apiConfig.providers.audioDb.trendingPath(),
        apiConfig.providers.musicBrainz.artistSearchPath("Daft Punk"),
        apiConfig.providers.lyrics.searchPath("Daft Punk", "Get Lucky"),
        apiConfig.providers.jamendo.searchPath("indie"),
        apiConfig.providers.invidious.searchPath("Daft Punk"),
        apiConfig.providers.invidious.detailPath("video-id")
    ];

    for (const path of paths) {
        const { pathname } = new URL(path, "https://openmusichub.example");
        assert.equal(pathname.split("/").filter(Boolean).length, 2, path);
    }
});

test("TheAudioDB v1 endpoint builders use the documented routes and encoded parameters", () => {
    const endpoints = apiConfig.providers.audioDb.endpoints;
    const mbid = "cc197bad-dc9c-440d-a5b5-d52ba2e14234";

    assert.equal(apiConfig.providers.audioDb.apiPath, "api/v1/json/123/");
    assert.equal(endpoints.searchArtist("Coldplay & Friends"), "search.php?s=Coldplay%20%26%20Friends");
    assert.equal(endpoints.searchDiscography("Coldplay"), "discography.php?s=Coldplay");
    assert.equal(endpoints.searchDiscographyMB(mbid), `discography-mb.php?s=${mbid}`);
    assert.equal(endpoints.searchAlbum("Coldplay", "A Rush"), "searchalbum.php?s=Coldplay&a=A%20Rush");
    assert.equal(endpoints.searchTrack("Coldplay", "Yellow"), "searchtrack.php?s=Coldplay&t=Yellow");
    assert.equal(endpoints.lookupArtist("42"), "artist.php?i=42");
    assert.equal(endpoints.lookupArtistMB(mbid), `artist-mb.php?i=${mbid}`);
    assert.equal(endpoints.lookupArtistSocial("42"), "artist-social.php?i=42");
    assert.equal(endpoints.lookupAlbum("42"), "album.php?i=42");
    assert.equal(endpoints.lookupAlbumByAlbumId("42"), "album.php?m=42");
    assert.equal(endpoints.lookupAlbumMB(mbid), `album-mb.php?i=${mbid}`);
    assert.equal(endpoints.lookupTrackByAlbum("42"), "track.php?m=42");
    assert.equal(endpoints.lookupTrackById("42"), "track.php?h=42");
    assert.equal(endpoints.lookupTrackMB(mbid), `track-mb.php?i=${mbid}`);
    assert.equal(endpoints.musicVideos("42"), "mvid.php?i=42");
    assert.equal(endpoints.musicVideosMB(mbid), `mvid-mb.php?i=${mbid}`);
    assert.equal(endpoints.trackTop10("Coldplay"), "track-top10.php?s=Coldplay");
    assert.equal(endpoints.mostLovedTracks, "mostloved.php?format=track");
    assert.equal(endpoints.mostLovedAlbums, "mostloved.php?format=album");
    assert.equal(endpoints.trending("br", "itunes", "tracks"), "trending.php?country=br&type=itunes&format=tracks");
});

test("flat API routes dispatch to their handlers and validate input", async () => {
    const paths = [
        "/api/deezer?action=search",
        "/api/deezer?action=detail&resource=artist&id=invalid",
        "/api/deezer?action=artist-albums&id=invalid",
        "/api/audiodb?action=search-artist",
        "/api/audiodb?action=lookup-artist&id=invalid",
        "/api/audiodb?action=search-discography",
        "/api/audiodb?action=search-discography-mb&mbid=invalid",
        "/api/audiodb?action=search-album&artist=Coldplay",
        "/api/audiodb?action=search-track&artist=Coldplay",
        "/api/audiodb?action=lookup-artist-social&id=invalid",
        "/api/audiodb?action=music-videos&id=invalid",
        "/api/audiodb?action=track-top10",
        "/api/audiodb?action=trending&country=USA",
        "/api/musicbrainz",
        "/api/jamendo",
        "/api/invidious?action=search",
        "/api/invidious?action=video&id=invalid%2Fid",
        "/api/lyrics"
    ];

    for (const path of paths) {
        const response = await request(path);
        assert.equal(response.statusCode, 400, `${path}: ${response.body}`);
    }
});

test("TheAudioDB v1 uses the published public test key through a same-origin proxy", async () => {
    const originalFetch = globalThis.fetch;
    let requestedUrl;
    let requestOptions;
    globalThis.fetch = async (input, options) => {
        requestedUrl = new URL(input);
        requestOptions = options;
        return {
            ok: true,
            async json() {
                return {
                    artists: [{
                        idArtist: "111239",
                        strArtist: "Coldplay",
                        strBiographyEN: "An English rock band.",
                        strArtistThumb: "https://www.theaudiodb.com/images/media/artist/thumb/example.jpg"
                    }]
                };
            }
        };
    };

    try {
        const response = await request(apiConfig.providers.audioDb.artistSearchPath("Coldplay"));
        assert.equal(response.statusCode, 200);
        assert.equal(requestedUrl.origin, "https://www.theaudiodb.com");
        assert.equal(requestedUrl.pathname, "/api/v1/json/123/search.php");
        assert.equal(requestedUrl.searchParams.get("s"), "Coldplay");
        assert.deepEqual(requestOptions.headers, {});
        assert.deepEqual(JSON.parse(response.body).results[0], {
            id: "111239",
            name: "Coldplay",
            biography: "An English rock band.",
            thumb: "https://www.theaudiodb.com/images/media/artist/thumb/example.jpg",
            banner: "",
            logo: "",
            genre: "",
            country: ""
        });
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("flat Deezer search routes query every catalog type", async () => {
    const originalFetch = globalThis.fetch;
    const requestedUrls = [];
    globalThis.fetch = async (input) => {
        requestedUrls.push(new URL(input).pathname);
        return {
            ok: true,
            async json() {
                return { data: [{ id: "42" }] };
            }
        };
    };

    try {
        const response = await request("/api/deezer?action=search&q=Daft%20Punk");
        assert.equal(response.statusCode, 200);
        assert.deepEqual(JSON.parse(response.body).results.map(({ type }) => type), [
            "track",
            "artist",
            "album",
            "playlist"
        ]);
        assert.equal(requestedUrls.length, 4);
        assert.ok(requestedUrls.every((url) => url.startsWith("/search/")));
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("synced lyrics route prefers LrcLib time-synced LRC responses", async () => {
    const originalFetch = globalThis.fetch;
    const requestedUrls = [];
    globalThis.fetch = async (input) => {
        requestedUrls.push(new URL(input));
        return {
            ok: true,
            async json() {
                return {
                    plainLyrics: "Linha um\nLinha dois",
                    syncedLyrics: "[00:12.50] Linha um\n[00:18.00] Linha dois"
                };
            }
        };
    };

    try {
        const response = await request("/api/lyrics?artist=Daft%20Punk&title=Get%20Lucky&format=synced");
        assert.equal(response.statusCode, 200);
        assert.equal(requestedUrls[0].origin, "https://lrclib.net");
        assert.equal(requestedUrls[0].pathname, "/api/get");
        assert.equal(requestedUrls[0].searchParams.get("artist_name"), "Daft Punk");
        assert.equal(requestedUrls[0].searchParams.get("track_name"), "Get Lucky");
        const payload = JSON.parse(response.body);
        assert.equal(payload.provider, "lrclib");
        assert.equal(payload.synced, true);
        assert.match(payload.syncedLyrics, /^\[00:12\.50\]/);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("synced lyrics route falls back to plain Lyrics.ovh when LrcLib misses", async () => {
    const originalFetch = globalThis.fetch;
    const requestedUrls = [];
    globalThis.fetch = async (input) => {
        const url = new URL(input);
        requestedUrls.push(url.origin);
        if (url.hostname === "lrclib.net") {
            return { ok: false, status: 404, async json() { return {}; } };
        }
        return {
            ok: true,
            async json() {
                return { lyrics: "Letra simples sem tempos" };
            }
        };
    };

    try {
        const response = await request("/api/lyrics?artist=Desconhecido&title=Inexistente&format=synced");
        assert.equal(response.statusCode, 200);
        assert.deepEqual(requestedUrls, ["https://lrclib.net", "https://api.lyrics.ovh"]);
        const payload = JSON.parse(response.body);
        assert.equal(payload.provider, "lyrics.ovh");
        assert.equal(payload.synced, false);
        assert.equal(payload.syncedLyrics, "");
        assert.equal(payload.lyrics, "Letra simples sem tempos");
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("synced lyrics route still validates artist and title", async () => {
    const response = await request("/api/lyrics?format=synced");
    assert.equal(response.statusCode, 400);
});
