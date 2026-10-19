# PRD: Voice-Controlled Personal Talk Assistant

Spec for the coding agent. Course project (Database Systems). Time budget: 1 to 2 hours total.

## 0. Hard rules for the agent (read first)

- **Build only what is written in this document. Nothing more.**
- **Do not add features, pages, tables, endpoints, libraries, animations, settings, auth, deployment or tests beyond what is listed.**
- If something is ambiguous, pick the simplest option and move on. Do not ask, do not expand.
- Prefer plain, readable code over clever code. No refactors, no abstractions, no config systems.
- Every item in section 11 (Out of scope) is forbidden.
- Stop when the acceptance criteria in section 10 pass.

## 1. Goal

A small web app where the user speaks a command, the backend interprets it, reads or writes a relational database, and the app shows and speaks the reply. The project must visibly have three connected layers: frontend, backend, database.

## 2. Users

One user: the student demoing the project. No login. A single default user is seeded in the database.

## 3. Functional requirements

The assistant supports exactly these six voice (or typed) commands:

- **Add task:** "add task buy milk" / "add task submit report tomorrow"
- **List tasks:** "show my tasks" / "what are my tasks"
- **Complete task:** "complete task 3" / "done task 3"
- **Delete task:** "delete task 3"
- **Add note:** "add note ESP32 pinout idea"
- **List notes:** "show my notes"

Behavior:

- Mic button captures speech and fills the transcript. A text box with a Send button is the fallback (same endpoint).
- Due dates: only the words "today" and "tomorrow" are recognized at the end of an add-task command. Otherwise due date is empty.
- Unknown command: reply "Sorry, I did not understand that." and still log it.
- Every reply is shown in a chat log and spoken aloud.
- Every command (understood or not) is written to `command_logs`.
- The task list and note list on screen refresh after each command.

## 4. Tech stack (fixed, do not substitute)

- **Frontend:** one static `index.html` + `app.js` + `style.css`, plain JavaScript, served by Express. No framework, no build step.
- **Speech:** browser Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`) for input, `speechSynthesis` for output. Target Chrome desktop.
- **Backend:** Node.js + Express. Only extra packages allowed: the DB driver and `cors` if needed.
- **Database:** SQLite via `better-sqlite3` (zero setup, fits the time limit). Write standard SQL so it ports to MySQL/PostgreSQL. If the course mandates MySQL or PostgreSQL, swap only the driver and connection; keep the schema and queries.
- **Intent parsing:** rule-based regex in one file. No AI/LLM, no NLP libraries.

## 5. Project structure

```
voice-assistant/
  server.js          # Express app, routes
  parser.js          # transcript -> {intent, args}
  db.js              # connection + schema init + seed
  schema.sql         # tables, view, index, trigger
  public/
    index.html
    app.js
    style.css
  README.md          # how to run, 10 lines max
```

## 6. Database design

Four tables. `schema.sql` must contain exactly this (adjust syntax only if the DB changes):

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

Seed one row: `INSERT INTO users(name) VALUES ('Student')` if the table is empty. Use `user_id = 1` everywhere.

**DBMS concepts this covers (for the report):** primary/foreign keys, cascade, CHECK constraint, index, view, trigger, and a transaction (below). Normalized to 3NF.

**Required transaction:** adding a task and writing its `command_logs` row happen inside one transaction (all or nothing). Use it for add-task only.

**Required queries (use parameterized statements only, never string concatenation):**

- Insert/select/update/delete on `tasks` and `notes`
- `SELECT * FROM v_pending_tasks WHERE user_id = ?` for listing tasks
- One aggregate for the report: `SELECT intent, COUNT(*) FROM command_logs GROUP BY intent`

## 7. Backend API

Exactly four endpoints. JSON in and out.

- `POST /api/command` body `{ "text": "add task buy milk" }` returns `{ "reply": "Task added: buy milk", "success": true }`
- `GET /api/tasks` returns pending and done tasks for user 1, newest first
- `GET /api/notes` returns notes for user 1, newest first
- `GET /api/logs` returns the last 20 `command_logs` rows

`POST /api/command` flow: parse text, run the matching DB action, write the log row, return the reply.

## 8. Intent parser rules (`parser.js`)

Lowercase and trim the text, then match in this order:

- `^(add|create) task (.+)$` → `add_task`, title = group 2. If title ends with " today" or " tomorrow", strip it and set due\_date (today = current date, tomorrow = current date + 1, format YYYY-MM-DD).
- `^(show|list|what are) (my )?tasks$` → `list_tasks`
- `^(complete|done|finish) task (\d+)$` → `complete_task`
- `^(delete|remove) task (\d+)$` → `delete_task`
- `^(add|save|create) note (.+)$` → `add_note`
- `^(show|list) (my )?notes$` → `list_notes`
- anything else → `unknown`

Reply strings: short, plain sentences. For list commands, read out the first 5 items and say the total count. If a task id does not exist, reply "Task not found."

## 9. Frontend spec

One screen, three areas, minimal styling:

- **Top:** mic button (toggle listening), live transcript text, text input + Send button
- **Left/Middle:** chat log (user line, assistant line). Assistant replies are spoken with `speechSynthesis`.
- **Right:** two simple lists, "Tasks" (with id, title, due date, status) and "Notes". Refresh after every command via `GET /api/tasks` and `GET /api/notes`.

If `SpeechRecognition` is not supported, hide the mic and show a small line: "Voice not supported, use the text box." No other UI states.

## 10. Acceptance criteria (stop when all pass)

- App starts with one command (`node server.js`) and opens at `http://localhost:3000`.
- All six commands work by voice and by typed text.
- Data survives a server restart (it is in the database).
- Unknown input gets the "did not understand" reply and is logged.
- Completing a task sets `completed_at` through the trigger.
- Add-task uses the transaction with the log insert.
- All SQL uses parameter placeholders.
- `README.md` explains how to install and run in under 10 lines.

## 11. Out of scope (do NOT build)

- Login, signup, passwords, sessions, multiple users
- Reminders, notifications, calendars, recurring tasks
- Tags, search, edit/update-by-voice, undo
- LLM or AI features, NLP libraries, natural date parsing beyond "today"/"tomorrow"
- Frameworks (React, Vue), TypeScript, build tools, Docker
- Deployment, hosting, environment/config systems
- Unit tests, linting setup, CI
- Dashboards, charts, themes, dark mode, animations
- Extra endpoints, extra tables, extra pages

## 12. Build order (time boxes, total about 90 minutes)

- **0:00 to 0:10** Project setup, install `express` and `better-sqlite3`, create `schema.sql`, `db.js` with init and seed
- **0:10 to 0:30** `parser.js` and `POST /api/command` with all six actions plus logging and the add-task transaction
- **0:30 to 0:40** `GET /api/tasks`, `/api/notes`, `/api/logs`; test with curl
- **0:40 to 1:10** Frontend: layout, text input flow, lists, then mic and speech output
- **1:10 to 1:30** Run through the acceptance criteria, fix bugs only, write README

## 13. Deliverables

- Working code in the structure from section 5
- `schema.sql`
- `README.md`
- Nothing else
