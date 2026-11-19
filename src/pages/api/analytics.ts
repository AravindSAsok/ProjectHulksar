import type { APIRoute } from "astro";
import { authenticateRequest } from "../../lib/server-auth";
import { getMongoDb } from "../../lib/mongodb";

export const prerender = false;
export const maxDuration = 30;

const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
});

function validDateTime(value: string | null): value is string {
  return !!value && Number.isFinite(Date.parse(value)) && value.length <= 40;
}

export const GET: APIRoute = async ({ request }) => {
  try {
    const auth = await authenticateRequest(request);
    const db = await getMongoDb();
    const params = new URL(request.url).searchParams;
    const start = params.get("start");
    const end = params.get("end");
    if (!validDateTime(start) || !validDateTime(end) || Date.parse(start) >= Date.parse(end)) {
      return json({ error: "Choose a valid analytics date range." }, 400);
    }
    if (Date.parse(end) - Date.parse(start) > 731 * 24 * 60 * 60 * 1000) {
      return json({ error: "Choose a date range of two years or less." }, 400);
    }
    const startDate = params.get("startDate");
    const endDate = params.get("endDate");
    const validDay = (value: string | null) => !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value + "T00:00:00Z"));
    if (!startDate || !endDate || !validDay(startDate) || !validDay(endDate) || startDate >= endDate) {
      return json({ error: "Choose valid calendar dates." }, 400);
    }
    const userId = auth.user.id;
    const [food, tasks, logs] = await Promise.all([
      db.collection("food_entries").find(
        { userId, eaten_at: { $gte: start, $lt: end } },
        { projection: { _id: 0, userId: 0 } }
      ).sort({ eaten_at: 1 }).limit(50000).toArray(),
      db.collection("daily_tasks").find(
        { userId, createdAt: { $lt: end } },
        { projection: { _id: 0, userId: 0 } }
      ).sort({ createdAt: 1 }).limit(2000).toArray(),
      db.collection("daily_task_logs").find(
        { userId, date: { $gte: startDate, $lt: endDate } },
        { projection: { _id: 0, userId: 0 } }
      ).sort({ date: 1 }).limit(100000).toArray()
    ]);
    return json({ food, tasks, logs, range: { start, end } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load your progress.";
    return json({ error: message }, /session|sign in|auth/i.test(message) ? 401 : 503);
  }
};
