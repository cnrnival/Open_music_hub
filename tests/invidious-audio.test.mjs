import assert from "node:assert/strict";
import test from "node:test";
import handleRequest from "../server.js";

const { selectInvidiousAudioFormat } = handleRequest;

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

const videoWithFormats = {
    videoId: "abc123",
    title: "Faixa Completa",
    author: "Artista",
    lengthSeconds: 200,
    adaptiveFormats: [
        { url: "https://media.example/video.webm", type: "video/webm", container: "webm", bitrate: "900000" },
        { url: "https://media.example/low.m4a", type: "audio/mp4; codecs=\"mp4a.40.2\"", container: "m4a", bitrate: "64000" },
        { url: "https://media.example/high.webm", type: "audio/webm; codecs=\"opus\"", container: "webm", bitrate: "160000" }
    ]
};

test("selectInvidiousAudioFormat picks the highest-bitrate audio-only stream", () => {
    const selected = selectInvidiousAudioFormat(videoWithFormats);
    assert.equal(selected.url, "https://media.example/high.webm");
    assert.equal(selected.container, "webm");
    assert.equal(selected.bitrate, 160000);
});

test("selectInvidiousAudioFormat ignores muxed video and reports missing audio", () => {
    assert.equal(selectInvidiousAudioFormat({
        adaptiveFormats: [{ url: "https://media.example/muxed.mp4", type: "video/mp4", container: "mp4", bitrate: "1" }]
    }), null);
    assert.equal(selectInvidiousAudioFormat({}), null);
    assert.equal(selectInvidiousAudioFormat(null), null);
});

test("the detail route exposes the same-origin proxy plus the direct audio URL", async () => {
    const originalFetch = globalThis.fetch;
    let requested;
    globalThis.fetch = async (input) => {
        requested = new URL(input);
        return { ok: true, status: 200, json: async () => videoWithFormats };
    };
    try {
        const response = createResponse();
        await handleRequest({ method: "GET", url: "/api/invidious/videos/abc123", headers: {} }, response);
        assert.equal(response.statusCode, 200);
        const payload = JSON.parse(response.body);
        const expectedStream = "/api/invidious?action=stream&id=abc123";
        assert.equal(payload.audioUrl, expectedStream);
        assert.equal(payload.item.audioUrl, expectedStream);
        assert.equal(payload.audio.url, expectedStream);
        // A URL direta é entregue para o player (IP do usuário) e o proxy fica como alternativa.
        // The direct URL is handed to the player (user's IP) while the proxy stays as fallback.
        assert.equal(payload.directAudioUrl, "https://media.example/high.webm");
        assert.equal(payload.item.directAudioUrl, "https://media.example/high.webm");
        assert.ok(payload.audioUrl.startsWith("/api/invidious?action=stream"), "the proxy URL stays same-origin");
        assert.equal(requested.origin, "https://invidious.f5.si");
        assert.equal(requested.pathname, "/api/v1/videos/abc123");
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("the audio action returns the resolved proxy stream path", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => videoWithFormats });
    try {
        const response = createResponse();
        await handleRequest({ method: "GET", url: "/api/invidious?action=audio&id=xyz789", headers: {} }, response);
        assert.equal(response.statusCode, 200);
        const payload = JSON.parse(response.body);
        assert.equal(payload.audioUrl, "/api/invidious?action=stream&id=xyz789");
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("a transient upstream 5xx is retried before the request fails", async () => {
    const originalFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = async () => {
        calls += 1;
        if (calls === 1) {
            return { ok: false, status: 500, json: async () => ({}) };
        }
        return { ok: true, status: 200, json: async () => ({ ...videoWithFormats, videoId: "retry123" }) };
    };
    try {
        const response = createResponse();
        await handleRequest({ method: "GET", url: "/api/invidious?action=audio&id=retry123", headers: {} }, response);
        assert.equal(response.statusCode, 200);
        assert.equal(calls, 2);
        assert.equal(JSON.parse(response.body).audioUrl, "/api/invidious?action=stream&id=retry123");
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("the audio action rejects invalid video ids", async () => {
    const response = createResponse();
    await handleRequest({ method: "GET", url: "/api/invidious?action=audio&id=bad%2Fid", headers: {} }, response);
    assert.equal(response.statusCode, 400);
});
