const DISCLAIMER_KEY = "gemini_disclaimer_seen_v5";
const MODEL_STORAGE_KEY = "gemini_selected_model";

type Language = "en" | "bn";

const TEXT: Record<Language, Record<string, string>> = {
    en: {
        title: "Before you continue",
        introPrefix: "A personal AI assistant by ",
        introSuffix: ", powered by Google Gemini.",
        warning: "AI responses can be inaccurate. Verify important information before relying on it.",
        model: "Choose a model",
        flash: "Flash — fast everyday responses",
        pro: "Pro — deeper reasoning",
        lite: "Flash Lite — fastest lightweight responses",
        help: "Need help?",
        continue: "Continue",
        close: "Close disclaimer"
    },
    bn: {
        title: "চালিয়ে যাওয়ার আগে",
        introPrefix: "Google Gemini দ্বারা চালিত personal AI assistant — ",
        introSuffix: "।",
        warning: "AI response ভুল হতে পারে। গুরুত্বপূর্ণ তথ্য ব্যবহারের আগে যাচাই করুন।",
        model: "একটি মডেল বেছে নিন",
        flash: "Flash — দৈনন্দিন কাজে দ্রুত",
        pro: "Pro — গভীর reasoning",
        lite: "Flash Lite — সবচেয়ে দ্রুত ও lightweight",
        help: "সহায়তা প্রয়োজন?",
        continue: "চালিয়ে যান",
        close: "Disclaimer বন্ধ করুন"
    }
};

function getLanguage(): Language {
    try {
        return window.currentLang === "bn" || localStorage.getItem("gemini_lang") === "bn" || localStorage.getItem("lang") === "bn" ? "bn" : "en";
    } catch {
        return "en";
    }
}

function hasSeenDisclaimer(): boolean {
    try {
        return localStorage.getItem(DISCLAIMER_KEY) === "1";
    } catch {
        return false;
    }
}

function markDisclaimerSeen(): void {
    try {
        localStorage.setItem(DISCLAIMER_KEY, "1");
    } catch {
        // Dismissal still works for this session.
    }
}

function restoreSavedModel(select: HTMLSelectElement): void {
    try {
        const saved = localStorage.getItem(MODEL_STORAGE_KEY);
        if (saved && Array.from(select.options).some((option) => option.value === saved)) select.value = saved;
    } catch {
        // Keep the current/default model.
    }
}

function saveSelectedModel(select: HTMLSelectElement): void {
    if (!select.value) return;
    try {
        localStorage.setItem(MODEL_STORAGE_KEY, select.value);
    } catch {
        // Current-session selection still works.
    }
}

function showDisclaimer(): void {
    const modalContainer = document.getElementById("modal-container");
    const modelSelect = document.getElementById("model-select") as HTMLSelectElement | null;
    if (!modalContainer || hasSeenDisclaimer()) return;

    const lang = getLanguage();
    const t = (key: string): string => TEXT[lang][key];

    if (modelSelect && !modelSelect.disabled && modelSelect.options.length) restoreSavedModel(modelSelect);

    const backdrop = document.createElement("div");
    backdrop.className = "ai-disclaimer-backdrop";
    backdrop.setAttribute("role", "dialog");
    backdrop.setAttribute("aria-modal", "true");
    backdrop.setAttribute("aria-labelledby", "ai-disclaimer-title");

    backdrop.innerHTML = `
        <div class="ai-disclaimer-card">
            <div class="ai-disclaimer-header">
                <div>
                    <span class="ai-disclaimer-eyebrow">Gemini AI Assistant</span>
                    <h2 id="ai-disclaimer-title">${t("title")}</h2>
                </div>
                <button type="button" class="ai-disclaimer-close" aria-label="${t("close")}">&times;</button>
            </div>
            <p class="ai-disclaimer-intro">
                ${t("introPrefix")}<a class="ai-disclaimer-creator" href="https://sourovadikari.xyz" target="_blank" rel="noopener noreferrer">Sourov Adikari</a>${t("introSuffix")}
            </p>
            <div class="ai-disclaimer-warning">${t("warning")}</div>
            <div class="ai-disclaimer-section">
                <span class="ai-disclaimer-label">${t("model")}</span>
                <div class="ai-disclaimer-model-list">
                    <span>${t("flash")}</span>
                    <span>${t("pro")}</span>
                    <span>${t("lite")}</span>
                </div>
            </div>
            <div class="ai-disclaimer-footer">
                <a class="ai-disclaimer-help" href="mailto:contact@sourovadikari.xyz">${t("help")}</a>
            </div>
            <button type="button" class="ai-disclaimer-continue">${t("continue")}</button>
        </div>
    `;

    const modalSelect = modelSelect ? document.createElement("select") : null;
    if (modalSelect && modelSelect) {
        modalSelect.className = "ai-disclaimer-model-select";
        modalSelect.setAttribute("aria-label", t("model"));
        Array.from(modelSelect.options).forEach((option) => modalSelect.appendChild(option.cloneNode(true)));
        modalSelect.value = modelSelect.value;
        backdrop.querySelector(".ai-disclaimer-model-list")?.replaceWith(modalSelect);
    }

    const dismiss = (): void => {
        if (modalSelect && modelSelect && modalSelect.value) {
            modelSelect.value = modalSelect.value;
            modelSelect.dispatchEvent(new Event("change", { bubbles: true }));
            saveSelectedModel(modelSelect);
        }
        markDisclaimerSeen();
        backdrop.remove();
        modalContainer.classList.add("hidden");
        modalContainer.setAttribute("aria-hidden", "true");
    };

    backdrop.querySelector(".ai-disclaimer-close")?.addEventListener("click", dismiss);
    backdrop.querySelector(".ai-disclaimer-continue")?.addEventListener("click", dismiss);
    backdrop.addEventListener("click", (event) => {
        if (event.target === backdrop) dismiss();
    });

    modalContainer.innerHTML = "";
    modalContainer.appendChild(backdrop);
    modalContainer.classList.remove("hidden");
    modalContainer.setAttribute("aria-hidden", "false");
    (backdrop.querySelector(".ai-disclaimer-continue") as HTMLButtonElement | null)?.focus();
}

document.addEventListener("DOMContentLoaded", () => window.setTimeout(showDisclaimer, 900), { once: true });
