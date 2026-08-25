/**
 * Chat scroll controller
 *
 * Keeps the conversation pinned to the latest content while the user
 * is already near the bottom. If the user scrolls up to read older
 * messages, automatic following pauses until they return near the bottom.
 */

const CHAT_WINDOW_ID = "chat-window";
const BOTTOM_THRESHOLD = 96;

type LegacyGlobal = typeof globalThis & {
    scrollDown?: () => void;
};

let followLatest = true;
let scrollFrame = 0;
let observer: MutationObserver | null = null;

function getChatWindow(): HTMLElement | null {
    return document.getElementById(CHAT_WINDOW_ID);
}

function isNearBottom(element: HTMLElement): boolean {
    return (
        element.scrollHeight -
            element.scrollTop -
            element.clientHeight <=
        BOTTOM_THRESHOLD
    );
}

function scrollToLatest(behavior: ScrollBehavior = "auto"): void {
    const element = getChatWindow();

    if (!element || !followLatest) {
        return;
    }

    if (scrollFrame) {
        cancelAnimationFrame(scrollFrame);
    }

    scrollFrame = requestAnimationFrame(() => {
        element.scrollTo({
            top: element.scrollHeight,
            behavior
        });
        scrollFrame = 0;
    });
}

function handleUserScroll(): void {
    const element = getChatWindow();

    if (!element) {
        return;
    }

    followLatest = isNearBottom(element);
}

function installLegacyScrollOverride(): void {
    // app.ts is intentionally kept as a classic browser script for now.
    // Replace its global scrollDown function without rewriting the core
    // streaming code. This keeps streaming and manual scrolling in sync.
    const globalObject = globalThis as LegacyGlobal;

    globalObject.scrollDown = () => {
        scrollToLatest("auto");
    };
}

function start(): void {
    const element = getChatWindow();

    if (!element) {
        return;
    }

    installLegacyScrollOverride();

    element.addEventListener("scroll", handleUserScroll, {
        passive: true
    });

    observer = new MutationObserver(() => {
        if (followLatest) {
            scrollToLatest();
        }
    });

    observer.observe(element, {
        childList: true,
        subtree: true,
        characterData: true
    });

    // Initial position after existing chat history has rendered.
    scrollToLatest();
}

document.addEventListener("DOMContentLoaded", start);

export { scrollToLatest };
