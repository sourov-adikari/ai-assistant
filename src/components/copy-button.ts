// @ts-nocheck
/* Code copy button */
(() => {
    "use strict";
    const TEXT = { en: { copy: "Copy code", copied: "Copied", failed: "Copy failed" }, bn: { copy: "কোড কপি করুন", copied: "কপি হয়েছে", failed: "কপি করা যায়নি" } };
    const language = () => window.currentLang === "bn" || localStorage.getItem("lang") === "bn" || localStorage.getItem("gemini_lang") === "bn" ? "bn" : "en";
    const text = (key) => TEXT[language()][key];
    async function copyTextToClipboard(value) {
        if (!value) return false;
        try {
            if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(value);
            else {
                const area = document.createElement("textarea"); area.value = value; area.setAttribute("readonly", ""); area.style.cssText = "position:fixed;left:-9999px;top:0";
                document.body.appendChild(area); area.focus(); area.select(); area.setSelectionRange(0, area.value.length);
                if (!document.execCommand("copy")) throw new Error("Copy command failed"); area.remove();
            }
            return true;
        } catch (error) { console.error("Copy failed:", error); if (typeof window.showNotification === "function") window.showNotification(text("failed"), "error"); return false; }
    }
    function setButton(button, copied) {
        button.innerHTML = copied ? '<i class="fas fa-check" aria-hidden="true"></i><span>Copied</span>' : '<i class="fas fa-copy" aria-hidden="true"></i><span>Copy</span>';
        button.title = copied ? text("copied") : text("copy"); button.setAttribute("aria-label", button.title); button.classList.toggle("copied", copied);
    }
    function addCodeCopyButtons(root = document) {
        root.querySelectorAll("pre").forEach((pre) => {
            if (pre.closest(".code-block-shell") || pre.dataset.copyChrome === "true") return;
            const code = pre.querySelector("code"); if (!code) return;
            pre.dataset.copyChrome = "true";
            const shell = document.createElement("div"); shell.className = "code-block-shell";
            const button = document.createElement("button"); button.type = "button"; button.className = "code-copy-btn"; setButton(button, false);
            button.addEventListener("click", async (event) => { event.preventDefault(); event.stopPropagation(); if (!await copyTextToClipboard(code.textContent || "")) return; setButton(button, true); window.setTimeout(() => { if (button.isConnected) setButton(button, false); }, 1200); });
            const scroll = document.createElement("div"); scroll.className = "code-scroll";
            pre.parentNode.insertBefore(shell, pre); shell.append(button, scroll); scroll.appendChild(pre);
        });
    }
    window.copyTextToClipboard = copyTextToClipboard; window.addCodeCopyButtons = addCodeCopyButtons;
    window.geminiUI = window.geminiUI || {}; window.geminiUI.addCodeCopyButtons = addCodeCopyButtons;
    document.addEventListener("DOMContentLoaded", () => addCodeCopyButtons(document.getElementById("messages") || document), { once: true });
})();
