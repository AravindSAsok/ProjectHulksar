import type { APIRoute } from "astro";
import { authenticateRequest } from "../../../lib/server-auth";

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  try {
    const { user } = await authenticateRequest(request);
    return new Response(JSON.stringify({ user }), {
      status: 200, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
    });
  } catch {
    return new Response(JSON.stringify({ user: null }), {
      status: 200, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
    });
  }
};
