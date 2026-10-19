# Voice-Controlled Personal Talk Assistant: Architecture, Code, and Logic Explanation

This document provides a comprehensive explanation of the architecture, database schema, rule-based parsing logic, backend endpoints, and frontend speech integration built for the Voice-Controlled Personal Talk Assistant.

---

## 1. System Architecture Overview

The system is organized into three connected layers:

```
[ User Voice / Input ]
         │
         ▼
 1. Frontend Layer (public/index.html, app.js, style.css)
    - Web Speech API (SpeechRecognition) captures microphone audio.
    - SpeechSynthesis generates audible spoken responses.
    - DOM lists dynamically update task and note views.
         │ HTTP JSON API (POST /api/command, GET /api/tasks, ...)
         ▼
 2. Backend Layer (server.js, parser.js)
    - Express web server on port 3000.
    - Rule-based regex parser (parser.js) decodes intent and parameters.
    - Parameterized SQL query execution and transaction coordinator.
         │ better-sqlite3 driver
         ▼
 3. Database Layer (db.js, schema.sql, assistant.db)
    - SQLite database normalized to 3NF.
    - Enforced foreign keys with ON DELETE CASCADE.
    - Automatic completion timestamp tracking via SQL trigger.
    - Virtual view for pending tasks and composite index for query optimization.
```

---

## 2. Database Design & Relational Concepts (`schema.sql` & `db.js`)

The database consists of 4 normalized tables, 1 index, 1 view, and 1 trigger.

### 2.1 Table Schema

1. **`users`**:
   - `user_id`: Primary Key (Autoincrementing integer).
   - `name`: User's display name.
   - `created_at`: Timestamp defaulted to `CURRENT_TIMESTAMP`.
   - *Seeding*: Seeded with `user_id = 1`, `name = 'Student'` upon initial launch.

2. **`tasks`**:
   - `task_id`: Primary Key.
   - `user_id`: Foreign Key referencing `users(user_id)` with `ON DELETE CASCADE`.
   - `title`: Task description.
   - `due_date`: Date string (`YYYY-MM-DD`) or `NULL`.
   - `status`: String restricted by a `CHECK` constraint to `'pending'` or `'done'`.
   - `created_at`: Default timestamp.
   - `completed_at`: Timestamp set exclusively when a task is marked done.

3. **`notes`**:
   - `note_id`: Primary Key.
   - `user_id`: Foreign Key referencing `users(user_id)` with `ON DELETE CASCADE`.
   - `content`: Plain text note content.
   - `created_at`: Default timestamp.

4. **`command_logs`**:
   - `log_id`: Primary Key.
   - `user_id`: Foreign Key referencing `users(user_id)`.
   - `raw_text`: The unparsed or user-spoken input string.
   - `intent`: The parsed intent name (e.g., `add_task`, `list_tasks`, `unknown`).
   - `response_text`: The spoken/displayed response given back to the user.
   - `success`: Integer flag (`1` for successful execution, `0` for failures/unknowns).
   - `created_at`: Default timestamp.

### 2.2 Relational Optimization and Automation

- **Composite Index (`idx_tasks_user_status`)**:
  ```sql
  CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON tasks(user_id, status);
  ```
  *Why*: Accelerates filtering queries that look for pending vs done tasks for a specific user without scanning the entire table.

- **Pending Tasks View (`v_pending_tasks`)**:
  ```sql
  CREATE VIEW IF NOT EXISTS v_pending_tasks AS
    SELECT task_id, user_id, title, due_date, created_at
    FROM tasks WHERE status = 'pending';
  ```
  *Why*: Encapsulates the pending status filter into a reusable database abstraction for task queries.

- **Status Completion Trigger (`trg_task_completed`)**:
  ```sql
  CREATE TRIGGER IF NOT EXISTS trg_task_completed
  AFTER UPDATE OF status ON tasks
  WHEN NEW.status = 'done'
  BEGIN
    UPDATE tasks SET completed_at = CURRENT_TIMESTAMP WHERE task_id = NEW.task_id;
  END;
  ```
  *Why*: Enforces business logic at the data tier. As soon as any SQL query updates a task's status to `'done'`, the database itself sets `completed_at` to the current timestamp.

- **Database Initialization (`db.js`)**:
  - Sets `PRAGMA foreign_keys = ON;` in SQLite to ensure constraint checking is enforced.
  - Automatically executes `schema.sql` if tables do not exist.
  - Checks if `users` table is populated; if empty, inserts the default `'Student'` record.

---

## 3. Intent Parser Logic (`parser.js`)

Intent parsing uses a flexible rule-based regex system supporting natural speech variations across the six core intents:

1. **Pre-processing (`clean`)**:
   - Cleans punctuation and whitespace.
   - Strips conversational conversational prefixes (e.g., `"hey assistant"`, `"can you please"`, `"i want you to"`).
   - Normalizes number words to digits (`"task two"` $\rightarrow$ `"task 2"`).

2. **Date Extraction (`splitDate`)**:
   - Detects relative and day-based deadlines: `"today"`, `"tonight"`, `"tomorrow"`, `"day after tomorrow"`, `"in N days"`, or specific days of the week (`"Friday"`, `"next Monday"`).
   - Formats extracted deadlines to `YYYY-MM-DD`.

3. **Supported Formats and Return Values**:
   - **`add_task`** $\rightarrow$ `{ intent: 'add_task', title, dueDate }`:
     Supports `"add task <title>"`, `"remind me to <title>"`, `"i need to <title>"`, `"remember to <title>"`, etc.
   - **`list_tasks`** $\rightarrow$ `{ intent: 'list_tasks' }`:
     Supports `"show my tasks"`, `"what's on my to-do list"`, `"what do i have to do today"`.
   - **`complete_task`** $\rightarrow$ `{ intent: 'complete_task', id }` OR `{ intent: 'complete_task', query }`:
     Supports numeric ID (e.g. `"complete task 2"`, `"mark 2 as done"`) or text query (e.g. `"complete the report"`, `"i finished the database project"`).
   - **`delete_task`** $\rightarrow$ `{ intent: 'delete_task', id }` OR `{ intent: 'delete_task', query }`:
     Supports numeric ID (`"delete task 1"`) or text query (`"remove report from my tasks"`).
   - **`set_due`** $\rightarrow$ `{ intent: 'set_due', id | query, dueDate }`:
     Supports setting or updating due dates by ID or pending title query (e.g. `"set due date for task 2 to tomorrow"`, `"task 1 is due next Friday"`, `"update due date of report to October 25"`).
   - **`add_note`** $\rightarrow$ `{ intent: 'add_note', content }`:
     Supports `"add note <content>"`, `"remember that <content>"`, `"jot down note <content>"`.
   - **`list_notes`** $\rightarrow$ `{ intent: 'list_notes' }`:
     Supports `"show notes"`, `"what are in my notes"`.
   - **`unknown`** $\rightarrow$ `{ intent: 'unknown' }`.

---

## 4. Backend Server & API Routing (`server.js`)

All database queries use **parameter placeholders (`?`)** to prevent SQL injection vulnerabilities.

### 4.1 Required ACID Transaction
Section 6 mandates an atomic transaction for task creation:
```javascript
const addTaskTransaction = db.transaction((userId, title, dueDate, rawText, intent, replyText) => {
  const insertTask = db.prepare('INSERT INTO tasks (user_id, title, due_date) VALUES (?, ?, ?)');
  insertTask.run(userId, title, dueDate);
  stmtInsertLog.run(userId, rawText, intent, replyText, 1);
});
```
*Logic*: If either inserting the task or recording the command log fails, the entire transaction rolls back, guaranteeing zero partial writes.

### 4.2 Task Resolution by ID or Title Query
`complete_task`, `delete_task`, and `set_due` accept either a direct numeric `id` or a partial title `query`:
- **Pending Task Resolution (`complete_task` and `set_due`)**:
  ```sql
  SELECT task_id FROM tasks WHERE user_id = ? AND title LIKE ? AND status = 'pending' ORDER BY task_id DESC LIMIT 1
  ```
  Passes `%query%`. Only selects pending tasks. If found:
  - For `complete_task`: runs `UPDATE tasks SET status = 'done'` (which triggers `trg_task_completed`).
  - For `set_due`: runs `UPDATE tasks SET due_date = ? WHERE task_id = ? AND user_id = ?`.
- **General Task Resolution (`delete_task`)**:
  ```sql
  SELECT task_id FROM tasks WHERE user_id = ? AND title LIKE ? ORDER BY task_id DESC LIMIT 1
  ```
  Passes `%query%`. If found, runs `DELETE FROM tasks WHERE task_id = ?`.
- If no task row is found by either ID or query, the backend replies with `"Task not found."`.

### 4.3 Endpoints Summary

1. **`POST /api/command`**:
   - Payload: `{ "text": "<command>" }`
   - Executes intent logic:
     - `add_task`: Executes atomic transaction above.
     - `list_tasks`: Queries view `SELECT * FROM v_pending_tasks WHERE user_id = ?`. Reads out up to 5 items and gives total count.
     - `complete_task`: Resolves task by ID or pending title query, updates status to `'done'`.
     - `delete_task`: Resolves task by ID or title query, deletes row.
     - `set_due`: Resolves task by ID or pending title query, updates `due_date`.
     - `add_note`: Inserts row into `notes`.
     - `list_notes`: Queries `notes` table. Reads out up to 5 items and gives total count.
     - `unknown`: Returns `"Sorry, I did not understand that."`.
   - Writes non-task commands to `command_logs`.
   - Returns `{ "reply": "...", "success": boolean }`.
   - Writes non-task commands to `command_logs`.
   - Returns `{ "reply": "...", "success": boolean }`.

2. **`GET /api/tasks`**:
   - Returns all tasks for `user_id = 1` ordered newest first (`task_id DESC`).

3. **`GET /api/notes`**:
   - Returns all notes for `user_id = 1` ordered newest first (`note_id DESC`).

4. **`GET /api/logs`**:
   - Returns the latest 20 rows from `command_logs` for debugging and auditing.

---

## 5. Frontend & Speech Architecture (`public/`)

The user interface is split into three functional panels matching Section 9:

### 5.1 Three-Area Layout
- **Top Bar**:
  - **Speech Input**: Microphone toggle button that initializes the browser's `SpeechRecognition` / `webkitSpeechRecognition`.
  - **Live Transcript**: Displays live interim speech recognition results.
  - **Fallback Input**: Standard text input field and "Send" button submitting to the exact same `/api/command` endpoint.
  - **Compatibility Detection**: If the browser does not support `SpeechRecognition`, the mic button is hidden and a fallback label `"Voice not supported, use the text box."` is displayed.
- **Left / Center Panel (Chat Log)**:
  - Displays a clean history of user inputs and assistant replies.
  - Formats user queries in blue-tinted bubbles and assistant responses in green-tinted bubbles.
- **Right Panel (Tasks and Notes Data View)**:
  - Displays active tasks (with ID, title, due date, and status pill).
  - Displays saved notes (with ID and content).
  - Automatically fetches updated lists via `GET /api/tasks` and `GET /api/notes` after every command.

### 5.2 Speech Output
Assistant responses are spoken audibly using standard browser `speechSynthesis`:
```javascript
function speakReply(text) {
  if ('speechSynthesis' in window && text) {
    window.speechSynthesis.cancel(); // Stop any pending speech
    const utterance = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(utterance);
  }
}
```

---

## 6. Acceptance Criteria Verification Checklist

| Criterion | Implementation | Status |
| :--- | :--- | :--- |
| **Single command startup** | `node server.js` binds to `http://localhost:3000` serving static frontend and JSON endpoints | Passed |
| **All 6 commands work** | Verified via test suite and manual verification (voice and typed) | Passed |
| **Data persistence** | SQLite stores records in persistent file `assistant.db` surviving restarts | Passed |
| **Unknown command handling** | Replied with `"Sorry, I did not understand that."` and logged with `success = 0` | Passed |
| **Trigger invocation** | `trg_task_completed` sets `completed_at = CURRENT_TIMESTAMP` upon `status = 'done'` | Passed |
| **Atomic transaction** | `add_task` executes task insert and log insert in a single `better-sqlite3` transaction | Passed |
| **Parameterized SQL** | All statements use `?` placeholders without string concatenation | Passed |
| **Concise README** | `README.md` is strictly under 10 lines explaining install & execution | Passed |
