// Model selection and persistence.
(() => {
    "use strict";

    const STORAGE_KEY = "gemini_selected_model";
    const getSelect = () => document.getElementById("model-select") as HTMLSelectElement | null;

    function saveModel(event: Event): void {
        const select = event.currentTarget as HTMLSelectElement | null;
        if (!select?.value) return;

        try {
            localStorage.setItem(STORAGE_KEY, select.value);
        } catch {
            // Model selection still works when storage is unavailable.
        }
    }

    function restoreModel(select: HTMLSelectElement): void {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved && Array.from(select.options).some((option) => option.value === saved)) {
                select.value = saved;
            }
        } catch {
            // Use the server-selected/default model when storage is unavailable.
        }
    }

    function setup(): void {
        const select = getSelect();
        if (!select) return;

        select.addEventListener("change", saveModel);

        const restore = (): boolean => {
            if (select.options.length && select.options[0].value) {
                restoreModel(select);
                return true;
            }
            return false;
        };

        if (restore()) return;

        const observer = new MutationObserver(() => {
            if (restore()) observer.disconnect();
        });

        observer.observe(select, { childList: true });
    }

    document.addEventListener("DOMContentLoaded", setup, { once: true });
})();
