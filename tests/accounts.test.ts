import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

import { createInMemoryServices, createServices } from "~/composition";

import { accountsContract } from "./contract/accounts.contract";

accountsContract("memory", (options) => createInMemoryServices(options));
accountsContract("sqlite", (options) => createServices(":memory:", options));

describe("agent tokens kept in SQLite", () => {
  it("stores only the hash and the ciphertext, readable again only with the same key", () => {
    const dir = mkdtempSync(join(tmpdir(), "tokens-"));
    const path = join(dir, "app.sqlite");
    try {
      const first = createServices(path, { secretKey: "a".repeat(32) });
      const { token, agent } = first.agentTokens.register("claude");
      first.close();

      const db = new Database(path);
      const row = db.prepare("SELECT token_hash, token_encrypted FROM agent_tokens").get() as Record<string, string>;
      db.close();
      expect(row.token_encrypted).toMatch(/^v1\./);
      expect(JSON.stringify(row)).not.toContain(token.slice(4));

      const same = createServices(path, { secretKey: "a".repeat(32) });
      expect(same.agentTokens.reveal(agent.id)).toBe(token);
      same.close();
      const other = createServices(path, { secretKey: "b".repeat(32) });
      expect(() => other.agentTokens.reveal(agent.id)).toThrow("This token can't be read with the current SECRET_KEY");
      expect(other.agentTokens.authenticate(token)).toBe("claude");
      other.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
