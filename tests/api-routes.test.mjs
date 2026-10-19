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
        apiConfig.providers.audioDb.searchPath("track", "Around the World"),
        apiConfig.providers.audioDb.lookupPath("artist", "42", true),
        apiConfig.providers.audioDb.discographyPath("42"),
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

test("flat API routes dispatch to their handlers and validate input", async () => {
    const paths = [
        "/api/deezer?action=search",
        "/api/deezer?action=detail&resource=artist&id=invalid",
        "/api/deezer?action=artist-albums&id=invalid",
        "/api/audiodb?action=search&kind=artist",
        "/api/audiodb?action=lookup&kind=artist",
        "/api/audiodb?action=discography",
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
