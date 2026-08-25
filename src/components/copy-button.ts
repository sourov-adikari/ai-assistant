// @ts-nocheck
/* Code copy button */
(() => {
    "use strict";

    const TEXT = {
        en: {
            copy: "Copy code",
            copied: "Copied",
            failed: "Copy failed"
        },
        bn: {
            copy: "কোড কপি করুন",
            copied: "কপি হয়েছে",
            failed: "কপি করা যায়নি"
        }
    };

    const language = () =>
        window.currentLang === "bn" ||
        localStorage.getItem("lang") === "bn" ||
        localStorage.getItem("gemini_lang") === "bn"
            ? "bn"
            : "en";

    const text = (key) =>
        TEXT[language()][key];

    async function copyTextToClipboard(value) {
        if (!value) return false;

        try {
            if (
                navigator.clipboard &&
                window.isSecureContext
            ) {
                await navigator.clipboard.writeText(value);
            } else {
                const area =
                    document.createElement("textarea");

                area.value = value;
                area.setAttribute(
                    "readonly",
                    ""
                );

                area.style.cssText =
                    "position:fixed;left:-9999px;top:0";

                document.body.appendChild(area);

                area.focus();
                area.select();

                area.setSelectionRange(
                    0,
                    area.value.length
                );

                if (
                    !document.execCommand("copy")
                ) {
                    throw new Error(
                        "Copy command failed"
                    );
                }

                area.remove();
            }

            return true;
        } catch (error) {
            console.error(
                "Copy failed:",
                error
            );

            if (
                typeof window.showNotification ===
                "function"
            ) {
                window.showNotification(
                    text("failed"),
                    "error"
                );
            }

            return false;
        }
    }

    /*
     * Copy button state.
     *
     * Normal:
     * 📋
     *
     * Copied:
     * ✓
     *
     * No "Copied" text is displayed.
     */
    function setButton(
        button,
        copied = false
    ) {
        button.innerHTML = copied
            ? '<i class="fas fa-check" aria-hidden="true"></i>'
            : '<i class="fas fa-copy" aria-hidden="true"></i>';

        button.title = copied
            ? text("copied")
            : text("copy");

        button.setAttribute(
            "aria-label",
            button.title
        );

        button.classList.toggle(
            "copied",
            copied
        );
    }

    function addCodeCopyButtons(
        root = document
    ) {
        if (!root) return;

        root
            .querySelectorAll("pre")
            .forEach((pre) => {

                /*
                 * Prevent duplicate copy buttons.
                 */
                if (
                    pre.closest(
                        ".code-block-shell"
                    )
                ) {
                    return;
                }

                if (
                    pre.dataset.copyChrome ===
                    "true"
                ) {
                    return;
                }

                const code =
                    pre.querySelector(
                        "code"
                    );

                if (!code) return;

                /*
                 * Mark this <pre> as already processed.
                 */
                pre.dataset.copyChrome =
                    "true";

                /*
                 * Main code block wrapper.
                 */
                const shell =
                    document.createElement(
                        "div"
                    );

                shell.className =
                    "code-block-shell";

                /*
                 * Single copy button.
                 */
                const button =
                    document.createElement(
                        "button"
                    );

                button.type = "button";

                button.className =
                    "code-copy-btn";

                setButton(
                    button,
                    false
                );

                /*
                 * Copy button click.
                 */
                button.addEventListener(
                    "click",
                    async (event) => {
                        event.preventDefault();
                        event.stopPropagation();

                        const success =
                            await copyTextToClipboard(
                                code.textContent ||
                                    ""
                            );

                        if (!success) {
                            return;
                        }

                        /*
                         * 📋 → ✓
                         */
                        setButton(
                            button,
                            true
                        );

                        /*
                         * ✓ → 📋
                         */
                        window.setTimeout(
                            () => {
                                if (
                                    button.isConnected
                                ) {
                                    setButton(
                                        button,
                                        false
                                    );
                                }
                            },
                            1200
                        );
                    }
                );

                /*
                 * Keep the existing scroll
                 * container.
                 *
                 * Horizontal + vertical
                 * scrolling remain available.
                 */
                const scroll =
                    document.createElement(
                        "div"
                    );

                scroll.className =
                    "code-scroll";

                /*
                 * Build:
                 *
                 * code-block-shell
                 * ├── copy button
                 * └── code-scroll
                 *     └── pre
                 */
                pre.parentNode.insertBefore(
                    shell,
                    pre
                );

                shell.appendChild(
                    button
                );

                shell.appendChild(
                    scroll
                );

                scroll.appendChild(
                    pre
                );
            });
    }

    /*
     * Public API.
     */
    window.copyTextToClipboard =
        copyTextToClipboard;

    window.addCodeCopyButtons =
        addCodeCopyButtons;

    window.geminiUI =
        window.geminiUI || {};

    window.geminiUI.addCodeCopyButtons =
        addCodeCopyButtons;

    /*
     * Initial code blocks.
     */
    document.addEventListener(
        "DOMContentLoaded",
        () => {
            addCodeCopyButtons(
                document.getElementById(
                    "messages"
                ) || document
            );
        },
        {
            once: true
        }
    );
})();
