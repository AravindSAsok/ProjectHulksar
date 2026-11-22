import type { APIRoute } from "astro";
import type { Document } from "mongodb";
import { authenticateRequest } from "../../lib/server-auth";
import { getMongoClient, getMongoDb } from "../../lib/mongodb";

export const prerender = false;
export const maxDuration = 30;

type Person = { id: string; name: string };
type Allocation = { personId: string; name: string; amount: number };
type Expense = { id: string; name: string; amount: number; allocations: Allocation[]; createdAt: string; periodId?: string };
type Borrowing = { id: string; amount: number; createdAt: string; lender?: string; periodId?: string };
type MonthlyBudgets = Record<string, number>;
type CalculationPeriod = { id: string; name: string; startDate: string; endDate: string; budget: number; legacyMonth?: string };
type MessculatorState = { budget: number; monthlyBudgets?: MonthlyBudgets; periods?: CalculationPeriod[]; borrowed: number; legacyBorrowed: number; borrowings: Borrowing[]; people: Person[]; expenses: Expense[] };

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
function validMonthKey(value: string): boolean { return value.length === 7 && value[4] === "-" && Number.isInteger(Number(value.slice(0, 4))) && Number(value.slice(5)) >= 1 && Number(value.slice(5)) <= 12; }
function validDate(value: unknown): value is string {
  return typeof value === "string" && value.length <= 40 && Number.isFinite(Date.parse(value));
}
function parseState(value: unknown): MessculatorState | null {
  if (!isRecord(value) || !validPaise(value.budget) || !validPaise(value.borrowed) ||
      !Array.isArray(value.people) || value.people.length > 100 ||
      (value.monthlyBudgets !== undefined && (!isRecord(value.monthlyBudgets) || Object.entries(value.monthlyBudgets).length > 120 || Object.entries(value.monthlyBudgets).some(([month, amount]) => !validMonthKey(month) || !validPaise(amount)))) ||
      (value.periods !== undefined && (!Array.isArray(value.periods) || value.periods.length > 500 || value.periods.some(period => !isRecord(period) || !validId(period.id) || typeof period.name !== "string" || period.name.length > 60 || typeof period.startDate !== "string" || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(period.startDate) || (period.endDate !== "" && (typeof period.endDate !== "string" || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(period.endDate) || period.endDate < period.startDate)) || !validPaise(period.budget)))) ||
      !Array.isArray(value.expenses) || value.expenses.length > 5000 ||
      (value.borrowings !== undefined && (!Array.isArray(value.borrowings) || value.borrowings.length > 5000)) ||
      (value.legacyBorrowed !== undefined && !validPaise(value.legacyBorrowed))) return null;

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
    expenses.push({ id: item.id, name: item.name.trim(), amount: item.amount, allocations, createdAt: item.createdAt, ...(validId(item.periodId) ? { periodId: item.periodId } : {}) });
  }

  const borrowings: Borrowing[] = [];
  const borrowingIds = new Set<string>();
  for (const item of (Array.isArray(value.borrowings) ? value.borrowings : [])) {
    if (!isRecord(item) || !validId(item.id) || borrowingIds.has(item.id) || !validPaise(item.amount, false) || !validDate(item.createdAt) || (item.lender !== undefined && (typeof item.lender !== "string" || item.lender.trim().length > 80))) return null;
    borrowingIds.add(item.id); borrowings.push({ id: item.id, amount: item.amount, createdAt: item.createdAt, ...(typeof item.lender === "string" && item.lender.trim() ? { lender: item.lender.trim() } : {}), ...(validId(item.periodId) ? { periodId: item.periodId } : {}) });
  }
  const legacyBorrowed = value.legacyBorrowed === undefined ? (value.borrowings === undefined ? value.borrowed : 0) : value.legacyBorrowed;
  const borrowingTotal = borrowings.reduce((sum, item) => sum + item.amount, legacyBorrowed);
  if (!Number.isSafeInteger(borrowingTotal) || borrowingTotal !== value.borrowed) return null;
  return { budget: value.budget, monthlyBudgets: (value.monthlyBudgets as MonthlyBudgets | undefined) || {}, periods: (Array.isArray(value.periods) ? value.periods : []) as CalculationPeriod[], borrowed: value.borrowed, legacyBorrowed, borrowings, people, expenses };
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
    const legacyBorrowed = borrowings.filter(row => row.id === "total" || row.id === "legacy-total").reduce((sum, row) => sum + (Number(row.amountPaise) || 0), 0);
    const borrowingHistory = borrowings.filter(row => row.id !== "total" && row.id !== "legacy-total").map(row => ({ id: String(row.id), amount: Number(row.amountPaise) || 0, createdAt: String(row.createdAt || row.updatedAt || "") })).filter(row => validDate(row.createdAt));
    const state: MessculatorState = {
      budget: Number(budget?.budgetPaise) || 0,
      monthlyBudgets: isRecord(budget?.monthlyBudgets) ? Object.fromEntries(Object.entries(budget.monthlyBudgets).filter(([month, amount]) => validMonthKey(month) && validPaise(amount))) as MonthlyBudgets : {},
      periods: Array.isArray(budget?.periods) ? budget.periods as CalculationPeriod[] : [],
      borrowed: borrowings.reduce((sum, row) => sum + (Number(row.amountPaise) || 0), 0),
      legacyBorrowed,
      borrowings: borrowingHistory.map(row => ({ ...row, ...(typeof borrowings.find(item => String(item.id) === row.id)?.lender === "string" ? { lender: String(borrowings.find(item => String(item.id) === row.id)?.lender).slice(0, 80) } : {}), ...(typeof borrowings.find(item => String(item.id) === row.id)?.periodId === "string" ? { periodId: String(borrowings.find(item => String(item.id) === row.id)?.periodId) } : {}) })),
      people: people.map(row => ({ id: String(row.id), name: String(row.name) })),
      expenses: expenses.map(row => ({
        id: String(row.id), name: String(row.name || ""), amount: Number(row.amountPaise) || 0,
        createdAt: String(row.createdAt), ...(typeof row.periodId === "string" ? { periodId: row.periodId } : {}), allocations: splitMap.get(String(row.id)) || []
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
    const isEmpty = state.budget === 0 && Object.values(state.monthlyBudgets || {}).every(value => value === 0) && (state.periods || []).length === 0 && state.borrowed === 0 && state.people.length === 0 && state.expenses.length === 0;
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
          { $set: { budgetPaise: state.budget, monthlyBudgets: state.monthlyBudgets || {}, periods: state.periods || [], updatedAt: now }, $setOnInsert: { userId, createdAt: now } },
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
            userId, id: expense.id, name: expense.name, amountPaise: expense.amount, createdAt: expense.createdAt, ...(expense.periodId ? { periodId: expense.periodId } : {})
          })), { session });
          const splitRows: Document[] = state.expenses.flatMap(expense => expense.allocations.map(allocation => ({
            userId, expenseId: expense.id, personId: allocation.personId,
            name: allocation.name, amountPaise: allocation.amount
          })));
          if (splitRows.length) await splits.insertMany(splitRows, { session });
        }
        if (state.legacyBorrowed > 0) {
          await borrowings.insertOne({ userId, id: "legacy-total", amountPaise: state.legacyBorrowed, updatedAt: now }, { session });
        }
        if (state.borrowings.length) {
          await borrowings.insertMany(state.borrowings.map(item => ({ userId, id: item.id, amountPaise: item.amount, createdAt: item.createdAt, ...(item.lender ? { lender: item.lender } : {}), ...(item.periodId ? { periodId: item.periodId } : {}) })), { session });
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
