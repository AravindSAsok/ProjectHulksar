type Food = { id: string; name: string; calories: number; protein_g: number; carbs_g: number; fat_g: number; meal_type: string; eaten_at: string };
type Task = { id: string; title: string; createdAt: string; archivedAt?: string | null };
type Log = { taskId: string; date: string; completed: boolean };
type Payload = { food: Food[]; tasks: Task[]; logs: Log[]; error?: string };
type Day = { date: string; foodCount: number; calories: number; protein: number; carbs: number; fat: number; meals: Record<string, number>; done: number; possible: number; rate: number };

const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const period = el<HTMLSelectElement>("analytics-period");
const startInput = el<HTMLInputElement>("analytics-start");
const endInput = el<HTMLInputElement>("analytics-end");
const scope = el<HTMLSelectElement>("analytics-scope");
const feedback = el<HTMLParagraphElement>("analytics-feedback");
const fmt = (n: number) => Math.round(n).toLocaleString("en-IN");
const localKey = (date: Date) => date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
const parseKey = (key: string) => new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10)));
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || c);
function rangeFor(value: string) {
  const today = new Date();
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  let start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (value === "7d") start.setDate(start.getDate() - 6);
  else if (value === "30d") start.setDate(start.getDate() - 29);
  else if (value === "month") start = new Date(today.getFullYear(), today.getMonth(), 1);
  else if (value === "year") start = new Date(today.getFullYear(), 0, 1);
  else return;
  startInput.value = localKey(start);
  endInput.value = localKey(new Date(end.getTime() - 86400000));
}
function isoLocalStart(key: string) {
  const d = parseKey(key);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString();
}
function isoLocalEnd(key: string) {
  const d = parseKey(key);
  d.setDate(d.getDate() + 1);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString();
}
function makeDays(start: string, end: string, food: Food[], tasks: Task[], logs: Log[]): Day[] {
  const days: Day[] = [];
  const completed = new Map<string, Set<string>>();
  for (const log of logs) {
    if (!log.completed) continue;
    if (!completed.has(log.date)) completed.set(log.date, new Set());
    completed.get(log.date)!.add(log.taskId);
  }
  const taskById = new Map(tasks.map(task => [task.id, task]));
  for (let cursor = parseKey(start), last = parseKey(end); cursor <= last; cursor.setDate(cursor.getDate() + 1)) {
    const key = localKey(cursor);
    const entries = food.filter(item => localKey(new Date(item.eaten_at)) === key);
    const active = tasks.filter(task => task.createdAt.slice(0, 10) <= key && (!task.archivedAt || task.archivedAt.slice(0, 10) > key));
    const doneSet = completed.get(key) || new Set<string>();
    const done = active.filter(task => doneSet.has(task.id)).length;
    const meals: Record<string, number> = { breakfast: 0, lunch: 0, dinner: 0, snack: 0 };
    for (const entry of entries) meals[entry.meal_type] = (meals[entry.meal_type] || 0) + Number(entry.calories || 0);
    days.push({
      date: key, foodCount: entries.length,
      calories: entries.reduce((sum, item) => sum + Number(item.calories || 0), 0),
      protein: entries.reduce((sum, item) => sum + Number(item.protein_g || 0), 0),
      carbs: entries.reduce((sum, item) => sum + Number(item.carbs_g || 0), 0),
      fat: entries.reduce((sum, item) => sum + Number(item.fat_g || 0), 0),
      meals, done, possible: active.length, rate: active.length ? Math.round(done / active.length * 100) : 0
    });
  }
  return days;
}
function lineChart(days: Day[], key: "calories" | "rate", suffix: string) {
  const width = 760, height = 250, left = 48, right = 18, top = 16, bottom = 48;
  const values = days.map(day => day[key]);
  const max = Math.max(10, ...values) * 1.12;
  const x = (i: number) => left + (days.length <= 1 ? 0 : i * (width - left - right) / (days.length - 1));
  const y = (v: number) => top + (height - top - bottom) * (1 - v / max);
  const path = values.map((v, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1)).join(" ");
  const grid = [0, .25, .5, .75, 1].map(p => {
    const val = max * p, yy = y(val);
    return '<line x1="' + left + '" y1="' + yy + '" x2="' + (width - right) + '" y2="' + yy + '" class="analytics-gridline"/><text x="' + (left - 8) + '" y="' + (yy + 4) + '" text-anchor="end" class="analytics-axis-label">' + Math.round(val) + '</text>';
  }).join("");
  const step = Math.max(1, Math.ceil(days.length / 7));
  const labels = days.filter((_, i) => i % step === 0 || i === days.length - 1).map(day => {
    const i = days.indexOf(day);
    return '<text x="' + x(i) + '" y="' + (height - 15) + '" text-anchor="middle" class="analytics-axis-label">' + day.date.slice(5) + '</text>';
  }).join("");
  const dots = values.map((v, i) => '<circle cx="' + x(i) + '" cy="' + y(v) + '" r="3.2" class="analytics-point"><title>' + days[i].date + ': ' + fmt(v) + suffix + '</title></circle>').join("");
  return '<svg viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="Chart showing daily values on a date x-axis and ' + suffix + ' y-axis">' + grid + '<path d="' + path + '" class="analytics-line"/>' + dots + labels + '<text x="12" y="12" class="analytics-axis-title">' + suffix + '</text></svg>';
}
function barChart(days: Day[]) {
  const width = 760, height = 220, left = 34, right = 14, top = 14, bottom = 42;
  const slot = (width - left - right) / Math.max(days.length, 1), barWidth = Math.max(2, Math.min(18, slot * .58));
  const bars = days.map((day, i) => {
    const h = (height - top - bottom) * day.rate / 100, x = left + i * slot + (slot - barWidth) / 2;
    return '<rect x="' + x + '" y="' + (height - bottom - h) + '" width="' + barWidth + '" height="' + h + '" rx="3" class="analytics-bar"><title>' + day.date + ': ' + day.done + '/' + day.possible + ' tasks (' + day.rate + '%)</title></rect>';
  }).join("");
  const step = Math.max(1, Math.ceil(days.length / 7));
  const labels = days.filter((_, i) => i % step === 0 || i === days.length - 1).map(day => {
    const i = days.indexOf(day), x = left + i * slot + slot / 2;
    return '<text x="' + x + '" y="' + (height - 12) + '" text-anchor="middle" class="analytics-axis-label">' + day.date.slice(5) + '</text>';
  }).join("");
  const grid = [0, 25, 50, 75, 100].map(v => {
    const y = height - bottom - (height - top - bottom) * v / 100;
    return '<line x1="' + left + '" y1="' + y + '" x2="' + (width - right) + '" y2="' + y + '" class="analytics-gridline"/><text x="' + (left - 7) + '" y="' + (y + 4) + '" text-anchor="end" class="analytics-axis-label">' + v + '</text>';
  }).join("");
  return '<svg viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="Task completion percentage by date">' + grid + bars + labels + '</svg>';
}
function renderStats(days: Day[], showFood: boolean, showTasks: boolean) {
  const foodCount = days.reduce((n, d) => n + d.foodCount, 0);
  const calories = days.reduce((n, d) => n + d.calories, 0);
  const protein = days.reduce((n, d) => n + d.protein, 0);
  const possible = days.reduce((n, d) => n + d.possible, 0);
  const done = days.reduce((n, d) => n + d.done, 0);
  const active = days.filter(d => d.foodCount || d.done > 0).length;
  const stats: [string, string, string][] = [];
  if (showFood) {
    stats.push(["Calories logged", fmt(calories) + " kcal", foodCount + " food entries"]);
    stats.push(["Average per day", fmt(calories / Math.max(days.length, 1)) + " kcal", "Across selected dates"]);
    stats.push(["Protein logged", fmt(protein) + " g", "Estimated from entries"]);
  }
  if (showTasks) stats.push(["Task completion", possible ? Math.round(done / possible * 100) + "%" : "—", done + " of " + possible + " check-ins"]);
  stats.push(["Active days", String(active), "Days with food or completed tasks"]);
  el<HTMLDivElement>("analytics-stats").innerHTML = stats.map(([label, value, note]) => '<article class="analytics-stat"><small>' + label + '</small><strong>' + value + '</strong><span>' + note + '</span></article>').join("");
}
function renderMeals(days: Day[]) {
  const labels = ["breakfast", "lunch", "dinner", "snack"];
  const totals = labels.map(label => days.reduce((sum, day) => sum + day.meals[label], 0));
  const total = totals.reduce((a, b) => a + b, 0);
  const colors = ["#d78a68", "#8eaa85", "#9c7dba", "#d0b66f"];
  let offset = 0;
  const stops = totals.map((value, i) => {
    const from = offset; offset += total ? value / total * 100 : 0;
    return colors[i] + " " + from + "% " + offset + "%";
  });
  const names = ["Breakfast", "Lunch", "Dinner", "Snacks"];
  const legend = names.map((name, i) => '<div class="analytics-legend-row"><span><i style="background:' + colors[i] + '"></i>' + name + '</span><strong>' + fmt(totals[i]) + ' kcal</strong></div>').join("");
  el<HTMLDivElement>("analytics-meals").innerHTML = total
    ? '<div class="analytics-donut" style="background:conic-gradient(' + stops.join(",") + ')"><div><strong>' + fmt(total) + '</strong><span>kcal</span></div></div><div class="analytics-legend">' + legend + '</div>'
    : '<div class="analytics-empty">No food entries in this range yet.</div>';
}
function renderRows(days: Day[], showFood: boolean, showTasks: boolean) {
  el<HTMLTableSectionElement>("analytics-rows").innerHTML = days.slice().reverse().map(day =>
    '<tr><td>' + day.date + '</td><td>' + (showFood ? day.foodCount : "—") + '</td><td>' + (showFood ? fmt(day.calories) + " kcal" : "—") + '</td><td>' + (showFood ? fmt(day.protein) + " g" : "—") + '</td><td>' + (showTasks ? day.done + "/" + day.possible : "—") + '</td><td>' + (showTasks ? (day.possible ? day.rate + "%" : "—") : "—") + '</td></tr>'
  ).join("") || '<tr><td colspan="6">No records in this date range.</td></tr>';
  el<HTMLSpanElement>("analytics-row-count").textContent = days.length + " days";
}
async function load() {
  if (!startInput.value || !endInput.value || startInput.value > endInput.value) {
    feedback.textContent = "Choose a valid start and end date."; return;
  }
  const button = el<HTMLButtonElement>("analytics-refresh");
  button.disabled = true; feedback.textContent = "Loading your private progress data…";
  try {
    const response = await fetch("/api/analytics?start=" + encodeURIComponent(isoLocalStart(startInput.value)) + "&end=" + encodeURIComponent(isoLocalEnd(endInput.value)), { credentials: "same-origin", cache: "no-store" });
    const payload = await response.json() as Payload;
    if (!response.ok) throw new Error(payload.error || "Could not load progress.");
    const days = makeDays(startInput.value, endInput.value, payload.food || [], payload.tasks || [], payload.logs || []);
    const showFood = scope.value !== "tasks", showTasks = scope.value !== "food";
    renderStats(days, showFood, showTasks);
    el<HTMLHeadingElement>("analytics-trend-title").textContent = showFood && showTasks ? "Nutrition and habit activity" : showFood ? "Calories over time" : "Task completion over time";
    el<HTMLSpanElement>("analytics-trend-note").textContent = showFood ? "X: date · Y: kcal" : "X: date · Y: completion %";
    el<HTMLDivElement>("analytics-trend").innerHTML = showFood ? lineChart(days, "calories", "kcal") : lineChart(days, "rate", "%");
    el<HTMLDivElement>("analytics-meals").closest("article")!.hidden = !showFood;
    el<HTMLDivElement>("analytics-meals").innerHTML = "";
    if (showFood) renderMeals(days);
    el<HTMLDivElement>("analytics-tasks").closest("article")!.hidden = !showTasks;
    if (showTasks) el<HTMLDivElement>("analytics-tasks").innerHTML = barChart(days);
    renderRows(days, showFood, showTasks);
    feedback.textContent = "Showing " + days.length + " calendar days · " + fmt((payload.food || []).length) + " foods · " + fmt((payload.logs || []).length) + " task check-ins.";
  } catch (error) {
    feedback.textContent = error instanceof Error ? error.message : "Could not load your progress.";
  } finally { button.disabled = false; }
}
rangeFor(period.value);
period.addEventListener("change", () => { if (period.value !== "custom") rangeFor(period.value); });
startInput.addEventListener("change", () => { period.value = "custom"; });
endInput.addEventListener("change", () => { period.value = "custom"; });
scope.addEventListener("change", load);
el<HTMLButtonElement>("analytics-refresh").addEventListener("click", load);
load();
