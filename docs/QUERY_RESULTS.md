# SQL Query Execution Results

This document captures the actual execution output for the 8 analytical queries defined in [`docs/queries.sql`](file:///c:/Users/rpran/Desktop/Repos/personal-talk-assistant/docs/queries.sql).
All queries were executed against a temporary database copy seeded verbatim with [`docs/seed.sql`](file:///c:/Users/rpran/Desktop/Repos/personal-talk-assistant/docs/seed.sql). The temporary database was destroyed immediately after verification.

---

## Query 1: JOIN across users and tasks

**Concept:** INNER JOIN displaying task ownership, status, and deadlines for each user.

**SQL Statement:**
```sql
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
```

**Actual Output (12 rows returned):**

| user_id | user_name | task_id | title | status | due_date |
| --- | --- | --- | --- | --- | --- |
| 1 | Student | 1 | Submit database assignment | pending | 2026-10-21 |
| 1 | Student | 2 | Review normalization slides | done | _NULL_ |
| 1 | Student | 3 | Buy milk and bread | pending | 2026-10-20 |
| 1 | Student | 4 | Prepare final project report | pending | 2026-10-25 |
| 1 | Student | 5 | Test speech recognition on Chrome | done | _NULL_ |
| 1 | Student | 6 | Submit lab reflection paper | pending | 2026-10-23 |
| 2 | Professor Smith | 7 | Grade midterm exam scripts | pending | 2026-10-24 |
| 2 | Professor Smith | 8 | Publish course project guidelines | done | _NULL_ |
| 2 | Professor Smith | 9 | Faculty curriculum meeting | pending | 2026-10-22 |
| 3 | Lab Assistant Alex | 10 | Calibrate oscilloscope probes | pending | _NULL_ |
| 3 | Lab Assistant Alex | 11 | Refill 3D printer filament | done | 2026-10-26 |
| 3 | Lab Assistant Alex | 12 | Update workstation software packages | pending | _NULL_ |

---

## Query 2: GROUP BY with COUNT

**Concept:** Aggregate distribution of tasks by completion status across all users.

**SQL Statement:**
```sql
SELECT 
  status,
  COUNT(*) AS total_tasks,
  COUNT(due_date) AS tasks_with_deadline,
  COUNT(*) - COUNT(due_date) AS tasks_without_deadline
FROM tasks
GROUP BY status;
```

**Actual Output (2 rows returned):**

| status | total_tasks | tasks_with_deadline | tasks_without_deadline |
| --- | --- | --- | --- |
| done | 4 | 1 | 3 |
| pending | 8 | 6 | 2 |

---

## Query 3: Subquery

**Concept:** Correlated scalar subqueries calculating pending task counts and total notes per user.

**SQL Statement:**
```sql
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
```

**Actual Output (3 rows returned):**

| user_id | name | pending_tasks | total_notes |
| --- | --- | --- | --- |
| 1 | Student | 4 | 3 |
| 2 | Professor Smith | 2 | 2 |
| 3 | Lab Assistant Alex | 2 | 1 |

---

## Query 4: View v_pending_tasks

**Concept:** Querying the database view to retrieve unresolved tasks sorted by urgency.

**SQL Statement:**
```sql
SELECT 
  task_id,
  user_id,
  title,
  due_date,
  created_at
FROM v_pending_tasks
ORDER BY due_date ASC NULLS LAST, task_id ASC;
```

**Actual Output (8 rows returned):**

| task_id | user_id | title | due_date | created_at |
| --- | --- | --- | --- | --- |
| 3 | 1 | Buy milk and bread | 2026-10-20 | 2026-10-18 10:00:00 |
| 1 | 1 | Submit database assignment | 2026-10-21 | 2026-10-18 09:15:00 |
| 9 | 2 | Faculty curriculum meeting | 2026-10-22 | 2026-10-18 15:00:00 |
| 6 | 1 | Submit lab reflection paper | 2026-10-23 | 2026-10-18 13:00:00 |
| 7 | 2 | Grade midterm exam scripts | 2026-10-24 | 2026-10-18 14:00:00 |
| 4 | 1 | Prepare final project report | 2026-10-25 | 2026-10-18 11:30:00 |
| 10 | 3 | Calibrate oscilloscope probes | _NULL_ | 2026-10-18 15:30:00 |
| 12 | 3 | Update workstation software packages | _NULL_ | 2026-10-18 16:30:00 |

---

## Query 5: HAVING clause

**Concept:** Filtering grouped user records to find power users with 3 or more pending tasks.

**SQL Statement:**
```sql
SELECT 
  u.user_id,
  u.name,
  COUNT(t.task_id) AS pending_task_count
FROM users u
JOIN tasks t ON u.user_id = t.user_id
WHERE t.status = 'pending'
GROUP BY u.user_id, u.name
HAVING COUNT(t.task_id) >= 3;
```

**Actual Output (1 row returned):**

| user_id | name | pending_task_count |
| --- | --- | --- |
| 1 | Student | 4 |

---

## Query 6: ORDER BY with LIMIT

**Concept:** Identifying the top 3 earliest pending tasks with deadlines for immediate attention.

**SQL Statement:**
```sql
SELECT 
  task_id,
  user_id,
  title,
  due_date
FROM tasks
WHERE status = 'pending' AND due_date IS NOT NULL
ORDER BY due_date ASC
LIMIT 3;
```

**Actual Output (3 rows returned):**

| task_id | user_id | title | due_date |
| --- | --- | --- | --- |
| 3 | 1 | Buy milk and bread | 2026-10-20 |
| 1 | 1 | Submit database assignment | 2026-10-21 |
| 9 | 2 | Faculty curriculum meeting | 2026-10-22 |

---

## Query 7: Query on command_logs by intent

**Concept:** Usage telemetry analyzing command frequency, success rates, and execution routes.

**SQL Statement:**
```sql
SELECT 
  intent,
  COUNT(*) AS invocation_count,
  SUM(success) AS successful_count,
  ROUND(AVG(success) * 100.0, 1) AS success_rate_pct
FROM command_logs
GROUP BY intent
ORDER BY invocation_count DESC, intent ASC;
```

**Actual Output (9 rows returned):**

| intent | invocation_count | successful_count | success_rate_pct |
| --- | --- | --- | --- |
| add_task | 2 | 2 | 100 |
| add_note | 1 | 1 | 100 |
| clear_completed | 1 | 1 | 100 |
| complete_task | 1 | 1 | 100 |
| delete_task_llm | 1 | 1 | 100 |
| list_notes | 1 | 1 | 100 |
| list_tasks | 1 | 1 | 100 |
| set_due_llm | 1 | 1 | 100 |
| unknown | 1 | 0 | 0 |

---

## Query 8: Showing the trigger's completed_at field

**Concept:** Auditing task completion timestamps automatically populated by trigger trg_task_completed.

**SQL Statement:**
```sql
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
```

**Actual Output (4 rows returned):**

| task_id | user_id | title | status | created_at | completed_at |
| --- | --- | --- | --- | --- | --- |
| 5 | 1 | Test speech recognition on Chrome | done | 2026-10-18 12:00:00 | 2026-10-19 18:30:00 |
| 11 | 3 | Refill 3D printer filament | done | 2026-10-18 16:00:00 | 2026-10-19 16:45:00 |
| 2 | 1 | Review normalization slides | done | 2026-10-18 09:20:00 | 2026-10-19 14:00:00 |
| 8 | 2 | Publish course project guidelines | done | 2026-10-18 14:15:00 | 2026-10-19 10:15:00 |

---

## Supplemental Verification: Live Trigger Execution Demonstration

To definitively demonstrate trigger `trg_task_completed` operating in real-time, task `task_id = 1` ('Submit database assignment') was updated from status `'pending'` to `'done'`:

```sql
-- Before update
SELECT task_id, title, status, completed_at FROM tasks WHERE task_id = 1;
```

**Before State:**

| task_id | title | status | completed_at |
| --- | --- | --- | --- |
| 1 | Submit database assignment | pending | _NULL_ |

```sql
-- Trigger activation statement
UPDATE tasks SET status = 'done' WHERE task_id = 1;
```

**After State (completed_at timestamp populated automatically by trigger):**

| task_id | title | status | completed_at |
| --- | --- | --- | --- |
| 1 | Submit database assignment | done | 2026-10-19 21:04:13 |

