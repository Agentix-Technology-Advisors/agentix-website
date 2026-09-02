const PORTAL_CONFIG = {
    manifestUrl: "/assets/client-portal-voices.json?v=20260902e",
    passwordHash: "f8fef429942234cca4074f3f329d11f1a29894e343ff7828395afd19a275e1ef",
    sessionKey: "agentix_client_portal_authed",
    attemptsKey: "agentix_client_portal_attempts",
    lockUntilKey: "agentix_client_portal_lock_until",
    maxAttempts: 5,
    cooldownSeconds: 90,
};

const state = {
    voices: [],
    filteredVoices: [],
    manifestVersion: "",
};

const voiceNameCollator = new Intl.Collator("en", { sensitivity: "base", numeric: true });

const authCard = document.querySelector("#portal-auth-card");
const portalContent = document.querySelector("#portal-content");
const loginForm = document.querySelector("#portal-login-form");
const passwordInput = document.querySelector("#portal-password");
const passwordToggle = document.querySelector("#portal-password-toggle");
const unlockButton = document.querySelector("#portal-unlock-button");
const capsWarning = document.querySelector("#portal-caps-warning");
const loginStatus = document.querySelector("#portal-login-status");

const providerSelect = document.querySelector("#voice-provider");
const genderSelect = document.querySelector("#voice-gender");
const accentSelect = document.querySelector("#voice-accent");
const languageSelect = document.querySelector("#voice-language");
const styleSelect = document.querySelector("#voice-style");
const voiceList = document.querySelector("#portal-voice-list");
const resultCount = document.querySelector("#portal-result-count");

let activeAudio = null;
let activePlayButton = null;
let selectedVoiceKey = "";
let manifestLoaded = false;
let lockCountdownTimer = null;

function stopActiveAudio() {
    if (!activeAudio) {
        return;
    }
    activeAudio.pause();
    activeAudio.currentTime = 0;
    activeAudio = null;
    if (activePlayButton) {
        activePlayButton.textContent = "▶";
        activePlayButton.classList.remove("is-playing");
        activePlayButton.setAttribute("aria-pressed", "false");
        activePlayButton = null;
    }
}

function setSelectedVoice(key) {
    selectedVoiceKey = key;
    document.querySelectorAll(".portal-voice-row").forEach((row) => {
        const isSelected = row.getAttribute("data-voice-key") === key;
        row.classList.toggle("is-selected", isSelected);
    });
}

function nowMs() {
    return Date.now();
}

function getAttemptCount() {
    return Number(localStorage.getItem(PORTAL_CONFIG.attemptsKey) || 0);
}

function setAttemptCount(value) {
    localStorage.setItem(PORTAL_CONFIG.attemptsKey, String(value));
}

function clearAttemptCount() {
    localStorage.removeItem(PORTAL_CONFIG.attemptsKey);
}

function getLockUntilMs() {
    return Number(localStorage.getItem(PORTAL_CONFIG.lockUntilKey) || 0);
}

function setLockUntilMs(value) {
    localStorage.setItem(PORTAL_CONFIG.lockUntilKey, String(value));
}

function clearLockUntilMs() {
    localStorage.removeItem(PORTAL_CONFIG.lockUntilKey);
}

function isLocked() {
    return getLockUntilMs() > nowMs();
}

function formatSeconds(seconds) {
    return `${Math.max(0, Math.ceil(seconds))}s`;
}

function setLoginMessage(message, isError = false) {
    if (!loginStatus) {
        return;
    }
    loginStatus.textContent = message;
    loginStatus.classList.toggle("is-error", isError);
    loginStatus.setAttribute("role", isError ? "alert" : "status");
    loginStatus.setAttribute("aria-live", isError ? "assertive" : "polite");
}

function setPasswordVisibility(isVisible) {
    if (!passwordInput || !passwordToggle) {
        return;
    }

    passwordInput.type = isVisible ? "text" : "password";
    passwordToggle.textContent = isVisible ? "Hide" : "Show";
    passwordToggle.setAttribute("aria-pressed", String(isVisible));
    passwordToggle.setAttribute("aria-label", isVisible ? "Hide password" : "Show password");
}

function setCapsLockWarning(isVisible) {
    if (!capsWarning) {
        return;
    }
    capsWarning.hidden = !isVisible;
}

function setLoginBusy(isBusy) {
    if (unlockButton) {
        unlockButton.disabled = isBusy;
        unlockButton.textContent = isBusy ? "Unlocking..." : "Unlock portal";
    }

    if (passwordInput) {
        passwordInput.disabled = isBusy;
    }

    if (passwordToggle) {
        passwordToggle.disabled = isBusy;
    }

    if (loginForm) {
        loginForm.setAttribute("aria-busy", String(isBusy));
    }
}

function setLoginLockedState(isFormLocked) {
    if (passwordInput) {
        passwordInput.disabled = isFormLocked;
    }

    if (passwordToggle) {
        passwordToggle.disabled = isFormLocked;
    }

    if (unlockButton) {
        unlockButton.disabled = isFormLocked;
        if (!isFormLocked) {
            unlockButton.textContent = "Unlock portal";
        }
    }
}

function lockPortal() {
    sessionStorage.removeItem(PORTAL_CONFIG.sessionKey);
    stopActiveAudio();
    if (lockCountdownTimer) {
        window.clearTimeout(lockCountdownTimer);
        lockCountdownTimer = null;
    }
    if (portalContent) {
        portalContent.hidden = true;
    }
    if (authCard) {
        authCard.hidden = false;
    }
    if (passwordInput) {
        passwordInput.value = "";
        passwordInput.focus();
    }
    setPasswordVisibility(false);
    setCapsLockWarning(false);
    setLoginBusy(false);

    if (voiceList) {
        voiceList.innerHTML = "";
    }

    if (resultCount) {
        resultCount.textContent = "Unlock portal to load voice library.";
    }
}

function unlockPortal() {
    clearAttemptCount();
    clearLockUntilMs();
    if (lockCountdownTimer) {
        window.clearTimeout(lockCountdownTimer);
        lockCountdownTimer = null;
    }
    if (authCard) {
        authCard.hidden = true;
    }
    if (portalContent) {
        portalContent.hidden = false;
    }
    setLoginMessage("");
    setCapsLockWarning(false);

    if (manifestLoaded) {
        applyFilters();
    } else {
        ensureManifestLoaded();
    }
}

function ensureManifestLoaded() {
    if (manifestLoaded) {
        return;
    }
    manifestLoaded = true;
    loadManifest();
}

async function sha256Hex(input) {
    const bytes = new TextEncoder().encode(input);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
}

function initialsFromName(name) {
    const source = (name || "Voice").trim();
    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length === 0) {
        return "V";
    }
    return parts
        .slice(0, 2)
        .map((part) => part[0].toUpperCase())
        .join("");
}

function resolveTags(voice) {
    const tags = [voice.ttsProvider, voice.gender, voice.accent, voice.style, voice.language]
        .filter((value) => typeof value === "string" && value.trim().length > 0)
        .map((value) => value.trim());

    if (tags.length > 0) {
        return tags.slice(0, 4);
    }

    return [
        voice.ttsProvider || "Provider",
        voice.language || "Language",
    ];
}

function buildAvatar(voice) {
    const avatar = document.createElement("div");
    avatar.className = "portal-avatar";

    if (typeof voice.avatarUrl === "string" && voice.avatarUrl.trim()) {
        const image = document.createElement("img");
        image.className = "portal-avatar-image";
        image.src = voice.avatarUrl;
        image.alt = "";
        avatar.append(image);
        return avatar;
    }

    const fallback = document.createElement("span");
    fallback.className = "portal-avatar-fallback";
    fallback.textContent = initialsFromName(voice.voiceName);
    avatar.append(fallback);
    return avatar;
}

function buildVoiceRow(voice) {
    const row = document.createElement("li");
    row.className = "portal-voice-row";
    const voiceKey = String(voice.voiceId || voice.voiceName || Math.random());
    const hasSampleFile = typeof voice.file === "string" && voice.file.trim().length > 0;
    const sampleUrl = hasSampleFile ? buildSampleUrl(voice.file) : "";
    row.setAttribute("data-voice-key", voiceKey);

    const controls = document.createElement("div");
    controls.className = "portal-voice-controls";

    const playButton = document.createElement("button");
    playButton.type = "button";
    playButton.className = "portal-play-toggle";
    playButton.textContent = "▶";
    playButton.setAttribute("aria-label", `Play sample for ${voice.voiceName || "voice"}`);
    playButton.setAttribute("aria-pressed", "false");
    if (!hasSampleFile) {
        playButton.disabled = true;
        playButton.classList.add("is-disabled");
        playButton.setAttribute("aria-label", `Sample unavailable for ${voice.voiceName || "voice"}`);
    }

    const audio = document.createElement("audio");
    audio.className = "portal-row-audio";
    audio.controls = false;
    audio.preload = "none";
    audio.src = sampleUrl;
    audio.setAttribute("aria-label", `Audio preview for ${voice.voiceName || "voice"}`);
    audio.addEventListener("ended", () => {
        if (activeAudio === audio) {
            activeAudio = null;
        }
        if (activePlayButton === playButton) {
            activePlayButton = null;
        }
        playButton.textContent = "▶";
        playButton.classList.remove("is-playing");
        playButton.setAttribute("aria-pressed", "false");
    });

    playButton.addEventListener("click", () => {
        if (!audio.src) {
            return;
        }

        setSelectedVoice(voiceKey);

        if (activeAudio === audio && !audio.paused) {
            audio.pause();
            playButton.textContent = "▶";
            playButton.classList.remove("is-playing");
            playButton.setAttribute("aria-pressed", "false");
            activeAudio = null;
            activePlayButton = null;
            return;
        }

        stopActiveAudio();
        audio
            .play()
            .then(() => {
                activeAudio = audio;
                activePlayButton = playButton;
                playButton.textContent = "❚❚";
                playButton.classList.add("is-playing");
                playButton.setAttribute("aria-pressed", "true");
            })
            .catch(() => {
                playButton.textContent = "▶";
                playButton.classList.remove("is-playing");
                playButton.setAttribute("aria-pressed", "false");
            });
    });

    controls.append(playButton);

    const identity = document.createElement("div");
    identity.className = "portal-voice-identity";
    identity.append(buildAvatar(voice));
    const heading = document.createElement("h3");
    heading.className = "portal-voice-name";
    heading.textContent = voice.voiceName || "Unnamed voice";
    identity.append(heading);

    const tags = document.createElement("div");
    tags.className = "portal-voice-tags";
    resolveTags(voice).forEach((tagValue) => {
        const tag = document.createElement("span");
        tag.className = "portal-tag";
        tag.textContent = tagValue;
        tags.append(tag);
    });

    const download = document.createElement("a");
    download.className = "portal-download";
    if (hasSampleFile) {
        download.href = sampleUrl;
        download.download = "";
        download.textContent = "Download";
    } else {
        download.href = "#";
        download.textContent = "No sample";
        download.classList.add("is-disabled");
        download.setAttribute("aria-disabled", "true");
        download.addEventListener("click", (event) => {
            event.preventDefault();
        });
    }

    row.append(controls, identity, tags, download, audio);
    return row;
}

function compareVoices(left, right) {
    const nameCompare = voiceNameCollator.compare(left.voiceName || "", right.voiceName || "");
    if (nameCompare !== 0) {
        return nameCompare;
    }

    const accentCompare = voiceNameCollator.compare(left.accent || "", right.accent || "");
    if (accentCompare !== 0) {
        return accentCompare;
    }

    const genderCompare = voiceNameCollator.compare(left.gender || "", right.gender || "");
    if (genderCompare !== 0) {
        return genderCompare;
    }

    return voiceNameCollator.compare(left.ttsProvider || "", right.ttsProvider || "");
}

function buildSampleUrl(filePath) {
    const version = (state.manifestVersion || "").trim();
    if (!version) {
        return filePath;
    }

    const joiner = filePath.includes("?") ? "&" : "?";
    return `${filePath}${joiner}v=${encodeURIComponent(version)}`;
}

function listUniqueValues(values) {
    return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function populateFilterOptions(voices) {
    if (!providerSelect || !genderSelect || !accentSelect || !languageSelect || !styleSelect) {
        return;
    }

    providerSelect.innerHTML = "<option value=\"all\">All providers</option>";
    genderSelect.innerHTML = "<option value=\"all\">All genders</option>";
    accentSelect.innerHTML = "<option value=\"all\">All accents</option>";
    languageSelect.innerHTML = "<option value=\"all\">All languages</option>";
    styleSelect.innerHTML = "<option value=\"all\">All styles</option>";

    const providers = listUniqueValues(voices.map((voice) => voice.ttsProvider));
    const genders = listUniqueValues(voices.map((voice) => voice.gender));
    const accents = listUniqueValues(voices.map((voice) => voice.accent));
    const languages = listUniqueValues(voices.map((voice) => voice.language));
    const styles = listUniqueValues(voices.map((voice) => voice.style));

    providers.forEach((provider) => {
        const option = document.createElement("option");
        option.value = provider;
        option.textContent = provider;
        providerSelect.append(option);
    });

    genders.forEach((gender) => {
        const option = document.createElement("option");
        option.value = gender;
        option.textContent = gender;
        genderSelect.append(option);
    });

    accents.forEach((accent) => {
        const option = document.createElement("option");
        option.value = accent;
        option.textContent = accent;
        accentSelect.append(option);
    });

    languages.forEach((language) => {
        const option = document.createElement("option");
        option.value = language;
        option.textContent = language;
        languageSelect.append(option);
    });

    styles.forEach((style) => {
        const option = document.createElement("option");
        option.value = style;
        option.textContent = style;
        styleSelect.append(option);
    });
}

function voiceMatches(voice, provider, gender, accent, language, style) {
    if (provider !== "all" && voice.ttsProvider !== provider) {
        return false;
    }

    if (gender !== "all" && voice.gender !== gender) {
        return false;
    }

    if (accent !== "all" && voice.accent !== accent) {
        return false;
    }

    if (language !== "all" && voice.language !== language) {
        return false;
    }

    if (style !== "all" && voice.style !== style) {
        return false;
    }

    return true;
}

function applyFilters() {
    if (!voiceList || !resultCount) {
        return;
    }

    const provider = providerSelect?.value || "all";
    const gender = genderSelect?.value || "all";
    const accent = accentSelect?.value || "all";
    const language = languageSelect?.value || "all";
    const style = styleSelect?.value || "all";

    stopActiveAudio();
    state.filteredVoices = state.voices.filter((voice) =>
        voiceMatches(voice, provider, gender, accent, language, style),
    );
    state.filteredVoices.sort(compareVoices);

    if (!state.filteredVoices.some((voice) => String(voice.voiceId || voice.voiceName || "") === selectedVoiceKey)) {
        selectedVoiceKey = "";
    }

    voiceList.innerHTML = "";

    if (state.filteredVoices.length === 0) {
        const empty = document.createElement("li");
        empty.className = "portal-empty-state";
        empty.textContent = "No voices match your filters yet.";
        voiceList.append(empty);
    } else {
        state.filteredVoices.forEach((voice) => {
            voiceList.append(buildVoiceRow(voice));
        });

        if (selectedVoiceKey) {
            setSelectedVoice(selectedVoiceKey);
        }
    }

    resultCount.textContent = `${state.filteredVoices.length} voice${state.filteredVoices.length === 1 ? "" : "s"} shown`;
}

async function loadManifest() {
    if (!voiceList || !resultCount) {
        return;
    }

    try {
        const response = await fetch(PORTAL_CONFIG.manifestUrl, { cache: "no-store" });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const payload = await response.json();
        const voices = Array.isArray(payload.voices) ? payload.voices : [];
        state.voices = voices.filter(
            (voice) =>
                voice &&
                typeof voice === "object" &&
                typeof voice.voiceName === "string" &&
                voice.voiceName.trim().length > 0,
        );
        state.voices.sort(compareVoices);
        state.manifestVersion = typeof payload.generatedAt === "string" ? payload.generatedAt : String(Date.now());
        populateFilterOptions(state.voices);
        applyFilters();
    } catch (error) {
        voiceList.innerHTML = "";
        const message = document.createElement("li");
        message.className = "portal-empty-state";
        message.textContent = "Voice library is not available yet. Please contact Agentix to refresh voice samples.";
        voiceList.append(message);
        resultCount.textContent = "Voice samples unavailable";
        console.error("Failed to load client portal voice manifest", error);
    }
}

function handleLockStateUI() {
    if (lockCountdownTimer) {
        window.clearTimeout(lockCountdownTimer);
        lockCountdownTimer = null;
    }

    if (!isLocked()) {
        setLoginLockedState(false);
        return;
    }

    setLoginLockedState(true);

    const tick = () => {
        const remainingMs = getLockUntilMs() - nowMs();
        if (remainingMs <= 0) {
            setLoginLockedState(false);
            setLoginMessage("You can try again.");
            clearLockUntilMs();
            if (passwordInput) {
                passwordInput.focus();
            }
            return;
        }

        const remaining = formatSeconds(remainingMs / 1000);
        if (unlockButton) {
            unlockButton.textContent = `Locked (${remaining})`;
        }
        setLoginMessage(`Too many attempts. Try again in ${formatSeconds(remainingMs / 1000)}.`, true);
        lockCountdownTimer = window.setTimeout(tick, 500);
    };

    tick();
}

function updateCapsLockState(event) {
    if (typeof event.getModifierState !== "function") {
        return;
    }
    setCapsLockWarning(event.getModifierState("CapsLock"));
}

function wireEvents() {
    loginForm?.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (!passwordInput) {
            return;
        }

        if (isLocked()) {
            handleLockStateUI();
            return;
        }

        const value = passwordInput.value.trim();
        if (!value) {
            setLoginMessage("Enter the shared password.", true);
            passwordInput.focus();
            return;
        }

        setLoginBusy(true);
        const hash = await sha256Hex(value);
        if (hash === PORTAL_CONFIG.passwordHash) {
            setLoginBusy(false);
            unlockPortal();
            return;
        }

        setLoginBusy(false);

        const attempts = getAttemptCount() + 1;
        setAttemptCount(attempts);
        const remainingAttempts = Math.max(0, PORTAL_CONFIG.maxAttempts - attempts);
        if (remainingAttempts > 0) {
            setLoginMessage(
                `Password is incorrect. ${remainingAttempts} attempt${remainingAttempts === 1 ? "" : "s"} remaining before a ${PORTAL_CONFIG.cooldownSeconds}s lockout.`,
                true,
            );
        }

        if (attempts >= PORTAL_CONFIG.maxAttempts) {
            setLockUntilMs(nowMs() + PORTAL_CONFIG.cooldownSeconds * 1000);
            setAttemptCount(0);
            handleLockStateUI();
        }

        passwordInput.focus();
        passwordInput.select();
    });

    passwordToggle?.addEventListener("click", () => {
        if (!passwordInput) {
            return;
        }
        setPasswordVisibility(passwordInput.type === "password");
        passwordInput.focus();
    });

    passwordInput?.addEventListener("keydown", updateCapsLockState);
    passwordInput?.addEventListener("keyup", updateCapsLockState);
    passwordInput?.addEventListener("blur", () => {
        setCapsLockWarning(false);
    });

    providerSelect?.addEventListener("change", applyFilters);
    genderSelect?.addEventListener("change", applyFilters);
    accentSelect?.addEventListener("change", applyFilters);
    languageSelect?.addEventListener("change", applyFilters);
    styleSelect?.addEventListener("change", applyFilters);
}

function initializePortal() {
    wireEvents();
    setPasswordVisibility(false);
    setCapsLockWarning(false);

    // Always require the shared password when the page loads.
    lockPortal();

    handleLockStateUI();
}

initializePortal();
