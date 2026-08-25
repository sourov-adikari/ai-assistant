/* Message actions: copy + audio + generation state */
(() => {
    "use strict";

    const TEXT = {
        en: { copy: "Copy message", copied: "Copied", copyFailed: "Copy failed", audio: "Read aloud", audioStop: "Stop reading" },
        bn: { copy: "বার্তা কপি করুন", copied: "কপি হয়েছে", copyFailed: "কপি করা যায়নি", audio: "বার্তা শুনুন", audioStop: "পড়া বন্ধ করুন" }
    };
    let speakingMessage = null;
    let speakingTimer = null;

    function lang() { return window.currentLang === "bn" || localStorage.getItem("lang") === "bn" || localStorage.getItem("gemini_lang") === "bn" ? "bn" : "en"; }
    function t(key) { return TEXT[lang()][key]; }

    function messageText(message) {
        const content = message?.querySelector(":scope > .content");
        if (!content) return "";
        const clone = content.cloneNode(true);
        clone.querySelectorAll("button, .message-actions, .ai-thinking, .error, .typing-cursor").forEach((node) => node.remove());
        return (clone.innerText || clone.textContent || "").replace(/\u00a0/g, " ").replace(/[ \t]+\n/g, "\n").trim();
    }

    function makeButton(icon, title) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "message-action-btn";
        button.title = title;
        button.setAttribute("aria-label", title);
        button.innerHTML = `<i class="fas ${icon}" aria-hidden="true"></i>`;
        return button;
    }

    async function copyMessage(value, button) {
        if (!value) return;
        if (typeof window.copyTextToClipboard !== "function") {
            window.showNotification?.(t("copyFailed"), "error");
            return;
        }
        if (!await window.copyTextToClipboard(value)) return;
        button.innerHTML = '<i class="fas fa-check" aria-hidden="true"></i>';
        button.classList.add("copied");
        button.title = t("copied");
        button.setAttribute("aria-label", t("copied"));
        window.setTimeout(() => {
            if (!button.isConnected) return;
            button.innerHTML = '<i class="fas fa-copy" aria-hidden="true"></i>';
            button.classList.remove("copied");
            button.title = t("copy");
            button.setAttribute("aria-label", t("copy"));
        }, 1400);
    }

    function resetAudioButtons() {
        document.querySelectorAll(".message-actions .response-audio-btn").forEach((button) => {
            button.innerHTML = '<i class="fas fa-volume-up" aria-hidden="true"></i>';
            button.classList.remove("speaking");
            button.title = t("audio");
            button.setAttribute("aria-label", t("audio"));
        });
    }

    function stopSpeaking() {
        if (speakingTimer) { clearTimeout(speakingTimer); speakingTimer = null; }
        if ("speechSynthesis" in window) window.speechSynthesis.cancel();
        speakingMessage = null;
        resetAudioButtons();
    }

    function addAudioHandler(button, message) {
        button.addEventListener("click", () => {
            const value = messageText(message);
            if (!value || typeof window.speak !== "function") return;
            if (speakingMessage === message) { stopSpeaking(); return; }
            stopSpeaking();
            speakingMessage = message;
            button.innerHTML = '<i class="fas fa-stop" aria-hidden="true"></i>';
            button.classList.add("speaking");
            button.title = t("audioStop");
            button.setAttribute("aria-label", t("audioStop"));
            try { window.speak(value); }
            catch (error) { console.error("TTS failed:", error); stopSpeaking(); return; }
            speakingTimer = setTimeout(() => { if (speakingMessage === message) stopSpeaking(); }, Math.max(3000, Math.min(value.length * 65, 120000)));
        });
    }

    function buildActions(message) {
        if (!message?.classList.contains("message")) return;
        const content = message.querySelector(":scope > .content");
        if (!content || message.querySelector(":scope > .message-actions")) return;
        message.querySelectorAll(":scope > .tts-btn").forEach((button) => button.remove());
        if (!message.hasAttribute("tabindex")) message.tabIndex = 0;
        if (!messageText(message)) return;

        const actions = document.createElement("div");
        actions.className = "message-actions";
        const copyButton = makeButton("fa-copy", t("copy"));
        copyButton.classList.add("response-copy-btn");
        copyButton.addEventListener("click", () => copyMessage(messageText(message), copyButton));
        const audioButton = makeButton("fa-volume-up", t("audio"));
        audioButton.classList.add("response-audio-btn");
        addAudioHandler(audioButton, message);
        actions.append(copyButton, audioButton);
        message.appendChild(actions);
    }

    function activeGenerating(message) {
        const stop = document.getElementById("stop-btn");
        const models = document.querySelectorAll("#messages .message.model");
        const last = models.length ? models[models.length - 1] : null;
        return Boolean(stop && !stop.classList.contains("hidden") && last === message);
    }

    function updateModel(message) {
        if (!message.classList.contains("model")) return;
        const content = message.querySelector(":scope > .content");
        if (!content) return;
        const value = messageText(message);
        const hasError = Boolean(content.querySelector(".error"));
        const generating = activeGenerating(message);
        const complete = message.dataset.generationComplete === "true" || !generating;

        if (!value && !hasError && generating && !complete) {
            message.classList.add("is-thinking");
            if (!content.querySelector(":scope > .ai-thinking")) {
                const dots = document.createElement("div");
                dots.className = "ai-thinking";
                dots.setAttribute("aria-label", "AI is thinking");
                dots.innerHTML = "<span></span><span></span><span></span>";
                content.appendChild(dots);
            }
            return;
        }

        content.querySelector(":scope > .ai-thinking")?.remove();
        message.classList.remove("is-thinking");
        if (hasError) {
            message.classList.remove("is-typing", "response-actions-ready");
            message.querySelector(":scope > .message-actions")?.remove();
            return;
        }
        if (complete) {
            message.dataset.generationComplete = "true";
            message.classList.remove("is-typing");
            message.classList.add("response-actions-ready");
            buildActions(message);
        } else {
            message.classList.add("is-typing");
        }
    }

    function finishModelResponse(message) {
        if (!message?.classList.contains("model")) return;
        message.dataset.generationComplete = "true";
        message.classList.remove("is-thinking", "is-typing");
        message.querySelector(":scope > .content > .ai-thinking")?.remove();
        if (!message.querySelector(".error") && messageText(message)) {
            message.classList.add("response-actions-ready");
            buildActions(message);
        }
    }

    function scan() {
        document.querySelectorAll("#messages .message").forEach((message) => {
            if (message.classList.contains("model")) updateModel(message);
            else if (message.classList.contains("user")) buildActions(message);
        });
    }

    function install() {
        const messages = document.getElementById("messages");
        if (!messages) return;
        scan();
        if (!messages.__messageActionsObserver) {
            const observer = new MutationObserver(() => requestAnimationFrame(scan));
            observer.observe(messages, { childList: true, subtree: true });
            messages.__messageActionsObserver = observer;
        }

        const stopButton = document.getElementById("stop-btn");
        if (stopButton && !stopButton.__messageActionCompletionObserver) {
            const observer = new MutationObserver(() => {
                if (!stopButton.classList.contains("hidden")) return;
                const models = document.querySelectorAll("#messages .message.model");
                const last = models.length ? models[models.length - 1] : null;
                if (last) finishModelResponse(last);
                scan();
            });
            observer.observe(stopButton, { attributes: true, attributeFilter: ["class"] });
            stopButton.__messageActionCompletionObserver = observer;
        }
    }

    window.geminiUI = window.geminiUI || {};
    window.geminiUI.finishModelResponse = finishModelResponse;
    window.geminiUI.buildMessageActions = buildActions;
    document.addEventListener("DOMContentLoaded", install, { once: true });
    window.addEventListener("beforeunload", stopSpeaking);
})();