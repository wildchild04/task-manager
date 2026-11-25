import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Ask the OS for an available port, then let Playwright start its own server.
const server = createServer();
await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});
const port = server.address().port;
await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));

const directory = await mkdtemp(join(tmpdir(), "notion-task-manager-e2e-"));
const child = spawn(process.execPath, ["node_modules/@playwright/test/cli.js", "test", ...process.argv.slice(2)], {
  stdio: "inherit",
  env: { ...process.env, E2E_PORT: String(port), E2E_TEST_DIR: directory },
});
let interrupted;
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => {
  interrupted ??= signal;
  child.kill(signal);
});
const status = await new Promise((resolve, reject) => {
  child.once("error", reject);
  child.once("close", (code, signal) => resolve(code ?? (signal ? 1 : 0)));
}).finally(() => rm(directory, { recursive: true, force: true }));
process.exitCode = interrupted === "SIGINT" ? 130 : interrupted === "SIGTERM" ? 143 : status;
