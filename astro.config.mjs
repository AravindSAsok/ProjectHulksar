import { defineConfig } from "astro/config";
import vercel from "@astrojs/vercel";
import node from "@astrojs/node";

// Keep Vercel as the default production adapter. Render opts into the
// standalone Node adapter with HULKSAR_HOST=render. TRACKCAKE_HOST remains
// supported as a legacy deployment-setting alias.
const adapter = (process.env.HULKSAR_HOST === "render" || process.env.TRACKCAKE_HOST === "render")
  ? node({ mode: "standalone" })
  : vercel();

export default defineConfig({
  output: "server",
  adapter,
  server: {
    host: true
  }
});
