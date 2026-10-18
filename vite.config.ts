import { reactRouter } from "@react-router/dev/vite";
import { defineConfig, loadEnv } from "vite";

import { appBasePath } from "./app-base-path";

export default defineConfig(({ mode }) => {
  // Server code reads its settings (DATABASE_PATH, TIME_ZONE, AGENT_TOKEN) from process.env; take them from .env too.
  for (const [key, value] of Object.entries(loadEnv(mode, process.cwd(), ""))) process.env[key] ??= value;
  const base = appBasePath();
  return {
    // Assets are served under the base path too.
    base: base === "/" ? "/" : `${base}/`,
    plugins: [reactRouter()],
    resolve: { tsconfigPaths: true },
  };
});
