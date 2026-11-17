import type { APIRoute } from "astro";
import type { Db, Document } from "mongodb";
import { authenticateRequest } from "../../lib/server-auth";
import { getMongoDb } from "../../lib/mongodb";

export const prerender = false;
export const maxDuration = 30;

type FoodEntry = {
  id: string; name: string; amount: string; calories: number; protein_g: number;
  carbs_g: number; fat_g: number; meal_type: "breakfast" | "lunch" | "dinner" | "snack";
  eaten_at: string; source: "ai" | "manual";
};
const DEFAULT_GOAL = 2000;
const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
});

async function ensureIndexes(db: Db) {
  await Promise.all([
    db.collection("food_entries").createIndex({ userId: 1, id: 1 }, { unique: true, name: "user_entry_unique" }),
    db.collection("food_entries").createIndex({ userId: 1, eaten_at: -1, id: -1 }, { name: "user_history" }),
    db.collection("tracker_settings").createIndex({ userId: 1 }, { unique: true, name: "user_settings_unique" }),
    db.collection("assistant_messages").createIndex({ userId: 1, created_at: -1 }, { name: "user_assistant_history" })
  ]);
}
function validEntry(value: unknown): value is FoodEntry {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === "string" && !!row.id && typeof row.name === "string" && !!row.name.trim() &&
    typeof row.amount === "string" && typeof row.eaten_at === "string" && Number.isFinite(Date.parse(row.eaten_at)) &&
    ["breakfast", "lunch", "dinner", "snack"].includes(String(row.meal_type)) &&
    ["ai", "manual"].includes(String(row.source)) &&
    ["calories", "protein_g", "carbs_g", "fat_g"].every((key) => Number.isFinite(Number(row[key])) && Number(row[key]) >= 0 && Number(row[key]) <= 10000);
}
function docFor(entry: FoodEntry, userId: string): Document {
  return { ...entry, userId, name: entry.name.trim().slice(0, 120), amount: entry.amount.trim().slice(0, 100) };
}
function escapeRegex(value: string) {
  return value.replace(/[.*+?^$()|[\]\\]/g, "\\$&");
}
async function context(request: Request) {
  const auth = await authenticateRequest(request);
  const db = await getMongoDb();
  await ensureIndexes(db);
  return { ...auth, db };
}

export const GET: APIRoute = async ({ request }) => {
  try {
    const { user, db } = await context(request);
    const params = new URL(request.url).searchParams;
    const pageNum = Number(params.get("page"));
    const sizeNum = Number(params.get("pageSize") || params.get("limit") || 500);
    const page = Number.isInteger(pageNum) && pageNum > 0 ? pageNum : 1;
    const pageSize = Math.min(5000, Math.max(1, Number.isFinite(sizeNum) ? Math.floor(sizeNum) : 500));
    const filter: Document = { userId: user.id };
    const start = params.get("start"), end = params.get("end");
    if (start || end) {
      filter.eaten_at = {};
      if (start && Number.isFinite(Date.parse(start))) filter.eaten_at.$gte = start;
      if (end && Number.isFinite(Date.parse(end))) filter.eaten_at.$lt = end;
    }
    const search = (params.get("search") || "").trim().slice(0, 100);
    if (search) {
      const pattern = new RegExp(escapeRegex(search), "i");
      filter.$or = [{ name: pattern }, { amount: pattern }, { meal_type: pattern }];
    }
    const collection = db.collection("food_entries");
    const total = await collection.countDocuments(filter);
    const entries = await collection.find(filter, { projection: { _id: 0, userId: 0 } })
      .sort({ eaten_at: -1, id: -1 })
      .skip(params.has("page") ? (page - 1) * pageSize : 0).limit(pageSize).toArray();
    const settings = await db.collection("tracker_settings").findOne({ userId: user.id }, { projection: { _id: 0, userId: 0 } });
    const goal = Number(settings?.calorie_goal);
    return json({ entries, total, page, pageSize, goal: Number.isInteger(goal) && goal >= 500 && goal <= 10000 ? goal : DEFAULT_GOAL });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load your diary.";
    return json({ error: message }, /session|sign in|auth/i.test(message) ? 401 : 503);
  }
};
export const POST: APIRoute = async ({ request }) => {
  let body: { entry?: unknown };
  try { body = await request.json() as { entry?: unknown }; } catch { return json({ error: "Invalid food entry." }, 400); }
  if (!validEntry(body.entry)) return json({ error: "The food entry is incomplete or invalid." }, 400);
  try {
    const { user, db } = await context(request);
    await db.collection("food_entries").updateOne({ userId: user.id, id: body.entry.id },
      { $setOnInsert: docFor(body.entry, user.id) }, { upsert: true });
    return json({ saved: true, id: body.entry.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save this food.";
    return json({ error: message }, /session|sign in|auth/i.test(message) ? 401 : 503);
  }
};
export const PATCH: APIRoute = async ({ request }) => {
  let body: { entry?: unknown; goal?: unknown };
  try { body = await request.json() as { entry?: unknown; goal?: unknown }; } catch { return json({ error: "Invalid update." }, 400); }
  try {
    const { user, db } = await context(request);
    if (body.goal !== undefined) {
      const goal = Number(body.goal);
      if (!Number.isInteger(goal) || goal < 500 || goal > 10000) return json({ error: "Choose a daily goal between 500 and 10,000 kcal." }, 400);
      await db.collection("tracker_settings").updateOne({ userId: user.id },
        { $set: { calorie_goal: goal, updated_at: new Date().toISOString() } }, { upsert: true });
      return json({ saved: true, goal });
    }
    if (!validEntry(body.entry)) return json({ error: "The food entry is incomplete or invalid." }, 400);
    const { id, ...fields } = docFor(body.entry, user.id);
    const result = await db.collection("food_entries").updateOne({ userId: user.id, id }, { $set: fields });
    if (!result.matchedCount) return json({ error: "Food entry not found." }, 404);
    return json({ saved: true, id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update your diary.";
    return json({ error: message }, /session|sign in|auth/i.test(message) ? 401 : 503);
  }
};
export const DELETE: APIRoute = async ({ request }) => {
  const id = new URL(request.url).searchParams.get("id")?.trim();
  if (!id || id.length > 100) return json({ error: "Choose a valid food entry." }, 400);
  try {
    const { user, db } = await context(request);
    await db.collection("food_entries").deleteOne({ userId: user.id, id });
    return json({ deleted: true, id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not delete this food.";
    return json({ error: message }, /session|sign in|auth/i.test(message) ? 401 : 503);
  }
};
