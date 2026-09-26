// contentGen.js
// Hybrid content generation module.
//
// - Social captions & ad copy -> template/phrase-bank engine (deterministic, instant, no infra)
// - Blog posts -> local Ollama call (optional; falls back to an outline if Ollama isn't running)
//
// No external API dependency anywhere in this module.

const fs = require('fs');
const path = require('path');
const { isOllamaAvailable, generateWithOllama } = require('./ollamaClient');

const phraseBank = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'phraseBank.json'), 'utf-8')
);

const PLATFORM_LIMITS = {
  x: 280,
  instagram: 2200,
  linkedin: 3000
};

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function fillTemplate(template, slots) {
  return template.replace(/{(\w+)}/g, (match, key) => {
    if (key === 'hook') return slots.hook ?? pickRandom(phraseBank.hooks);
    if (key === 'cta') return slots.cta ?? pickRandom(phraseBank.ctas);
    return slots[key] ?? '';
  }).replace(/\s+/g, ' ').trim();
}

function truncateToLimit(text, limit) {
  if (!limit || text.length <= limit) return text;
  return text.slice(0, limit - 1).trim() + '…';
}

/**
 * Generates a social media caption.
 */
function generateSocialCaption(opts) {
  const { platform = 'instagram', tone = 'casual', productName, keyPoint, hook, cta, variants = 3 } = opts;

  const bank = phraseBank.caption[platform]?.[tone] || phraseBank.caption.instagram.casual;
  const limit = PLATFORM_LIMITS[platform];

  const results = new Set();
  let attempts = 0;
  while (results.size < Math.min(variants, bank.length) && attempts < bank.length * 3) {
    const template = pickRandom(bank);
    const filled = fillTemplate(template, { productName, keyPoint, hook, cta });
    results.add(truncateToLimit(filled, limit));
    attempts++;
  }

  return {
    type: 'caption',
    source: 'template',
    platform,
    tone,
    variants: Array.from(results)
  };
}

/**
 * Generates ad copy.
 */
function generateAdCopy(opts) {
  const { tone = 'professional', productName, benefit, painPoint, keyPoint, hook, cta, variants = 3 } = opts;

  const bank = phraseBank.ad.general[tone] || phraseBank.ad.general.professional;

  const results = new Set();
  let attempts = 0;
  while (results.size < Math.min(variants, bank.length) && attempts < bank.length * 3) {
    const template = pickRandom(bank);
    const filled = fillTemplate(template, { productName, benefit, painPoint, keyPoint, hook, cta });
    results.add(filled);
    attempts++;
  }

  return {
    type: 'ad',
    source: 'template',
    tone,
    variants: Array.from(results)
  };
}

/**
 * Generates a blog post draft via local Ollama. Falls back to a structured
 * outline (no LLM) if Ollama isn't reachable, so the feature never hard-fails.
 */
async function generateBlogPost(opts) {
  const { topic, tone = 'professional', keyPoints = [], targetLength = 600 } = opts;

  const available = await isOllamaAvailable();

  if (!available) {
    return {
      type: 'blog',
      source: 'fallback-outline',
      note: 'Ollama not reachable at localhost:11434 — returning a structured outline instead. Run `ollama serve` to enable full drafts.',
      draft: buildFallbackOutline(topic, keyPoints)
    };
  }

  const prompt = buildBlogPrompt({ topic, tone, keyPoints, targetLength });

  try {
    const text = await generateWithOllama({ prompt, temperature: 0.7 });
    return {
      type: 'blog',
      source: 'ollama',
      draft: text
    };
  } catch (err) {
    return {
      type: 'blog',
      source: 'fallback-outline',
      note: `Ollama call failed (${err.message}) — returning a structured outline instead.`,
      draft: buildFallbackOutline(topic, keyPoints)
    };
  }
}

function buildBlogPrompt({ topic, tone, keyPoints, targetLength }) {
  const pointsList = keyPoints.length
    ? `Key points to include:\n${keyPoints.map(p => `- ${p}`).join('\n')}`
    : '';

  return [
    `Write a ${tone} blog post about: ${topic}`,
    pointsList,
    `Target length: approximately ${targetLength} words.`,
    'Structure it with a short intro, 2-4 subheadings, and a brief closing.',
    'Output only the blog post content, no preamble or meta-commentary.'
  ].filter(Boolean).join('\n\n');
}

function buildFallbackOutline(topic, keyPoints) {
  const points = keyPoints.length ? keyPoints : ['Key point 1', 'Key point 2', 'Key point 3'];
  return [
    `# ${topic}`,
    '',
    '## Introduction',
    '(Draft intro paragraph here — hook the reader, state what this post covers.)',
    '',
    ...points.flatMap(p => [`## ${p}`, '(Expand on this point.)', '']),
    '## Closing',
    '(Wrap up, call to action.)'
  ].join('\n');
}

/**
 * Single entry point. Routes by content type.
 */
async function generateContent(request) {
  const { type } = request;
  if (type === 'caption') return generateSocialCaption(request);
  if (type === 'ad') return generateAdCopy(request);
  if (type === 'blog') return generateBlogPost(request);
  throw new Error(`Unknown content type: ${type}. Expected 'caption', 'ad', or 'blog'.`);
}

module.exports = {
  generateContent,
  generateSocialCaption,
  generateAdCopy,
  generateBlogPost
};
