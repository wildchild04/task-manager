/**
 * The owner's account and the agents, from the command line, against
 * DATABASE_PATH (default data/app.sqlite). Works while the app is running.
 *
 *   account password        set a new password (creating the account, asking its email, when there's none); ends every session
 *   account agent <name>    register an agent and print its token
 *   account agents          list the registered agents
 *   account revoke <name>   revoke an agent's token
 *
 * From the repo: `npm run account -- <command>`, or `just account <command>`
 * (inside the container when it's running). The production image runs the
 * bundled `build/account.mjs`.
 */
import { createInterface } from "node:readline";
import { Writable } from "node:stream";

import { createServices } from "~/composition";
import { AccountError } from "~/domain/accounts/errors";

/** One reader for every question, so piped answers aren't lost between them; typing is hidden while `muted`. */
let muted = false;
const output = new Writable({
  write(chunk, _encoding, done) {
    if (!muted) process.stdout.write(chunk);
    done();
  },
});
let reader: ReturnType<typeof createInterface> | undefined;
let lines: AsyncIterator<string> | undefined;

/** Asks a question; with `hidden`, without echoing what's typed. */
async function ask(question: string, hidden = false): Promise<string> {
  reader ??= createInterface({ input: process.stdin, output, terminal: Boolean(process.stdin.isTTY) });
  lines ??= reader[Symbol.asyncIterator]();
  process.stdout.write(question);
  muted = hidden;
  const { value, done } = await lines.next();
  muted = false;
  if (hidden) process.stdout.write("\n");
  if (done) throw new AccountError("validation", "No answer given");
  return value;
}

const usage = () => {
  console.error("Usage: account password | agent <name> | agents | revoke <name>");
  process.exit(2);
};

async function main() {
  const [command, name] = process.argv.slice(2);
  if (!command) usage();
  const services = createServices();
  try {
    switch (command) {
      case "password": {
        const existing = services.accounts.account();
        const email = existing ? undefined : await ask("No account yet. Email: ");
        const password = await ask("New password: ", true);
        if (password !== (await ask("Again: ", true))) throw new AccountError("validation", "The passwords don't match");
        const account = services.accounts.setPassword(password, email);
        console.log(existing ? `Password set for ${account.email}; every session was ended.` : `Created the account ${account.email}.`);
        break;
      }
      case "agent": {
        if (!name) usage();
        const { token, agent } = services.agentTokens.register(name!);
        console.log(`Registered ${agent.name}. Its token (shown once), for its MCP profile:\n\nAGENT_TOKEN=${token}`);
        break;
      }
      case "agents": {
        const agents = services.agentTokens.list();
        if (agents.length === 0) console.log("No agents registered.");
        for (const agent of agents) {
          console.log(`${agent.name}\t${agent.prefix}…\tregistered ${agent.createdAt}\t${agent.lastUsedAt ? `last used ${agent.lastUsedAt}` : "never used"}`);
        }
        break;
      }
      case "revoke": {
        if (!name) usage();
        services.agentTokens.revokeByName(name!);
        console.log(`Revoked ${name}'s token.`);
        break;
      }
      default:
        usage();
    }
  } catch (error) {
    if (!(error instanceof AccountError)) throw error;
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    reader?.close();
    services.close();
  }
}

await main();
