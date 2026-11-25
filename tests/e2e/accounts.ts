import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));

const testDirectory = process.env.E2E_TEST_DIR ?? `${root}tests/.tmp`;
export const BASE_URL = `http://127.0.0.1:${process.env.E2E_PORT ?? "57321"}`;
export const DATABASE_PATH = `${testDirectory}/playwright.sqlite`;
/** The signed-in browser state every test starts from. */
export const STORAGE_STATE = `${testDirectory}/storage-state.json`;
/** The registered agents' tokens, by name. */
export const AGENTS_FILE = `${testDirectory}/agents.json`;
export const OWNER = { email: "owner@example.com", password: "correct horse battery" };

/** The `Authorization` header of a registered test agent ("builder" or "playwright"). */
export function agentHeaders(name = "builder"): Record<string, string> {
  const tokens = JSON.parse(readFileSync(AGENTS_FILE, "utf8")) as Record<string, string>;
  return { authorization: `Bearer ${tokens[name]}` };
}
