-- ============================================================================
-- 8 Useful Demonstration SQL Queries: Voice-Controlled Personal Talk Assistant
-- Demonstrates key relational database concepts using the seeded database.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. JOIN across users and tasks
-- Concept: INNER JOIN displaying task ownership, status, and deadlines for each user.
-- ----------------------------------------------------------------------------
SELECT 
  u.user_id,
  u.name AS user_name,
  t.task_id,
  t.title,
  t.status,
  t.due_date
FROM users u
INNER JOIN tasks t ON u.user_id = t.user_id
ORDER BY u.user_id ASC, t.task_id ASC;


-- ----------------------------------------------------------------------------
-- 2. GROUP BY with COUNT
-- Concept: Aggregate distribution of tasks by completion status across all users.
-- ----------------------------------------------------------------------------
SELECT 
  status,
  COUNT(*) AS total_tasks,
  COUNT(due_date) AS tasks_with_deadline,
  COUNT(*) - COUNT(due_date) AS tasks_without_deadline
FROM tasks
GROUP BY status;


-- ----------------------------------------------------------------------------
-- 3. Subquery
-- Concept: Correlated scalar subqueries calculating pending task counts and total notes per user.
-- ----------------------------------------------------------------------------
SELECT 
  u.user_id,
  u.name,
  (SELECT COUNT(*) FROM tasks t WHERE t.user_id = u.user_id AND t.status = 'pending') AS pending_tasks,
  (SELECT COUNT(*) FROM notes n WHERE n.user_id = u.user_id) AS total_notes
FROM users u
WHERE u.user_id IN (
  SELECT DISTINCT user_id FROM tasks WHERE status = 'pending'
)
ORDER BY u.user_id ASC;


-- ----------------------------------------------------------------------------
-- 4. View v_pending_tasks
-- Concept: Querying the database view to retrieve unresolved tasks sorted by urgency.
-- ----------------------------------------------------------------------------
SELECT 
  task_id,
  user_id,
  title,
  due_date,
  created_at
FROM v_pending_tasks
ORDER BY due_date ASC NULLS LAST, task_id ASC;


-- ----------------------------------------------------------------------------
-- 5. HAVING clause
-- Concept: Filtering grouped user records to find power users with 3 or more pending tasks.
-- ----------------------------------------------------------------------------
SELECT 
  u.user_id,
  u.name,
  COUNT(t.task_id) AS pending_task_count
FROM users u
JOIN tasks t ON u.user_id = t.user_id
WHERE t.status = 'pending'
GROUP BY u.user_id, u.name
HAVING COUNT(t.task_id) >= 3;


-- ----------------------------------------------------------------------------
-- 6. ORDER BY with LIMIT
-- Concept: Identifying the top 3 earliest pending tasks with deadlines for immediate attention.
-- ----------------------------------------------------------------------------
SELECT 
  task_id,
  user_id,
  title,
  due_date
FROM tasks
WHERE status = 'pending' AND due_date IS NOT NULL
ORDER BY due_date ASC
LIMIT 3;


-- ----------------------------------------------------------------------------
-- 7. Query on command_logs by intent
-- Concept: Usage telemetry analyzing command frequency, success rates, and execution routes.
-- ----------------------------------------------------------------------------
SELECT 
  intent,
  COUNT(*) AS invocation_count,
  SUM(success) AS successful_count,
  ROUND(AVG(success) * 100.0, 1) AS success_rate_pct
FROM command_logs
GROUP BY intent
ORDER BY invocation_count DESC, intent ASC;


-- ----------------------------------------------------------------------------
-- 8. Showing the trigger's completed_at
-- Concept: Auditing task completion timestamps automatically populated by trigger trg_task_completed.
-- ----------------------------------------------------------------------------
SELECT 
  task_id,
  user_id,
  title,
  status,
  created_at,
  completed_at
FROM tasks
WHERE completed_at IS NOT NULL
ORDER BY completed_at DESC;
