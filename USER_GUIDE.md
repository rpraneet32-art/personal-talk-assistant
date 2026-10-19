# Voice-Controlled Personal Talk Assistant: User Guide & Use Cases

This guide documents all features, intents, supported speech/text patterns, and practical use cases of the **Voice-Controlled Personal Talk Assistant** as it exists right now.

---

## 1. Overview & Ways to Interact

The assistant is an interactive three-tier system (Web Frontend $\leftrightarrow$ Node.js / Express $\leftrightarrow$ SQLite Database) designed for natural hands-free voice control and keyboard input.

### Interaction Modes
1. **Voice Input (Microphone)**:
   - Click **🎙️ Start Listening** to begin speaking.
   - Speak naturally. The speech recognizer automatically removes polite conversational filler (e.g., *"hey assistant"*, *"could you please"*), handles number words (*"task two"* $\rightarrow$ *"task 2"*), and transcribes your words in real time.
   - Upon completing your sentence, the assistant automatically submits the command.
2. **Text Input (Keyboard Fallback)**:
   - Type commands into the input box and press **Enter** or click **Send**.
3. **Audible Speech & Visual Log**:
   - Every assistant response is displayed in the **Conversation Log** and spoken aloud using browser **Speech Synthesis**.
4. **Live Data Synchronization**:
   - The **Tasks** and **Notes** panels update automatically after every command without requiring a manual page reload.

---

## 2. Complete Catalog of Use Cases & Examples

### Use Case 1: Adding a Task
Create new pending tasks with or without deadlines.

#### Phrasing Variations Supported
- **Direct command**: `"add task <title>"`, `"create task <title>"`, `"make task <title>"`
- **Natural speech**: `"remind me to <title>"`, `"i need to <title>"`, `"i have to <title>"`, `"remember to <title>"`
- **List-oriented**: `"add <title> to my todo list"`, `"todo <title>"`
- **Polite / conversational prefix**: `"hey assistant can you please remind me to <title>"`

#### Examples & Scenarios
| Scenario | Example Voice / Typed Command | System Action & Spoken Reply |
| :--- | :--- | :--- |
| **No Deadline** | `"add task buy groceries"` | Adds task with `due_date = NULL`.<br>**Reply**: *"Task added: Buy groceries"* |
| **Relative (Today)** | `"remind me to submit assignment today"` | Computes today's date (`YYYY-MM-DD`).<br>**Reply**: *"Task added: Submit assignment (due 2026-10-20)"* |
| **Relative (Tomorrow)** | `"i need to call the bank tomorrow"` | Computes tomorrow's date.<br>**Reply**: *"Task added: Call the bank (due 2026-10-21)"* |
| **Day After Tomorrow** | `"add task prepare presentation day after tomorrow"` | Computes current date + 2 days.<br>**Reply**: *"Task added: Prepare presentation (due 2026-10-22)"* |
| **Offset in Days** | `"remind me to return library books in 5 days"` | Computes current date + 5 days.<br>**Reply**: *"Task added: Return library books (due 2026-10-25)"* |
| **Upcoming Weekday** | `"create task project meeting this Friday"` | Calculates upcoming Friday's date.<br>**Reply**: *"Task added: Project meeting (due 2026-10-23)"* |
| **Specific Calendar Date** | `"add task conference registration on October 25"` | Extracts month and day for current year.<br>**Reply**: *"Task added: Conference registration (due 2026-10-25)"* |

> **Under the Hood**: Uses an **atomic ACID database transaction** that creates the task and writes an entry into `command_logs` simultaneously.

---

### Use Case 2: Listing Active Tasks
Inquire about your active workload.

#### Phrasing Variations Supported
- `"show my tasks"`, `"list tasks"`, `"what are my tasks"`, `"show me all tasks"`
- `"what's on my to-do list"`, `"what is on my list"`
- `"what do i have to do today"`, `"what should i do"`

#### Examples & Scenarios
| Scenario | Example Voice / Typed Command | System Action & Spoken Reply |
| :--- | :--- | :--- |
| **When Tasks Exist** | `"what are my tasks"` | Queries `v_pending_tasks` view.<br>**Reply**: *"You have 3 pending tasks. First 5: 1: Buy groceries, 2: Submit assignment, 3: Call the bank."* |
| **When No Tasks Are Pending** | `"show my tasks"` | **Reply**: *"You have no pending tasks."* |

> **Under the Hood**: Queries the dedicated SQL view [`v_pending_tasks`](file:///c:/Users/rpran/Desktop/Repos/personal-talk-assistant/schema.sql#L108-L110) (`WHERE status = 'pending'`).

---

### Use Case 3: Setting or Updating Due Dates
Update deadlines for existing pending tasks by ID or by title name.

#### Phrasing Variations Supported
- **By ID**: `"set due date for task <id> to <date>"`, `"task <id> is due on <date>"`, `"change deadline of task <id> to <date>"`
- **By Title Query**: `"set due date for <words from title> to <date>"`, `"update deadline of <words from title> to <date>"`
- **Speech Slips**: Handles common recognition slips like `"asset due date for..."`

#### Examples & Scenarios
| Scenario | Example Voice / Typed Command | System Action & Spoken Reply |
| :--- | :--- | :--- |
| **By Task ID** | `"set due date for task 1 to tomorrow"` | Updates task ID 1.<br>**Reply**: *"Due date for task 1 set to 2026-10-21."* |
| **By Title Query** | `"set deadline for groceries to next Monday"` | Resolves pending task containing *"groceries"*.<br>**Reply**: *"Due date for task 1 set to 2026-10-26."* |
| **Non-Existent Task** | `"set due date for task 99 to Friday"` | **Reply**: *"Task not found."* |

> **Under the Hood**: Executes a parameterized `UPDATE tasks SET due_date = ? WHERE task_id = ? AND user_id = ?`.

---

### Use Case 4: Completing Tasks (Marking as Done)
Mark tasks completed when finished.

#### Phrasing Variations Supported
- **By ID**: `"complete task 2"`, `"done task 2"`, `"mark task 2 as done"`, `"finish task two"`
- **By Title Query**: `"complete buy groceries"`, `"i finished the assignment"`, `"mark call bank as done"`

#### Examples & Scenarios
| Scenario | Example Voice / Typed Command | System Action & Spoken Reply |
| :--- | :--- | :--- |
| **By Task ID** | `"complete task 2"` | Marks task 2 done.<br>**Reply**: *"Task 2 completed."* |
| **By Spoken Number** | `"finish task two"` | Automatically normalizes *"two"* $\rightarrow$ `2`.<br>**Reply**: *"Task 2 completed."* |
| **By Title Query** | `"i completed buy groceries"` | Resolves pending task containing *"buy groceries"*.<br>**Reply**: *"Task 1 completed."* |
| **Already Done or Missing** | `"complete task 999"` | **Reply**: *"Task not found."* |

> **Under the Hood**: Updating status to `'done'` automatically activates the SQLite trigger [`trg_task_completed`](file:///c:/Users/rpran/Desktop/Repos/personal-talk-assistant/schema.sql#L112-L117), which sets `completed_at = CURRENT_TIMESTAMP`.

---

### Use Case 5: Deleting Tasks
Remove unwanted or obsolete tasks from the database.

#### Phrasing Variations Supported
- **By ID**: `"delete task 1"`, `"remove task 1"`, `"cancel task one"`
- **By Title Query**: `"delete buy groceries"`, `"remove call bank from my tasks"`

#### Examples & Scenarios
| Scenario | Example Voice / Typed Command | System Action & Spoken Reply |
| :--- | :--- | :--- |
| **By Task ID** | `"delete task 3"` | Removes task 3.<br>**Reply**: *"Task 3 deleted."* |
| **By Title Query** | `"remove call the bank from my list"` | Searches title and deletes row.<br>**Reply**: *"Task 3 deleted."* |
| **Non-Existent Task** | `"delete task 88"` | **Reply**: *"Task not found."* |

---

### Use Case 6: Adding Quick Notes
Capture ideas, thoughts, and reference information separate from actionable tasks.

#### Phrasing Variations Supported
- `"add note <content>"`, `"create note <content>"`, `"save note <content>"`
- `"jot down note <content>"`, `"take note that <content>"`
- `"remember that <content>"`
- `"save <content> to my notes"`

#### Examples & Scenarios
| Scenario | Example Voice / Typed Command | System Action & Spoken Reply |
| :--- | :--- | :--- |
| **Technical Idea** | `"add note ESP32 pinout idea"` | Saves note.<br>**Reply**: *"Note added: Esp32 pinout idea"* |
| **Memo / Reminder** | `"remember that conference room key is with Alice"` | Saves note.<br>**Reply**: *"Note added: Conference room key is with alice"* |
| **Quick Thought** | `"jot down note check foreign key cascade rules"` | Saves note.<br>**Reply**: *"Note added: Check foreign key cascade rules"* |

---

### Use Case 7: Listing Notes
Retrieve and listen to saved notes.

#### Phrasing Variations Supported
- `"show my notes"`, `"list notes"`, `"what are my notes"`, `"what is in my notes"`

#### Examples & Scenarios
| Scenario | Example Voice / Typed Command | System Action & Spoken Reply |
| :--- | :--- | :--- |
| **When Notes Exist** | `"show my notes"` | Reads notes newest first.<br>**Reply**: *"You have 2 notes. First 5: 2: Check foreign key cascade rules, 1: Esp32 pinout idea."* |
| **When No Notes Exist** | `"show my notes"` | **Reply**: *"You have no notes."* |

---

### Use Case 8: Handling Unknown Commands & Voice Slips
When an unsupported command is spoken or typed, the assistant gives feedback and audits the event.

#### Examples & Scenarios
| Input | System Response | Behind the Scenes |
| :--- | :--- | :--- |
| `"play some music"` | *"Sorry, I did not understand that."* | Recorded into `command_logs` with `intent = 'unknown'`, `success = 0`. |
| `"what is the weather today"` | *"Sorry, I did not understand that."* | Logged for auditing and course analytics. |

---

## 3. Database & Course Project Demo Walkthrough

Here is a 2-minute step-by-step demonstration script you can follow when presenting the project:

1. **Demonstrate Voice Task Creation & Due Date Calculation**:
   - Speak: *"Remind me to submit database project tomorrow"*
   - Show: Task appears in the **Tasks** column with calculated tomorrow date (`YYYY-MM-DD`).
   - Point out: Executed inside an atomic SQLite transaction with the command log.
2. **Demonstrate Flexible Intent & Query Resolution**:
   - Speak: *"Add task prepare slide deck"*
   - Speak: *"Set due date for slide deck to Friday"*
   - Show: Due date updates on the existing pending card.
3. **Demonstrate SQL Trigger on Task Completion**:
   - Speak: *"I finished submit database project"*
   - Show: Status pill turns green (`DONE`).
   - Point out: Database trigger [`trg_task_completed`](file:///c:/Users/rpran/Desktop/Repos/personal-talk-assistant/schema.sql#L112-L117) automatically set `completed_at`.
4. **Demonstrate Notes & Database Views**:
   - Speak: *"Remember that project demo is in Lab 304"*
   - Show: Note appears in the **Notes** column.
   - Speak: *"What are my tasks"*
   - Point out: Queries SQL view [`v_pending_tasks`](file:///c:/Users/rpran/Desktop/Repos/personal-talk-assistant/schema.sql#L108-L110) which excludes the completed task.
5. **Demonstrate Speech Synthesis & Error Auditing**:
   - Speak an unhandled query: *"Open Youtube"*
   - Show: Assistant audibly replies *"Sorry, I did not understand that."* and logs it to `command_logs`.
