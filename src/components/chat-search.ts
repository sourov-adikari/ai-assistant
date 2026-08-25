type SearchSession = { id: string; title: string; timestamp: number };

const SEARCH_SESSIONS_KEY = "gemini_sessions";
const SEARCH_ACTIVE_KEY = "gemini_active_id";

function normalizeSearch(value: unknown): string {
    return String(value ?? "").toLocaleLowerCase().normalize("NFKC").trim();
}

function getSearchLanguage(): "en" | "bn" {
    try {
        return (localStorage.getItem("gemini_lang") || localStorage.getItem("lang")) === "bn" ? "bn" : "en";
    } catch {
        return "en";
    }
}

function splitTitleWords(value: string): string[] {
    return normalizeSearch(value).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

function matchesTitlePrefix(title: string, query: string): boolean {
    const terms = splitTitleWords(query);
    if (terms.length === 0) return true;

    const words = splitTitleWords(title);

    // A query containing one or more terms matches when ANY query term
    // is a prefix of ANY complete title word. This is intentionally
    // optimized for Bengali while preserving the same prefix-only rule
    // for English: no middle/end-of-word substring matches.
    return terms.some((term) => words.some((word) => word.startsWith(term)));
}

function readSessions(): SearchSession[] {
    try {
        const raw = localStorage.getItem(SEARCH_SESSIONS_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(parsed)) return [];

        return parsed
            .filter((session) => session && typeof session.id === "string")
            .map((session) => ({
                id: session.id,
                title: typeof session.title === "string" && session.title.trim()
                    ? session.title.trim()
                    : (getSearchLanguage() === "bn" ? "নতুন চ্যাট" : "New Chat"),
                timestamp: Number.isFinite(Number(session.timestamp)) ? Number(session.timestamp) : Date.now()
            }));
    } catch {
        return [];
    }
}

function renderSearchResults(query: string): void {
    const list = document.getElementById("chat-history-list");
    if (!list) return;

    const sessions = readSessions();
    const activeId = localStorage.getItem(SEARCH_ACTIVE_KEY);
    const filtered = sessions.filter((session) => matchesTitlePrefix(session.title, query));
    const lang = getSearchLanguage();
    const labels = lang === "bn"
        ? { today: "আজ", yesterday: "গতকাল", older: "পুরানো", rename: "নাম পরিবর্তন", delete: "মুছুন" }
        : { today: "Today", yesterday: "Yesterday", older: "Older", rename: "Rename", delete: "Delete" };

    const groups: Record<"today" | "yesterday" | "older", SearchSession[]> = {
        today: [],
        yesterday: [],
        older: []
    };

    const now = Date.now();
    filtered.forEach((session) => {
        const age = Math.max(0, now - session.timestamp) / 86400000;
        if (age < 1) groups.today.push(session);
        else if (age < 2) groups.yesterday.push(session);
        else groups.older.push(session);
    });

    list.replaceChildren();

    (Object.keys(groups) as Array<keyof typeof groups>).forEach((group) => {
        if (groups[group].length === 0) return;

        const header = document.createElement("div");
        header.className = "group-header";
        header.textContent = labels[group];
        list.appendChild(header);

        groups[group].forEach((session) => {
            const item = document.createElement("div");
            item.className = `session-item ${session.id === activeId ? "active" : ""}`;

            const title = document.createElement("span");
            title.className = "title";
            title.textContent = session.title;

            const actions = document.createElement("div");
            actions.className = "actions";

            const edit = document.createElement("i");
            edit.className = "fas fa-edit";
            edit.title = labels.rename;
            edit.setAttribute("role", "button");
            edit.addEventListener("click", (event) => {
                event.stopPropagation();
                (window as any).renameSession?.(session.id, event);
                window.setTimeout(() => renderSearchResults(query), 0);
            });

            const trash = document.createElement("i");
            trash.className = "fas fa-trash";
            trash.title = labels.delete;
            trash.setAttribute("role", "button");
            trash.addEventListener("click", (event) => {
                event.stopPropagation();
                (window as any).deleteSession?.(session.id, event);
                window.setTimeout(() => renderSearchResults(query), 0);
            });

            actions.append(edit, trash);
            item.append(title, actions);
            item.addEventListener("click", () => {
                (window as any).loadSession?.(session.id);
                window.setTimeout(() => renderSearchResults(query), 0);
            });

            list.appendChild(item);
        });
    });
}

function installChatSearch(): void {
    const input = document.getElementById("chat-search") as HTMLInputElement | null;
    if (!input) return;

    const clearButton = document.getElementById("clear-search-btn");

    input.addEventListener("input", (event) => {
        event.stopImmediatePropagation();
        clearButton?.classList.toggle("hidden", !input.value);
        renderSearchResults(input.value);
    }, true);

    clearButton?.addEventListener("click", () => {
        input.value = "";
        input.focus();
        clearButton.classList.add("hidden");
        renderSearchResults("");
    });

    input.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") return;
        input.value = "";
        clearButton?.classList.add("hidden");
        renderSearchResults("");
    });

    window.addEventListener("storage", (event) => {
        if (event.key === "gemini_lang" || event.key === SEARCH_SESSIONS_KEY) {
            renderSearchResults(input.value);
        }
    });

    clearButton?.classList.toggle("hidden", !input.value);
    renderSearchResults(input.value);
}

document.addEventListener("DOMContentLoaded", installChatSearch, { once: true });
