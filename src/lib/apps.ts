export const HULKSAR_APPS = [
  { id: "hulksar", name: "Hulksar", description: "Nutrition, daily tasks, progress and Hulkie", href: "/", icon: "✦" },
  { id: "messculator", name: "messCulator", description: "Budgets, expenses, borrowing and shared splits", href: "/messculator", icon: "₹" }
] as const;
export type HulksarAppId = (typeof HULKSAR_APPS)[number]["id"];
export type HulksarAppPreferences = { defaultApp: HulksarAppId; order: HulksarAppId[] };
export const DEFAULT_APP_PREFERENCES: HulksarAppPreferences = { defaultApp: "hulksar", order: HULKSAR_APPS.map(app => app.id) };
export function normalizeAppPreferences(value: unknown): HulksarAppPreferences {
  if (!value || typeof value !== "object") return DEFAULT_APP_PREFERENCES;
  const input = value as { defaultApp?: unknown; order?: unknown };
  const ids = HULKSAR_APPS.map(app => app.id) as string[];
  const order = Array.isArray(input.order) ? input.order.filter((id): id is HulksarAppId => typeof id === "string" && ids.includes(id)) : [];
  for (const id of ids) if (!order.includes(id as HulksarAppId)) order.push(id as HulksarAppId);
  const defaultApp = typeof input.defaultApp === "string" && ids.includes(input.defaultApp) ? input.defaultApp as HulksarAppId : "hulksar";
  return { defaultApp, order };
}
