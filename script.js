const body = document.body;
const heroVideoFrame = document.getElementById("hero-video-frame");
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
const siteTitlePhrases = [
    { text: "welcome to my website", lang: "en" },
    { text: "مرحبا بكم في موقعي", lang: "ar" },
    { text: "bienvenue sur mon site", lang: "fr" },
    { text: "web siteme hoş geldiniz", lang: "tr" },
    { text: "私のウェブサイトへようこそ", lang: "ja" },
    { text: "欢迎来到我的网站", lang: "zh-Hans" },
    { text: "내 웹사이트에 오신 것을 환영합니다", lang: "ko" }
];
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
let siteTitlePhraseIndex = 0;
let siteTitleCharacterIndex = 0;
let isDeletingSiteTitle = false;
let heroTitleResizeTimer = null;
let backgroundAudioEnabled = false;
let vimeoPlayer = null;
let lastNowPlayingLevels = [0.34, 0.74, 0.5];
let soundToggleBusy = false;

const statusMessages = {
    unavailable: "The background video is unavailable right now. Check the Vimeo embed URL.",
    fullscreenBlocked: "Fullscreen was blocked by the browser. The site still works normally."
};

function setStatus(message, tone = "info") {
    void message;
    void tone;
}

function withTimeout(promise, timeoutMs = 1500) {
    return Promise.race([
        promise,
        new Promise((_, reject) => {
            window.setTimeout(() => {
                reject(new Error("Vimeo request timed out."));
            }, timeoutMs);
        })
    ]);
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
    soundToggle.setAttribute("aria-busy", String(soundToggleBusy));
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
    soundToggleBusy = false;
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

function setIdleNowPlayingBars() {
    setNowPlayingMode("idle");
    setNowPlayingBarLevels([0.34, 0.74, 0.5]);
}

function setMutedNowPlayingBars() {
    setNowPlayingMode("muted");
    setNowPlayingBarLevels([0.18, 0.18, 0.18]);
}

function setFallbackNowPlayingBars() {
    if (reducedMotionQuery.matches || !backgroundAudioEnabled || !hasPlayableVideo) {
        setMutedNowPlayingBars();
        return;
    }

    setNowPlayingMode("fallback");
}

function applyUiFromMutedState(isMuted) {
    backgroundAudioEnabled = !isMuted;
    setSoundButtonState(backgroundAudioEnabled);

    if (backgroundAudioEnabled) {
        setFallbackNowPlayingBars();
        return;
    }

    setMutedNowPlayingBars();
}

async function playVimeoBackground() {
    if (!vimeoPlayer) {
        return false;
    }

    try {
        await withTimeout(vimeoPlayer.play());
        return true;
    } catch (error) {
        return false;
    }
}

async function pauseVimeoBackground() {
    if (!vimeoPlayer) {
        return;
    }

    try {
        await withTimeout(vimeoPlayer.pause());
    } catch (error) {
        void error;
    }
}

async function setVimeoMuted(muted) {
    if (!vimeoPlayer) {
        return false;
    }

    try {
        await withTimeout(vimeoPlayer.setMuted(muted));
        return true;
    } catch (error) {
        return false;
    }
}

async function ensureMutedPlayback() {
    const mutedSet = await setVimeoMuted(true);
    const playbackStarted = await playVimeoBackground();
    applyUiFromMutedState(true);
    return mutedSet && playbackStarted;
}

async function ensureAudiblePlayback() {
    const mutedSet = await setVimeoMuted(false);
    applyUiFromMutedState(false);
    return mutedSet;
}

function sliceTypedText(text, length) {
    return Array.from(text).slice(0, length).join("");
}

function applyHeroTitlePhraseMetadata(targetTitle, targetText, phrase) {
    if (!targetTitle || !targetText) {
        return;
    }

    const isRtl = phrase.lang === "ar";
    targetTitle.setAttribute("aria-label", phrase.text);
    targetTitle.dataset.titleLang = phrase.lang;
    targetTitle.dataset.titleDir = isRtl ? "rtl" : "ltr";
    targetText.lang = phrase.lang;
    targetText.dir = isRtl ? "rtl" : "ltr";
    targetText.style.fontSize = phrase.lang === "ko" ? "0.8em" : "";
}

function setHeroTitlePhraseMetadata(phrase) {
    applyHeroTitlePhraseMetadata(siteTitle, siteTitleText, phrase);
}

function syncHeroTitleHeight() {
    if (!siteTitle || !siteTitleText) {
        return;
    }

    const titleWidth = siteTitle.getBoundingClientRect().width;

    if (!titleWidth) {
        return;
    }

    const titleMeasure = siteTitle.cloneNode(true);
    const measureText = titleMeasure.querySelector("#site-title-text");

    if (!measureText) {
        return;
    }

    titleMeasure.removeAttribute("id");
    titleMeasure.classList.remove("hero-title--done");
    titleMeasure.style.position = "absolute";
    titleMeasure.style.visibility = "hidden";
    titleMeasure.style.pointerEvents = "none";
    titleMeasure.style.left = "-9999px";
    titleMeasure.style.top = "0";
    titleMeasure.style.width = `${titleWidth}px`;
    titleMeasure.style.minHeight = "0";
    titleMeasure.style.height = "auto";

    measureText.removeAttribute("id");

    document.body.appendChild(titleMeasure);

    let maxHeight = 0;

    siteTitlePhrases.forEach((phrase) => {
        applyHeroTitlePhraseMetadata(titleMeasure, measureText, phrase);
        measureText.textContent = phrase.text;
        maxHeight = Math.max(maxHeight, Math.ceil(titleMeasure.getBoundingClientRect().height));
    });

    document.body.removeChild(titleMeasure);

    if (maxHeight > 0) {
        siteTitle.style.minHeight = `${maxHeight}px`;
    }
}

function finishHeroTitleTyping() {
    if (!siteTitle || !siteTitleText) {
        return;
    }

    const firstPhrase = siteTitlePhrases[0];
    window.clearTimeout(siteTitleTypingTimer);
    setHeroTitlePhraseMetadata(firstPhrase);
    siteTitle.classList.add("hero-title--done");
    siteTitleText.textContent = firstPhrase.text;
}

function renderHeroTitleLoop() {
    if (!siteTitle || !siteTitleText) {
        return;
    }

    if (reducedMotionQuery.matches) {
        finishHeroTitleTyping();
        return;
    }

    const currentPhrase = siteTitlePhrases[siteTitlePhraseIndex];
    const currentCharacters = Array.from(currentPhrase.text);
    setHeroTitlePhraseMetadata(currentPhrase);

    if (isDeletingSiteTitle) {
        siteTitleCharacterIndex -= 1;
    } else {
        siteTitleCharacterIndex += 1;
    }

    siteTitleText.textContent = sliceTypedText(currentPhrase.text, siteTitleCharacterIndex);

    let delay = isDeletingSiteTitle ? 58 : 104;

    if (!isDeletingSiteTitle && siteTitleCharacterIndex === currentCharacters.length) {
        delay = 1300;
        isDeletingSiteTitle = true;
    } else if (isDeletingSiteTitle && siteTitleCharacterIndex === 0) {
        isDeletingSiteTitle = false;
        siteTitlePhraseIndex = (siteTitlePhraseIndex + 1) % siteTitlePhrases.length;
        delay = 320;
    }

    siteTitleTypingTimer = window.setTimeout(renderHeroTitleLoop, delay);
}

function startHeroTitleTyping() {
    if (!siteTitle || !siteTitleText) {
        return;
    }

    if (reducedMotionQuery.matches) {
        finishHeroTitleTyping();
        return;
    }

    window.clearTimeout(siteTitleTypingTimer);
    siteTitlePhraseIndex = 0;
    siteTitleCharacterIndex = 0;
    isDeletingSiteTitle = false;
    siteTitle.classList.remove("hero-title--done");
    siteTitleText.textContent = "";
    setHeroTitlePhraseMetadata(siteTitlePhrases[0]);
    siteTitleTypingTimer = window.setTimeout(renderHeroTitleLoop, 280);
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

async function applyReducedMotionPreference() {
    if (reducedMotionQuery.matches) {
        finishHeroTitleTyping();
    } else {
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

    if (!hasPlayableVideo || !vimeoPlayer) {
        return;
    }

    if (reducedMotionQuery.matches) {
        backgroundAudioEnabled = false;
        disableSoundButton("Sound Disabled");
        setIdleNowPlayingBars();
        await setVimeoMuted(true);
        await pauseVimeoBackground();
        return;
    }

    const playbackStarted = await playVimeoBackground();
    applyUiFromMutedState(!backgroundAudioEnabled);

    if (!playbackStarted) {
        await ensureMutedPlayback();
        return;
    }
}

function markVideoAvailable() {
    hasPlayableVideo = true;
    body.classList.remove("video-unavailable");
}

function markVideoUnavailable(message) {
    hasPlayableVideo = false;
    backgroundAudioEnabled = false;
    body.classList.add("video-unavailable");
    disableSoundButton("Video Unavailable");
    setIdleNowPlayingBars();
    setStatus(message, "warning");
}

async function setupVimeoPlayer() {
    if (!heroVideoFrame || !window.Vimeo?.Player) {
        markVideoUnavailable(statusMessages.unavailable);
        return;
    }

    vimeoPlayer = new window.Vimeo.Player(heroVideoFrame);

    try {
        await vimeoPlayer.ready();
        markVideoAvailable();
        if (reducedMotionQuery.matches) {
            await applyReducedMotionPreference();
            return;
        }

        await ensureMutedPlayback();
    } catch (error) {
        markVideoUnavailable(statusMessages.unavailable);
        return;
    }

    vimeoPlayer.on("volumechange", (data) => {
        if (typeof data?.muted === "boolean") {
            applyUiFromMutedState(data.muted);
        }
    });

    vimeoPlayer.on("play", () => {
        if (backgroundAudioEnabled && !reducedMotionQuery.matches) {
            setFallbackNowPlayingBars();
            return;
        }

        setMutedNowPlayingBars();
    });

    vimeoPlayer.on("pause", () => {
        if (backgroundAudioEnabled && !reducedMotionQuery.matches) {
            setFallbackNowPlayingBars();
            return;
        }

        setMutedNowPlayingBars();
    });
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
    if (soundToggleBusy || !hasPlayableVideo || reducedMotionQuery.matches || !vimeoPlayer) {
        return;
    }

    const shouldEnableSound = !backgroundAudioEnabled;
    soundToggleBusy = true;
    backgroundAudioEnabled = shouldEnableSound;
    setSoundButtonState(shouldEnableSound);

    if (shouldEnableSound) {
        setFallbackNowPlayingBars();
    } else {
        setIdleNowPlayingBars();
    }

    animateSoundToggle();

    try {
        const success = shouldEnableSound
            ? await ensureAudiblePlayback()
            : await ensureMutedPlayback();

        if (!success) {
            throw new Error("Sound toggle failed.");
        }
    } catch (error) {
        applyUiFromMutedState(!shouldEnableSound);
        setStatus("Your browser blocked audio playback. Click the sound button again after interacting with the page.", "warning");
    } finally {
        soundToggleBusy = false;
        setSoundButtonState(backgroundAudioEnabled);
    }
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
disableSoundButton("Loading Audio");
setMutedNowPlayingBars();
syncHeroTitleHeight();
startHeroTitleTyping();
startTypingLoop();

soundToggle.addEventListener("click", toggleSound);
fullscreenToggle.addEventListener("click", toggleFullscreen);
copyShopCodeButton?.addEventListener("click", copyShopCode);
document.addEventListener("fullscreenchange", syncFullscreenButton);
window.addEventListener("resize", () => {
    window.clearTimeout(heroTitleResizeTimer);
    heroTitleResizeTimer = window.setTimeout(syncHeroTitleHeight, 120);
});

if (typeof reducedMotionQuery.addEventListener === "function") {
    reducedMotionQuery.addEventListener("change", () => {
        void applyReducedMotionPreference();
    });
} else if (typeof reducedMotionQuery.addListener === "function") {
    reducedMotionQuery.addListener(() => {
        void applyReducedMotionPreference();
    });
}

if (window.Vimeo?.Player) {
    void setupVimeoPlayer();
} else {
    window.addEventListener("load", () => {
        void setupVimeoPlayer();
    }, { once: true });
}

if (document.fonts?.ready) {
    document.fonts.ready.then(() => {
        syncHeroTitleHeight();
    }).catch(() => {
        syncHeroTitleHeight();
    });
}
