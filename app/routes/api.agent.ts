import { handleAgentRequest } from "../lib/agent/request.server";
import { services } from "../lib/services.server";
import type { Route } from "./+types/api.agent";

/** The agent API: `GET`/`POST /api/agent/<function>`, for the MCP server and other agent clients. */
export function loader({ request, params }: Route.LoaderArgs) {
  return handleAgentRequest(services, request, params["*"] ?? "", process.env.AGENT_TOKEN);
}

export function action({ request, params }: Route.ActionArgs) {
  return handleAgentRequest(services, request, params["*"] ?? "", process.env.AGENT_TOKEN);
}
