import type { APIRoute } from "astro";
import { authenticateRequest } from "../../lib/server-auth";
import { getMongoDb } from "../../lib/mongodb";

export const prerender = false;
export const maxDuration = 30;

type DailyTask = { id: string; title: string; createdAt: string; archivedAt?: string | null };
const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
});
const validDate = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(value + "T00:00:00Z")) &&
  new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value;
const validMonth = (value: string | null): value is string => !!value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);

let taskIndexesReady: Promise<void> | undefined;
async function context(request: Request) {
  const auth = await authenticateRequest(request);
  const db = await getMongoDb();
  taskIndexesReady ??= Promise.all([
    db.collection("daily_tasks").createIndex({ userId: 1, id: 1 }, { unique: true, name: "user_task_unique" }),
    db.collection("daily_tasks").createIndex({ userId: 1, createdAt: 1 }, { name: "user_tasks_created" }),
    db.collection("daily_task_logs").createIndex({ userId: 1, taskId: 1, date: 1 }, { unique: true, name: "user_task_day_unique" }),
    db.collection("daily_task_logs").createIndex({ userId: 1, date: 1 }, { name: "user_task_history" })
  ]).then(() => undefined).catch(error => {
    taskIndexesReady = undefined;
    throw error;
  });
  await taskIndexesReady;
  return { userId: auth.user.id, db };
}
function validTaskTitle(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= 100;
}

export const GET: APIRoute = async ({ request }) => {
  try {
    const { userId, db } = await context(request);
    const params = new URL(request.url).searchParams;
    const month = params.get("month");
    if (!validMonth(month)) return json({ error: "Choose a valid month." }, 400);
    const start = month + "-01";
    const endDate = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1));
    const end = endDate.toISOString().slice(0, 10);
    const [tasks, logs] = await Promise.all([
      db.collection("daily_tasks").find({ userId, createdAt: { $lt: end + "T00:00:00.000Z" } }, { projection: { _id: 0, userId: 0 } }).sort({ createdAt: 1 }).toArray(),
      db.collection("daily_task_logs").find({ userId, date: { $gte: start, $lt: end } }, { projection: { _id: 0, userId: 0 } }).toArray()
    ]);
    return json({ tasks, logs });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load task history.";
    return json({ error: message }, /session|sign in|auth/i.test(message) ? 401 : 503);
  }
};

export const POST: APIRoute = async ({ request }) => {
  let body: { title?: unknown };
  try { body = await request.json() as { title?: unknown }; } catch { return json({ error: "Invalid task." }, 400); }
  if (!validTaskTitle(body.title)) return json({ error: "Enter a task name (up to 100 characters)." }, 400);
  try {
    const { userId, db } = await context(request);
    const task: DailyTask & { userId: string } = { id: crypto.randomUUID(), title: body.title.trim(), createdAt: new Date().toISOString(), archivedAt: null, userId };
    await db.collection("daily_tasks").insertOne(task);
    const { userId: _userId, ...result } = task;
    return json({ task: result }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not add this task.";
    return json({ error: message }, /session|sign in|auth/i.test(message) ? 401 : 503);
  }
};

export const PATCH: APIRoute = async ({ request }) => {
  let body: { taskId?: unknown; date?: unknown; completed?: unknown; title?: unknown };
  try { body = await request.json() as typeof body; } catch { return json({ error: "Invalid task update." }, 400); }
  if (typeof body.taskId !== "string" || !body.taskId || body.taskId.length > 100) return json({ error: "Choose a valid task." }, 400);
  if (body.title !== undefined && !validTaskTitle(body.title)) return json({ error: "Enter a task name (up to 100 characters)." }, 400);
  if (body.title === undefined && (!validDate(body.date) || typeof body.completed !== "boolean")) return json({ error: "Choose a valid day and completion status." }, 400);
  try {
    const { userId, db } = await context(request);
    const tasks = db.collection("daily_tasks");
    const task = await tasks.findOne({ userId, id: body.taskId });
    if (!task) return json({ error: "Task not found." }, 404);
    if (body.title !== undefined) {
      await tasks.updateOne({ userId, id: body.taskId, archivedAt: null }, { $set: { title: body.title.trim() } });
      return json({ saved: true });
    }
    const date = body.date as string;
    await db.collection("daily_task_logs").updateOne(
      { userId, taskId: body.taskId, date },
      { $set: { completed: body.completed, updatedAt: new Date().toISOString() }, $setOnInsert: { userId, taskId: body.taskId, date, createdAt: new Date().toISOString() } },
      { upsert: true }
    );
    return json({ saved: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update this task.";
    return json({ error: message }, /session|sign in|auth/i.test(message) ? 401 : 503);
  }
};

export const DELETE: APIRoute = async ({ request }) => {
  const id = new URL(request.url).searchParams.get("id")?.trim();
  if (!id || id.length > 100) return json({ error: "Choose a valid task." }, 400);
  try {
    const { userId, db } = await context(request);
    const result = await db.collection("daily_tasks").updateOne(
      { userId, id, archivedAt: null }, { $set: { archivedAt: new Date().toISOString() } }
    );
    if (!result.matchedCount) return json({ error: "Task not found." }, 404);
    return json({ archived: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not remove this task.";
    return json({ error: message }, /session|sign in|auth/i.test(message) ? 401 : 503);
  }
};
