import assert from "node:assert/strict";
import test from "node:test";
import handleRequest from "../server.js";

const {
    selectInvidiousAudioFormat,
    selectPipedAudioFormat,
    isAllowedAudioMimeType,
    AUDIO_ENGINES,
    AUDIO_ENGINE_TIMEOUT_MS
} = handleRequest;

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

test("selectInvidiousAudioFormat maps the three quality tiers onto available formats", () => {
    const threeTiers = {
        adaptiveFormats: [
            { url: "https://media.example/low.m4a", type: "audio/mp4", container: "m4a", bitrate: "48000" },
            { url: "https://media.example/normal.m4a", type: "audio/mp4", container: "m4a", bitrate: "128000" },
            { url: "https://media.example/high.webm", type: "audio/webm", container: "webm", bitrate: "160000" }
        ]
    };
    assert.equal(selectInvidiousAudioFormat(threeTiers, "low").bitrate, 48000);
    assert.equal(selectInvidiousAudioFormat(threeTiers, "normal").bitrate, 128000);
    assert.equal(selectInvidiousAudioFormat(threeTiers, "high").bitrate, 160000);
    // Qualquer valor desconhecido mantém a melhor qualidade disponível.
    // Any unknown value keeps the best available quality.
    assert.equal(selectInvidiousAudioFormat(threeTiers, "ultra").bitrate, 160000);
});

test("selectInvidiousAudioFormat ignores muxed video and reports missing audio", () => {
    assert.equal(selectInvidiousAudioFormat({
        adaptiveFormats: [{ url: "https://media.example/muxed.mp4", type: "video/mp4", container: "mp4", bitrate: "1" }]
    }), null);
    assert.equal(selectInvidiousAudioFormat({
        adaptiveFormats: [{ url: "https://media.example/track.ogg", type: "audio/ogg", container: "ogg", bitrate: "128000" }]
    }), null);
    assert.equal(selectInvidiousAudioFormat({}), null);
    assert.equal(selectInvidiousAudioFormat(null), null);
});

test("the audio engine list includes Invidious backups and Piped with a 3s timeout", () => {
    assert.equal(AUDIO_ENGINE_TIMEOUT_MS, 3000);
    assert.deepEqual(AUDIO_ENGINES.map((engine) => `${engine.type}:${engine.url}`), [
        "invidious:https://invidious.f5.si",
        "invidious:https://inv.us.projectsegfau.lt",
        "invidious:https://invidious.nerdvpn.de",
        "invidious:https://invidious.drgns.space",
        "piped:https://pipedapi.kavin.rocks",
        "piped:https://pipedapi.tokhmi.xyz"
    ]);
    assert.equal(isAllowedAudioMimeType("audio/mp4; codecs=\"mp4a.40.2\""), true);
    assert.equal(isAllowedAudioMimeType("audio/webm"), true);
    assert.equal(isAllowedAudioMimeType("audio/m4a"), true);
    assert.equal(isAllowedAudioMimeType("audio/ogg"), false);
});

test("selectPipedAudioFormat picks a strict audio MIME from audioStreams", () => {
    const selected = selectPipedAudioFormat({
        audioStreams: [
            { url: "https://pipedapi.kavin.rocks/low.m4a", mimeType: "audio/mp4", bitrate: 48000 },
            { url: "https://pipedapi.kavin.rocks/skip.ogg", mimeType: "audio/ogg", bitrate: 256000 },
            { url: "https://pipedapi.kavin.rocks/high.webm", mimeType: "audio/webm", bitrate: 160000 }
        ]
    });
    assert.equal(selected.url, "https://pipedapi.kavin.rocks/high.webm");
    assert.equal(selected.container, "webm");
    assert.equal(selected.bitrate, 160000);
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
        const expectedStream = "/api/invidious?action=stream&id=abc123&quality=high";
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
        assert.equal(payload.audioUrl, "/api/invidious?action=stream&id=xyz789&quality=high");
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
        assert.equal(JSON.parse(response.body).audioUrl, "/api/invidious?action=stream&id=retry123&quality=high");
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("the audio action forwards the requested quality to the resolved stream", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => videoWithFormats });
    try {
        const response = createResponse();
        await handleRequest({ method: "GET", url: "/api/invidious?action=audio&id=quality9&quality=low", headers: {} }, response);
        assert.equal(response.statusCode, 200);
        const payload = JSON.parse(response.body);
        assert.equal(payload.audioUrl, "/api/invidious?action=stream&id=quality9&quality=low");
        assert.equal(payload.directAudioUrl, "https://media.example/low.m4a");
        assert.equal(payload.audio.bitrate, 64000);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("the audio action rejects invalid video ids", async () => {
    const response = createResponse();
    await handleRequest({ method: "GET", url: "/api/invidious?action=audio&id=bad%2Fid", headers: {} }, response);
    assert.equal(response.statusCode, 400);
});

test("a failing Invidious instance falls back to the next audio engine", async () => {
    const originalFetch = globalThis.fetch;
    const origins = [];
    globalThis.fetch = async (input) => {
        const requested = new URL(input);
        origins.push(requested.origin);
        if (requested.origin === "https://invidious.f5.si") {
            return { ok: false, status: 502, json: async () => ({}) };
        }
        return { ok: true, status: 200, json: async () => ({ ...videoWithFormats, videoId: "fallback1" }) };
    };
    try {
        const response = createResponse();
        await handleRequest({ method: "GET", url: "/api/invidious?action=audio&id=fallback1", headers: {} }, response);
        assert.equal(response.statusCode, 200);
        assert.equal(JSON.parse(response.body).audioUrl, "/api/invidious?action=stream&id=fallback1&quality=high");
        assert.deepEqual(origins, [
            "https://invidious.f5.si",
            "https://inv.us.projectsegfau.lt"
        ]);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("Piped supplies audio when every Invidious instance fails", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input) => {
        const requested = new URL(input);
        if (requested.origin === "https://pipedapi.kavin.rocks") {
            return {
                ok: true,
                status: 200,
                json: async () => ({
                    title: "Faixa Completa",
                    uploader: "Artista",
                    audioStreams: [
                        { url: "https://pipedapi.kavin.rocks/track.m4a", mimeType: "audio/mp4", bitrate: 128000 }
                    ]
                })
            };
        }
        return { ok: false, status: 503, json: async () => ({}) };
    };
    try {
        const response = createResponse();
        await handleRequest({ method: "GET", url: "/api/invidious?action=audio&id=piped123", headers: {} }, response);
        assert.equal(response.statusCode, 200);
        const payload = JSON.parse(response.body);
        assert.equal(payload.directAudioUrl, "https://pipedapi.kavin.rocks/track.m4a");
        assert.equal(payload.audio.mimeType, "audio/mp4");
    } finally {
        globalThis.fetch = originalFetch;
    }
});
