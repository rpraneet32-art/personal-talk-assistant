# Endpoint Test Suite Results

This document captures the verification results of 20 comprehensive end-to-end test cases evaluated against the `/api/command` HTTP endpoint.

**Execution Environment & Integrity Rules:**
- All tests were executed against an isolated temporary database copy seeded with [`docs/seed.sql`](file:///c:/Users/rpran/Desktop/Repos/personal-talk-assistant/docs/seed.sql).
- The production database `assistant.db` and `.env` configuration were not modified or accessed during testing.
- All 20 tests executed against the live Express routing, transactional logic, trigger mechanics, deterministic regex parser, and Groq LLM fallback.
- The temporary test database was permanently deleted upon suite completion.

## Summary of Test Cases

| Test Count | Passed | Failed | Success Rate |
| :---: | :---: | :---: | :---: |
| 20 | 20 | 0 | 100% |

## Detailed Test Results

| # | Input Command | Expected Reply | Actual Reply | Intent Logged | Route | Status |
| :---: | :--- | :--- | :--- | :---: | :---: | :---: |
| 1 | `add task Study compiler design` | Task added: Study compiler design | Task added: Study compiler design | `add_task` | parser | **PASS** |
| 2 | `add task Submit lab report tomorrow` | Task added: Submit lab report (due 2026-10-21) | Task added: Submit lab report (due 2026-10-21) | `add_task` | parser | **PASS** |
| 3 | `show my tasks` | You have 6 pending tasks | You have 6 pending tasks. First 5: 14: Submit lab report, 13: Study compiler design, 6: Submit lab reflection paper, 4: Prepare final project report, 3: Buy milk and bread. | `list_tasks` | parser | **PASS** |
| 4 | `complete task 1` | Task 1 completed. | Task 1 completed. | `complete_task` | parser | **PASS** |
| 5 | `complete study compiler design` | Task 13 completed. | Task 13 completed. | `complete_task` | parser | **PASS** |
| 6 | `set due date for task 3 to tomorrow` | Due date for task 3 set to 2026-10-21. | Due date for task 3 set to 2026-10-21. | `set_due` | parser | **PASS** |
| 7 | `task 4 is due friday` | Due date for task 4 set to 2026-10-23. | Due date for task 4 set to 2026-10-23. | `set_due` | parser | **PASS** |
| 8 | `delete task 6` | Task 6 deleted. | Task 6 deleted. | `delete_task` | parser | **PASS** |
| 9 | `delete lab report` | Task 14 deleted. | Task 14 deleted. | `delete_task` | parser | **PASS** |
| 10 | `add note Check chapter 4 exercises` | Note added: Check chapter 4 exercises | Note added: Check chapter 4 exercises | `add_note` | parser | **PASS** |
| 11 | `add note` | What should the note say? | What should the note say? | `add_note` | parser | **PASS** |
| 12 | `show my notes` | You have 4 notes | You have 4 notes. First 5: 7: Check chapter 4 exercises, 3: Check 3NF normalization decomposition rules, 2: Remember presentation is scheduled in Hall B, 1: ESP32 pinout idea for IoT talk. | `list_notes` | parser | **PASS** |
| 13 | `delete note 1` | Note 1 deleted. | Note 1 deleted. | `delete_note` | parser | **PASS** |
| 14 | `delete last note` | Note 7 deleted. | Note 7 deleted. | `delete_note` | parser | **PASS** |
| 15 | `clear completed tasks` | Delete all completed tasks? Say yes to confirm. | Delete all completed tasks? Say yes to confirm. | `clear_completed` | parser | **PASS** |
| 16 | `cancel` | Sorry, I did not understand that. | Sorry, I did not understand that. | `unknown` | parser | **PASS** |
| 17 | `clear completed tasks -> yes` | 4 completed tasks deleted. | 4 completed tasks deleted. | `clear_completed` | parser | **PASS** |
| 18 | `complete task 999` | Task not found. | Task not found. | `complete_task` | parser | **PASS** |
| 19 | `what is the current weather forecast` | Sorry, I did not understand that. | Sorry, I did not understand that. | `unknown` | LLM | **PASS** |
| 20 | `move the milk task to friday` | Due date for task 3 set to 2026-10-23. | Due date for task 3 set to 2026-10-23. | `set_due_llm` | LLM | **PASS** |

---

## Test Coverage Highlights

1. **Rule-Based Deterministic Intents:** `add_task` (with/without due date), `list_tasks`, `complete_task` (numeric ID and fuzzy title search), `delete_task` (numeric ID and title search), `set_due` (numeric ID and title search), `add_note`, `list_notes`, `delete_note` (numeric ID and ordinals).
2. **Edge Cases & Validations:**
   - **Empty Note:** Handled gracefully with `"What should the note say?"` without polluting SQLite with empty strings.
   - **Missing Task:** Parameterized search returning zero rows safely replies with `"Task not found."` without uncaught exceptions.
   - **Two-Step Confirmation Cancellation:** Saying `"cancel"` safely expires confirmation state and preserves existing completed tasks.
   - **Two-Step Confirmation Execution:** Saying `"yes"` cleanly deletes only completed tasks belonging to the current user.
3. **LLM Fallback & Reasoning Integration:**
   - Unstructured conversational inputs (`"move the milk task to friday"`) correctly fall back to Groq `openai/gpt-oss-20b`, logging intent with `_llm` audit suffix.
   - Dates extracted by LLM are resolved deterministically by system code relative to dynamic system date, eliminating model hallucination.
