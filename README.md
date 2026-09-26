# Content Generator (Standalone)

Hybrid content generation tool — template engine for short-form (social captions, ad copy),
optional local Ollama call for blog posts. Fully standalone: own port, own flat file,
no external API, no connection to any other app.

## Setup

```bash
npm install
npm start
```

Server runs at `http://localhost:4020`. Open `http://localhost:4020` in your browser
for the UI (served as static CDN-based React, no build step).

## Optional: enable blog post generation

Blog posts use a local Ollama model if available. Without it, you still get a
structured outline — nothing breaks.

```bash
# install Ollama: https://ollama.com
ollama serve
ollama pull llama3.1:8b
```

## Structure

- `server.js` — Express app, port 4020, all routes, reads/writes `drafts.json`
- `contentGen.js` — core generation logic (template engine + Ollama routing)
- `phraseBank.json` — templates for captions/ad copy, edit freely to add more variety
- `ollamaClient.js` — thin wrapper for local Ollama calls
- `drafts.json` — flat file storing saved drafts (own file, not shared with anything else)
- `public/index.html` — CDN-based React frontend, no build step

## API

- `POST /api/generate` — `{ type: 'caption'|'ad'|'blog', ...fields }` → generated draft(s)
- `POST /api/drafts` — save a draft (`{ type, content, meta }`)
- `GET /api/drafts` — list saved drafts
- `PATCH /api/drafts/:id/approve` — mark a draft approved
- `DELETE /api/drafts/:id` — remove a draft

Nothing here auto-publishes anywhere — generation and saving are the only actions.
