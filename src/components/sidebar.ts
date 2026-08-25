// @ts-nocheck
/* Sidebar UI behavior */
(() => {
    "use strict";
    const THEME_KEY = "gemini_theme";
    const getSidebar = () => document.getElementById("sidebar"); const getOverlay = () => document.getElementById("sidebar-overlay"); const getMenu = () => document.getElementById("menu-toggle"); const isMobile = () => window.matchMedia("(max-width: 768px)").matches;
    function setMenuState(open) { const menu = getMenu(); if (!menu) return; menu.setAttribute("aria-expanded", open ? "true" : "false"); menu.setAttribute("aria-label", open ? "Close sidebar" : "Open sidebar"); menu.title = open ? "Close sidebar" : "Open sidebar"; }
    function setOverlay(open) { const overlay = getOverlay(); if (!overlay) return; const visible = Boolean(open && isMobile()); overlay.classList.toggle("hidden", !visible); overlay.setAttribute("aria-hidden", visible ? "false" : "true"); }
    function setSidebar(open) { const sidebar = getSidebar(); if (!sidebar) return; sidebar.classList.toggle("open", open); document.body.classList.toggle("sidebar-collapsed", !open); document.body.classList.toggle("sidebar-open", open); sidebar.setAttribute("aria-hidden", open ? "false" : "true"); setOverlay(open); setMenuState(open); }
    const closeSidebar = () => setSidebar(false); const openSidebar = () => setSidebar(true);
    function applyDefaultDark() { try { if (localStorage.getItem(THEME_KEY)) return; } catch (_) {} document.body.classList.remove("light-mode"); document.body.classList.add("dark-mode"); document.getElementById("theme-color-meta")?.setAttribute("content", "#121212"); }
    function install() {
        applyDefaultDark(); const sidebar = getSidebar(); const overlay = getOverlay(); const menu = getMenu(); const close = document.getElementById("close-sidebar"); const newChat = document.getElementById("new-chat-btn"); const clearAll = document.getElementById("clear-all-btn"); const historyList = document.getElementById("chat-history-list"); if (!sidebar || !menu) return;
        if (isMobile()) setSidebar(false); else setSidebar(true);
        menu.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); setSidebar(!document.body.classList.contains("sidebar-open")); });
        close?.addEventListener("click", (event) => { event.preventDefault(); closeSidebar(); }); overlay?.addEventListener("click", closeSidebar); newChat?.addEventListener("click", () => { if (isMobile()) closeSidebar(); }); clearAll?.addEventListener("click", () => { if (isMobile()) window.setTimeout(closeSidebar, 0); });
        historyList?.addEventListener("click", (event) => { if (!isMobile()) return; if (event.target.closest(".session-item")) window.setTimeout(closeSidebar, 0); });
        document.addEventListener("keydown", (event) => { if (event.key === "Escape" && document.body.classList.contains("sidebar-open")) closeSidebar(); });
        window.addEventListener("resize", () => { const open = document.body.classList.contains("sidebar-open"); setOverlay(open); setMenuState(open); });
    }
    document.addEventListener("DOMContentLoaded", install, { once: true });
    window.geminiUI = window.geminiUI || {}; window.geminiUI.openSidebar = openSidebar; window.geminiUI.closeSidebar = closeSidebar;
})();