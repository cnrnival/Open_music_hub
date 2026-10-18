const playButton = document.querySelector(".music-player__play");
const playIcon = playButton.querySelector(".music-player__play-icon");
const audio = document.querySelector(".music-player__audio");
const fileInput = document.querySelector(".music-player__file-input");
const loadButton = document.querySelector(".Pplay-music__cover");
const title = document.querySelector(".Pplay-music__title");
const artist = document.querySelector(".Pplay-music__artist");
const status = document.querySelector(".music-player__status");
const currentTimeLabel = document.querySelector(".music-player__current-time");
const durationLabel = document.querySelector(".music-player__duration");
const progress = document.querySelector(".music-player__progress");
const volumeControl = document.querySelector(".music-player__volume-control");
const muteButton = document.querySelector(".music-player__mute");
const volumeIcon = muteButton.querySelector(".mdi");
const playSource = "https://img.icons8.com/?size=100&id=59862&format=png&color=000000";
const pauseSource = "https://img.icons8.com/?size=100&id=61012&format=png&color=000000";
let audioUrl;
let previousVolume = Number(volumeControl.value);

// Define a faixa inicial e aplica o volume escolhido no controle.
audio.volume = previousVolume;
audio.src = "music/lil-giela-cristal.mp3";
title.textContent = "Cristal (Remasterizado 2024)";
artist.textContent = "lilberto33";
audio.load();

// Mantém o volume do áudio, a barra e o ícone de som sincronizados.
function updateVolume() {
    const volume = Number(volumeControl.value);
    audio.volume = volume;
    volumeControl.style.setProperty("--volume", `${volume * 100}%`);
    volumeControl.setAttribute("aria-valuetext", `${Math.round(volume * 100)}%`);
    muteButton.setAttribute("aria-label", volume === 0 ? "Ativar som" : "Silenciar");
    volumeIcon.className = volume === 0
        ? "mdi mdi-volume-off"
        : volume < 0.5
            ? "mdi mdi-volume-low"
            : "mdi mdi-volume-high";

    if (volume > 0) {
        previousVolume = volume;
    }
}

// Converte a duração em segundos para o formato exibido no player.
function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) {
        return "0:00";
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

// Atualiza o estado acessível do botão e alterna o ícone de play/pausa.
function setPlaybackState(isPlaying) {
    playButton.setAttribute("aria-pressed", String(isPlaying));
    playButton.setAttribute("aria-label", isPlaying ? "Pausar" : "Reproduzir");
    playIcon.src = isPlaying ? pauseSource : playSource;
}

// Reflete a posição e a duração atuais na barra e nos contadores.
function updateProgress() {
    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    const currentTime = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;

    currentTimeLabel.textContent = formatTime(currentTime);
    durationLabel.textContent = formatTime(duration);
    progress.max = String(duration);
    progress.value = String(currentTime);
    progress.style.setProperty(
        "--progress",
        duration > 0 ? `${(currentTime / duration) * 100}%` : "0%"
    );
}

loadButton.addEventListener("click", () => fileInput.click());

// Carrega um arquivo local e libera a URL anterior para evitar vazamentos.
fileInput.addEventListener("change", () => {
    const [file] = fileInput.files;
    if (!file) {
        return;
    }

    audio.pause();
    const previousAudioUrl = audioUrl;
    audioUrl = URL.createObjectURL(file);
    audio.src = audioUrl;
    audio.load();
    if (previousAudioUrl) {
        URL.revokeObjectURL(previousAudioUrl);
    }
    title.textContent = file.name.replace(/\.[^.]+$/, "");
    artist.textContent = "Arquivo local";
    status.textContent = "";
    playButton.disabled = true;
    progress.disabled = true;
    currentTimeLabel.textContent = "0:00";
    durationLabel.textContent = "0:00";
    progress.value = "0";
    progress.max = "0";
    progress.style.setProperty("--progress", "0%");
    setPlaybackState(false);
});

// Habilita os controles assim que os metadados revelam a duração da faixa.
audio.addEventListener("loadedmetadata", () => {
    if (!Number.isFinite(audio.duration)) {
        status.textContent = "Não foi possível ler a duração deste arquivo.";
        return;
    }

    playButton.disabled = false;
    progress.disabled = false;
    updateProgress();
});

audio.addEventListener("timeupdate", updateProgress);
audio.addEventListener("seeked", updateProgress);
audio.addEventListener("play", () => {
    setPlaybackState(true);
    status.textContent = "";
});
audio.addEventListener("pause", () => setPlaybackState(false));
audio.addEventListener("ended", () => {
    setPlaybackState(false);
    updateProgress();
});

// A reprodução depende dos codecs suportados pelo navegador; formatos desconhecidos são informados aqui.
// Exibe um erro compreensível quando o arquivo não pode ser reproduzido.
audio.addEventListener("error", () => {
    playButton.disabled = true;
    progress.disabled = true;
    status.textContent = audio.error?.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED
        ? "Formato não compatível com este navegador. Converta o arquivo para MP3 ou WAV."
        : "Não foi possível carregar este arquivo de áudio.";
});

// Usa os eventos reais do elemento de áudio para reproduzir e pausar.
playButton.addEventListener("click", () => {
    if (audio.paused) {
        audio.play().catch((error) => {
            status.textContent = "O navegador não conseguiu iniciar a reprodução.";
            console.error("Falha ao iniciar a reprodução do áudio.", error);
        });
    } else {
        audio.pause();
    }
});

// Permite buscar uma posição da música arrastando a barra de progresso.
progress.addEventListener("input", () => {
    if (Number.isFinite(audio.duration)) {
        audio.currentTime = Number(progress.value);
        updateProgress();
    }
});

volumeControl.addEventListener("input", updateVolume);

// Alterna entre mudo e o último nível de volume usado.
muteButton.addEventListener("click", () => {
    volumeControl.value = audio.volume === 0 ? String(previousVolume || 0.75) : "0";
    updateVolume();
});

// Libera a URL temporária do arquivo local ao sair da página.
window.addEventListener("beforeunload", () => {
    if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
    }
});

updateVolume();