// server.js
// Standalone content generation server. Own port (4020), own flat JSON file
// (drafts.json), zero dependency on the main dashboard's backend or data.json.
// Run independently: `node server.js`

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { generateContent } = require('./contentGen');

const app = express();
const PORT = process.env.PORT || 4020;
const DRAFTS_PATH = path.join(__dirname, 'drafts.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- flat file helpers (own file, not shared with dashboard's data.json) ---

function readDrafts() {
  if (!fs.existsSync(DRAFTS_PATH)) return [];
  return JSON.parse(fs.readFileSync(DRAFTS_PATH, 'utf-8'));
}

function writeDrafts(drafts) {
  fs.writeFileSync(DRAFTS_PATH, JSON.stringify(drafts, null, 2));
}

// --- routes ---

app.post('/api/generate', async (req, res) => {
  try {
    const result = await generateContent(req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/drafts', (req, res) => {
  try {
    res.json(readDrafts());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/drafts', (req, res) => {
  try {
    const { type, content, meta = {} } = req.body;
    if (!type || !content) {
      return res.status(400).json({ error: 'type and content are required' });
    }

    const drafts = readDrafts();
    const draft = {
      id: `draft_${Date.now()}`,
      type,
      content,
      meta,
      status: 'pending_approval',
      createdAt: new Date().toISOString()
    };

    drafts.push(draft);
    writeDrafts(drafts);
    res.json(draft);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/drafts/:id/approve', (req, res) => {
  try {
    const drafts = readDrafts();
    const draft = drafts.find(d => d.id === req.params.id);
    if (!draft) return res.status(404).json({ error: 'Draft not found' });
    draft.status = 'approved';
    draft.approvedAt = new Date().toISOString();
    writeDrafts(drafts);
    res.json(draft);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/drafts/:id', (req, res) => {
  try {
    const drafts = readDrafts().filter(d => d.id !== req.params.id);
    writeDrafts(drafts);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Content generator standalone server running on http://localhost:${PORT}`);
});
