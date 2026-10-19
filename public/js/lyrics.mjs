// Letras sincronizadas: analisa marcas de tempo LRC, formata mm:ss e escolhe a linha ativa.
// Synced lyrics: parses LRC timestamps, formats mm:ss, and picks the active line.

// Linha LRC válida: [mm:ss], [mm:ss.xx], [mm:ss.xxx] ou [mm:ss:xx].
// Valid LRC line: [mm:ss], [mm:ss.xx], [mm:ss.xxx], or [mm:ss:xx].
const LRC_LINE = /^\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\](.*)$/;

// Converte a fração de segundo ("5", "56", "567") em segundos decimais.
// Convert the second fraction ("5", "56", "567") into decimal seconds.
function fractionToSeconds(fraction) {
    if (!fraction) {
        return 0;
    }
    return Number(`0.${fraction}`) || 0;
}

// Analisa o conteúdo LRC e devolve as linhas ordenadas pelo tempo.
// Parse LRC content and return the lines sorted by time.
export function parseLrc(text) {
    if (typeof text !== "string" || !text.trim()) {
        return [];
    }
    const lines = [];
    for (const rawLine of text.split(/\r?\n/)) {
        const match = LRC_LINE.exec(rawLine.trim());
        if (!match) {
            // Metadados ([ar:], [ti:], [al:]) e texto sem marcação ficam de fora.
            // Metadata tags ([ar:], [ti:], [al:]) and untagged text are skipped.
            continue;
        }
        const time = Number(match[1]) * 60 + Number(match[2]) + fractionToSeconds(match[3]);
        if (!Number.isFinite(time)) {
            continue;
        }
        lines.push({ time, text: match[4].trim() });
    }
    lines.sort((left, right) => left.time - right.time);
    return lines;
}

// Converte uma letra simples (sem tempos) na mesma forma das linhas sincronizadas.
// Convert plain lyrics (no timestamps) into the same shape as synced lines.
export function linhasDeTexto(text) {
    if (typeof text !== "string" || !text.trim()) {
        return [];
    }
    return text
        .split(/\r?\n/)
        .map((line) => ({ time: null, text: line.trim() }))
        .filter((line) => line.text.length > 0);
}

// Formata segundos como mm:ss com zeros à esquerda (ex.: 65 -> "01:05").
// Format seconds as zero-padded mm:ss (e.g. 65 -> "01:05").
export function formatarTempo(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) {
        return "00:00";
    }
    const total = Math.floor(seconds);
    const minutes = Math.floor(total / 60);
    const rest = total % 60;
    return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

// Devolve o índice da linha ativa para o tempo atual (-1 quando ainda não começou).
// Return the active line index for the current time (-1 before the first line).
export function linhaAtiva(lines, time) {
    if (!Array.isArray(lines) || lines.length === 0 || !Number.isFinite(time) || time < 0) {
        return -1;
    }
    let active = -1;
    for (let index = 0; index < lines.length; index += 1) {
        const lineTime = lines[index]?.time;
        if (typeof lineTime !== "number" || !Number.isFinite(lineTime)) {
            // Letras sem marcação de tempo não podem ser destacadas.
            // Plain lines without timestamps cannot be highlighted.
            return -1;
        }
        if (lineTime <= time + 0.001) {
            active = index;
        } else {
            break;
        }
    }
    return active;
}
