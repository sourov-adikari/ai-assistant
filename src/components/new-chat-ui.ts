function getNewChatLanguage(): "en" | "bn" {
    try {
        return (localStorage.getItem("gemini_lang") || localStorage.getItem("lang")) === "bn" ? "bn" : "en";
    } catch {
        return "en";
    }
}

function getNewChatText(): string {
    return getNewChatLanguage() === "bn" ? "নতুন চ্যাট" : "New Chat";
}

function isDefaultNewChatTitle(value: string): boolean {
    const title = value.trim();
    return title === "New Chat" || title === "নতুন চ্যাট";
}

function updateNewChatHeading(): void {
    const messages = document.getElementById("messages");
    if (!messages) return;

    const existing = messages.querySelector<HTMLElement>(".new-chat-heading");
    const hasMessages = !!messages.querySelector(".message");

    if (hasMessages) {
        existing?.remove();
        return;
    }

    const text = getNewChatText();

    if (existing) {
        if (existing.textContent !== text) {
            existing.textContent = text;
        }
        return;
    }

    const heading = document.createElement("div");
    heading.className = "new-chat-heading";
    heading.textContent = text;
    heading.setAttribute("aria-hidden", "true");
    messages.appendChild(heading);
}

function updateDefaultNewChatLabels(): void {
    const label = getNewChatText();
    const chatTitle = document.getElementById("chat-title");

    if (chatTitle && isDefaultNewChatTitle(chatTitle.textContent || "")) {
        chatTitle.textContent = label;
    }

    document.querySelectorAll<HTMLElement>("#chat-history-list .session-item .title").forEach((element) => {
        if (isDefaultNewChatTitle(element.textContent || "") && element.textContent !== label) {
            element.textContent = label;
        }
    });
}

function syncNewChatLanguage(): void {
    updateNewChatHeading();
    updateDefaultNewChatLabels();
}

function installNewChatHeading(): void {
    const messages = document.getElementById("messages");
    if (!messages) return;

    const observer = new MutationObserver(() => {
        syncNewChatLanguage();
    });

    observer.observe(messages, {
        childList: true,
        subtree: true,
        characterData: true,
    });

    const languageButton = document.getElementById("lang-toggle");
    languageButton?.addEventListener("click", () => {
        window.setTimeout(syncNewChatLanguage, 0);
    });

    syncNewChatLanguage();
}

document.addEventListener("DOMContentLoaded", installNewChatHeading, { once: true });
