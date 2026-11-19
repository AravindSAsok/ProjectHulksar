export {};

type Task = { id: string; title: string; createdAt: string; archivedAt?: string | null };
type TaskLog = { taskId: string; date: string; completed: boolean };
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const monthKey = (date: Date) => date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0");
const dayKey = (date: Date) => monthKey(date) + "-" + String(date.getDate()).padStart(2, "0");
const dateFromKey = (key: string) => new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10)));
const esc = (value: string) => value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] || c);
const formatDate = (key: string, options: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long" }) =>
  new Intl.DateTimeFormat("en-IN", options).format(dateFromKey(key));

let tasks: Task[] = [];
let logs: TaskLog[] = [];
let month = monthKey(new Date());
let selectedDate = dayKey(new Date());
let busy = false;
let feedbackTimer: number | undefined;
const pendingTaskStates = new Map<string, boolean>();
const syncingTaskStates = new Set<string>();
const syncedTaskStates = new Map<string, boolean>();

let editingTaskId: string | null = null;
const taskEditDialog = $("task-edit-dialog") as HTMLDialogElement;
const taskEditForm = $("task-edit-form") as HTMLFormElement;
const taskEditInput = $("task-edit-title") as HTMLInputElement;
const taskDeleteConfirm = $("task-delete-confirm");
const taskDeleteName = $("task-delete-name");

function openTaskEditor(task: Task) {
  editingTaskId = task.id;
  taskEditInput.value = task.title;
  taskDeleteConfirm.hidden = true;
  taskEditForm.hidden = false;
  taskEditDialog.showModal();
  requestAnimationFrame(() => taskEditInput.focus());
}

taskEditForm.addEventListener("submit", async event => {
  event.preventDefault();
  const task = tasks.find(item => item.id === editingTaskId);
  const title = taskEditInput.value.trim();
  if (!task || busy || !title || title.length > 100) return;
  if (title === task.title) { taskEditDialog.close(); return; }
  const previousTitle = task.title;
  task.title = title;
  render();
  taskEditDialog.close();
  busy = true;
  try {
    await api("/api/tasks", { method: "PATCH", body: JSON.stringify({ taskId: task.id, title }) });
    feedback("Task updated.");
  } catch {
    task.title = previousTitle;
    render();
    showNetworkWarning();
  } finally { busy = false; }
});

$("task-delete-start").addEventListener("click", () => {
  const task = tasks.find(item => item.id === editingTaskId);
  if (!task || busy) return;
  taskDeleteName.textContent = task.title;
  taskEditForm.hidden = true;
  taskDeleteConfirm.hidden = false;
  $("task-delete-cancel").focus();
});

$("task-delete-cancel").addEventListener("click", () => {
  taskDeleteConfirm.hidden = true;
  taskEditForm.hidden = false;
  taskEditInput.focus();
});

$("task-delete-confirm-button").addEventListener("click", async () => {
  const task = tasks.find(item => item.id === editingTaskId);
  if (!task || busy) return;
  const previousArchivedAt = task.archivedAt;
  task.archivedAt = new Date().toISOString();
  render();
  taskEditDialog.close();
  busy = true;
  try {
    await api("/api/tasks?id=" + encodeURIComponent(task.id), { method: "DELETE" });
    feedback("Task removed. Its previous history is preserved.");
  } catch {
    task.archivedAt = previousArchivedAt;
    render();
    showNetworkWarning();
  } finally { busy = false; }
});

$("task-edit-close").addEventListener("click", () => taskEditDialog.close());
$("task-edit-cancel").addEventListener("click", () => taskEditDialog.close());

taskEditDialog.addEventListener("close", () => {
  editingTaskId = null;
  taskDeleteConfirm.hidden = true;
  taskEditForm.hidden = false;
});

function feedback(message: string, error = false) {
  const el = $("task-feedback");
  el.textContent = message;
  el.classList.toggle("is-error", error);
}
function showNetworkWarning() {
  const toast = document.getElementById("toast");
  if (toast) {
    toast.textContent = "Unstable network, some data may not be synced";
    toast.className = "toast visible toast-error";
    window.clearTimeout(feedbackTimer);
    feedbackTimer = window.setTimeout(() => { toast.className = "toast"; }, 2000);
  } else {
    feedback("Unstable network, some data may not be synced", true);
    window.clearTimeout(feedbackTimer);
    feedbackTimer = window.setTimeout(() => feedback(""), 2000);
  }
}
async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  // The protected API authenticates every request; avoid a duplicate session round trip.
  const response = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers: { ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers },
    cache: "no-store"
  });
  const body = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(body.error || "Could not save your task.");
  return body;
}
const logsFor = (date: string) => new Map<string, boolean>(logs.filter(log => log.date === date).map(log => [log.taskId, log.completed] as [string, boolean]));
const tasksFor = (date: string) => tasks.filter(task => task.createdAt.slice(0, 10) <= date && (!task.archivedAt || task.archivedAt.slice(0, 10) > date));
function completedCount(date: string) {
  const due = tasksFor(date), done = logsFor(date);
  return { done: due.filter(task => done.get(task.id)).length, total: due.length };
}
function activeStreak() {
  let cursor = new Date(); let streak = 0;
  while (streak < 366) {
    const key = dayKey(cursor), counts = completedCount(key);
    if (!counts.total || counts.done !== counts.total) break;
    streak++; cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
function renderDaily() {
  const key = selectedDate, due = tasksFor(key), status = logsFor(key);
  const done = due.filter(task => status.get(task.id)).length;
  const percent = due.length ? Math.round(done / due.length * 100) : 0;
  $("task-selected-date").textContent = key === dayKey(new Date()) ? "Today" : formatDate(key);
  $("task-day-caption").textContent = due.length ? `${done} of ${due.length} tasks completed · ${percent}%` : "Add a task to start building your routine.";
  $("task-day-progress-fill").style.width = percent + "%";
  $("task-summary-done").textContent = done + " / " + due.length;
  $("task-summary-rate").textContent = due.length ? percent + "%" : "—";
  $("task-summary-streak").textContent = month === monthKey(new Date()) ? activeStreak() + " days" : "—";
  $("task-list").innerHTML = due.length ? due.map(task => {
    const checked = !!status.get(task.id);
    return `<div class="task-row ${checked ? "is-complete" : ""}" data-task-row="${esc(task.id)}">
      <button class="task-check ${checked ? "checked" : ""}" type="button" data-task-toggle="${esc(task.id)}" aria-label="${checked ? "Mark incomplete" : "Mark complete"}: ${esc(task.title)}" aria-pressed="${checked}">${checked ? "✓" : ""}</button>
      <button class="task-row-title" type="button" data-task-toggle="${esc(task.id)}" aria-label="${checked ? "Mark incomplete" : "Mark complete"}: ${esc(task.title)}" aria-pressed="${checked}">${esc(task.title)}</button>
      <button class="task-edit" type="button" data-task-edit="${esc(task.id)}" aria-label="Edit task">···</button>
    </div>`;
  }).join("") : '<p class="task-empty">Nothing on your list yet. Add one small thing you want to show up for.</p>';
}
function renderCalendar() {
  const [year, monthNum] = month.split("-").map(Number);
  const first = new Date(year, monthNum - 1, 1);
  const days = new Date(year, monthNum, 0).getDate();
  const offset = (first.getDay() + 6) % 7;
  $("task-month-label").textContent = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(first);
  let html = "";
  for (let i = 0; i < offset; i++) html += '<span class="task-calendar-blank"></span>';
  for (let day = 1; day <= days; day++) {
    const key = month + "-" + String(day).padStart(2, "0");
    const counts = completedCount(key);
    const level = !counts.total || !counts.done ? 0 : counts.done === counts.total ? 2 : 1;
    const future = key > dayKey(new Date());
    html += `<button type="button" class="task-calendar-day level-${level} ${key === selectedDate ? "selected" : ""} ${future ? "future" : ""}" data-task-date="${key}" ${future ? "disabled" : ""} aria-label="${formatDate(key, { day: "numeric", month: "long", year: "numeric" })}: ${counts.done} of ${counts.total} done"><span>${day}</span>${counts.total ? `<i>${counts.done}/${counts.total}</i>` : ""}</button>`;
  }
  $("task-calendar-grid").innerHTML = html;
  const monthLogs = logs.filter(log => log.date.startsWith(month) && log.completed);
  const checkins = monthLogs.length;
  const daysWithTasks = Array.from({ length: days }, (_, i) => month + "-" + String(i + 1).padStart(2, "0")).filter(key => tasksFor(key).length && key <= dayKey(new Date()));
  const activeDays = daysWithTasks.filter(key => completedCount(key).done > 0).length;
  $("task-month-summary").textContent = `${checkins} completed check-ins · ${activeDays} active days this month`;
}
function renderAnalysis() {
  const [year, monthNum] = month.split("-").map(Number);
  const days = new Date(year, monthNum, 0).getDate();
  const validDays = Array.from({ length: days }, (_, i) => month + "-" + String(i + 1).padStart(2, "0")).filter(key => key <= dayKey(new Date()) && tasksFor(key).length);
  let possible = 0, done = 0, bestDay = "—";
  let bestRate = -1;
  for (const key of validDays) {
    const counts = completedCount(key); possible += counts.total; done += counts.done;
    const rate = counts.total ? counts.done / counts.total : 0;
    if (rate > bestRate && counts.total) { bestRate = rate; bestDay = formatDate(key, { day: "numeric", month: "short" }); }
  }
  const rate = possible ? Math.round(done / possible * 100) : 0;
  const taskStats = tasks.map(task => {
    const applicable = validDays.filter(key => task.createdAt.slice(0, 10) <= key && (!task.archivedAt || task.archivedAt.slice(0, 10) > key));
    const count = applicable.filter(key => logsFor(key).get(task.id)).length;
    return { title: task.title, count, total: applicable.length, rate: applicable.length ? Math.round(count / applicable.length * 100) : 0 };
  }).filter(item => item.total).sort((a, b) => b.rate - a.rate || b.count - a.count);
  const weeks = Array.from({ length: Math.ceil(days / 7) }, (_, i) => {
    const keys = validDays.filter(key => Math.floor((Number(key.slice(8, 10)) - 1) / 7) === i);
    const total = keys.reduce((sum, key) => sum + completedCount(key).total, 0);
    const value = keys.reduce((sum, key) => sum + completedCount(key).done, 0);
    return { label: "W" + (i + 1), rate: total ? Math.round(value / total * 100) : 0 };
  });
  $("task-analysis-subtitle").textContent = "Your tracking summary for " + new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(new Date(year, monthNum - 1, 1)) + ".";
  $("task-analysis-stats").innerHTML = [
    ["Completion rate", rate + "%"], ["Completed check-ins", String(done)], ["Best day", bestDay], ["Tasks tracked", String(taskStats.length)]
  ].map(([label, value]) => `<div class="task-analysis-stat"><small>${label}</small><strong>${value}</strong></div>`).join("");
  $("task-analysis-breakdown").innerHTML = taskStats.length ? taskStats.slice(0, 8).map(item => `<div class="task-analysis-item"><div><span>${esc(item.title)}</span><strong>${item.rate}%</strong></div><div class="task-analysis-track"><i style="width:${item.rate}%"></i></div><small>${item.count} of ${item.total} days</small></div>`).join("") : '<p class="task-empty">Complete a few tasks to see your consistency.</p>';
  $("task-weekly-chart").innerHTML = weeks.map(item => `<div class="task-week-bar"><div class="task-week-bar-track"><i style="height:${item.rate}%"></i></div><strong>${item.rate}%</strong><small>${item.label}</small></div>`).join("");
  $("task-analysis-note").textContent = !possible ? "Start checking off tasks and your monthly insights will appear here." :
    rate >= 80 ? "Excellent consistency. Keep the routine realistic and build on what's already working." :
    rate >= 50 ? "You're building momentum. Focus on repeating your easiest wins before adding more tasks." :
    "Progress starts with showing up. Try keeping your daily list short enough to complete on busy days.";
}
function render() { renderDaily(); renderCalendar(); renderAnalysis(); }
async function loadMonth() {
  busy = true; $("task-list").innerHTML = '<p class="task-empty">Loading your tasks…</p>';
  try {
    const result = await api<{ tasks: Task[]; logs: TaskLog[] }>("/api/tasks?month=" + month);
    tasks = result.tasks || []; logs = result.logs || []; render(); feedback("");
  } catch (error) { feedback(error instanceof Error ? error.message : "Could not load tasks.", true); $("task-list").innerHTML = '<p class="task-empty">Tasks could not be loaded. Please try again.</p>'; }
  finally { busy = false; }
}
async function refresh() { await loadMonth(); }
async function syncTaskState(taskId: string, date: string, key: string): Promise<void> {
  if (syncingTaskStates.has(key)) return;
  syncingTaskStates.add(key);
  try {
    while (pendingTaskStates.has(key)) {
      const desired = pendingTaskStates.get(key)!;
      pendingTaskStates.delete(key);
      try {
        await api("/api/tasks", { method: "PATCH", body: JSON.stringify({ taskId, date, completed: desired }) });
        syncedTaskStates.set(key, desired);
      } catch (error) {
        if (pendingTaskStates.has(key)) continue;
        throw error;
      }
    }
  } catch {
    const rollback = syncedTaskStates.get(key) || false;
    const index = logs.findIndex(log => log.taskId === taskId && log.date === date);
    if (index >= 0) logs[index].completed = rollback;
    else if (rollback) logs.push({ taskId, date, completed: true });
    pendingTaskStates.delete(key);
    render();
    showNetworkWarning();
  } finally {
    syncingTaskStates.delete(key);
  }
}
$("task-add-form").addEventListener("submit", async event => {
  event.preventDefault();
  const input = $("task-title-input") as HTMLInputElement, title = input.value.trim();
  if (!title || busy) return;
  busy = true;
  const temporaryId = "pending-" + crypto.randomUUID();
  const optimisticTask: Task = { id: temporaryId, title, createdAt: new Date().toISOString(), archivedAt: null };
  tasks.push(optimisticTask);
  input.value = "";
  month = monthKey(new Date()); selectedDate = dayKey(new Date());
  render();
  try {
    const result = await api<{ task: Task }>("/api/tasks", { method: "POST", body: JSON.stringify({ title }) });
    tasks = tasks.map(task => task.id === temporaryId ? result.task : task);
    render();
    feedback("Task added to your daily list.");
  } catch {
    tasks = tasks.filter(task => task.id !== temporaryId);
    render();
    showNetworkWarning();
  } finally { busy = false; }
});
$("task-list").addEventListener("click", async event => {
  const target = event.target as HTMLElement;
  const toggle = target.closest<HTMLElement>("[data-task-toggle]");
  const edit = target.closest<HTMLElement>("[data-task-edit]");
  if (toggle) {
    const taskId = toggle.dataset.taskToggle!;
    const date = selectedDate;
    const key = taskId + "|" + date;
    const current = logsFor(date).get(taskId) || false;
    const next = !current;
    if (!syncedTaskStates.has(key)) syncedTaskStates.set(key, current);
    const existing = logs.findIndex(log => log.taskId === taskId && log.date === date);
    if (existing >= 0) logs[existing].completed = next;
    else logs.push({ taskId, date, completed: next });
    pendingTaskStates.set(key, next);
    render();
    void syncTaskState(taskId, date, key);
  } else if (edit) {
    const task = tasks.find(item => item.id === edit.dataset.taskEdit);
    if (!task || busy) return;
    openTaskEditor(task);
  }
});
$("task-calendar-grid").addEventListener("click", event => {
  const day = (event.target as HTMLElement).closest<HTMLElement>("[data-task-date]");
  if (!day || day.hasAttribute("disabled")) return;
  selectedDate = day.dataset.taskDate!; render();
});
$("task-month-prev").addEventListener("click", async () => { const [y, m] = month.split("-").map(Number); month = monthKey(new Date(y, m - 2, 1)); selectedDate = month + "-01"; await loadMonth(); });
$("task-month-next").addEventListener("click", async () => { const [y, m] = month.split("-").map(Number); const next = new Date(y, m, 1); if (next > new Date()) return; month = monthKey(next); selectedDate = month + "-01"; await loadMonth(); });
$("task-go-today").addEventListener("click", async () => { month = monthKey(new Date()); selectedDate = dayKey(new Date()); await loadMonth(); });
$("task-analyse").addEventListener("click", () => { const panel = $("task-analysis-panel"); panel.hidden = !panel.hidden; if (!panel.hidden) panel.scrollIntoView({ behavior: "smooth", block: "nearest" }); });
$("task-analysis-close").addEventListener("click", () => { $("task-analysis-panel").hidden = true; });
loadMonth();
