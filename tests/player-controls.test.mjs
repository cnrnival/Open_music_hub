import assert from "node:assert/strict";
import test from "node:test";
import {
    clampVolume,
    getProgressState,
    getVolumeState,
    seekTimeFromRatio
} from "../src/player-controls.mjs";

test("clampVolume limita valores abaixo de zero e acima de um", () => {
    assert.equal(clampVolume(-0.5), 0);
    assert.equal(clampVolume(1.5), 1);
    assert.equal(clampVolume(0.42), 0.42);
});

test("clampVolume usa fallback seguro para entradas inválidas", () => {
    assert.equal(clampVolume(Number.NaN), 0.75);
    assert.equal(clampVolume("invalido"), 0.75);
    assert.equal(clampVolume(undefined, 0.2), 0.2);
    assert.equal(clampVolume(null, 0.2), 0);
    assert.equal(clampVolume("invalido", 2), 1);
});

test("getVolumeState descreve mute, porcentagem e ícone corretamente", () => {
    assert.deepEqual(getVolumeState(0), {
        volume: 0,
        percentage: 0,
        muted: true,
        icon: "volume-off"
    });
    assert.deepEqual(getVolumeState(0.25), {
        volume: 0.25,
        percentage: 25,
        muted: false,
        icon: "volume-low"
    });
    assert.deepEqual(getVolumeState(0.75), {
        volume: 0.75,
        percentage: 75,
        muted: false,
        icon: "volume-high"
    });
});

test("getVolumeState preserva o volume anterior como fallback", () => {
    assert.equal(getVolumeState("não numérico", 0.34).volume, 0.34);
    assert.equal(getVolumeState("não numérico", 2).volume, 1);
});

test("getProgressState retorna zero para duração ausente, zero ou inválida", () => {
    assert.deepEqual(getProgressState(10, 0), {
        currentTime: 0,
        duration: 0,
        ratio: 0,
        percentage: 0
    });
    assert.deepEqual(getProgressState(10, Number.NaN), {
        currentTime: 0,
        duration: 0,
        ratio: 0,
        percentage: 0
    });
});

test("getProgressState limita o tempo atual ao intervalo da faixa", () => {
    assert.deepEqual(getProgressState(-10, 200), {
        currentTime: 0,
        duration: 200,
        ratio: 0,
        percentage: 0
    });
    assert.deepEqual(getProgressState(250, 200), {
        currentTime: 200,
        duration: 200,
        ratio: 1,
        percentage: 100
    });
    assert.equal(getProgressState(50, 200).percentage, 25);
});

test("getProgressState trata currentTime inválido sem quebrar a barra", () => {
    assert.deepEqual(getProgressState("não numérico", 120), {
        currentTime: 0,
        duration: 120,
        ratio: 0,
        percentage: 0
    });
});

test("seekTimeFromRatio converte a posição da barra em segundos", () => {
    assert.equal(seekTimeFromRatio(0, 180), 0);
    assert.equal(seekTimeFromRatio(0.5, 180), 90);
    assert.equal(seekTimeFromRatio(1, 180), 180);
});

test("seekTimeFromRatio limita posições fora da barra e entradas inválidas", () => {
    assert.equal(seekTimeFromRatio(-1, 180), 0);
    assert.equal(seekTimeFromRatio(2, 180), 180);
    assert.equal(seekTimeFromRatio(Number.NaN, 180), 0);
    assert.equal(seekTimeFromRatio(0.5, 0), 0);
});
