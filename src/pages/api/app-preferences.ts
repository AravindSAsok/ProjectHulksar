import type { APIRoute } from "astro";
import { authenticateRequest } from "../../lib/server-auth";
import { getMongoDb } from "../../lib/mongodb";
import { normalizeAppPreferences } from "../../lib/apps";
export const prerender = false;
const COLLECTION = "hulksar_app_preferences";
const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
let indexReady: Promise<void> | undefined;
async function ensureIndex() {
  indexReady ??= getMongoDb().then(db => db.collection(COLLECTION).createIndex({ userId: 1 }, { unique: true, name: "hulksar_app_preferences_user_unique" })).then(() => undefined).catch(error => { indexReady = undefined; throw error; });
  await indexReady;
}
export const GET: APIRoute = async ({ request }) => {
  try {
    const { user } = await authenticateRequest(request); await ensureIndex();
    const db = await getMongoDb();
    const row = await db.collection(COLLECTION).findOne({ userId: user.id }, { projection: { _id: 0, userId: 0 } });
    return json({ preferences: normalizeAppPreferences(row || null) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load app preferences.";
    return json({ error: message }, /session|sign in|auth/i.test(message) ? 401 : 503);
  }
};
export const PUT: APIRoute = async ({ request }) => {
  let body: unknown; try { body = await request.json(); } catch { return json({ error: "Send valid app preferences." }, 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "Send valid app preferences." }, 400);
  const preferences = normalizeAppPreferences(body);
  try {
    const { user } = await authenticateRequest(request); await ensureIndex();
    const db = await getMongoDb(); const now = new Date().toISOString();
    await db.collection(COLLECTION).updateOne({ userId: user.id }, { $set: { ...preferences, updatedAt: now }, $setOnInsert: { userId: user.id, createdAt: now } }, { upsert: true });
    return json({ saved: true, preferences });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save app preferences.";
    return json({ error: message }, /session|sign in|auth/i.test(message) ? 401 : 503);
  }
};
