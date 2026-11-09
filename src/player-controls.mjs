const DEFAULT_VOLUME = 0.75;

export function clampVolume(value, fallback = DEFAULT_VOLUME) {
    const numericValue = Number(value);
    const safeFallback = Number.isFinite(Number(fallback))
        ? Math.min(1, Math.max(0, Number(fallback)))
        : DEFAULT_VOLUME;
    return Number.isFinite(numericValue)
        ? Math.min(1, Math.max(0, numericValue))
        : safeFallback;
}

export function getVolumeState(value, previousVolume = DEFAULT_VOLUME) {
    const volume = clampVolume(value, previousVolume);
    return {
        volume,
        percentage: Math.round(volume * 100),
        muted: volume === 0,
        icon: volume === 0 ? "volume-off" : volume < 0.5 ? "volume-low" : "volume-high"
    };
}

export function getProgressState(currentTime, duration) {
    const safeDuration = Number(duration);
    const safeCurrentTime = Number(currentTime);
    if (!Number.isFinite(safeDuration) || safeDuration <= 0) {
        return { currentTime: 0, duration: 0, ratio: 0, percentage: 0 };
    }
    const boundedCurrentTime = Number.isFinite(safeCurrentTime)
        ? Math.min(safeDuration, Math.max(0, safeCurrentTime))
        : 0;
    const ratio = boundedCurrentTime / safeDuration;
    return {
        currentTime: boundedCurrentTime,
        duration: safeDuration,
        ratio,
        percentage: ratio * 100
    };
}

export function seekTimeFromRatio(ratio, duration) {
    const safeDuration = Number(duration);
    const safeRatio = Number(ratio);
    if (!Number.isFinite(safeDuration) || safeDuration <= 0 || !Number.isFinite(safeRatio)) {
        return 0;
    }
    const boundedRatio = Math.min(1, Math.max(0, safeRatio));
    return boundedRatio * safeDuration;
}
