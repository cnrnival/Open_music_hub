import assert from "node:assert/strict";
import test from "node:test";
import { parseLrc, linhasDeTexto, formatarTempo, linhaAtiva } from "../public/js/lyrics.mjs";

const SAMPLE_LRC = [
    "[ti:Get Lucky]",
    "[ar:Daft Punk]",
    "[00:35.11] Our ends were beginnings",
    "[00:30.64] Like the legend of the phoenix, huh",
    "[01:02] Solo marker without fraction",
    "[01:10:25] Colon variant for centiseconds",
    "Plain text without a timestamp"
].join("\n");

test("parseLrc keeps timed lines, sorts them, and drops metadata", () => {
    const lines = parseLrc(SAMPLE_LRC);
    assert.equal(lines.length, 4);
    assert.deepEqual(lines[0], { time: 30.64, text: "Like the legend of the phoenix, huh" });
    assert.deepEqual(lines[1], { time: 35.11, text: "Our ends were beginnings" });
    assert.equal(lines[2].time, 62);
    assert.equal(lines[3].time, 70.25);
});

test("parseLrc handles millisecond precision and invalid input", () => {
    assert.deepEqual(parseLrc("[00:12.345] Third line"), [{ time: 12.345, text: "Third line" }]);
    assert.deepEqual(parseLrc(""), []);
    assert.deepEqual(parseLrc(null), []);
    assert.deepEqual(parseLrc("[not-a-timestamp] ignored"), []);
});

test("linhasDeTexto splits plain lyrics and removes blank lines", () => {
    const lines = linhasDeTexto("First line\n\n  Second line  ");
    assert.deepEqual(lines, [
        { time: null, text: "First line" },
        { time: null, text: "Second line" }
    ]);
    assert.deepEqual(linhasDeTexto(""), []);
});

test("formatarTempo renders zero-padded minutes and seconds", () => {
    assert.equal(formatarTempo(0), "00:00");
    assert.equal(formatarTempo(65), "01:05");
    assert.equal(formatarTempo(3599), "59:59");
    assert.equal(formatarTempo(3600), "60:00");
    assert.equal(formatarTempo(Number.NaN), "00:00");
    assert.equal(formatarTempo(-5), "00:00");
});

test("linhaAtiva follows playback time across synced lines", () => {
    const lines = parseLrc("[00:10.00] A\n[00:20.00] B\n[00:30.00] C");
    assert.equal(linhaAtiva(lines, 0), -1);
    assert.equal(linhaAtiva(lines, 10), 0);
    assert.equal(linhaAtiva(lines, 25), 1);
    assert.equal(linhaAtiva(lines, 99), 2);
    assert.equal(linhaAtiva([], 10), -1);
    assert.equal(linhaAtiva(lines, Number.NaN), -1);
});

test("linhaAtiva refuses plain lines that carry no timestamps", () => {
    const lines = linhasDeTexto("Only plain text");
    assert.equal(linhaAtiva(lines, 15), -1);
});
