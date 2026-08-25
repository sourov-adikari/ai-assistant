# Gemini AI Personal Assistant

A mobile-first bilingual AI personal assistant powered by Google's Gemini API.

Supports:

- English
- বাংলা
- Dynamic Gemini model discovery
- Multi-turn conversations
- Multiple chat sessions
- Session search
- Today / Yesterday / Older grouping
- Markdown responses
- Safe HTML rendering with DOMPurify
- SSE streaming
- Stop generation
- Speech-to-Text
- Text-to-Speech
- Temperature control
- Multiple assistant personas
- Dark mode
- Mobile-first responsive UI
- Conversation export
- Local browser persistence

---

## Project Structure

```text
gemini-ai-personal-assistant/
│
├── api/
│   ├── chat.js
│   └── models.js
│
├── public/
│   ├── index.html
│   ├── app.js
│   └── style.css
│
├── .env.example
├── .gitignore
├── Dockerfile
├── package.json
├── README.md
├── server.js
└── vercel.json