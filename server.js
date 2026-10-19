const path = require('path');
const express = require('express');
const db = require('./db');
const { parseCommand } = require('./parser');

const app = express();
const PORT = process.env.PORT || 3000;
const USER_ID = 1; // Default seeded student user

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Precompiled statements for performance and parameterized query compliance
const stmtPendingTasks = db.prepare('SELECT * FROM v_pending_tasks WHERE user_id = ? ORDER BY task_id DESC');
const stmtAllTasks = db.prepare('SELECT * FROM tasks WHERE user_id = ? ORDER BY task_id DESC');
const stmtAllNotes = db.prepare('SELECT * FROM notes WHERE user_id = ? ORDER BY note_id DESC');
const stmtRecentLogs = db.prepare('SELECT * FROM command_logs WHERE user_id = ? ORDER BY log_id DESC LIMIT 20');
const stmtInsertLog = db.prepare(
  'INSERT INTO command_logs (user_id, raw_text, intent, response_text, success) VALUES (?, ?, ?, ?, ?)'
);
const stmtUpdateTaskStatus = db.prepare('UPDATE tasks SET status = ? WHERE task_id = ? AND user_id = ?');
const stmtDeleteTask = db.prepare('DELETE FROM tasks WHERE task_id = ? AND user_id = ?');
const stmtInsertNote = db.prepare('INSERT INTO notes (user_id, content) VALUES (?, ?)');
const stmtUpdateTaskDueDate = db.prepare('UPDATE tasks SET due_date = ? WHERE task_id = ? AND user_id = ?');
const stmtResolvePendingTaskByQuery = db.prepare(
  "SELECT task_id FROM tasks WHERE user_id = ? AND title LIKE ? AND status = 'pending' ORDER BY task_id DESC LIMIT 1"
);
const stmtResolveTaskByQuery = db.prepare(
  'SELECT task_id FROM tasks WHERE user_id = ? AND title LIKE ? ORDER BY task_id DESC LIMIT 1'
);

// Atomic transaction: task creation and command log row committed together
const addTaskTransaction = db.transaction((userId, title, dueDate, rawText, intent, replyText) => {
  const insertTask = db.prepare('INSERT INTO tasks (user_id, title, due_date) VALUES (?, ?, ?)');
  insertTask.run(userId, title, dueDate);
  stmtInsertLog.run(userId, rawText, intent, replyText, 1);
});

// POST /api/command - Process voice/typed command
app.post('/api/command', (req, res) => {
  const rawText = req.body && req.body.text ? String(req.body.text) : '';
  const parsed = parseCommand(rawText);
  const intent = parsed.intent;

  let reply = '';
  let success = true;

  try {
    switch (intent) {
      case 'add_task': {
        const title = parsed.title;
        const dueDate = parsed.dueDate || null;
        reply = dueDate ? `Task added: ${title} (due ${dueDate})` : `Task added: ${title}`;
        addTaskTransaction(USER_ID, title, dueDate, rawText, intent, reply);
        return res.json({ reply, success: true });
      }

      case 'list_tasks': {
        const pendingTasks = stmtPendingTasks.all(USER_ID);
        const count = pendingTasks.length;
        if (count === 0) {
          reply = 'You have no pending tasks.';
        } else {
          const sample = pendingTasks.slice(0, 5).map(t => `${t.task_id}: ${t.title}`).join(', ');
          reply = `You have ${count} pending task${count === 1 ? '' : 's'}. First 5: ${sample}.`;
        }
        break;
      }

      case 'complete_task': {
        let taskId = parsed.id;
        if (!taskId && parsed.query) {
          const match = stmtResolvePendingTaskByQuery.get(USER_ID, `%${parsed.query}%`);
          if (match) {
            taskId = match.task_id;
          }
        }

        if (!taskId) {
          reply = 'Task not found.';
          success = false;
        } else {
          const result = stmtUpdateTaskStatus.run('done', taskId, USER_ID);
          if (result.changes === 0) {
            reply = 'Task not found.';
            success = false;
          } else {
            reply = `Task ${taskId} completed.`;
            success = true;
          }
        }
        break;
      }

      case 'delete_task': {
        let taskId = parsed.id;
        if (!taskId && parsed.query) {
          const match = stmtResolveTaskByQuery.get(USER_ID, `%${parsed.query}%`);
          if (match) {
            taskId = match.task_id;
          }
        }

        if (!taskId) {
          reply = 'Task not found.';
          success = false;
        } else {
          const result = stmtDeleteTask.run(taskId, USER_ID);
          if (result.changes === 0) {
            reply = 'Task not found.';
            success = false;
          } else {
            reply = `Task ${taskId} deleted.`;
            success = true;
          }
        }
        break;
      }

      case 'set_due': {
        let taskId = parsed.id;
        if (!taskId && parsed.query) {
          const match = stmtResolvePendingTaskByQuery.get(USER_ID, `%${parsed.query}%`);
          if (match) {
            taskId = match.task_id;
          }
        }

        if (!taskId) {
          reply = 'Task not found.';
          success = false;
        } else {
          const result = stmtUpdateTaskDueDate.run(parsed.dueDate, taskId, USER_ID);
          if (result.changes === 0) {
            reply = 'Task not found.';
            success = false;
          } else {
            reply = `Due date for task ${taskId} set to ${parsed.dueDate}.`;
            success = true;
          }
        }
        break;
      }

      case 'add_note': {
        stmtInsertNote.run(USER_ID, parsed.content);
        reply = `Note added: ${parsed.content}`;
        success = true;
        break;
      }

      case 'list_notes': {
        const notes = stmtAllNotes.all(USER_ID);
        const count = notes.length;
        if (count === 0) {
          reply = 'You have no notes.';
        } else {
          const sample = notes.slice(0, 5).map(n => `${n.note_id}: ${n.content}`).join(', ');
          reply = `You have ${count} note${count === 1 ? '' : 's'}. First 5: ${sample}.`;
        }
        break;
      }

      case 'unknown':
      default: {
        reply = 'Sorry, I did not understand that.';
        success = false;
        break;
      }
    }

    // Log all non-add_task commands (add_task logged within transaction)
    stmtInsertLog.run(USER_ID, rawText, intent, reply, success ? 1 : 0);

    return res.json({ reply, success });
  } catch (error) {
    const errorReply = 'An internal database error occurred.';
    try {
      stmtInsertLog.run(USER_ID, rawText, intent, errorReply, 0);
    } catch (_) {}
    return res.status(500).json({ reply: errorReply, success: false });
  }
});

// GET /api/tasks - Pending and done tasks for user 1, newest first
app.get('/api/tasks', (req, res) => {
  try {
    const tasks = stmtAllTasks.all(USER_ID);
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve tasks' });
  }
});

// GET /api/notes - Notes for user 1, newest first
app.get('/api/notes', (req, res) => {
  try {
    const notes = stmtAllNotes.all(USER_ID);
    res.json(notes);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve notes' });
  }
});

// GET /api/logs - Last 20 command_logs rows
app.get('/api/logs', (req, res) => {
  try {
    const logs = stmtRecentLogs.all(USER_ID);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve logs' });
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Voice Assistant server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
