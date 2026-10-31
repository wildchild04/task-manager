import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

import { request } from "@playwright/test";

import { AGENTS_FILE, BASE_URL, DATABASE_PATH, OWNER, STORAGE_STATE } from "./accounts";

/**
 * Runs once, after the web server started on a fresh database: creates the
 * owner's account through `/setup` (as a first visit would), saves the
 * signed-in browser state every test starts from, and registers the agents
 * the tests call the agent API as, through the command line.
 */
export default async function globalSetup() {
  const context = await request.newContext({ baseURL: BASE_URL });
  const response = await context.post("/setup", { form: { email: OWNER.email, password: OWNER.password, confirm: OWNER.password } });
  if (!response.ok()) throw new Error(`Creating the account failed: ${response.status()} ${await response.text()}`);
  await context.storageState({ path: STORAGE_STATE });
  await context.dispose();

  const tokens: Record<string, string> = {};
  for (const name of ["builder", "playwright"]) {
    const output = execFileSync("npx", ["tsx", "scripts/account.ts", "agent", name], {
      env: { ...process.env, DATABASE_PATH, SECRET_KEY: "playwright-secret-key-of-32-characters" },
      encoding: "utf8",
    });
    tokens[name] = /AGENT_TOKEN=(\S+)/.exec(output)![1]!;
  }
  writeFileSync(AGENTS_FILE, JSON.stringify(tokens));
}
