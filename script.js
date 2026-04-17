const body = document.body;
const heroVideo = document.getElementById("hero-video");
const soundToggle = document.getElementById("sound-toggle");
const soundToggleLabel = soundToggle?.querySelector(".sr-only");
const fullscreenToggle = document.getElementById("fullscreen-toggle");
const fullscreenToggleLabel = fullscreenToggle?.querySelector(".sr-only");
const siteTitle = document.getElementById("site-title");
const siteTitleText = document.getElementById("site-title-text");
const typedName = document.getElementById("typed-name");
const copyShopCodeButton = document.getElementById("copy-shop-code");
const shopCodeFeedback = document.getElementById("shop-code-feedback");
const nowPlayingElement = document.querySelector(".now-playing");
const nowPlayingBars = Array.from(document.querySelectorAll(".now-playing__bars span"));

const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const siteTitleFullText = siteTitle?.dataset.fullText || "";
const nicknames = ["Mo", "Moha", "Nemo", "AlBARQ"];
const fortniteShopCode = "Q1";

let hasPlayableVideo = false;
let typingIndex = 0;
let characterIndex = 0;
let isDeleting = false;
let typingTimer = null;
let copyResetTimer = null;
let soundTogglePulseTimer = null;
let fullscreenTogglePulseTimer = null;
let siteTitleTypingTimer = null;
let siteTitleCharacterIndex = 0;
let siteTitleTypedOnce = false;
let audioContext = null;
let mediaSourceNode = null;
let analyserNode = null;
let analyserData = null;
let audioBarsFrame = null;
let liveAudioBarsReady = false;
let lastNowPlayingLevels = [0.34, 0.74, 0.5];
let initialSoundAttempted = false;

const statusMessages = {
    loading: "Loading background video.",
    unavailable: "The background video is unavailable right now. Check your hosted video URL.",
    fullscreenBlocked: "Fullscreen was blocked by the browser. The site still works normally."
};

function setStatus(message, tone = "info") {
    void message;
    void tone;
}

function clamp(value, minimum, maximum) {
    return Math.min(Math.max(value, minimum), maximum);
}

function setFullscreenButtonUi({ label, pressed, state }) {
    fullscreenToggle.setAttribute("aria-pressed", String(pressed));
    fullscreenToggle.setAttribute("aria-label", label);
    fullscreenToggle.setAttribute("title", label);
    fullscreenToggle.dataset.fullscreenState = state;

    if (fullscreenToggleLabel) {
        fullscreenToggleLabel.textContent = label;
    }
}

function animateFullscreenToggle() {
    fullscreenToggle.classList.remove("fullscreen-toggle--pulse");
    window.clearTimeout(fullscreenTogglePulseTimer);

    void fullscreenToggle.offsetWidth;

    fullscreenToggle.classList.add("fullscreen-toggle--pulse");
    fullscreenTogglePulseTimer = window.setTimeout(() => {
        fullscreenToggle.classList.remove("fullscreen-toggle--pulse");
    }, 450);
}

function syncFullscreenButton() {
    const isFullscreen = Boolean(document.fullscreenElement);
    setFullscreenButtonUi({
        label: isFullscreen ? "Exit fullscreen" : "Enter fullscreen",
        pressed: isFullscreen,
        state: isFullscreen ? "exit" : "enter"
    });
}

function setSoundButtonUi({ label, pressed, disabled, state }) {
    soundToggle.disabled = disabled;
    soundToggle.setAttribute("aria-pressed", String(pressed));
    soundToggle.setAttribute("aria-label", label);
    soundToggle.setAttribute("title", label);
    soundToggle.dataset.soundState = state;

    if (soundToggleLabel) {
        soundToggleLabel.textContent = label;
    }
}

function animateSoundToggle() {
    soundToggle.classList.remove("sound-toggle--pulse");
    window.clearTimeout(soundTogglePulseTimer);

    void soundToggle.offsetWidth;

    soundToggle.classList.add("sound-toggle--pulse");
    soundTogglePulseTimer = window.setTimeout(() => {
        soundToggle.classList.remove("sound-toggle--pulse");
    }, 450);
}

function setSoundButtonState(enabled) {
    setSoundButtonUi({
        label: enabled ? "Mute sound" : "Enable sound",
        pressed: enabled,
        disabled: !hasPlayableVideo || reducedMotionQuery.matches,
        state: enabled ? "on" : "off"
    });
}

function disableSoundButton(label) {
    setSoundButtonUi({
        label,
        pressed: false,
        disabled: true,
        state: label.toLowerCase().includes("loading") ? "loading" : "off"
    });
}

function setNowPlayingMode(mode) {
    if (nowPlayingElement) {
        nowPlayingElement.dataset.barsMode = mode;
    }
}

function setNowPlayingBarLevels(levels) {
    if (!nowPlayingBars.length) {
        return;
    }

    lastNowPlayingLevels = levels.map((level) => Math.min(Math.max(level, 0.18), 1));

    nowPlayingBars.forEach((bar, index) => {
        const nextLevel = lastNowPlayingLevels[index] ?? 0.55;
        bar.style.setProperty("--bar-scale", nextLevel.toFixed(3));
    });
}

function stopAudioBarsLoop() {
    if (audioBarsFrame !== null) {
        window.cancelAnimationFrame(audioBarsFrame);
        audioBarsFrame = null;
    }
}

function setIdleNowPlayingBars() {
    stopAudioBarsLoop();
    setNowPlayingMode("idle");
    setNowPlayingBarLevels([0.34, 0.74, 0.5]);
}

function setFallbackNowPlayingBars() {
    stopAudioBarsLoop();

    if (reducedMotionQuery.matches || heroVideo.muted || !hasPlayableVideo) {
        setIdleNowPlayingBars();
        return;
    }

    setNowPlayingMode("fallback");
}

async function tryInitialSoundPlayback() {
    if (initialSoundAttempted || !hasPlayableVideo || reducedMotionQuery.matches) {
        return;
    }

    initialSoundAttempted = true;
    heroVideo.muted = false;
    heroVideo.defaultMuted = false;
    setSoundButtonState(true);
    await enableReactiveAudioBars();

    try {
        await heroVideo.play();
    } catch (error) {
        heroVideo.muted = true;
        heroVideo.defaultMuted = true;
        setSoundButtonState(false);
        setIdleNowPlayingBars();

        heroVideo.play().catch(() => {
            setStatus(statusMessages.loading, "info");
        });
    }
}

function canUseLiveAudioAnalysis() {
    const currentSource = heroVideo.currentSrc || heroVideo.getAttribute("src") || "";

    if (!currentSource) {
        return false;
    }

    try {
        return new URL(currentSource, window.location.href).origin === window.location.origin;
    } catch (error) {
        return false;
    }
}

function sampleFrequencyBand(startIndex, endIndex) {
    if (!analyserData) {
        return 0;
    }

    const safeEnd = Math.min(endIndex, analyserData.length);

    if (startIndex >= safeEnd) {
        return 0;
    }

    let sum = 0;
    let peak = 0;

    for (let index = startIndex; index < safeEnd; index += 1) {
        const value = analyserData[index] / 255;
        sum += value;
        peak = Math.max(peak, value);
    }

    const average = sum / (safeEnd - startIndex);
    return Math.min(1, average * 0.78 + peak * 0.5);
}

function updateReactiveAudioBars() {
    if (!analyserNode || !analyserData || reducedMotionQuery.matches || heroVideo.muted || heroVideo.paused) {
        setIdleNowPlayingBars();
        return;
    }

    analyserNode.getByteFrequencyData(analyserData);

    const nextLevels = [
        0.18 + sampleFrequencyBand(0, 5) * 0.82,
        0.18 + sampleFrequencyBand(5, 14) * 0.82,
        0.18 + sampleFrequencyBand(14, 28) * 0.82
    ];

    const easedLevels = lastNowPlayingLevels.map((currentLevel, index) => {
        const nextLevel = nextLevels[index] ?? currentLevel;
        return currentLevel + (nextLevel - currentLevel) * 0.35;
    });

    setNowPlayingMode("reactive");
    setNowPlayingBarLevels(easedLevels);
    audioBarsFrame = window.requestAnimationFrame(updateReactiveAudioBars);
}

function startReactiveAudioBars() {
    if (reducedMotionQuery.matches || heroVideo.muted || !hasPlayableVideo) {
        setIdleNowPlayingBars();
        return;
    }

    if (!liveAudioBarsReady) {
        setFallbackNowPlayingBars();
        return;
    }

    stopAudioBarsLoop();
    updateReactiveAudioBars();
}

async function enableReactiveAudioBars() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass || !canUseLiveAudioAnalysis()) {
        liveAudioBarsReady = false;
        setFallbackNowPlayingBars();
        return false;
    }

    try {
        if (!audioContext) {
            audioContext = new AudioContextClass();
        }

        if (!mediaSourceNode) {
            mediaSourceNode = audioContext.createMediaElementSource(heroVideo);
            analyserNode = audioContext.createAnalyser();
            analyserNode.fftSize = 128;
            analyserNode.smoothingTimeConstant = 0.84;
            analyserData = new Uint8Array(analyserNode.frequencyBinCount);

            // Route the background video's audio through the analyser so the bars can react live.
            mediaSourceNode.connect(analyserNode);
            analyserNode.connect(audioContext.destination);
        }

        if (audioContext.state !== "running") {
            await audioContext.resume();
        }

        liveAudioBarsReady = true;
        startReactiveAudioBars();
        return true;
    } catch (error) {
        liveAudioBarsReady = false;
        setFallbackNowPlayingBars();
        return false;
    }
}

function finishHeroTitleTyping() {
    if (!siteTitle || !siteTitleText) {
        return;
    }

    window.clearTimeout(siteTitleTypingTimer);
    siteTitleText.textContent = siteTitleFullText;
    siteTitle.classList.add("hero-title--done");
    siteTitleTypedOnce = true;
}

function typeHeroTitleOnce() {
    if (!siteTitle || !siteTitleText) {
        return;
    }

    if (reducedMotionQuery.matches) {
        finishHeroTitleTyping();
        return;
    }

    siteTitleCharacterIndex += 1;
    siteTitleText.textContent = siteTitleFullText.slice(0, siteTitleCharacterIndex);

    if (siteTitleCharacterIndex < siteTitleFullText.length) {
        const delay = siteTitleCharacterIndex < 4 ? 92 : 58;
        siteTitleTypingTimer = window.setTimeout(typeHeroTitleOnce, delay);
        return;
    }

    finishHeroTitleTyping();
}

function startHeroTitleTyping() {
    if (!siteTitle || !siteTitleText || !siteTitleFullText) {
        return;
    }

    if (siteTitleTypedOnce || reducedMotionQuery.matches) {
        finishHeroTitleTyping();
        return;
    }

    window.clearTimeout(siteTitleTypingTimer);
    siteTitleCharacterIndex = 0;
    siteTitleText.textContent = "";
    siteTitle.classList.remove("hero-title--done");
    siteTitleTypingTimer = window.setTimeout(typeHeroTitleOnce, 260);
}

function renderTypingName() {
    if (!typedName) {
        return;
    }

    if (reducedMotionQuery.matches) {
        typedName.textContent = nicknames[0];
        return;
    }

    const currentName = nicknames[typingIndex];

    if (isDeleting) {
        characterIndex -= 1;
    } else {
        characterIndex += 1;
    }

    typedName.textContent = currentName.slice(0, characterIndex);

    let delay = isDeleting ? 85 : 140;

    if (!isDeleting && characterIndex === currentName.length) {
        delay = 1100;
        isDeleting = true;
    } else if (isDeleting && characterIndex === 0) {
        isDeleting = false;
        typingIndex = (typingIndex + 1) % nicknames.length;
        delay = 280;
    }

    typingTimer = window.setTimeout(renderTypingName, delay);
}

function startTypingLoop() {
    if (!typedName) {
        return;
    }

    window.clearTimeout(typingTimer);
    typingIndex = 0;
    characterIndex = 0;
    isDeleting = false;
    typedName.textContent = "";
    renderTypingName();
}

function applyReducedMotionPreference() {
    if (reducedMotionQuery.matches) {
        finishHeroTitleTyping();
    } else if (!siteTitleTypedOnce) {
        startHeroTitleTyping();
    }

    if (reducedMotionQuery.matches) {
        if (typedName) {
            window.clearTimeout(typingTimer);
            typedName.textContent = nicknames[0];
        }
    } else {
        startTypingLoop();
    }

    if (!hasPlayableVideo) {
        return;
    }

    if (reducedMotionQuery.matches) {
        heroVideo.pause();
        heroVideo.muted = true;
        heroVideo.defaultMuted = true;
        heroVideo.currentTime = 0;
        disableSoundButton("Sound Disabled");
        setIdleNowPlayingBars();
        return;
    }

    void tryInitialSoundPlayback();
}

function markVideoAvailable() {
    hasPlayableVideo = true;
    body.classList.remove("video-unavailable");
    applyReducedMotionPreference();
}

function markVideoUnavailable(message) {
    hasPlayableVideo = false;
    body.classList.add("video-unavailable");
    heroVideo.pause();
    disableSoundButton("Video Unavailable");
    setIdleNowPlayingBars();
    setStatus(message, "warning");
}

function handleVideoError() {
    markVideoUnavailable(statusMessages.unavailable);
}

async function attemptFullscreen() {
    const target = document.documentElement;

    if (!target.requestFullscreen || document.fullscreenElement) {
        return;
    }

    try {
        await target.requestFullscreen();
    } catch (error) {
        setStatus(statusMessages.fullscreenBlocked, "warning");
    }
}

async function toggleFullscreen() {
    animateFullscreenToggle();

    if (document.fullscreenElement) {
        try {
            await document.exitFullscreen();
        } catch (error) {
            setStatus(statusMessages.fullscreenBlocked, "warning");
        }
        return;
    }

    await attemptFullscreen();
}

async function toggleSound() {
    if (!hasPlayableVideo || reducedMotionQuery.matches) {
        return;
    }

    const shouldEnableSound = heroVideo.muted;
    heroVideo.muted = !shouldEnableSound;
    setSoundButtonState(shouldEnableSound);
    animateSoundToggle();

    if (shouldEnableSound) {
        await enableReactiveAudioBars();
    } else {
        setIdleNowPlayingBars();
    }

    heroVideo.play().catch(() => {
        setIdleNowPlayingBars();
        setStatus("Your browser blocked audio playback. Click the sound button again after interacting with the page.", "warning");
    });
}

async function copyShopCode() {
    if (!copyShopCodeButton) {
        return;
    }

    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(fortniteShopCode);
        } else {
            throw new Error("Clipboard API unavailable");
        }

        copyShopCodeButton.textContent = "Copied Q1";

        if (shopCodeFeedback) {
            shopCodeFeedback.textContent = "Creator code Q1 copied.";
        }
    } catch (error) {
        copyShopCodeButton.textContent = "Use Q1";

        if (shopCodeFeedback) {
            shopCodeFeedback.textContent = "Copy failed. Just type Q1 manually in the Fortnite Item Shop.";
        }
    }

    window.clearTimeout(copyResetTimer);
    copyResetTimer = window.setTimeout(() => {
        copyShopCodeButton.textContent = "Copy Code";

        if (shopCodeFeedback) {
            shopCodeFeedback.textContent = "";
        }
    }, 1800);
}

syncFullscreenButton();
setStatus(statusMessages.loading, "info");
disableSoundButton("Loading Audio");
setIdleNowPlayingBars();
startHeroTitleTyping();
startTypingLoop();

soundToggle.addEventListener("click", toggleSound);
fullscreenToggle.addEventListener("click", toggleFullscreen);
copyShopCodeButton?.addEventListener("click", copyShopCode);
document.addEventListener("fullscreenchange", syncFullscreenButton);
heroVideo.addEventListener("loadeddata", markVideoAvailable);
heroVideo.addEventListener("error", handleVideoError);

if (typeof reducedMotionQuery.addEventListener === "function") {
    reducedMotionQuery.addEventListener("change", applyReducedMotionPreference);
} else if (typeof reducedMotionQuery.addListener === "function") {
    reducedMotionQuery.addListener(applyReducedMotionPreference);
}

if (heroVideo.readyState >= 2) {
    markVideoAvailable();
} else {
    heroVideo.load();
}

heroVideo.play().catch(() => {
    setStatus(statusMessages.loading, "info");
});
