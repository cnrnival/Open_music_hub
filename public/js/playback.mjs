function normalizeForComparison(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase("pt-BR")
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .trim();
}

function isLicensedJamendoTrack(track, title, artist) {
    try {
        const streamUrl = new URL(track.playbackUrl);
        const licenseUrl = new URL(track.licenseUrl);
        const validStream = streamUrl.protocol === "https:"
            && (streamUrl.hostname === "jamendo.com" || streamUrl.hostname.endsWith(".jamendo.com"));
        const validLicense = licenseUrl.protocol === "https:"
            && (licenseUrl.hostname === "creativecommons.org"
                || licenseUrl.hostname.endsWith(".creativecommons.org"));
        return validStream
            && validLicense
            && normalizeForComparison(track.title) === normalizeForComparison(title)
            && normalizeForComparison(track.artistName) === normalizeForComparison(artist);
    } catch {
        return false;
    }
}

// Finds an exact Jamendo track that the server has confirmed is downloadable under a CC license.
// Busca uma faixa Jamendo exata que o servidor confirmou ser baixável sob licença CC.
export async function obterStreamAudioCompleto(titulo, artista, { searchUrl, fetchImpl = fetch } = {}) {
    if (!titulo || !artista || !searchUrl) {
        throw new TypeError("Título, artista e URL de busca são obrigatórios.");
    }
    const response = await fetchImpl(searchUrl);
    if (!response.ok) {
        throw new Error(`A busca licenciada falhou (HTTP ${response.status}).`);
    }
    const payload = await response.json();
    const track = (Array.isArray(payload.results) ? payload.results : [])
        .find((result) => isLicensedJamendoTrack(result, titulo, artista));
    return track || null;
}
