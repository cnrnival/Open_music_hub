const fs = require('node:fs');
const path = 'public/js/app.js';
const original = fs.readFileSync(path, 'utf8');

const attach = `// Microinterações do player (Media Session, fila, hover e gradiente) ficam ativas só quando o player encontra os containers corretos.
// Player microinteractions (Media Session, queue, hover, and gradient) activate only once the player finds the right containers.
if (doc && typeof doc.querySelector === 'function') {
    const attachedPlayButton = doc.querySelector('.music-player__play');
    const attachedTimeline = doc.querySelector('.music-player__timeline');
    const attachedQueueButton = doc.querySelector('.music-player__extras [aria-label=\'Fila\']');
    if (attachedPlayButton) {
        if (typeof applyMediaSession === 'function') {
            applyMediaSession();
        }
        if (typeof attachKeyboardShortcuts === 'function') {
            attachKeyboardShortcuts();
        }
    }
    if (attachedTimeline && typeof applyTimelineHoverStyle === 'function') {
        applyTimelineHoverStyle();
    }
    if (attachedQueueButton && typeof openQueuePanel === 'function') {
        attachedQueueButton.addEventListener('click', () => {
            queuePanelVisible ? closeQueuePanel() : openQueuePanel();
        });
    }
    if (typeof updateHeaderGradientForTrack === 'function') {
        updateHeaderGradientForTrack();
    }
}
`;

const removeStart = '// Media Session, queue, progress bar hover, and reactive gradient start after the player init.';
const removeEndMarker = `\n\n// Offline-first: registra o Service Worker (cache do shell); o áudio já usa a Cache API.\n// Offline-first: register the Service Worker (shell cache); audio already uses the Cache API.`;

const start = original.indexOf(removeStart);
if (start === -1) {
    console.error('ANCHOR_START_NOT_FOUND');
    process.exit(1);
}
const afterStart = original.slice(start + removeStart.length);
const end = afterStart.indexOf(removeEndMarker);
if (end === -1) {
    console.error('ANCHOR_END_NOT_FOUND');
    process.exit(1);
}

const endIndex = start + removeStart.length + end;
const newContents = original.slice(0, start) + attach + removeEndMarker + original.slice(endIndex + removeEndMarker.length);

fs.writeFileSync(path, newContents);
console.log('PATCHED', newContents.length - original.length, 'chars');
