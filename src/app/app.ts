/**
 * GEMINI ASSISTANT
 * Bilingual English / বাংলা
 * Multi-session chat
 * Dynamic Gemini model discovery
 * SSE streaming
 * AbortController
 * STT / TTS
 * Markdown + DOMPurify
 */

const i18n = {
    en: {
        newChat: "New Chat",
        searchPlaceholder: "Search chats...",
        clearAll: "Clear All",
        themeText: "Dark Mode",
        personaGeneral: "General Assistant",
        personaTutor: "Language Tutor",
        personaCoder: "Code Expert",
        personaWriter: "Creative Writer",
        personaSolver: "Problem Solver",
        tempLabel: "Temp:",
        inputPlaceholder: "Type a message...",
        today: "Today",
        yesterday: "Yesterday",
        older: "Older",
        loadingModels: "Loading models...",
        noModels: "No models available",
        errorModel: "Please select a model first.",
        errorSpeech: "Speech recognition is not supported in this browser.",
        networkError: "Network error. Please try again.",
        stopped: "Generation stopped.",
        clearConfirm: "Delete all chat history?",
        renamePrompt: "Enter new chat title:",
        modelsFailed: "Could not load Gemini models.",
        exportEmpty: "There is no active conversation to export.",
        copySuccess: "Copied",
        copyFailed: "Copy failed"
    },

    bn: {
        newChat: "নতুন চ্যাট",
        searchPlaceholder: "চ্যাট খুঁজুন...",
        clearAll: "সব মুছুন",
        themeText: "ডার্ক মোড",
        personaGeneral: "সাধারণ সহকারী",
        personaTutor: "ভাষা শিক্ষক",
        personaCoder: "কোড বিশেষজ্ঞ",
        personaWriter: "সৃজনশীল লেখক",
        personaSolver: "সমস্যা সমাধানকারী",
        tempLabel: "তাপমাত্রা:",
        inputPlaceholder: "কিছু লিখুন...",
        today: "আজ",
        yesterday: "গতকাল",
        older: "পুরানো",
        loadingModels: "মডেল লোড হচ্ছে...",
        noModels: "কোনো মডেল পাওয়া যায়নি",
        errorModel: "প্রথমে একটি মডেল নির্বাচন করুন।",
        errorSpeech: "এই ব্রাউজারে Speech Recognition সাপোর্ট নেই।",
        networkError: "নেটওয়ার্ক সমস্যা হয়েছে। আবার চেষ্টা করুন।",
        stopped: "জেনারেশন বন্ধ করা হয়েছে।",
        clearConfirm: "সব চ্যাট ইতিহাস মুছে ফেলবেন?",
        renamePrompt: "নতুন চ্যাটের নাম লিখুন:",
        modelsFailed: "Gemini মডেল লোড করা যায়নি।",
        exportEmpty: "Export করার মতো কোনো active conversation নেই।",
        copySuccess: "কপি হয়েছে",
        copyFailed: "কপি করা যায়নি"
    }
};

const STORAGE_SESSIONS = "gemini_sessions";
const STORAGE_ACTIVE = "gemini_active_id";
const STORAGE_LANG = "gemini_lang";
const STORAGE_THEME = "gemini_theme";

const MAX_SESSIONS = 100;
const MAX_HISTORY_MESSAGES = 100;
const MAX_TEXT_LENGTH = 20000;

let currentLang =
    localStorage.getItem(STORAGE_LANG) ||
    localStorage.getItem("lang") ||
    "en";

let sessions = loadSessions();

let activeSessionId =
    localStorage.getItem(STORAGE_ACTIVE) || null;

let abortController = null;
let isGenerating = false;


// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener("DOMContentLoaded", initApp);

async function initApp() {
    applySavedTheme();
    setupEventListeners();
    applyLanguage();

    renderSessionList();

    if (
        activeSessionId &&
        getActiveSession()
    ) {
        loadSession(activeSessionId);
    } else if (sessions.length > 0) {
        loadSession(sessions[0].id);
    } else {
        createNewSession();
    }

    await fetchModels();
}


// ============================================================
// SAFE LOCAL STORAGE
// ============================================================

function loadSessions() {
    try {
        const raw =
            localStorage.getItem(
                STORAGE_SESSIONS
            );

        if (!raw) {
            return [];
        }

        const parsed = JSON.parse(raw);

        if (!Array.isArray(parsed)) {
            return [];
        }

        return parsed
            .filter(
                (session) =>
                    session &&
                    typeof session === "object" &&
                    typeof session.id === "string"
            )
            .map((session) => ({
                id: session.id,

                title:
                    typeof session.title === "string" &&
                    session.title.trim()
                        ? session.title.trim().slice(0, 100)
                        : "New Chat",

                history:
                    sanitizeLocalHistory(
                        session.history
                    ),

                timestamp:
                    Number.isFinite(
                        Number(session.timestamp)
                    )
                        ? Number(session.timestamp)
                        : Date.now()
            }))
            .slice(0, MAX_SESSIONS);

    } catch (error) {
        console.error(
            "Failed to load sessions:",
            error
        );

        return [];
    }
}

function sanitizeLocalHistory(history) {
    if (!Array.isArray(history)) {
        return [];
    }

    return history
        .filter(
            (item) =>
                item &&
                (item.role === "user" ||
                    item.role === "model") &&
                Array.isArray(item.parts)
        )
        .map((item) => {
            const text = item.parts
                .filter(
                    (part) =>
                        part &&
                        typeof part.text === "string"
                )
                .map((part) => part.text)
                .join("\n")
                .trim();

            if (!text) {
                return null;
            }

            return {
                role: item.role,
                parts: [
                    {
                        text: text.slice(
                            0,
                            MAX_TEXT_LENGTH
                        )
                    }
                ]
            };
        })
        .filter(Boolean)
        .slice(-MAX_HISTORY_MESSAGES);
}

function saveSessions() {
    try {
        sessions = sessions
            .slice(0, MAX_SESSIONS);

        localStorage.setItem(
            STORAGE_SESSIONS,
            JSON.stringify(sessions)
        );
    } catch (error) {
        console.error(
            "Failed to save sessions:",
            error
        );
    }
}


// ============================================================
// EVENT LISTENERS
// ============================================================

function setupEventListeners() {
    const chatForm =
        document.getElementById("chat-form");

    const newChatBtn =
        document.getElementById("new-chat-btn");

    const langToggle =
        document.getElementById("lang-toggle");

    const themeToggle =
        document.getElementById("theme-toggle");

    const tempSlider =
        document.getElementById("temp-slider");

    const menuToggle =
        document.getElementById("menu-toggle");

    const closeSidebar =
        document.getElementById("close-sidebar");

    const sttBtn =
        document.getElementById("stt-btn");

    const stopBtn =
        document.getElementById("stop-btn");

    const clearAllBtn =
        document.getElementById("clear-all-btn");

    const exportBtn =
        document.getElementById("export-btn");

    const searchInput =
        document.getElementById("chat-search");

    const userInput =
        document.getElementById("user-input");

    chatForm.addEventListener(
        "submit",
        handleChatSubmit
    );

    newChatBtn.addEventListener(
        "click",
        () => {
            createNewSession();
            closeMobileSidebar();
        }
    );

    langToggle.addEventListener(
        "click",
        toggleLanguage
    );

    themeToggle.addEventListener(
        "click",
        toggleTheme
    );

    tempSlider.addEventListener(
        "input",
        (event) => {
            document.getElementById(
                "temp-value"
            ).textContent =
                event.target.value;
        }
    );

    menuToggle.addEventListener(
        "click",
        () => {
            document
                .getElementById("sidebar")
                .classList.add("open");
        }
    );

    closeSidebar.addEventListener(
        "click",
        closeMobileSidebar
    );

    sttBtn.addEventListener(
        "click",
        runSTT
    );

    stopBtn.addEventListener(
        "click",
        stopGeneration
    );

    clearAllBtn.addEventListener(
        "click",
        clearAllSessions
    );

    exportBtn.addEventListener(
        "click",
        exportChat
    );

    searchInput.addEventListener(
        "input",
        (event) => {
            renderSessionList(
                event.target.value
            );
        }
    );

    userInput.addEventListener(
        "input",
        autoResizeTextarea
    );

    userInput.addEventListener(
        "keydown",
        (event) => {
            if (
                event.key === "Enter" &&
                !event.shiftKey &&
                window.innerWidth > 600
            ) {
                event.preventDefault();
                chatForm.requestSubmit();
            }
        }
    );
}


// ============================================================
// MODEL DISCOVERY
// ============================================================

async function fetchModels() {
    const select =
        document.getElementById(
            "model-select"
        );

    const sendBtn =
        document.getElementById(
            "send-btn"
        );

    select.disabled = true;
    sendBtn.disabled = true;

    select.innerHTML = "";

    const loadingOption =
        document.createElement(
            "option"
        );

    loadingOption.value = "";
    loadingOption.textContent =
        i18n[currentLang].loadingModels;

    select.appendChild(
        loadingOption
    );

    try {
        const response =
            await fetch(
                "/api/models",
                {
                    method: "GET",
                    headers: {
                        Accept:
                            "application/json"
                    },
                    cache: "no-store"
                }
            );

        const data =
            await response.json();

        if (
            !response.ok ||
            !data ||
            !Array.isArray(data.models) ||
            data.models.length === 0
        ) {
            throw new Error(
                data?.error ||
                    i18n[currentLang]
                        .modelsFailed
            );
        }

        select.innerHTML = "";

        data.models.forEach(
            (model) => {
                if (
                    !model ||
                    typeof model.id !==
                        "string" ||
                    !model.id.trim()
                ) {
                    return;
                }

                const option =
                    document.createElement(
                        "option"
                    );

                option.value =
                    model.id.trim();

                option.textContent =
                    model.displayName ||
                    model.id;

                if (
                    model.description
                ) {
                    option.title =
                        model.description;
                }

                select.appendChild(
                    option
                );
            }
        );

        if (
            select.options.length === 0
        ) {
            throw new Error(
                "No valid models returned."
            );
        }

        select.disabled = false;
        sendBtn.disabled = false;

    } catch (error) {
        console.error(
            "Model discovery failed:",
            error
        );

        select.innerHTML = "";

        const option =
            document.createElement(
                "option"
            );

        option.value = "";
        option.textContent =
            i18n[currentLang].noModels;

        select.appendChild(
            option
        );

        select.disabled = true;
        sendBtn.disabled = true;

        showNotification(
            i18n[currentLang]
                .modelsFailed,
            "error"
        );
    }
}


// ============================================================
// CHAT SUBMISSION
// ============================================================

async function handleChatSubmit(
    event
) {
    event.preventDefault();

    if (isGenerating) {
        return;
    }

    const input =
        document.getElementById(
            "user-input"
        );

    const modelSelect =
        document.getElementById(
            "model-select"
        );

    const message =
        input.value.trim();

    const modelName =
        modelSelect.value.trim();

    if (!message) {
        return;
    }

    if (!modelName) {
        showNotification(
            i18n[currentLang]
                .errorModel,
            "error"
        );

        return;
    }

    let session =
        getActiveSession();

    if (!session) {
        session =
            createNewSession(
                message.substring(
                    0,
                    40
                )
            );
    }

    appendMessage(
        "user",
        message
    );

    input.value = "";
    input.style.height = "auto";

    await startStreaming(
        message,
        modelName
    );
}


// ============================================================
// STREAMING
// ============================================================

async function startStreaming(
    userMessage,
    modelName
) {
    const session =
        getActiveSession();

    if (!session) {
        return;
    }

    isGenerating = true;

    abortController =
        new AbortController();

    toggleStopButton(true);

    const aiMessage =
        appendMessage(
            "model",
            ""
        );

    const contentElement =
        aiMessage.querySelector(
            ".content"
        );

    let fullResponse = "";

    try {
        const response =
            await fetch(
                "/api/chat",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json",
                        Accept:
                            "text/event-stream"
                    },

                    body:
                        JSON.stringify({
                            message:
                                userMessage,

                            history:
                                session.history,

                            modelName:
                                modelName,

                            temperature:
                                parseFloat(
                                    document
                                        .getElementById(
                                            "temp-slider"
                                        )
                                        .value
                                ),

                            systemInstruction:
                                getSystemInstruction()
                        }),

                    signal:
                        abortController
                            .signal
                }
            );

        if (!response.ok) {
            let errorMessage =
                "Server error.";

            try {
                const errorData =
                    await response.json();

                if (
                    errorData &&
                    typeof errorData.error ===
                        "string"
                ) {
                    errorMessage =
                        errorData.error;
                }
            } catch (_) {}

            throw new Error(
                errorMessage
            );
        }

        if (!response.body) {
            throw new Error(
                "Streaming response is not available."
            );
        }

        const reader =
            response.body.getReader();

        const decoder =
            new TextDecoder(
                "utf-8"
            );

        let buffer = "";
        let streamFinished =
            false;

        while (
            !streamFinished
        ) {
            const {
                value,
                done
            } =
                await reader.read();

            if (done) {
                break;
            }

            buffer +=
                decoder.decode(
                    value,
                    {
                        stream: true
                    }
                );

            const events =
                buffer.split(
                    "\n\n"
                );

            buffer =
                events.pop() || "";

            for (
                const event
                of events
            ) {
                const dataLines =
                    event
                        .split("\n")
                        .filter(
                            (line) =>
                                line.startsWith(
                                    "data:"
                                )
                        );

                if (
                    dataLines.length ===
                    0
                ) {
                    continue;
                }

                const data =
                    dataLines
                        .map(
                            (line) =>
                                line
                                    .slice(
                                        5
                                    )
                                    .trim()
                        )
                        .join("\n");

                if (!data) {
                    continue;
                }

                if (
                    data === "[DONE]"
                ) {
                    streamFinished =
                        true;
                    break;
                }

                try {
                    const parsed =
                        JSON.parse(
                            data
                        );

                    if (
                        typeof parsed.text ===
                        "string"
                    ) {
                        fullResponse +=
                            parsed.text;

                        //
                        if (typeof window.renderEnhancedMarkdown === "function") {
                            window.renderEnhancedMarkdown(
                                contentElement,
                                fullResponse
                            );
                        } else {
                            renderMarkdown(
                                contentElement,
                                fullResponse
                            );
                        }

                        scrollDown();
                    }

                    if (
                        typeof parsed.error ===
                        "string"
                    ) {
                        renderError(
                            contentElement,
                            parsed.error
                        );
                    }

                } catch (
                    parseError
                ) {
                    console.error(
                        "SSE parse error:",
                        parseError
                    );
                }
            }
        }

        buffer +=
            decoder.decode();

        if (
            !fullResponse.trim() &&
            !contentElement
                .textContent
                .trim()
        ) {
            renderError(
                contentElement,
                "No response received."
            );
        }

        if (
            fullResponse.trim()
        ) {
            saveToHistory(
                userMessage,
                fullResponse
            );
        }

    } catch (error) {
        if (
            error &&
            error.name ===
                "AbortError"
        ) {
            if (
                fullResponse.trim()
            ) {
                saveToHistory(
                    userMessage,
                    fullResponse
                );
            }

            renderError(
                contentElement,
                i18n[currentLang]
                    .stopped
            );

        } else {
            console.error(
                "Chat request failed:",
                error
            );

            renderError(
                contentElement,
                error?.message ||
                    i18n[currentLang]
                        .networkError
            );
        }

    } finally {
        toggleStopButton(false);

        abortController = null;
        isGenerating = false;

        scrollDown();
    }
}


// ============================================================
// MARKDOWN
// ============================================================

function renderMarkdown(
    element,
    markdown
) {
    if (!element) {
        return;
    }
    
    const source =
        String(markdown || "");
    
    try {
        if (
            typeof window.renderEnhancedMarkdown ===
            "function"
        ) {
            window.renderEnhancedMarkdown(
                element,
                source
            );
            
            return;
        }
        
        const html =
            marked.parse(
                source,
                {
                    gfm: true,
                    breaks: true
                }
            );
        
        element.innerHTML =
            DOMPurify.sanitize(
                html
            );
        
    } catch (error) {
        console.error(
            "Markdown rendering error:",
            error
        );
        
        element.textContent =
            source;
    }
}

function renderError(
    element,
    message
) {
    element.innerHTML = "";

    const error =
        document.createElement(
            "span"
        );

    error.className = "error";
    error.textContent =
        message;

    element.appendChild(
        error
    );
}


// ============================================================
// MESSAGE UI
// ============================================================

function appendMessage(
    role,
    text
) {
    const container =
        document.getElementById(
            "messages"
        );

    const messageElement =
        document.createElement(
            "div"
        );

    messageElement.className =
        `message ${role}`;

    const avatar =
        document.createElement(
            "div"
        );

    avatar.className =
        "avatar";

    const icon =
        document.createElement(
            "i"
        );

    icon.className =
        role === "user"
            ? "fas fa-user"
            : "fas fa-robot";

    avatar.appendChild(icon);

    const content =
        document.createElement(
            "div"
        );

    content.className =
        "content";

    renderMarkdown(
        content,
        text
    );

    messageElement.appendChild(
        avatar
    );

    messageElement.appendChild(
        content
    );

    if (
        role === "model"
    ) {
        const ttsButton =
            document.createElement(
                "button"
            );

        ttsButton.type = "button";
        ttsButton.className =
            "tts-btn";

        ttsButton.title =
            "Read aloud";

        ttsButton.innerHTML =
            '<i class="fas fa-volume-up"></i>';

        ttsButton.addEventListener(
            "click",
            () => {
                speak(
                    text ||
                        content.textContent
                );
            }
        );

        messageElement.appendChild(
            ttsButton
        );
    }

    container.appendChild(
        messageElement
    );

    return messageElement;
}


// ============================================================
// SESSION MANAGEMENT
// ============================================================

function createNewSession(
    title = i18n[currentLang]
        .newChat
) {
    const id =
        Date.now().toString() +
        Math.random()
            .toString(36)
            .substring(2, 8);

    const session = {
        id,

        title:
            title.trim() ||
            i18n[currentLang]
                .newChat,

        history: [],

        timestamp:
            Date.now()
    };

    sessions.unshift(
        session
    );

    sessions =
        sessions.slice(
            0,
            MAX_SESSIONS
        );

    activeSessionId =
        id;

    saveSessions();

    localStorage.setItem(
        STORAGE_ACTIVE,
        id
    );

    loadSession(id);

    return session;
}

function loadSession(id) {
    const session =
        sessions.find(
            (item) =>
                item.id === id
        );

    if (!session) {
        return;
    }

    activeSessionId =
        id;

    localStorage.setItem(
        STORAGE_ACTIVE,
        id
    );

    const messages =
        document.getElementById(
            "messages"
        );

    messages.innerHTML = "";

    document.getElementById(
        "chat-title"
    ).textContent =
        session.title;

    session.history.forEach(
        (message) => {
            if (
                message &&
                (
                    message.role ===
                        "user" ||
                    message.role ===
                        "model"
                ) &&
                Array.isArray(
                    message.parts
                ) &&
                message.parts[0] &&
                typeof message.parts[0]
                    .text ===
                    "string"
            ) {
                appendMessage(
                    message.role,
                    message.parts[0].text
                );
            }
        }
    );

    renderSessionList();

    closeMobileSidebar();

    scrollDown();
}

function saveToHistory(
    userText,
    modelText
) {
    const session =
        getActiveSession();

    if (!session) {
        return;
    }

    const cleanUserText =
        userText.trim();

    const cleanModelText =
        modelText.trim();

    if (
        !cleanUserText ||
        !cleanModelText
    ) {
        return;
    }

    if (
        session.history.length ===
            0 ||
        session.title ===
            i18n.en.newChat ||
        session.title ===
            i18n.bn.newChat
    ) {
        session.title =
            cleanUserText.substring(
                0,
                40
            );
    }

    session.history.push(
        {
            role: "user",
            parts: [
                {
                    text:
                        cleanUserText.slice(
                            0,
                            MAX_TEXT_LENGTH
                        )
                }
            ]
        },
        {
            role: "model",
            parts: [
                {
                    text:
                        cleanModelText.slice(
                            0,
                            MAX_TEXT_LENGTH
                        )
                }
            ]
        }
    );

    session.history =
        session.history.slice(
            -MAX_HISTORY_MESSAGES
        );

    session.timestamp =
        Date.now();

    saveSessions();

    localStorage.setItem(
        STORAGE_ACTIVE,
        session.id
    );

    document.getElementById(
        "chat-title"
    ).textContent =
        session.title;

    renderSessionList();
}


// ============================================================
// SESSION LIST
// ============================================================

function renderSessionList(
    filter = ""
) {
    const list =
        document.getElementById(
            "chat-history-list"
        );

    if (!list) {
        return;
    }

    list.innerHTML = "";

    const search =
        String(filter)
            .toLowerCase()
            .trim();

    const filtered =
        sessions.filter(
            (session) =>
                String(
                    session.title
                )
                    .toLowerCase()
                    .includes(search)
        );

    const groups = {
        today: [],
        yesterday: [],
        older: []
    };

    const now =
        new Date();

    filtered.forEach(
        (session) => {
            const date =
                new Date(
                    session.timestamp
                );

            const diff =
                (now - date) /
                (1000 * 60 * 60 * 24);

            if (diff < 1) {
                groups.today.push(
                    session
                );
            } else if (
                diff < 2
            ) {
                groups.yesterday.push(
                    session
                );
            } else {
                groups.older.push(
                    session
                );
            }
        }
    );

    Object.keys(groups)
        .forEach(
            (groupName) => {
                if (
                    groups[
                        groupName
                    ].length === 0
                ) {
                    return;
                }

                const header =
                    document.createElement(
                        "div"
                    );

                header.className =
                    "group-header";

                header.textContent =
                    i18n[currentLang][
                        groupName
                    ];

                list.appendChild(
                    header
                );

                groups[
                    groupName
                ].forEach(
                    (session) => {
                        const item =
                            document.createElement(
                                "div"
                            );

                        item.className =
                            `session-item ${
                                session.id ===
                                activeSessionId
                                    ? "active"
                                    : ""
                            }`;

                        const title =
                            document.createElement(
                                "span"
                            );

                        title.className =
                            "title";

                        title.textContent =
                            session.title;

                        const actions =
                            document.createElement(
                                "div"
                            );

                        actions.className =
                            "actions";

                        const edit =
                            document.createElement(
                                "i"
                            );

                        edit.className =
                            "fas fa-edit";

                        edit.title =
                            "Rename";

                        edit.addEventListener(
                            "click",
                            (event) =>
                                renameSession(
                                    session.id,
                                    event
                                )
                        );

                        const trash =
                            document.createElement(
                                "i"
                            );

                        trash.className =
                            "fas fa-trash";

                        trash.title =
                            "Delete";

                        trash.addEventListener(
                            "click",
                            (event) =>
                                deleteSession(
                                    session.id,
                                    event
                                )
                        );

                        actions.appendChild(
                            edit
                        );

                        actions.appendChild(
                            trash
                        );

                        item.appendChild(
                            title
                        );

                        item.appendChild(
                            actions
                        );

                        item.addEventListener(
                            "click",
                            () => {
                                if (
                                    isGenerating
                                ) {
                                    return;
                                }

                                loadSession(
                                    session.id
                                );
                            }
                        );

                        list.appendChild(
                            item
                        );
                    }
                );
            }
        );
}


// ============================================================
// DELETE / RENAME / CLEAR
// ============================================================

function deleteSession(
    id,
    event
) {
    event?.stopPropagation();

    if (
        isGenerating &&
        id === activeSessionId
    ) {
        stopGeneration();
    }

    sessions =
        sessions.filter(
            (session) =>
                session.id !== id
        );

    if (
        activeSessionId === id
    ) {
        activeSessionId =
            null;

        localStorage.removeItem(
            STORAGE_ACTIVE
        );

        const next =
            sessions[0];

        if (next) {
            loadSession(
                next.id
            );
        } else {
            createNewSession();
        }
    }

    saveSessions();
    renderSessionList();
}

function renameSession(
    id,
    event
) {
    event?.stopPropagation();

    const session =
        sessions.find(
            (item) =>
                item.id === id
        );

    if (!session) {
        return;
    }

    const newTitle =
        window.prompt(
            i18n[currentLang]
                .renamePrompt,
            session.title
        );

    if (
        newTitle === null
    ) {
        return;
    }

    const cleanTitle =
        newTitle.trim();

    if (!cleanTitle) {
        return;
    }

    session.title =
        cleanTitle.substring(
            0,
            100
        );

    saveSessions();

    if (
        id === activeSessionId
    ) {
        document.getElementById(
            "chat-title"
        ).textContent =
            session.title;
    }

    renderSessionList();
}

function clearAllSessions() {
    if (
        isGenerating
    ) {
        stopGeneration();
    }

    if (
        !window.confirm(
            i18n[currentLang]
                .clearConfirm
        )
    ) {
        return;
    }

    sessions = [];

    activeSessionId =
        null;

    localStorage.removeItem(
        STORAGE_SESSIONS
    );

    localStorage.removeItem(
        STORAGE_ACTIVE
    );

    createNewSession();
}


// ============================================================
// LANGUAGE
// ============================================================

function toggleLanguage() {
    currentLang =
        currentLang === "en"
            ? "bn"
            : "en";

    localStorage.setItem(
        STORAGE_LANG,
        currentLang
    );

    localStorage.setItem(
        "lang",
        currentLang
    );

    applyLanguage();

    renderSessionList();
}

function applyLanguage() {
    document
        .querySelectorAll(
            "[data-i18n]"
        )
        .forEach((element) => {
            const key =
                element.getAttribute(
                    "data-i18n"
                );

            if (
                i18n[currentLang][key]
            ) {
                element.textContent =
                    i18n[currentLang][key];
            }
        });

    document
        .querySelectorAll(
            "[data-i18n-placeholder]"
        )
        .forEach(
            (element) => {
                const key =
                    element.getAttribute(
                        "data-i18n-placeholder"
                    );

                if (
                    i18n[currentLang][
                        key
                    ]
                ) {
                    element.placeholder =
                        i18n[
                            currentLang
                        ][key];
                }
            }
        );

    const langLabel =
        document.getElementById(
            "lang-label"
        );

    if (langLabel) {
        langLabel.textContent =
            currentLang === "en"
                ? "বাংলা"
                : "English";
    }
}


// ============================================================
// THEME
// ============================================================

function applySavedTheme() {
    const savedTheme =
        localStorage.getItem(
            STORAGE_THEME
        );

    const body =
        document.body;

    if (
        savedTheme ===
        "dark"
    ) {
        body.classList.remove(
            "light-mode"
        );

        body.classList.add(
            "dark-mode"
        );
    } else {
        body.classList.remove(
            "dark-mode"
        );

        body.classList.add(
            "light-mode"
        );
    }

    updateThemeButton();
}

function toggleTheme() {
    const body =
        document.body;

    const isDark =
        body.classList.contains(
            "dark-mode"
        );

    if (isDark) {
        body.classList.remove(
            "dark-mode"
        );

        body.classList.add(
            "light-mode"
        );

        localStorage.setItem(
            STORAGE_THEME,
            "light"
        );
    } else {
        body.classList.remove(
            "light-mode"
        );

        body.classList.add(
            "dark-mode"
        );

        localStorage.setItem(
            STORAGE_THEME,
            "dark"
        );
    }

    updateThemeButton();
}

function updateThemeButton() {
    const button =
        document.getElementById(
            "theme-toggle"
        );

    if (!button) {
        return;
    }

    const icon =
        button.querySelector(
            "i"
        );

    const isDark =
        document.body.classList.contains(
            "dark-mode"
        );

    if (icon) {
        icon.className =
            isDark
                ? "fas fa-sun"
                : "fas fa-moon";
    }

    const label =
        button.querySelector(
            "span"
        );

    if (label) {
        label.textContent =
            i18n[currentLang]
                .themeText;
    }
}


// ============================================================
// PERSONA / SYSTEM INSTRUCTION
// ============================================================

function getSystemInstruction() {
    const persona =
        document.getElementById(
            "persona-select"
        ).value;

    const instructions = {
        general:
            "You are a helpful assistant.",

        tutor:
            "You are a language tutor. Explain concepts clearly in both English and Bengali when useful.",

        coder:
            "You are an expert software engineer. Provide secure, efficient, maintainable code with clear explanations.",

        writer:
            "You are a creative writer. Help the user with storytelling, writing, editing, and creative tasks.",

        solver:
            "You are a logical problem solver. Break complex problems into clear, useful steps."
    };

    return (
        instructions[persona] ||
        instructions.general
    );
}


// ============================================================
// STT / TTS
// ============================================================

function speak(text) {
    if (
        !(
            "speechSynthesis" in
            window
        )
    ) {
        return;
    }

    if (!text) {
        return;
    }

    window.speechSynthesis.cancel();

    const utterance =
        new SpeechSynthesisUtterance(
            text
        );

    utterance.lang =
        currentLang === "en"
            ? "en-US"
            : "bn-BD";

    window.speechSynthesis.speak(
        utterance
    );
}

function runSTT() {
    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        showNotification(
            i18n[currentLang]
                .errorSpeech,
            "error"
        );

        return;
    }

    const recognition =
        new SpeechRecognition();

    recognition.lang =
        currentLang === "en"
            ? "en-US"
            : "bn-BD";

    recognition.interimResults =
        false;

    recognition.continuous =
        false;

    const button =
        document.getElementById(
            "stt-btn"
        );

    recognition.onstart =
        () => {
            button.classList.add(
                "recording"
            );
        };

    recognition.onend =
        () => {
            button.classList.remove(
                "recording"
            );
        };

    recognition.onerror =
        (event) => {
            console.error(
                "Speech recognition error:",
                event.error
            );

            button.classList.remove(
                "recording"
            );
        };

    recognition.onresult =
        (event) => {
            const input =
                document.getElementById(
                    "user-input"
                );

            const transcript =
                event.results?.[0]?.[0]
                    ?.transcript || "";

            if (!transcript) {
                return;
            }

            input.value =
                transcript;

            autoResizeTextarea();
            input.focus();
        };

    try {
        recognition.start();
    } catch (error) {
        console.error(
            "Speech recognition start failed:",
            error
        );
    }
}


// ============================================================
// UI HELPERS
// ============================================================

function autoResizeTextarea() {
    const input =
        document.getElementById(
            "user-input"
        );

    if (!input) {
        return;
    }

    input.style.height =
        "auto";

    input.style.height =
        `${Math.min(
            input.scrollHeight,
            200
        )}px`;
}

function scrollDown() {
    const windowElement =
        document.getElementById(
            "chat-window"
        );

    if (!windowElement) {
        return;
    }

    windowElement.scrollTop =
        windowElement.scrollHeight;
}

function closeMobileSidebar() {
    const sidebar =
        document.getElementById(
            "sidebar"
        );

    if (
        sidebar &&
        window.innerWidth <= 768
    ) {
        sidebar.classList.remove(
            "open"
        );
    }
}

function toggleStopButton(
    show
) {
    const sendBtn =
        document.getElementById(
            "send-btn"
        );

    const stopBtn =
        document.getElementById(
            "stop-btn"
        );

    if (sendBtn) {
        sendBtn.classList.toggle(
            "hidden",
            show
        );
    }

    if (stopBtn) {
        stopBtn.classList.toggle(
            "hidden",
            !show
        );
    }
}

function stopGeneration() {
    if (
        abortController
    ) {
        abortController.abort();
    }
}

// ============================================================
// EXPORT
// ============================================================

function exportChat() {
    const session =
        getActiveSession();

    if (!session) {
        showNotification(
            i18n[currentLang]
                .exportEmpty,
            "error"
        );

        return;
    }

    const exportData = {
        app:
            "Gemini Assistant",
        exportedAt:
            new Date().toISOString(),
        session: session
    };

    const blob =
        new Blob(
            [
                JSON.stringify(
                    exportData,
                    null,
                    2
                )
            ],
            {
                type:
                    "application/json"
            }
        );

    const url =
        URL.createObjectURL(
            blob
        );

    const anchor =
        document.createElement(
            "a"
        );

    anchor.href = url;

    anchor.download =
        `${sanitizeFilename(
            session.title
        ) || "gemini-chat"}.json`;

    document.body.appendChild(
        anchor
    );

    anchor.click();

    anchor.remove();

    setTimeout(
        () => {
            URL.revokeObjectURL(
                url
            );
        },
        1000
    );
}

function sanitizeFilename(
    filename
) {
    return String(filename)
        .replace(
            /[<>:"/\\|?*\x00-\x1F]/g,
            "_"
        )
        .trim()
        .slice(0, 100);
}


// ============================================================
// NOTIFICATION
// ============================================================

function showNotification(
    message,
    type = "info"
) {
    let container =
        document.getElementById(
            "notification-container"
        );

    if (!container) {
        container =
            document.createElement(
                "div"
            );

        container.id =
            "notification-container";

        container.style.position =
            "fixed";

        container.style.top =
            "20px";

        container.style.left =
            "50%";

        container.style.transform =
            "translateX(-50%)";

        container.style.zIndex =
            "9999";

        container.style.maxWidth =
            "90%";

        document.body.appendChild(
            container
        );
    }

    const notification =
        document.createElement(
            "div"
        );

    notification.textContent =
        message;

    notification.className =
        `notification ${type}`;

    notification.style.padding =
        "10px 16px";

    notification.style.marginBottom =
        "8px";

    notification.style.borderRadius =
        "8px";

    notification.style.background =
        type === "error"
            ? "#dc3545"
            : "#007bff";

    notification.style.color =
        "#fff";

    notification.style.boxShadow =
        "0 4px 12px rgba(0,0,0,.2)";

    container.appendChild(
        notification
    );

    setTimeout(
        () => {
            notification.remove();
        },
        3000
    );
}


// ============================================================
// ACTIVE SESSION
// ============================================================

function getActiveSession() {
    return sessions.find(
        (session) =>
            session.id ===
            activeSessionId
    );
}
