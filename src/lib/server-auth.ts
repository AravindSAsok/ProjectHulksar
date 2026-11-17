import { createClient, type User } from "@supabase/supabase-js";

export interface AuthenticatedRequest {
  user: User;
  supabase: ReturnType<typeof createClient>;
}

export async function authenticateRequest(request: Request): Promise<AuthenticatedRequest> {
  const url = process.env.PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.PUBLIC_SUPABASE_ANON_KEY?.trim();
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!url || !anonKey) throw new Error("Supabase Auth is not configured.");
  if (!token) throw new Error("Sign in to continue.");
  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: "Bearer " + token } }
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new Error("Your session expired. Please sign in again.");
  return { user: data.user, supabase };
}
