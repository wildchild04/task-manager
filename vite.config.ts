import { reactRouter } from "@react-router/dev/vite";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  // Server code reads its settings (DATABASE_PATH, TIME_ZONE, AGENT_TOKEN) from process.env; take them from .env too.
  for (const [key, value] of Object.entries(loadEnv(mode, process.cwd(), ""))) process.env[key] ??= value;
  return {
    plugins: [reactRouter()],
    resolve: { tsconfigPaths: true },
  };
});
