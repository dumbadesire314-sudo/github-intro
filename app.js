/**
 * Progress & Routine Tracker — app.js
 *
 * Data model (persisted in localStorage):
 *   habits : [{ id, name, goal, doneToday, lastDate, streak, bestStreak }]
 *   tasks  : [{ id, label, category, done, date }]   (one entry per calendar day)
 */

(function () {
  'use strict';

  // ─── Helpers ─────────────────────────────────────────────────────────────

  const today = () => new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const fmt = (d) =>
    new Date(d).toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

  const uid = () => Math.random().toString(36).slice(2, 10);

  const VALID_CATEGORIES = ['work', 'health', 'learning', 'personal', 'other'];
  const sanitizeCategory = (c) =>
    VALID_CATEGORIES.includes(c) ? c : 'other';

  // ─── Storage ──────────────────────────────────────────────────────────────

  function load(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch {
      return fallback;
    }
  }

  function save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* quota exceeded — silently ignore */
    }
  }

  // ─── State ────────────────────────────────────────────────────────────────

  let habits = load('prt_habits', []);
  let tasks = load('prt_tasks', []);

  /** Advance streaks: if a habit's lastDate is not today, reset doneToday.
   *  If lastDate was yesterday, streak continues; otherwise streak resets. */
  function reconcileHabits() {
    const t = today();
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    let changed = false;
    habits = habits.map((h) => {
      if (h.lastDate === t) return h; // already today
      const newStreak = h.lastDate === yesterday ? h.streak : 0;
      changed = true;
      return { ...h, doneToday: 0, lastDate: null, streak: newStreak };
    });
    if (changed) save('prt_habits', habits);
  }

  /** Remove tasks from previous days so the list stays relevant */
  function reconcileTasks() {
    const t = today();
    tasks = tasks.filter((tk) => tk.date === t);
    save('prt_tasks', tasks);
  }

  // ─── DOM refs ─────────────────────────────────────────────────────────────

  const habitsList = document.getElementById('habits-list');
  const tasksList = document.getElementById('tasks-list');

  const addHabitForm = document.getElementById('add-habit-form');
  const habitNameInput = document.getElementById('habit-name-input');
  const habitGoalInput = document.getElementById('habit-goal-input');

  const addTaskForm = document.getElementById('add-task-form');
  const taskNameInput = document.getElementById('task-name-input');
  const taskCatInput = document.getElementById('task-cat-input');

  const ringProgress = document.getElementById('ring-progress');
  const ringPct = document.getElementById('ring-pct');
  const ringSub = document.getElementById('ring-sub');

  const statHabitsDone = document.getElementById('stat-habits-done');
  const statHabitsTotal = document.getElementById('stat-habits-total');
  const statTasksDone = document.getElementById('stat-tasks-done');
  const statTasksTotal = document.getElementById('stat-tasks-total');
  const statBestStreak = document.getElementById('stat-best-streak');
  const statScore = document.getElementById('stat-score');

  // ─── Render: habits ──────────────────────────────────────────────────────

  function renderHabits() {
    if (habits.length === 0) {
      habitsList.innerHTML =
        '<p class="empty-state">No habits yet — add one above!</p>';
      return;
    }

    habitsList.innerHTML = habits
      .map((h) => {
        const pct = Math.min(100, Math.round((h.doneToday / h.goal) * 100));
        const done = h.doneToday >= h.goal;
        const safeId = escHtml(h.id);
        const safeName = escHtml(h.name);
        const safeStreak = Number(h.streak) || 0;
        const safeDone = Number(h.doneToday) || 0;
        const safeGoal = Number(h.goal) || 1;
        return `
        <div class="habit-item" data-id="${safeId}">
          <div class="habit-meta">
            <span class="habit-name">${safeName}</span>
            <span class="habit-streak">🔥 ${safeStreak} day streak</span>
            <div class="progress-wrap">
              <div class="progress-bar">
                <div class="progress-bar-fill" style="width:${pct}%${done ? ';background:var(--success)' : ''}"></div>
              </div>
              <span class="progress-label">${safeDone}/${safeGoal}</span>
            </div>
          </div>
          <div class="habit-actions">
            <button class="btn btn-success btn-sm btn-log-habit" data-id="${safeId}"
              title="Log completion" aria-label="Log habit ${safeName}">
              +1
            </button>
            <button class="btn btn-danger btn-delete-habit" data-id="${safeId}"
              title="Delete habit" aria-label="Delete habit ${safeName}">
              ✕
            </button>
          </div>
        </div>`;
      })
      .join('');
  }

  // ─── Render: tasks ────────────────────────────────────────────────────────

  function renderTasks() {
    if (tasks.length === 0) {
      tasksList.innerHTML =
        '<p class="empty-state">No tasks for today — add one above!</p>';
      return;
    }

    tasksList.innerHTML = tasks
      .map((tk) => {
        const cat = sanitizeCategory(tk.category);
        const catClass = `cat-${cat}`;
        const safeId = escHtml(tk.id);
        const safeLabel = escHtml(tk.label);
        const safeCat = escHtml(cat);
        return `
        <div class="task-item${tk.done ? ' done' : ''}" data-id="${safeId}">
          <button class="btn-check${tk.done ? ' checked' : ''}"
            data-id="${safeId}" aria-label="${tk.done ? 'Uncheck' : 'Check'} task ${safeLabel}">
            ${tk.done ? '✓' : ''}
          </button>
          <span class="task-label">${safeLabel}</span>
          <span class="task-category ${catClass}">${safeCat}</span>
          <button class="btn btn-danger btn-delete-task" data-id="${safeId}"
            title="Delete task" aria-label="Delete task ${safeLabel}">
            ✕
          </button>
        </div>`;
      })
      .join('');
  }

  // ─── Render: stats & ring ─────────────────────────────────────────────────

  function renderStats() {
    const habitsDone = habits.filter((h) => h.doneToday >= h.goal).length;
    const tasksDone = tasks.filter((t) => t.done).length;
    const total = habits.length + tasks.length;
    const done = habitsDone + tasksDone;
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);

    statHabitsDone.textContent = habitsDone;
    statHabitsTotal.textContent = `of ${habits.length} completed`;
    statTasksDone.textContent = tasksDone;
    statTasksTotal.textContent = `of ${tasks.length} completed`;

    const best = habits.reduce((mx, h) => Math.max(mx, h.bestStreak || 0), 0);
    statBestStreak.textContent = best;
    statScore.textContent = `${pct}%`;

    // Ring
    const CIRCUMFERENCE = 251.2;
    const offset = CIRCUMFERENCE - (pct / 100) * CIRCUMFERENCE;
    ringProgress.style.strokeDashoffset = offset;
    ringPct.textContent = `${pct}%`;
    ringSub.textContent = `${done} of ${total} items done today`;
  }

  // ─── Full render ──────────────────────────────────────────────────────────

  function renderAll() {
    renderHabits();
    renderTasks();
    renderStats();
  }

  // ─── Habit actions ───────────────────────────────────────────────────────

  function addHabit(name, goal) {
    habits.push({
      id: uid(),
      name,
      goal,
      doneToday: 0,
      lastDate: null,
      streak: 0,
      bestStreak: 0,
    });
    save('prt_habits', habits);
    renderAll();
  }

  function logHabit(id) {
    const t = today();
    habits = habits.map((h) => {
      if (h.id !== id) return h;
      const newDone = h.doneToday + 1;
      const completed = newDone >= h.goal;
      const newStreak = completed && h.lastDate !== t ? h.streak + 1 : h.streak;
      const newBest = Math.max(h.bestStreak || 0, newStreak);
      return {
        ...h,
        doneToday: newDone,
        lastDate: completed ? t : h.lastDate,
        streak: newStreak,
        bestStreak: newBest,
      };
    });
    save('prt_habits', habits);
    renderAll();
  }

  function deleteHabit(id) {
    habits = habits.filter((h) => h.id !== id);
    save('prt_habits', habits);
    renderAll();
  }

  // ─── Task actions ─────────────────────────────────────────────────────────

  function addTask(label, category) {
    tasks.push({ id: uid(), label, category: sanitizeCategory(category), done: false, date: today() });
    save('prt_tasks', tasks);
    renderAll();
  }

  function toggleTask(id) {
    tasks = tasks.map((t) =>
      t.id === id ? { ...t, done: !t.done } : t
    );
    save('prt_tasks', tasks);
    renderAll();
  }

  function deleteTask(id) {
    tasks = tasks.filter((t) => t.id !== id);
    save('prt_tasks', tasks);
    renderAll();
  }

  // ─── Security: HTML escape ────────────────────────────────────────────────

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ─── Event delegation ─────────────────────────────────────────────────────

  habitsList.addEventListener('click', (e) => {
    const logBtn = e.target.closest('.btn-log-habit');
    const delBtn = e.target.closest('.btn-delete-habit');
    if (logBtn) logHabit(logBtn.dataset.id);
    if (delBtn) deleteHabit(delBtn.dataset.id);
  });

  tasksList.addEventListener('click', (e) => {
    const chk = e.target.closest('.btn-check');
    const del = e.target.closest('.btn-delete-task');
    if (chk) toggleTask(chk.dataset.id);
    if (del) deleteTask(del.dataset.id);
  });

  // ─── Add-habit form ──────────────────────────────────────────────────────

  document.getElementById('btn-toggle-add-habit').addEventListener('click', () => {
    addHabitForm.style.display = addHabitForm.style.display === 'none' ? 'flex' : 'none';
    if (addHabitForm.style.display !== 'none') habitNameInput.focus();
  });

  document.getElementById('btn-cancel-habit').addEventListener('click', () => {
    addHabitForm.style.display = 'none';
    habitNameInput.value = '';
    habitGoalInput.value = 1;
  });

  document.getElementById('btn-add-habit').addEventListener('click', () => {
    const name = habitNameInput.value.trim();
    const goal = Math.max(1, parseInt(habitGoalInput.value, 10) || 1);
    if (!name) { habitNameInput.focus(); return; }
    addHabit(name, goal);
    habitNameInput.value = '';
    habitGoalInput.value = 1;
    addHabitForm.style.display = 'none';
  });

  habitNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('btn-add-habit').click();
  });

  // ─── Add-task form ────────────────────────────────────────────────────────

  document.getElementById('btn-toggle-add-task').addEventListener('click', () => {
    addTaskForm.style.display = addTaskForm.style.display === 'none' ? 'flex' : 'none';
    if (addTaskForm.style.display !== 'none') taskNameInput.focus();
  });

  document.getElementById('btn-cancel-task').addEventListener('click', () => {
    addTaskForm.style.display = 'none';
    taskNameInput.value = '';
  });

  document.getElementById('btn-add-task').addEventListener('click', () => {
    const label = taskNameInput.value.trim();
    if (!label) { taskNameInput.focus(); return; }
    addTask(label, taskCatInput.value);
    taskNameInput.value = '';
    addTaskForm.style.display = 'none';
  });

  taskNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('btn-add-task').click();
  });

  // ─── Bootstrap ────────────────────────────────────────────────────────────

  document.getElementById('today-date').textContent = fmt(today());
  reconcileHabits();
  reconcileTasks();
  renderAll();
})();
