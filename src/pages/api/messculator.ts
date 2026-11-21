import type { APIRoute } from "astro";
import type { Document } from "mongodb";
import { authenticateRequest } from "../../lib/server-auth";
import { getMongoClient, getMongoDb } from "../../lib/mongodb";

export const prerender = false;
export const maxDuration = 30;

type Person = { id: string; name: string };
type Allocation = { personId: string; name: string; amount: number };
type Expense = { id: string; name: string; amount: number; allocations: Allocation[]; createdAt: string };
type MessculatorState = { budget: number; borrowed: number; people: Person[]; expenses: Expense[] };

const COLLECTIONS = {
  budgets: "messculator_budgets",
  people: "messculator_people",
  expenses: "messculator_expenses",
  borrowings: "messculator_borrowings",
  splits: "messculator_expense_splits"
} as const;

const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
});

let indexesReady: Promise<void> | undefined;
async function ensureIndexes() {
  indexesReady ??= (async () => {
    const db = await getMongoDb();
    await Promise.all([
      db.collection(COLLECTIONS.budgets).createIndex({ userId: 1 }, { unique: true, name: "messculator_budget_user_unique" }),
      db.collection(COLLECTIONS.people).createIndex({ userId: 1, id: 1 }, { unique: true, name: "messculator_person_user_id_unique" }),
      db.collection(COLLECTIONS.expenses).createIndex({ userId: 1, id: 1 }, { unique: true, name: "messculator_expense_user_id_unique" }),
      db.collection(COLLECTIONS.expenses).createIndex({ userId: 1, createdAt: -1 }, { name: "messculator_expense_history" }),
      db.collection(COLLECTIONS.borrowings).createIndex({ userId: 1, id: 1 }, { unique: true, name: "messculator_borrowing_user_id_unique" }),
      db.collection(COLLECTIONS.splits).createIndex({ userId: 1, expenseId: 1, personId: 1 }, { unique: true, name: "messculator_split_expense_person_unique" }),
      db.collection(COLLECTIONS.splits).createIndex({ userId: 1, personId: 1 }, { name: "messculator_person_splits" })
    ]);
  })().catch(error => {
    indexesReady = undefined;
    throw error;
  });
  await indexesReady;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function validId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 100;
}
function validPaise(value: unknown, allowZero = true): value is number {
  return Number.isSafeInteger(value) && Number(value) >= (allowZero ? 0 : 1) && Number(value) <= 1_000_000_000_000;
}
function validDate(value: unknown): value is string {
  return typeof value === "string" && value.length <= 40 && Number.isFinite(Date.parse(value));
}
function parseState(value: unknown): MessculatorState | null {
  if (!isRecord(value) || !validPaise(value.budget) || !validPaise(value.borrowed) ||
      !Array.isArray(value.people) || value.people.length > 100 ||
      !Array.isArray(value.expenses) || value.expenses.length > 5000) return null;

  const people: Person[] = [];
  const personIds = new Set<string>();
  for (const item of value.people) {
    if (!isRecord(item) || !validId(item.id) || typeof item.name !== "string" ||
        !item.name.trim() || item.name.trim().length > 40 || personIds.has(item.id)) return null;
    personIds.add(item.id);
    people.push({ id: item.id, name: item.name.trim() });
  }

  const expenses: Expense[] = [];
  const expenseIds = new Set<string>();
  let splitCount = 0;
  for (const item of value.expenses) {
    if (!isRecord(item) || !validId(item.id) || expenseIds.has(item.id) ||
        !validPaise(item.amount, false) || typeof item.name !== "string" ||
        item.name.length > 80 || !validDate(item.createdAt) ||
        !Array.isArray(item.allocations) || item.allocations.length < 1 || item.allocations.length > 100) return null;
    expenseIds.add(item.id);
    const allocationIds = new Set<string>();
    const allocations: Allocation[] = [];
    let allocated = 0;
    for (const part of item.allocations) {
      if (!isRecord(part) || !validId(part.personId) || typeof part.name !== "string" ||
          !part.name.trim() || part.name.trim().length > 40 || !validPaise(part.amount) ||
          allocationIds.has(part.personId)) return null;
      allocationIds.add(part.personId);
      allocated += part.amount;
      if (!Number.isSafeInteger(allocated)) return null;
      allocations.push({ personId: part.personId, name: part.name.trim(), amount: part.amount });
    }
    if (allocated !== item.amount) return null;
    splitCount += allocations.length;
    if (splitCount > 100_000) return null;
    expenses.push({ id: item.id, name: item.name.trim(), amount: item.amount, allocations, createdAt: item.createdAt });
  }

  return { budget: value.budget, borrowed: value.borrowed, people, expenses };
}

export const GET: APIRoute = async ({ request }) => {
  try {
    const { user } = await authenticateRequest(request);
    await ensureIndexes();
    const db = await getMongoDb();
    const userId = user.id;
    const [budget, people, expenses, borrowings, splits] = await Promise.all([
      db.collection(COLLECTIONS.budgets).findOne({ userId }, { projection: { _id: 0, userId: 0 } }),
      db.collection(COLLECTIONS.people).find({ userId }, { projection: { _id: 0, userId: 0 } }).sort({ createdAt: 1 }).toArray(),
      db.collection(COLLECTIONS.expenses).find({ userId }, { projection: { _id: 0, userId: 0 } }).sort({ createdAt: 1, id: 1 }).toArray(),
      db.collection(COLLECTIONS.borrowings).find({ userId }, { projection: { _id: 0, userId: 0 } }).toArray(),
      db.collection(COLLECTIONS.splits).find({ userId }, { projection: { _id: 0, userId: 0 } }).toArray()
    ]);
    const splitMap = new Map<string, Allocation[]>();
    for (const row of splits) {
      const allocations = splitMap.get(String(row.expenseId)) || [];
      allocations.push({ personId: String(row.personId), name: String(row.name), amount: Number(row.amountPaise) || 0 });
      splitMap.set(String(row.expenseId), allocations);
    }
    const state: MessculatorState = {
      budget: Number(budget?.budgetPaise) || 0,
      borrowed: borrowings.reduce((sum, row) => sum + (Number(row.amountPaise) || 0), 0),
      people: people.map(row => ({ id: String(row.id), name: String(row.name) })),
      expenses: expenses.map(row => ({
        id: String(row.id), name: String(row.name || ""), amount: Number(row.amountPaise) || 0,
        createdAt: String(row.createdAt), allocations: splitMap.get(String(row.id)) || []
      }))
    };
    const exists = Boolean(budget || people.length || expenses.length || borrowings.length);
    return json({ exists, state });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load messCulator data.";
    return json({ error: message }, /session|sign in|auth/i.test(message) ? 401 : 503);
  }
};

export const PUT: APIRoute = async ({ request }) => {
  let body: unknown;
  try { body = await request.json(); }
  catch { return json({ error: "Send a valid messCulator budget." }, 400); }
  const state = parseState(body);
  if (!state) return json({ error: "The budget data is invalid. Check expense amounts and individual splits." }, 400);

  try {
    const { user } = await authenticateRequest(request);
    await ensureIndexes();
    const db = await getMongoDb();
    const client = await getMongoClient();
    const userId = user.id;
    const now = new Date().toISOString();
    const isEmpty = state.budget === 0 && state.borrowed === 0 && state.people.length === 0 && state.expenses.length === 0;
    const session = client.startSession();
    try {
      await session.withTransaction(async () => {
        const budgets = db.collection(COLLECTIONS.budgets);
        const people = db.collection(COLLECTIONS.people);
        const expenses = db.collection(COLLECTIONS.expenses);
        const borrowings = db.collection(COLLECTIONS.borrowings);
        const splits = db.collection(COLLECTIONS.splits);

        if (isEmpty) {
          await budgets.deleteOne({ userId }, { session });
          await people.deleteMany({ userId }, { session });
          await expenses.deleteMany({ userId }, { session });
          await borrowings.deleteMany({ userId }, { session });
          await splits.deleteMany({ userId }, { session });
          return;
        }

        await budgets.updateOne(
          { userId },
          { $set: { budgetPaise: state.budget, updatedAt: now }, $setOnInsert: { userId, createdAt: now } },
          { upsert: true, session }
        );

        await people.deleteMany({ userId }, { session });
        await expenses.deleteMany({ userId }, { session });
        await borrowings.deleteMany({ userId }, { session });
        await splits.deleteMany({ userId }, { session });

        if (state.people.length) {
          await people.insertMany(state.people.map(person => ({ ...person, userId, createdAt: now })), { session });
        }
        if (state.expenses.length) {
          await expenses.insertMany(state.expenses.map(expense => ({
            userId, id: expense.id, name: expense.name, amountPaise: expense.amount, createdAt: expense.createdAt
          })), { session });
          const splitRows: Document[] = state.expenses.flatMap(expense => expense.allocations.map(allocation => ({
            userId, expenseId: expense.id, personId: allocation.personId,
            name: allocation.name, amountPaise: allocation.amount
          })));
          if (splitRows.length) await splits.insertMany(splitRows, { session });
        }
        if (state.borrowed > 0) {
          await borrowings.insertOne({ userId, id: "total", amountPaise: state.borrowed, updatedAt: now }, { session });
        }
      });
    } finally {
      await session.endSession();
    }
    return json({ saved: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save messCulator data.";
    return json({ error: message }, /session|sign in|auth/i.test(message) ? 401 : 503);
  }
};
