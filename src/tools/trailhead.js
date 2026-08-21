import { z } from "zod";
import { failure, success } from "../lib/respond.js";

const TRAILHEAD_MCP_ENDPOINT = "https://mcp.trailhead.salesforce.com/mcp";

const TrailheadListToolsSchema = {};

const TrailheadSearchContentSchema = {
  query: z.string().min(1),
  first: z.number().int().min(1).max(12).optional(),
  role: z.string().optional(),
  roles: z.array(z.string().min(1)).max(20).optional(),
  level: z.string().optional(),
  levels: z.array(z.string().min(1)).max(20).optional(),
  types: z.array(z.string().min(1)).max(20).optional(),
  locale: z.string().optional(),
};

const TrailheadFetchContentSchema = {
  apiName: z.string().min(1),
  expand: z.boolean().optional(),
};

function normalizeSearchArguments(input) {
  const args = {
    query: input.query.trim(),
  };

  if (input.first !== undefined) {
    args.first = input.first;
  }

  if (Array.isArray(input.roles) && input.roles.length > 0) {
    args.roles = input.roles;
  } else if (input.role?.trim()) {
    args.roles = [input.role.trim()];
  }

  if (Array.isArray(input.levels) && input.levels.length > 0) {
    args.levels = input.levels;
  } else if (input.level?.trim()) {
    args.levels = [input.level.trim()];
  }

  if (Array.isArray(input.types) && input.types.length > 0) {
    args.types = input.types;
  }

  if (input.locale?.trim()) {
    args.locale = input.locale.trim();
  }

  return args;
}

async function callTrailheadRpc(method, params) {
  const response = await fetch(TRAILHEAD_MCP_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method,
      params,
      id: 1,
    }),
  });

  const responseText = await response.text();
  let payload;
  try {
    payload = JSON.parse(responseText);
  } catch {
    throw new Error(`Trailhead MCP returned non-JSON response (status ${response.status}).`);
  }

  if (!response.ok) {
    throw new Error(
      `Trailhead MCP HTTP error (${response.status}): ${payload?.error?.message ?? responseText}`
    );
  }

  if (payload?.error) {
    throw new Error(`Trailhead MCP RPC error: ${payload.error.message}`);
  }

  return payload.result ?? {};
}

export function registerTrailheadTools(server) {
  server.tool(
    "sf_trailhead_list_tools",
    "List available tools and schemas from the public Trailhead MCP server.",
    TrailheadListToolsSchema,
    async () => {
      try {
        const result = await callTrailheadRpc("tools/list", {});
        const tools = Array.isArray(result.tools) ? result.tools : [];
        return success({
          endpoint: TRAILHEAD_MCP_ENDPOINT,
          toolCount: tools.length,
          tools,
        });
      } catch (error) {
        return failure(error.message);
      }
    }
  );

  server.tool(
    "sf_trailhead_search_content",
    "Search Trailhead learning catalog content (modules, projects, trails, badges).",
    TrailheadSearchContentSchema,
    async (input) => {
      try {
        const argumentsPayload = normalizeSearchArguments(input);
        const result = await callTrailheadRpc("tools/call", {
          name: "content_search",
          arguments: argumentsPayload,
        });

        const structuredContent = result?.structuredContent ?? {};
        const results = Array.isArray(structuredContent.results)
          ? structuredContent.results
          : [];

        return success({
          endpoint: TRAILHEAD_MCP_ENDPOINT,
          arguments: argumentsPayload,
          totalMatches: results.length,
          results,
          content: result?.content ?? [],
          structuredContent,
        });
      } catch (error) {
        return failure(error.message);
      }
    }
  );

  server.tool(
    "sf_trailhead_fetch_content",
    "Fetch detailed Trailhead content by apiName, including markdown when available.",
    TrailheadFetchContentSchema,
    async (input) => {
      try {
        const argumentsPayload = {
          apiName: input.apiName.trim(),
        };
        if (input.expand === true) {
          argumentsPayload.expand = true;
        }

        const result = await callTrailheadRpc("tools/call", {
          name: "fetch_content",
          arguments: argumentsPayload,
        });
        const structuredContent = result?.structuredContent ?? {};

        return success({
          endpoint: TRAILHEAD_MCP_ENDPOINT,
          arguments: argumentsPayload,
          hasMarkdown: Boolean(structuredContent.markdown),
          structuredContent,
          content: result?.content ?? [],
        });
      } catch (error) {
        return failure(error.message);
      }
    }
  );
}
