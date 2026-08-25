/* Markdown, tables, math and presentation enhancements */
(() => {
    "use strict";
    
    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }
    
    function wrapTables(element) {
        if (!element) return;
        
        element.querySelectorAll("table").forEach((table) => {
            if (
                table.parentElement?.classList.contains(
                    "table-wrap"
                )
            ) {
                return;
            }
            
            const wrapper =
                document.createElement("div");
            
            wrapper.className = "table-wrap";
            wrapper.setAttribute("role", "region");
            wrapper.setAttribute(
                "aria-label",
                "Scrollable table"
            );
            
            table.parentNode.insertBefore(
                wrapper,
                table
            );
            
            wrapper.appendChild(table);
        });
    }
    
    function renderMath(element) {
        if (
            !element ||
            typeof window.renderMathInElement !==
            "function"
        ) {
            return;
        }
        
        try {
            window.renderMathInElement(
                element,
                {
                    delimiters: [
                    {
                        left: "$$",
                        right: "$$",
                        display: true
                    },
                    {
                        left: "\\[",
                        right: "\\]",
                        display: true
                    },
                    {
                        left: "\\(",
                        right: "\\)",
                        display: false
                    },
                    {
                        left: "$",
                        right: "$",
                        display: false
                    }],
                    
                    ignoredTags: [
                        "script",
                        "noscript",
                        "style",
                        "textarea",
                        "pre",
                        "code",
                        "option"
                    ],
                    
                    throwOnError: false,
                    strict: "ignore",
                    trust: false
                }
            );
        } catch (error) {
            console.warn(
                "KaTeX rendering failed:",
                error
            );
        }
    }
    
    function highlightCode(container) {
        if (
            !container ||
            !window.hljs?.highlightElement
        ) {
            return;
        }
        
        container
            .querySelectorAll("pre code")
            .forEach((code) => {
                try {
                    window.hljs.highlightElement(
                        code
                    );
                } catch (error) {
                    console.warn(
                        "Syntax highlighting skipped:",
                        error
                    );
                }
            });
    }
    
    function enhanceTaskLists(container) {
        if (!container) return;
        
        container
            .querySelectorAll("li")
            .forEach((li) => {
                const checkbox =
                    li.querySelector(
                        'input[type="checkbox"]'
                    );
                
                if (!checkbox) return;
                
                checkbox.disabled = true;
                li.classList.add(
                    "task-list-item"
                );
            });
    }
    
    async function renderMermaid(container) {
        if (
            !container ||
            !window.mermaid
        ) {
            return;
        }
        
        const blocks =
            Array.from(
                container.querySelectorAll(
                    "pre code.language-mermaid"
                )
            );
        
        if (!blocks.length) return;
        
        try {
            window.mermaid.initialize({
                startOnLoad: false,
                securityLevel: "strict",
                theme: "dark"
            });
        } catch (_) {
            return;
        }
        
        for (const code of blocks) {
            const pre =
                code.closest("pre");
            
            if (
                !pre ||
                pre.dataset
                .mermaidEnhanced ===
                "true"
            ) {
                continue;
            }
            
            const source =
                code.textContent.trim();
            
            if (!source) continue;
            
            try {
                const result =
                    await window.mermaid.render(
                        "mermaid-" +
                        Math.random()
                        .toString(36)
                        .slice(2),
                        source
                    );
                
                const wrapper =
                    document.createElement(
                        "div"
                    );
                
                wrapper.className =
                    "mermaid-diagram";
                
                wrapper.innerHTML =
                    result.svg;
                
                const shell =
                    pre.closest(
                        ".code-block-shell"
                    );
                
                if (shell) {
                    shell.replaceWith(
                        wrapper
                    );
                } else {
                    pre.replaceWith(
                        wrapper
                    );
                }
            } catch (_) {
                // Keep the original code block
                // if Mermaid rendering fails.
            }
        }
    }
    
    function enhance(element) {
        if (!element) return;
        
        try {
            highlightCode(element);
            enhanceTaskLists(element);
            renderMermaid(element);
            
            window.geminiUI
                ?.addCodeCopyButtons
                ?.(
                    element
                );
        } catch (error) {
            console.warn(
                "Markdown enhancement failed:",
                error
            );
        }
    }
    
    function fallbackMarkdown(markdown) {
        let source =
            String(markdown ?? "")
            .replace(
                /\r\n?/g,
                "\n"
            );
        
        const codeBlocks = [];
        
        /*
         * Handle fenced code blocks first.
         *
         * Supports:
         *
         * ```python
         * print("Hello")
         * ```
         */
        source = source.replace(
            /```([\w+-]*)[ \t]*\n?([\s\S]*?)```/g,
            (_, lang, code) => {
                const index =
                    codeBlocks.length;
                
                codeBlocks.push(
                    "<pre><code" +
                    (
                        lang ?
                        ' class="language-' +
                        escapeHtml(
                            lang
                        ) +
                        '"' :
                        ""
                    ) +
                    ">" +
                    escapeHtml(
                        code.replace(
                            /\n$/,
                            ""
                        )
                    ) +
                    "</code></pre>"
                );
                
                return (
                    `\u0000CODE${index}\u0000`
                );
            }
        );
        
        let html =
            escapeHtml(source);
        
        html = html
            .replace(
                /^######\s+(.+)$/gm,
                "<h6>$1</h6>"
            )
            .replace(
                /^#####\s+(.+)$/gm,
                "<h5>$1</h5>"
            )
            .replace(
                /^####\s+(.+)$/gm,
                "<h4>$1</h4>"
            )
            .replace(
                /^###\s+(.+)$/gm,
                "<h3>$1</h3>"
            )
            .replace(
                /^##\s+(.+)$/gm,
                "<h2>$1</h2>"
            )
            .replace(
                /^#\s+(.+)$/gm,
                "<h1>$1</h1>"
            )
            .replace(
                /^\s*([-*_])\s*\1\s*\1\s*$/gm,
                "<hr>"
            )
            .replace(
                /^&gt;\s?(.*)$/gm,
                "<blockquote>$1</blockquote>"
            )
            .replace(
                /\*\*([^*\n]+)\*\*/g,
                "<strong>$1</strong>"
            )
            .replace(
                /__([^_\n]+)__/g,
                "<strong>$1</strong>"
            )
            .replace(
                /\*([^*\n]+)\*/g,
                "<em>$1</em>"
            )
            .replace(
                /_([^_\n]+)_/g,
                "<em>$1</em>"
            )
            .replace(
                /`([^`\n]+)`/g,
                "<code>$1</code>"
            )
            .replace(
                /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
                '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
            );
        
        const lines =
            html.split("\n");
        
        const output = [];
        let paragraph = [];
        let list = false;
        
        const flushParagraph = () => {
            if (!paragraph.length) {
                return;
            }
            
            output.push(
                "<p>" +
                paragraph.join("<br>") +
                "</p>"
            );
            
            paragraph = [];
        };
        
        const closeList = () => {
            if (!list) return;
            
            output.push("</ul>");
            list = false;
        };
        
        lines.forEach((line) => {
            if (
                /^\s*<h[1-6]>/.test(
                    line
                ) ||
                line === "<hr>"
            ) {
                flushParagraph();
                closeList();
                output.push(line);
            } else if (
                /^\s*[-*+]\s+/.test(
                    line
                )
            ) {
                flushParagraph();
                
                if (!list) {
                    output.push(
                        "<ul>"
                    );
                    
                    list = true;
                }
                
                output.push(
                    "<li>" +
                    line.replace(
                        /^\s*[-*+]\s+/,
                        ""
                    ) +
                    "</li>"
                );
            } else if (
                /^\s*<blockquote>/.test(
                    line
                )
            ) {
                flushParagraph();
                closeList();
                output.push(line);
            } else if (
                /^\u0000CODE\d+\u0000$/.test(
                    line
                )
            ) {
                flushParagraph();
                closeList();
                output.push(line);
            } else if (
                !line.trim()
            ) {
                flushParagraph();
                closeList();
            } else {
                closeList();
                paragraph.push(line);
            }
        });
        
        flushParagraph();
        closeList();
        
        html = output.join("");
        
        return html.replace(
            /\u0000CODE(\d+)\u0000/g,
            (_, index) =>
            codeBlocks[
                Number(index)
            ] || ""
        );
    }
    
    /*
     * IMPORTANT:
     *
     * app.ts already has a function named
     * renderMarkdown().
     *
     * Therefore this enhanced renderer
     * uses a different global name.
     */
    window.renderEnhancedMarkdown =
        function(
            element,
            markdown
        ) {
            if (!element) return;
            
            const source =
                String(
                    markdown ?? ""
                );
            
            try {
                if (
                    window.marked?.parse
                ) {
                    const rendered =
                        window.marked.parse(
                            source,
                            {
                                gfm: true,
                                breaks: true
                            }
                        );
                    
                    element.innerHTML =
                        window.DOMPurify
                        ?.sanitize ?
                        window.DOMPurify.sanitize(
                            rendered
                        ) :
                        rendered;
                } else {
                    const fallback =
                        fallbackMarkdown(
                            source
                        );
                    
                    element.innerHTML =
                        window.DOMPurify
                        ?.sanitize ?
                        window.DOMPurify.sanitize(
                            fallback
                        ) :
                        fallback;
                }
            } catch (error) {
                console.warn(
                    "Markdown rendering failed; using fallback:",
                    error
                );
                
                const fallback =
                    fallbackMarkdown(
                        source
                    );
                
                element.innerHTML =
                    window.DOMPurify
                    ?.sanitize ?
                    window.DOMPurify.sanitize(
                        fallback
                    ) :
                    fallback;
            }
            
            wrapTables(element);
            renderMath(element);
            enhance(element);
        };
    
    window.enhanceMarkdownContent =
        enhance;
    
    document.addEventListener(
        "click",
        (event) => {
            const target =
                event.target;
            
            if (
                !(target instanceof Element)
            ) {
                return;
            }
            
            const link =
                target.closest(
                    ".formatted-response a[href]"
                );
            
            if (!link) return;
            
            const href =
                link.getAttribute(
                    "href"
                ) || "";
            
            if (
                /^https?:\/\//i.test(
                    href
                )
            ) {
                link.target = "_blank";
                link.rel =
                    "noopener noreferrer";
            }
        }
    );
})();
