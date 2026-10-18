import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { type AgentCall, createAgentServer } from "./tools";

/**
 * The MCP server agents launch (stdio). It calls the app's agent API at
 * APP_URL with AGENT_TOKEN, as AGENT_NAME.
 */
const missing = ["APP_URL", "AGENT_TOKEN", "AGENT_NAME"].filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error(`Missing ${missing.join(", ")}: set them in the MCP server's environment.`);
  process.exit(1);
}
const base = process.env.APP_URL!.replace(/\/$/, "");
const headers = { authorization: `Bearer ${process.env.AGENT_TOKEN}`, "x-agent-name": process.env.AGENT_NAME! };

const call: AgentCall = async (method, path, input) => {
  const url = new URL(`${base}/api/agent/${path}`);
  if (method === "GET") for (const [key, value] of Object.entries(input ?? {})) url.searchParams.set(key, String(value));
  try {
    const response = await fetch(url, {
      method,
      headers: method === "POST" ? { ...headers, "content-type": "application/json" } : headers,
      ...(method === "POST" ? { body: JSON.stringify(input ?? {}) } : {}),
    });
    return { status: response.status, body: await response.json().catch(() => null) };
  } catch (error) {
    return { status: 503, body: { error: { code: "unreachable", message: `Can't reach the app at ${base}: ${String(error)}` } } };
  }
};

await createAgentServer(call).connect(new StdioServerTransport());
