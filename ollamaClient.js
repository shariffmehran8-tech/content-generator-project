// ollamaClient.js
// Thin wrapper around a local Ollama instance. No external API dependency —
// everything here talks to http://localhost:11434, which you run yourself
// (`ollama serve` + `ollama pull llama3.1:8b` or similar).

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || 'llama3.1:8b';
const REQUEST_TIMEOUT_MS = 30000;

/**
 * Checks whether Ollama is reachable. Cheap, fast, used before attempting
 * a real generation call so callers can fall back gracefully.
 */
async function isOllamaAvailable() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${OLLAMA_HOST}/api/tags`, { signal: controller.signal });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Sends a prompt to the local Ollama model and returns the generated text.
 * Throws on failure — caller (contentGen.js) is responsible for fallback behavior.
 */
async function generateWithOllama({ prompt, model = DEFAULT_MODEL, temperature = 0.7 }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${OLLAMA_HOST}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: { temperature }
      }),
      signal: controller.signal
    });

    if (!res.ok) {
      throw new Error(`Ollama returned status ${res.status}`);
    }

    const data = await res.json();
    return (data.response || '').trim();
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Ollama request timed out — is `ollama serve` running and is the model pulled?');
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { isOllamaAvailable, generateWithOllama, OLLAMA_HOST, DEFAULT_MODEL };
