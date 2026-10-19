-- ============================================================================
-- DML Demonstration Seed Script: Voice-Controlled Personal Talk Assistant
-- Includes: 3 users, 12 tasks (mix of status and due dates), 6 notes, 10 logs
-- ============================================================================

-- 1. Insert 3 Users
INSERT INTO users (user_id, name, created_at) VALUES
  (1, 'Student', '2026-10-18 09:00:00'),
  (2, 'Professor Smith', '2026-10-18 09:05:00'),
  (3, 'Lab Assistant Alex', '2026-10-18 09:10:00');

-- 2. Insert 12 Tasks (Mix of pending/done, with/without due dates across users)
INSERT INTO tasks (task_id, user_id, title, due_date, status, created_at, completed_at) VALUES
  (1, 1, 'Submit database assignment', '2026-10-21', 'pending', '2026-10-18 09:15:00', NULL),
  (2, 1, 'Review normalization slides', NULL, 'done', '2026-10-18 09:20:00', '2026-10-19 14:00:00'),
  (3, 1, 'Buy milk and bread', '2026-10-20', 'pending', '2026-10-18 10:00:00', NULL),
  (4, 1, 'Prepare final project report', '2026-10-25', 'pending', '2026-10-18 11:30:00', NULL),
  (5, 1, 'Test speech recognition on Chrome', NULL, 'done', '2026-10-18 12:00:00', '2026-10-19 18:30:00'),
  (6, 1, 'Submit lab reflection paper', '2026-10-23', 'pending', '2026-10-18 13:00:00', NULL),
  (7, 2, 'Grade midterm exam scripts', '2026-10-24', 'pending', '2026-10-18 14:00:00', NULL),
  (8, 2, 'Publish course project guidelines', NULL, 'done', '2026-10-18 14:15:00', '2026-10-19 10:15:00'),
  (9, 2, 'Faculty curriculum meeting', '2026-10-22', 'pending', '2026-10-18 15:00:00', NULL),
  (10, 3, 'Calibrate oscilloscope probes', NULL, 'pending', '2026-10-18 15:30:00', NULL),
  (11, 3, 'Refill 3D printer filament', '2026-10-26', 'done', '2026-10-18 16:00:00', '2026-10-19 16:45:00'),
  (12, 3, 'Update workstation software packages', NULL, 'pending', '2026-10-18 16:30:00', NULL);

-- 3. Insert 6 Notes (Spread across users)
INSERT INTO notes (note_id, user_id, content, created_at) VALUES
  (1, 1, 'ESP32 pinout idea for IoT talk', '2026-10-18 09:30:00'),
  (2, 1, 'Remember presentation is scheduled in Hall B', '2026-10-18 10:15:00'),
  (3, 1, 'Check 3NF normalization decomposition rules', '2026-10-18 11:45:00'),
  (4, 2, 'Office hours moved to Thursdays 3 PM to 5 PM', '2026-10-18 14:30:00'),
  (5, 2, 'Recommended reference text: Database System Concepts 7th Edition', '2026-10-18 15:10:00'),
  (6, 3, 'Storage cabinet key is kept in Room 204', '2026-10-18 16:15:00');

-- 4. Insert 10 Command Logs (Mix of intents, successes, and LLM routes)
INSERT INTO command_logs (log_id, user_id, raw_text, intent, response_text, success, created_at) VALUES
  (1, 1, 'add task submit database assignment tomorrow', 'add_task', 'Task added: Submit database assignment (due 2026-10-21)', 1, '2026-10-18 09:15:00'),
  (2, 1, 'show my tasks', 'list_tasks', 'You have 4 pending tasks.', 1, '2026-10-18 09:16:00'),
  (3, 1, 'complete task 2', 'complete_task', 'Task 2 completed.', 1, '2026-10-18 09:20:00'),
  (4, 1, 'add note ESP32 pinout idea for IoT talk', 'add_note', 'Note added: ESP32 pinout idea for IoT talk', 1, '2026-10-18 09:30:00'),
  (5, 1, 'push the database task to friday', 'set_due_llm', 'Due date for task 1 set to 2026-10-23.', 1, '2026-10-18 09:35:00'),
  (6, 1, 'remove the milk one', 'delete_task_llm', 'Task 3 deleted.', 1, '2026-10-18 10:05:00'),
  (7, 1, 'what is the current weather forecast', 'unknown', 'Sorry, I did not understand that.', 0, '2026-10-18 11:00:00'),
  (8, 2, 'add task grade midterm exam scripts', 'add_task', 'Task added: Grade midterm exam scripts', 1, '2026-10-18 14:00:00'),
  (9, 2, 'show my notes', 'list_notes', 'You have 2 notes.', 1, '2026-10-18 15:12:00'),
  (10, 3, 'clear completed tasks', 'clear_completed', 'Delete all completed tasks? Say yes to confirm.', 1, '2026-10-18 16:46:00');

-- ============================================================================
-- DML DEMONSTRATION EXAMPLES (UPDATE and DELETE)
-- ============================================================================

/*
-- EXAMPLE UPDATE 1: Reschedule an existing task deadline
UPDATE tasks
SET due_date = '2026-10-28'
WHERE task_id = 1 AND user_id = 1;

-- EXAMPLE UPDATE 2: Complete a task manually (activates trg_task_completed trigger)
UPDATE tasks
SET status = 'done'
WHERE task_id = 4 AND user_id = 1;

-- EXAMPLE UPDATE 3: Modify existing note content
UPDATE notes
SET content = 'Storage cabinet key is now kept in Room 208'
WHERE note_id = 6 AND user_id = 3;

-- EXAMPLE DELETE 1: Delete a specific note by ID
DELETE FROM notes
WHERE note_id = 3 AND user_id = 1;

-- EXAMPLE DELETE 2: Remove a task row for a user
DELETE FROM tasks
WHERE task_id = 5 AND user_id = 1;

-- EXAMPLE DELETE 3: Cascade delete a user (automatically deletes all their tasks and notes via foreign key cascade)
DELETE FROM users
WHERE user_id = 3;
*/
