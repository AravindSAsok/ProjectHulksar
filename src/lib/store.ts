export type MealType = "breakfast" | "lunch" | "dinner" | "snack";
export type EntrySource = "ai" | "manual";
export type StorageMode = "local" | "cloud";
export interface FoodEntry {
  id: string; name: string; amount: string; calories: number; protein_g: number;
  carbs_g: number; fat_g: number; meal_type: MealType; eaten_at: string; source: EntrySource;
}
export interface TrackerData { entries: FoodEntry[]; goal: number; mode: StorageMode; message?: string; }
export interface HistoryPage { entries: FoodEntry[]; total: number; page: number; pageSize: number; }

const ENTRIES_KEY = "hulksar.entries.v1";
const GOAL_KEY = "hulksar.goal.v1";
const PENDING_KEY = "hulksar.pending-entries.v1";
const LEGACY_ENTRIES_KEY = "trackcake.entries.v1";
const LEGACY_GOAL_KEY = "trackcake.goal.v1";
const DEFAULT_GOAL = 2000;
let storageMode: StorageMode = "local";

function userKey(key: string, userId?: string): string {
  return userId ? key + "." + userId : key;
}
function readLocalEntries(userId?: string): FoodEntry[] {
  try {
    const raw = localStorage.getItem(userKey(ENTRIES_KEY, userId)) || (!userId ? localStorage.getItem(LEGACY_ENTRIES_KEY) : null);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is FoodEntry => {
      if (!entry || typeof entry !== "object") return false;
      const row = entry as Record<string, unknown>;
      return typeof row.id === "string" && typeof row.name === "string" && typeof row.eaten_at === "string" && Number.isFinite(Number(row.calories));
    });
  } catch { return []; }
}
function readLocalGoal(userId?: string): number {
  try {
    const value = Number(localStorage.getItem(userKey(GOAL_KEY, userId)) || (!userId ? localStorage.getItem(LEGACY_GOAL_KEY) : null));
    return Number.isInteger(value) && value >= 500 && value <= 10000 ? value : DEFAULT_GOAL;
  } catch { return DEFAULT_GOAL; }
}
function writeLocal(entries: FoodEntry[], goal?: number, userId?: string) {
  try {
    localStorage.setItem(userKey(ENTRIES_KEY, userId), JSON.stringify(entries));
    if (typeof goal === "number") localStorage.setItem(userKey(GOAL_KEY, userId), String(goal));
  } catch { throw new Error("This browser could not save your diary. Check available storage space or browser privacy settings."); }
}
function readPending(userId: string): FoodEntry[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(PENDING_KEY) || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return [];
    const ids = (parsed as Record<string, unknown>)[userId];
    if (!Array.isArray(ids)) return [];
    const map = new Map(readLocalEntries(userId).map((entry) => [entry.id, entry]));
    return ids.filter((id): id is string => typeof id === "string").map((id) => map.get(id)).filter((entry): entry is FoodEntry => Boolean(entry));
  } catch { return []; }
}
function updatePending(userId: string, ids: string[]) {
  let parsed: Record<string, unknown> = {};
  try {
    const value: unknown = JSON.parse(localStorage.getItem(PENDING_KEY) || "{}");
    if (value && typeof value === "object" && !Array.isArray(value)) parsed = value as Record<string, unknown>;
  } catch { /* empty queue */ }
  if (ids.length) parsed[userId] = ids; else delete parsed[userId];
  localStorage.setItem(PENDING_KEY, JSON.stringify(parsed));
}
function queuePending(userId: string, entry: FoodEntry) {
  const ids = readPending(userId).map((item) => item.id);
  if (!ids.includes(entry.id)) updatePending(userId, [...ids, entry.id]);
}
function removePending(userId: string, id: string) {
  updatePending(userId, readPending(userId).map((item) => item.id).filter((item) => item !== id));
}
async function getCloudContext(): Promise<{ userId: string } | null> {
  const response = await fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) throw new Error("Could not check your sign-in session.");
  const payload = await response.json() as { user?: { id?: string } | null };
  return payload.user?.id ? { userId: payload.user.id } : null;
}
async function apiRequest<T>(_context: { userId: string }, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers: { ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers },
    cache: "no-store"
  });
  const payload = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || "The cloud request failed (HTTP " + response.status + ").");
  return payload;
}
function mergeEntries(cloudEntries: FoodEntry[], localEntries: FoodEntry[]): FoodEntry[] {
  const merged = new Map<string, FoodEntry>();
  for (const entry of localEntries) merged.set(entry.id, entry);
  for (const entry of cloudEntries) merged.set(entry.id, entry);
  return [...merged.values()].sort((a, b) => b.eaten_at.localeCompare(a.eaten_at) || b.id.localeCompare(a.id));
}
function localHistory(options: { page: number; pageSize: number; start?: string; end?: string; search?: string }, userId?: string): HistoryPage {
  let entries = readLocalEntries(userId);
  if (options.start) entries = entries.filter((entry) => entry.eaten_at >= options.start!);
  if (options.end) entries = entries.filter((entry) => entry.eaten_at < options.end!);
  const term = (options.search || "").trim().toLocaleLowerCase();
  if (term) entries = entries.filter((entry) => [entry.name, entry.amount, entry.meal_type].some((value) => value.toLocaleLowerCase().includes(term)));
  entries.sort((a, b) => b.eaten_at.localeCompare(a.eaten_at) || b.id.localeCompare(a.id));
  const offset = (options.page - 1) * options.pageSize;
  return { entries: entries.slice(offset, offset + options.pageSize), total: entries.length, page: options.page, pageSize: options.pageSize };
}

export async function loadTrackerData(): Promise<TrackerData> {
  let userId: string | undefined;
  try {
    const context = await getCloudContext();
    userId = context?.userId;
    const localEntries = readLocalEntries(userId);
    const localGoal = readLocalGoal(userId);
    if (!context) { storageMode = "local"; return { entries: localEntries, goal: localGoal, mode: "local" }; }
    for (const entry of readPending(context.userId)) {
      await apiRequest(context, "/api/tracker", { method: "POST", body: JSON.stringify({ entry }) });
      removePending(context.userId, entry.id);
    }
    const payload = await apiRequest<{ entries: FoodEntry[]; goal: number }>(context, "/api/tracker?limit=500");
    // Keep pre-existing device-only entries local to this account. Do not silently
    // import guest/Supabase data into MongoDB; a deliberate migration can happen later.
    const entries = mergeEntries(payload.entries, localEntries);
    writeLocal(entries, payload.goal, context.userId);
    storageMode = "cloud";
    return { entries, goal: payload.goal, mode: "cloud" };
  } catch (error) {
    storageMode = "local";
    const localEntries = readLocalEntries(userId);
    const localGoal = readLocalGoal(userId);
    console.warn("[hulksar-storage] MongoDB sync unavailable; using local diary.", error);
    return { entries: localEntries, goal: localGoal, mode: "local", message: "Your diary is saved on this device. Cloud sync will resume when the database is available." };
  }
}

export async function fetchHistoryPage(options: { page: number; pageSize?: number; date?: string; search?: string }): Promise<HistoryPage> {
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 10));
  const page = Math.max(1, Math.floor(options.page));
  let start: string | undefined, end: string | undefined, userId: string | undefined;
  if (options.date) {
    const from = new Date(options.date + "T00:00:00");
    const until = new Date(from); until.setDate(until.getDate() + 1);
    start = from.toISOString(); end = until.toISOString();
  }
  try {
    const context = await getCloudContext();
    userId = context?.userId;
    if (!context) return localHistory({ page, pageSize, start, end, search: options.search });
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (start) params.set("start", start);
    if (end) params.set("end", end);
    if (options.search?.trim()) params.set("search", options.search.trim());
    const result = await apiRequest<HistoryPage>(context, "/api/tracker?" + params.toString());
    return { ...result, page, pageSize };
  } catch (error) {
    console.warn("[hulksar-storage] History request failed.", error);
    return localHistory({ page, pageSize, start, end, search: options.search }, userId);
  }
}
export async function addEntry(entry: FoodEntry): Promise<string | undefined> {
  const context = await getCloudContext().catch(() => null);
  const existing = readLocalEntries(context?.userId);
  if (existing.some((item) => item.id === entry.id)) throw new Error("This food entry already exists. Hulksar did not overwrite it.");
  writeLocal([entry, ...existing], undefined, context?.userId);
  if (!context) return;
  try {
    await apiRequest(context, "/api/tracker", { method: "POST", body: JSON.stringify({ entry }) });
  } catch (error) {
    try { queuePending(context.userId, entry); } catch { /* retain local copy */ }
    storageMode = "local";
    return "Saved on this device. MongoDB sync will retry when the connection is available. " + (error instanceof Error ? error.message : "Cloud error");
  }
}
export async function updateEntry(entry: FoodEntry): Promise<string | undefined> {
  const context = await getCloudContext().catch(() => null);
  writeLocal(readLocalEntries(context?.userId).map((item) => item.id === entry.id ? entry : item), undefined, context?.userId);
  if (!context) return;
  try {
    await apiRequest(context, "/api/tracker", { method: "PATCH", body: JSON.stringify({ entry }) });
  } catch (error) {
    storageMode = "local";
    return "Saved on this device only. MongoDB update failed: " + (error instanceof Error ? error.message : "Cloud error");
  }
}
export async function deleteEntry(id: string): Promise<string | undefined> {
  const context = await getCloudContext().catch(() => null);
  writeLocal(readLocalEntries(context?.userId).filter((item) => item.id !== id), undefined, context?.userId);
  if (!context) return;
  try {
    await apiRequest(context, "/api/tracker?id=" + encodeURIComponent(id), { method: "DELETE" });
  } catch (error) {
    storageMode = "local";
    return "Deleted on this device only. MongoDB deletion failed: " + (error instanceof Error ? error.message : "Cloud error");
  }
}
export async function saveGoal(goal: number): Promise<string | undefined> {
  if (!Number.isInteger(goal) || goal < 500 || goal > 10000) throw new Error("Choose a daily goal between 500 and 10,000 kcal.");
  const context = await getCloudContext().catch(() => null);
  writeLocal(readLocalEntries(context?.userId), goal, context?.userId);
  if (!context) return;
  try {
    await apiRequest(context, "/api/tracker", { method: "PATCH", body: JSON.stringify({ goal }) });
  } catch (error) {
    storageMode = "local";
    return "Saved on this device only. MongoDB goal sync failed: " + (error instanceof Error ? error.message : "Cloud error");
  }
}
export function getStorageMode(): StorageMode { return storageMode; }
export const DEFAULT_CALORIE_GOAL = DEFAULT_GOAL;
