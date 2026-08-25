(() => {
    "use strict";

    const STORAGE_KEY = "gemini_theme";

    type Theme = "dark" | "light";

    function readTheme(): Theme {
        try {
            return localStorage.getItem(STORAGE_KEY) === "light" ? "light" : "dark";
        } catch {
            return "dark";
        }
    }

    function applyTheme(theme: Theme): void {
        document.body.classList.toggle("dark-mode", theme === "dark");
        document.body.classList.toggle("light-mode", theme === "light");

        const meta = document.getElementById("theme-color-meta") as HTMLMetaElement | null;
        if (meta) {
            meta.content = theme === "dark" ? "#121212" : "#ffffff";
        }
    }

    function saveTheme(theme: Theme): void {
        try {
            localStorage.setItem(STORAGE_KEY, theme);
        } catch {
            // Theme still works when storage is unavailable.
        }
    }

    function updateButton(button: HTMLElement, theme: Theme): void {
        const icon = button.querySelector("i");
        const label = button.querySelector("span");

        // The label describes the action available after the current state.
        // Dark mode active -> offer Light Mode.
        // Light mode active -> offer Dark Mode.
        const language = (() => {
            try {
                return (localStorage.getItem("gemini_lang") || localStorage.getItem("lang")) === "bn"
                    ? "bn"
                    : "en";
            } catch {
                return "en";
            }
        })();

        if (icon) {
            icon.className = theme === "dark" ? "fas fa-sun" : "fas fa-moon";
        }

        if (label) {
            label.textContent = theme === "dark"
                ? (language === "bn" ? "লাইট মোড" : "Light Mode")
                : (language === "bn" ? "ডার্ক মোড" : "Dark Mode");
        }

        button.setAttribute("aria-pressed", theme === "light" ? "true" : "false");
    }

    function syncButton(): void {
        const button = document.getElementById("theme-toggle");
        if (!button) return;
        updateButton(button, readTheme());
    }

    function install(): void {
        const theme = readTheme();
        applyTheme(theme);

        const button = document.getElementById("theme-toggle");
        if (button) {
            // Capture the click so app.ts's legacy theme listener cannot toggle
            // the theme a second time. This keeps one authoritative controller.
            button.addEventListener("click", (event) => {
                event.preventDefault();
                event.stopImmediatePropagation();

                const next: Theme = readTheme() === "dark" ? "light" : "dark";
                saveTheme(next);
                applyTheme(next);
                updateButton(button, next);
            }, true);

            updateButton(button, theme);
        }

        const languageButton = document.getElementById("lang-toggle");
        languageButton?.addEventListener("click", () => {
            window.setTimeout(syncButton, 0);
        });

        // app.ts also applies a saved theme during its initialization. Re-apply
        // once after DOMContentLoaded so an absent preference always stays dark.
        window.setTimeout(() => {
            const current = readTheme();
            applyTheme(current);
            syncButton();
        }, 0);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", install, { once: true });
    } else {
        install();
    }
})();
