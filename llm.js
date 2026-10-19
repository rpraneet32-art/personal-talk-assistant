const fs = require('fs');
const path = require('path');
const { parseDate } = require('./parser');

// Tiny manual .env loader if GROQ_API_KEY is not already present in environment
function ensureEnvLoaded() {
  if (process.env.GROQ_API_KEY) return;
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const k = trimmed.slice(0, eqIdx).trim();
          const v = trimmed.slice(eqIdx + 1).trim().replace(/^['"](.*)['"]$/, '$1');
          if (!process.env[k]) {
            process.env[k] = v;
          }
        }
      }
    } catch (_) {}
  }
}

ensureEnvLoaded();

const ALLOWED_INTENTS = new Set([
  'add_task',
  'list_tasks',
  'complete_task',
  'delete_task',
  'set_due',
  'add_note',
  'list_notes',
  'delete_note',
  'clear_completed',
  'unknown'
]);

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getTodayStringWithWeekday() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const weekday = WEEKDAYS[d.getDay()];
  const ymd = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return `Today is ${weekday}, ${ymd}`;
}

/**
 * Fallback intent parser using Groq LLM API.
 * @param {string} text - User's input command
 * @param {Array} tasks - Current user tasks [{id, title, status}]
 * @param {Array} notes - Current user notes [{id, content}]
 * @returns {Promise<{intent: string, title?: string, content?: string, id?: number, query?: string, dueDate?: string}>}
 */
async function llmParse(text, tasks = [], notes = []) {
  ensureEnvLoaded();
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || !text || typeof text !== 'string') {
    return { intent: 'unknown' };
  }

  const todayPrompt = getTodayStringWithWeekday();
  const taskListSummary = tasks.map(t => ({
    id: t.task_id !== undefined ? t.task_id : t.id,
    title: t.title,
    status: t.status
  }));
  const noteListSummary = notes.map(n => ({
    id: n.note_id !== undefined ? n.note_id : n.id,
    content: n.content
  }));

  const systemPrompt = `${todayPrompt}.
You are an intent parser for a speech-to-text personal task and note assistant.
The input comes from speech recognition and frequently has phonetic slips (e.g. "asset" means "set", "da 8" or "da database" means "database", "milk one" means task with milk).

Allowed intents:
- add_task: { "intent": "add_task", "title": string, "dueText": string (optional, e.g. "friday", "tomorrow", "next monday", "25 october") }
- list_tasks: { "intent": "list_tasks" }
- complete_task: { "intent": "complete_task", "id": number }
- delete_task: { "intent": "delete_task", "id": number }
- set_due: { "intent": "set_due", "id": number, "dueText": string (e.g. "friday", "tomorrow", "next monday", "25 october") }
- add_note: { "intent": "add_note", "content": string }
- list_notes: { "intent": "list_notes" }
- delete_note: { "intent": "delete_note", "id": number }
- clear_completed: { "intent": "clear_completed" }
- unknown: { "intent": "unknown" }

Current Tasks: ${JSON.stringify(taskListSummary)}
Current Notes: ${JSON.stringify(noteListSummary)}

Rules:
1. Do NOT compute dates or format YYYY-MM-DD. Return the exact spoken date words in dueText (e.g. "friday", "tomorrow", "next monday", "25 october").
2. "first", "last", or partial names must be resolved to real existing integer ids from the provided tasks or notes list (if multiple match, resolve to the most recent one with highest id).
3. If unsure, return {"intent": "unknown"}.
4. NEVER guess a delete - only return delete_task or delete_note if the user clearly specified an item and it matches.
5. Reply with one JSON object and nothing else.`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const model = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text }
        ],
        temperature: 0,
        max_tokens: 800,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      return { intent: 'unknown' };
    }

    const data = await response.json();
    const rawContent = data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content
      : '';

    const cleaned = rawContent.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    // Validate intent
    if (!parsed || !ALLOWED_INTENTS.has(parsed.intent)) {
      return { intent: 'unknown' };
    }

    // Validate and resolve id if present
    if (parsed.id !== undefined) {
      const numId = parseInt(parsed.id, 10);
      if (Number.isNaN(numId)) return { intent: 'unknown' };
      parsed.id = numId;

      if (['complete_task', 'delete_task', 'set_due'].includes(parsed.intent)) {
        const validTaskIds = new Set(taskListSummary.map(t => t.id));
        if (!validTaskIds.has(parsed.id)) return { intent: 'unknown' };
      } else if (parsed.intent === 'delete_note') {
        const validNoteIds = new Set(noteListSummary.map(n => n.id));
        if (!validNoteIds.has(parsed.id)) return { intent: 'unknown' };
      }
    }

    // Resolve dueText -> dueDate using deterministic parseDate
    if (parsed.dueText !== undefined && parsed.dueText !== null) {
      if (typeof parsed.dueText === 'string' && parsed.dueText.trim()) {
        const resolvedDate = parseDate(parsed.dueText.trim());
        if (!resolvedDate) {
          return { intent: 'unknown' };
        }
        parsed.dueDate = resolvedDate;
      } else {
        return { intent: 'unknown' };
      }
      delete parsed.dueText;
    } else if (parsed.intent === 'set_due') {
      return { intent: 'unknown' };
    }

    return parsed;
  } catch (_) {
    return { intent: 'unknown' };
  } finally {
    clearTimeout(timeoutId);
  }
}

module.exports = { llmParse, ALLOWED_INTENTS };
