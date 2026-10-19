// Flexible rule-based parser. Same six intents, many more ways to say them.
// Returns: { intent, title?, dueDate?, id?, query?, content? }
//   add_task        -> { title, dueDate }
//   list_tasks      -> {}
//   complete_task   -> { id } OR { query }   (query = words from the task title)
//   delete_task     -> { id } OR { query }
//   add_note        -> { content }
//   delete_note     -> { id }
//   clear_completed -> {}
//   set_due         -> { id | query, dueDate }
//   list_notes      -> {}
//   unknown         -> {}

const WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const pad = (n) => String(n).padStart(2, '0');
const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const inDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return fmt(d); };
const MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december'];
const MON = '(' + MONTHS.join('|') + ')';
function monthDate(day, monthName) {
  // Always the current year (a past date is better than silently jumping a year ahead).
  return fmt(new Date(new Date().getFullYear(), MONTHS.indexOf(monthName.toLowerCase()), parseInt(day, 10)));
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function clean(text) {
  let t = String(text || '').replace(/[.,!?;:]+/g, ' ').replace(/\s+/g, ' ').trim();
  t = t.replace(/^(?:(?:hey|hi|ok|okay)\s+)?(?:assistant\s+)?(?:please\s+)?(?:(?:can|could|would) you\s+(?:please\s+)?)?(?:i (?:want|would like) you to\s+)?/i, '');
  t = t.replace(/\s+please$/i, '');
  t = t.replace(/\b(task|note|number)\s+(one|two|three|four|five|six|seven|eight|nine|ten)\b/gi, (m, a, w) => `${a} ${WORDS[w.toLowerCase()]}`);
  return t.trim();
}

// Pull a trailing date phrase off a title.
function splitDate(s) {
  const lead = '(?:\\s+(?:by|on|for|due|before))?';
  let m;
  if ((m = s.match(new RegExp(lead + '\\s+day after tomorrow$', 'i')))) return [s.slice(0, m.index), inDays(2)];
  if ((m = s.match(new RegExp(lead + '\\s+(today|tonight)$', 'i')))) return [s.slice(0, m.index), inDays(0)];
  if ((m = s.match(new RegExp(lead + '\\s+tomorrow$', 'i')))) return [s.slice(0, m.index), inDays(1)];
  if ((m = s.match(new RegExp(lead + '\\s+in (\\d+) days?$', 'i')))) return [s.slice(0, m.index), inDays(parseInt(m[1], 10))];
  if ((m = s.match(new RegExp(lead + '\\s+(?:next |this )?(' + DAYS.join('|') + ')$', 'i')))) {
    let diff = (DAYS.indexOf(m[1].toLowerCase()) - new Date().getDay() + 7) % 7;
    if (diff === 0) diff = 7;
    return [s.slice(0, m.index), inDays(diff)];
  }
  if ((m = s.match(new RegExp(lead + '\\s+(?:the )?(\\d{1,2})(?:st|nd|rd|th)?(?: of)? ' + MON + '$', 'i')))) return [s.slice(0, m.index), monthDate(m[1], m[2])];
  if ((m = s.match(new RegExp(lead + '\\s+' + MON + ' (\\d{1,2})(?:st|nd|rd|th)?$', 'i')))) return [s.slice(0, m.index), monthDate(m[2], m[1])];
  if ((m = s.match(new RegExp(lead + '\\s+(\\d{4}-\\d{2}-\\d{2})$', 'i')))) return [s.slice(0, m.index), m[1]];
  return [s, null];
}

function parseDate(text) {
  const [rest, date] = splitDate(' ' + text.trim());
  return date && rest.trim() === '' ? date : null;
}

const TASKS = '(?:tasks|todos?|to-?do list|to do list)';
const SHOW = '(?:show|list|read|give|tell|display|get|view|see|open)(?: me)?(?: all)?(?: of)?(?: my| the)?';

function parseCommand(text) {
  const q = clean(text);
  let m;
  const task = (raw) => {
    const [t, dueDate] = splitDate(raw.trim());
    const title = t.trim();
    return title ? { intent: 'add_task', title: cap(title), dueDate } : { intent: 'unknown' };
  };

  // ---- list ----
  if (new RegExp(`^${SHOW} (?:pending |open |current )?${TASKS}$`, 'i').test(q)
    || new RegExp(`^what(?:'s| is| are)? (?:on )?(?:my )?(?:${TASKS}|list)$`, 'i').test(q)
    || /^what (?:do i have|do i need|should i do|have i got)(?: to do)?(?: today)?$/i.test(q)
    || new RegExp(`^(?:my )?${TASKS}$`, 'i').test(q)) return { intent: 'list_tasks' };

  if (new RegExp(`^${SHOW} notes$`, 'i').test(q)
    || /^what(?:'s| is| are)? (?:in |on )?(?:my )?notes$/i.test(q)
    || /^(?:my )?notes$/i.test(q)) return { intent: 'list_notes' };

  // ---- clear completed tasks ----
  if (/^(?:delete|remove|clear|drop) (?:all )?(?:completed|done|finished) (?:tasks|todos?|items)?$/i.test(q)
    || /^(?:clear|delete|remove) (?:completed|finished) (?:tasks|todos?|items)?$/i.test(q)
    || /^clear (?:all )?completed$/i.test(q)) {
    return { intent: 'clear_completed' };
  }

  // ---- delete note ----
  if ((m = q.match(/^(?:delete|remove|clear|drop) (?:the )?note (?:number )?(\d+)$/i))
    || (m = q.match(/^(?:delete|remove|clear|drop) (?:the )?note (?:number )?(first|last)$/i))
    || (m = q.match(/^(?:delete|remove|clear|drop) (?:the )?(first|last) note$/i))) {
    const val = m[1].toLowerCase();
    return { intent: 'delete_note', id: /^\d+$/.test(val) ? parseInt(val, 10) : val };
  }
  // Ensure "remove/delete note ..." never falls into delete-task-by-title
  if (/^(?:delete|remove|clear|drop) (?:the )?notes?\b/i.test(q)) {
    return { intent: 'delete_note' };
  }

  // ---- set due date ----  ("asset" = common speech-to-text slip for "set")
  const V = '(?:set|asset|change|update|move|reschedule)';
  const D = '(?:the )?(?:due date|due|deadline|timeline|date)';
  if ((m = q.match(new RegExp(`^${V} ${D}(?: (?:for|of))? task (\\d+) (?:to|as|for|on|by) (.+)$`, 'i')))
    || (m = q.match(new RegExp(`^${V} task (\\d+)(?: due date| deadline)? (?:to|for|on|by) (.+)$`, 'i')))
    || (m = q.match(/^task (\d+)(?: is)? due(?: on| by| for)? (.+)$/i))) {
    const dueDate = parseDate(m[2]);
    if (dueDate) return { intent: 'set_due', id: parseInt(m[1], 10), dueDate };
  }
  if ((m = q.match(new RegExp(`^${V} ${D}(?: (?:for|of))? (?!task \\d)(.+?) (?:to|as|for|on|by) (.+)$`, 'i')))) {
    const dueDate = parseDate(m[2]);
    if (dueDate) return { intent: 'set_due', query: m[1].trim(), dueDate };
  }

  // ---- complete ----
  if ((m = q.match(/^(?:complete|finish|finished|completed|check off|tick off|done(?: with)?) task (\d+)$/i))
    || (m = q.match(/^(?:mark |set )?task (\d+)(?: as| is)? (?:done|complete|completed|finished)$/i))
    || (m = q.match(/^mark (\d+) (?:as )?(?:done|complete|completed|finished)$/i))) return { intent: 'complete_task', id: parseInt(m[1], 10) };

  if ((m = q.match(/^(?:i(?: have| just)? (?:finished|completed|done)|complete|finish|check off|tick off|mark)\s+(?:the )?(.+?)(?: as (?:done|complete|completed|finished)| is done)?$/i))
    && !/^(?:task|note|all|my)\b/i.test(m[1])) return { intent: 'complete_task', query: m[1].trim() };

  // ---- delete ----
  if ((m = q.match(/^(?:delete|remove|cancel|clear|drop) (?:the )?task (\d+)$/i))) return { intent: 'delete_task', id: parseInt(m[1], 10) };
  if ((m = q.match(/^(?:delete|remove|cancel|drop) (?:the )?(.+?)(?: from (?:my )?(?:tasks|todo|todo list|list))?$/i))
    && !/^(?:task|note|all|my)\b/i.test(m[1])
    && !/\bone$/i.test(m[1])) return { intent: 'delete_task', query: m[1].trim() };

  // ---- add note (empty content check) ----
  if (/^(?:add|create|save|take|make|write|jot)(?: down)?(?: a| new)? notes?$/i.test(q)
    || /^notes?$/i.test(q)) {
    return { intent: 'add_note', content: '' };
  }

  // ---- add note ----
  if ((m = q.match(/^(?:add|save|create|take|make|write|jot)(?: down)?(?: a| new)? note(?: that| to self| saying)?\s+(.+)$/i))
    || (m = q.match(/^note(?: down| that)?\s+(.+)$/i))
    || (m = q.match(/^(?:remember|save) that (.+)$/i))
    || (m = q.match(/^(?:add|save|put) (.+?) (?:to|in|into) (?:my )?notes$/i))) return { intent: 'add_note', content: cap(m[1].trim()) };

  // ---- add task ----
  if ((m = q.match(/^(?:add|create|new|make|set|put)(?: a| new)? (?:task|todo|to-?do)(?:\s+to)?\s+(.+)$/i))
    || (m = q.match(/^add (.+?) to (?:my |the )?(?:tasks|todo|todo list|to do list|list)$/i))
    || (m = q.match(/^remind me (?:to |about )?(.+)$/i))
    || (m = q.match(/^(?:i need to|i have to|i must|i should|don't forget to|do not forget to|remember to) (.+)$/i))
    || (m = q.match(/^(?:todo|task) (?!\d)(.+)$/i))) return task(m[1]);

  return { intent: 'unknown' };
}

module.exports = { parseCommand, parseDate };
