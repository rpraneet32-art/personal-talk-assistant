# Project Implementation Evidence

This document captures the current structure, schema, code implementations, supported intents, endpoints, and architectural evolution of the **Voice-Controlled Personal Talk Assistant**.

---

## 1. Project File Tree

```
personal-talk-assistant/
├── .env                                  # Local environment configuration (GROQ_API_KEY) - gitignored
├── .gitignore                            # Git ignore rules (node_modules, .env)
├── PRD Voice-Controlled Personal Talk Assistant.md # Original course project requirements
├── PROJECT_EXPLANATION.md                # Maintained technical architecture and logic walkthrough
├── README.md                             # Setup instructions (<10 lines) including API key setup
├── USER_GUIDE.md                         # Comprehensive user manual and demonstration script
├── assistant.db                          # SQLite production database (users, tasks, notes, logs)
├── db.js                                 # Database initialization, pragmas, schema runner, seed
├── llm.js                                # Groq LLM fallback parser (openai/gpt-oss-20b)
├── package.json                          # Node.js project manifest (express, better-sqlite3)
├── package-lock.json                     # Dependency lockfile
├── parser.js                             # Deterministic rule-based regex command parser & date extractor
├── schema.sql                            # Relational DDL (tables, index, view, trigger)
├── server.js                             # Express web application & REST API coordinator
├── public/
│   ├── app.js                            # Frontend client (Web Speech API recognition & synthesis)
│   ├── index.html                        # 3-panel accessible interface
│   └── style.css                         # Clean, minimal application styling
└── docs/                                 # Documentation, SQL artifacts, test reports
    ├── EVIDENCE.md                       # This document
    ├── seed.sql                          # DML demonstration statements
    ├── queries.sql                       # 8 analytical SQL queries
    ├── QUERY_RESULTS.md                  # Query outputs against seeded database
    └── TEST_RESULTS.md                   # 20-case end-to-end endpoint verification table
```

---

## 2. Final `schema.sql` (Verbatim)

```sql
CREATE TABLE IF NOT EXISTS users (
  user_id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tasks (
  task_id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  due_date TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notes (
  note_id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS command_logs (
  log_id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  raw_text TEXT NOT NULL,
  intent TEXT NOT NULL,
  response_text TEXT NOT NULL,
  success INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON tasks(user_id, status);

CREATE VIEW IF NOT EXISTS v_pending_tasks AS
  SELECT task_id, user_id, title, due_date, created_at
  FROM tasks WHERE status = 'pending';

CREATE TRIGGER IF NOT EXISTS trg_task_completed
AFTER UPDATE OF status ON tasks
WHEN NEW.status = 'done'
BEGIN
  UPDATE tasks SET completed_at = CURRENT_TIMESTAMP WHERE task_id = NEW.task_id;
END;
```

---

## 3. Supported Intents and API Endpoints

### 3.1 Supported Intents
The system resolves incoming speech/text through a two-stage pipeline: **Deterministic Regex Parser** first, falling back to **Groq LLM (`openai/gpt-oss-20b`)** if unparsed.

| Intent | Source Handler | Expected Fields / Arguments | Description |
| :--- | :--- | :--- | :--- |
| **`add_task`** | Parser / LLM | `title`, optional `dueDate` | Adds task to user 1 via atomic transaction. |
| **`list_tasks`** | Parser / LLM | (none) | Lists pending tasks from view `v_pending_tasks`. |
| **`complete_task`**| Parser / LLM | `id` (integer) OR `query` (title search) | Updates status to `'done'`, activating trigger `trg_task_completed`. |
| **`delete_task`** | Parser / LLM | `id` (integer) OR `query` (title search) | Deletes matching task row. |
| **`set_due`** | Parser / LLM | `id` (integer) OR `query`, `dueDate` | Updates `due_date` for a pending task. |
| **`add_note`** | Parser / LLM | `content` | Creates note, or prompts `"What should the note say?"` if empty. |
| **`list_notes`** | Parser / LLM | (none) | Lists all notes for user 1 newest first. |
| **`delete_note`** | Parser / LLM | `id` (integer, `'first'`, or `'last'`) | Deletes note by ID or ordinal. |
| **`clear_completed`**| Parser / LLM | (none) | Two-step confirmation flow to purge `'done'` tasks. |
| **`unknown`** | Parser / LLM | (none) | Fallback response `"Sorry, I did not understand that."`. |

*Note on Logging*: When an intent is resolved via the Groq LLM fallback path, its logged intent name in `command_logs` receives the `_llm` suffix (e.g., `set_due_llm`, `delete_task_llm`).

### 3.2 HTTP API Endpoints

| Method | Path | Request Body | Response Payload | Description |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/command` | `{ "text": string }` | `{ "reply": string, "success": boolean }` | Parses and executes voice or typed assistant command. |
| `GET` | `/api/tasks` | (none) | `Array<Task>` | Returns all tasks (pending and done) for `user_id = 1`, newest first. |
| `GET` | `/api/notes` | (none) | `Array<Note>` | Returns all notes for `user_id = 1`, newest first. |
| `GET` | `/api/logs` | (none) | `Array<CommandLog>` | Returns last 20 rows from `command_logs`. |

---

## 4. Key Database & Application Code Blocks

### 4.1 Database Connection & Pragmas (`db.js`)
```javascript
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, 'assistant.db');
const db = new Database(dbPath);

// Enable foreign key constraints in SQLite
db.pragma('foreign_keys = ON');

// Initialize database schema from schema.sql
const schemaPath = path.join(__dirname, 'schema.sql');
const schemaSql = fs.readFileSync(schemaPath, 'utf8');
db.exec(schemaSql);

// Seed default user if not present (Student, user_id = 1)
const userCount = db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
if (userCount === 0) {
  db.prepare('INSERT INTO users(name) VALUES (?)').run('Student');
}

module.exports = db;
```

### 4.2 Add-Task Atomic Transaction (`server.js`)
```javascript
// Atomic transaction: task creation and command log row committed together
const addTaskTransaction = db.transaction((userId, title, dueDate, rawText, intent, replyText) => {
  const insertTask = db.prepare('INSERT INTO tasks (user_id, title, due_date) VALUES (?, ?, ?)');
  insertTask.run(userId, title, dueDate);
  stmtInsertLog.run(userId, rawText, intent, replyText, 1);
});
```

### 4.3 Task Completion Trigger (`schema.sql`)
```sql
CREATE TRIGGER IF NOT EXISTS trg_task_completed
AFTER UPDATE OF status ON tasks
WHEN NEW.status = 'done'
BEGIN
  UPDATE tasks SET completed_at = CURRENT_TIMESTAMP WHERE task_id = NEW.task_id;
END;
```

### 4.4 Pending Tasks View (`schema.sql`)
```sql
CREATE VIEW IF NOT EXISTS v_pending_tasks AS
  SELECT task_id, user_id, title, due_date, created_at
  FROM tasks WHERE status = 'pending';
```

---

## 5. Deviations from the Original PRD

The project strictly preserved all core relational database invariants from the original specification (schema, atomic transaction, view, trigger, parameterized SQL), while expanding command handling to support real-world speech variability:

1. **Title-Based Task Resolution (`complete_task` & `delete_task`)**:
   - *Original*: Only supported rigid numeric IDs (`"complete task 3"`).
   - *Deviation*: Added parameterized lookup `SELECT task_id FROM tasks WHERE user_id = ? AND title LIKE ? ...` enabling users to say `"complete the report"` or `"delete buy milk"`.
2. **`set_due` Intent**:
   - *Original*: Due dates could only be assigned at creation time.
   - *Deviation*: Added ability to assign or reschedule deadlines on existing pending tasks (`"set due date for task 2 to tomorrow"`, `"task 1 is due Friday"`).
3. **`delete_note` Intent**:
   - *Original*: Notes could only be added or listed.
   - *Deviation*: Added note removal supporting IDs and ordinals (`"delete note 3"`, `"remove first note"`, `"delete last note"`).
4. **`clear_completed` Two-Step Workflow**:
   - *Original*: No batch completion cleanup.
   - *Deviation*: Added `"clear completed tasks"` / `"delete all done tasks"` with a 30-second in-memory confirmation prompt (`"Say yes to confirm"`).
5. **Empty Note Validation**:
   - *Original*: Unspecified behavior for empty `"add note"`.
   - *Deviation*: Intercepts blank note commands and asks `"What should the note say?"` without writing empty records to SQLite.
6. **LLM Fallback Engine (`llm.js`)**:
   - *Original*: Regex-only parser; unknown phrasing was immediately rejected.
   - *Deviation*: Integrated a zero-dependency fallback via Groq's `openai/gpt-oss-20b` for phonetic slips, messy speech, and indirect references (e.g. `"push the database task to friday"`, `"remove the milk one"`).
7. **Audit Suffix for LLM Invocations**:
   - *Deviation*: Appends `_llm` to intent names in `command_logs` (e.g. `set_due_llm`, `delete_task_llm`) to distinguish model-parsed commands in database aggregate reports.
8. **Deterministic Date Resolution for LLM**:
   - *Deviation*: LLM returns spoken date tokens (`dueText`) rather than computing dates itself, and the system resolves them deterministically in code via `parseDate()` against the dynamic system date.
