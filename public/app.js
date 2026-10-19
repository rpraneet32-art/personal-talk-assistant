const micBtn = document.getElementById('mic-btn');
const voiceFallback = document.getElementById('voice-fallback');
const liveTranscript = document.getElementById('live-transcript');
const commandForm = document.getElementById('command-form');
const commandInput = document.getElementById('command-input');
const chatLog = document.getElementById('chat-log');
const taskList = document.getElementById('task-list');
const noteList = document.getElementById('note-list');

// Speech Recognition setup (target Chrome desktop)
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isListening = false;

if (!SpeechRecognition) {
  if (micBtn) micBtn.style.display = 'none';
  if (voiceFallback) voiceFallback.style.display = 'inline';
} else {
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  recognition.onstart = () => {
    isListening = true;
    micBtn.classList.add('listening');
    micBtn.textContent = '🛑 Stop Listening';
    liveTranscript.textContent = 'Listening...';
  };

  recognition.onresult = (event) => {
    const transcript = Array.from(event.results)
      .map(result => result[0].transcript)
      .join('');

    liveTranscript.textContent = transcript;

    const isFinal = event.results[event.results.length - 1].isFinal;
    if (isFinal && transcript.trim()) {
      submitCommand(transcript.trim());
    }
  };

  recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
    stopListening();
  };

  recognition.onend = () => {
    stopListening();
  };

  micBtn.addEventListener('click', () => {
    if (isListening) {
      recognition.stop();
    } else {
      try {
        recognition.start();
      } catch (err) {
        console.error('Recognition start error:', err);
      }
    }
  });
}

function stopListening() {
  isListening = false;
  if (micBtn) {
    micBtn.classList.remove('listening');
    micBtn.textContent = '🎙️ Start Listening';
  }
}

// Speech Synthesis for assistant replies
function speakReply(text) {
  if ('speechSynthesis' in window && text) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  }
}

// Append line to chat log
function appendChat(role, message, isError = false) {
  const line = document.createElement('div');
  line.className = `chat-line ${role} ${isError ? 'error' : ''}`;
  const prefix = role === 'user' ? 'You: ' : 'Assistant: ';
  line.textContent = `${prefix}${message}`;
  chatLog.appendChild(line);
  chatLog.scrollTop = chatLog.scrollHeight;
}

// Submit command to backend
async function submitCommand(text) {
  if (!text) return;

  commandInput.value = '';
  appendChat('user', text);
  liveTranscript.textContent = text;

  try {
    const res = await fetch('/api/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });

    const data = await res.json();
    const replyText = data.reply || 'No response from assistant.';

    appendChat('assistant', replyText, !data.success);
    speakReply(replyText);

    // Refresh lists after every command
    await Promise.all([fetchTasks(), fetchNotes()]);
  } catch (error) {
    const errText = 'Error connecting to the assistant backend.';
    appendChat('assistant', errText, true);
    speakReply(errText);
  }
}

// Fetch and render tasks
async function fetchTasks() {
  try {
    const res = await fetch('/api/tasks');
    const tasks = await res.json();

    taskList.innerHTML = '';
    if (!tasks || tasks.length === 0) {
      taskList.innerHTML = '<div class="empty-state">No tasks created yet.</div>';
      return;
    }

    tasks.forEach(task => {
      const card = document.createElement('div');
      card.className = 'item-card';

      const title = document.createElement('div');
      title.className = 'title';
      title.textContent = `#${task.task_id} - ${task.title}`;

      const meta = document.createElement('div');
      meta.className = 'meta';

      const dueDateText = task.due_date ? `Due: ${task.due_date}` : 'No due date';
      const statusClass = task.status === 'done' ? 'badge-done' : 'badge-pending';

      meta.innerHTML = `
        <span>${dueDateText}</span>
        <span class="badge ${statusClass}">${task.status}</span>
      `;

      card.appendChild(title);
      card.appendChild(meta);
      taskList.appendChild(card);
    });
  } catch (err) {
    console.error('Failed to fetch tasks:', err);
  }
}

// Fetch and render notes
async function fetchNotes() {
  try {
    const res = await fetch('/api/notes');
    const notes = await res.json();

    noteList.innerHTML = '';
    if (!notes || notes.length === 0) {
      noteList.innerHTML = '<div class="empty-state">No notes created yet.</div>';
      return;
    }

    notes.forEach(note => {
      const card = document.createElement('div');
      card.className = 'item-card';

      const title = document.createElement('div');
      title.className = 'title';
      title.textContent = `#${note.note_id}`;

      const content = document.createElement('div');
      content.textContent = note.content;

      card.appendChild(title);
      card.appendChild(content);
      noteList.appendChild(card);
    });
  } catch (err) {
    console.error('Failed to fetch notes:', err);
  }
}

// Handle manual typed form submit
commandForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = commandInput.value.trim();
  if (text) {
    submitCommand(text);
  }
});

// Initial load
fetchTasks();
fetchNotes();
