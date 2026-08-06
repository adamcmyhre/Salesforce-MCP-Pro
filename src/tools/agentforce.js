import { z } from "zod";
import {
  assertOrgAccess,
  assertWritable,
  isReadOnly,
} from "../config/permissions.js";
import { assertMutationAllowed } from "../config/safety.js";
import { failure, success } from "../lib/respond.js";
import { execSfJson } from "../sf/execSf.js";
import { resolveTargetOrg } from "../sf/resolveOrg.js";

const AgentCreateSchema = {
  name: z.string().min(1),
  specPath: z.string().min(1),
  apiName: z.string().optional(),
  preview: z.boolean().optional(),
  targetOrg: z.string().optional(),
  directory: z.string().optional(),
  apiVersion: z.string().optional(),
  confirm: z.boolean().optional(),
};

const AgentActivateSchema = {
  apiName: z.string().min(1),
  version: z.number().int().min(1).optional(),
  targetOrg: z.string().optional(),
  directory: z.string().optional(),
  apiVersion: z.string().optional(),
  confirm: z.boolean().optional(),
};

const AgentDeactivateSchema = {
  apiName: z.string().min(1),
  targetOrg: z.string().optional(),
  directory: z.string().optional(),
  apiVersion: z.string().optional(),
  confirm: z.boolean().optional(),
};

const AgentPreviewStartSchema = {
  apiName: z.string().optional(),
  authoringBundle: z.string().optional(),
  useLiveActions: z.boolean().optional(),
  simulateActions: z.boolean().optional(),
  contextVariables: z.array(z.string().min(1)).optional(),
  targetOrg: z.string().optional(),
  directory: z.string().optional(),
  apiVersion: z.string().optional(),
  confirm: z.boolean().optional(),
};

const AgentPreviewSendSchema = {
  utterance: z.string().min(1),
  sessionId: z.string().optional(),
  apiName: z.string().optional(),
  authoringBundle: z.string().optional(),
  targetOrg: z.string().optional(),
  directory: z.string().optional(),
  apiVersion: z.string().optional(),
  confirm: z.boolean().optional(),
};

const AgentPreviewEndSchema = {
  sessionId: z.string().optional(),
  endAll: z.boolean().optional(),
  apiName: z.string().optional(),
  authoringBundle: z.string().optional(),
  noPrompt: z.boolean().optional(),
  targetOrg: z.string().optional(),
  directory: z.string().optional(),
  apiVersion: z.string().optional(),
};

const AgentPreviewSessionsSchema = {
  directory: z.string().optional(),
};

function appendApiVersion(args, apiVersion) {
  if (apiVersion) {
    args.push("--api-version", apiVersion);
  }
}

function appendAgentSelector(args, input) {
  if (input.apiName) {
    args.push("--api-name", input.apiName);
  }
  if (input.authoringBundle) {
    args.push("--authoring-bundle", input.authoringBundle);
  }
}

function validateAgentSelector(apiName, authoringBundle) {
  if (!apiName && !authoringBundle) {
    throw new Error("Provide apiName or authoringBundle.");
  }
  if (apiName && authoringBundle) {
    throw new Error("Provide only one of apiName or authoringBundle.");
  }
}

function validateModeFlags(useLiveActions, simulateActions) {
  if (useLiveActions && simulateActions) {
    throw new Error("useLiveActions and simulateActions are mutually exclusive.");
  }
}

async function resolveAgentTargetOrg(input) {
  const resolvedTargetOrg = await resolveTargetOrg(input.targetOrg, {
    cwd: input.directory,
  });
  assertOrgAccess(resolvedTargetOrg);
  return resolvedTargetOrg;
}

export function registerAgentforceTools(server) {
  server.tool(
    "sf_agent_create",
    "Create an Agentforce agent from a local agent spec file.",
    AgentCreateSchema,
    async (input) => {
      try {
        if (isReadOnly()) {
          assertWritable("sf_agent_create");
        }

        const resolvedTargetOrg = await resolveAgentTargetOrg(input);
        assertMutationAllowed({
          toolName: "sf_agent_create",
          targetOrg: resolvedTargetOrg,
          confirm: input.confirm,
        });

        const args = [
          "agent",
          "create",
          "--target-org",
          resolvedTargetOrg,
          "--name",
          input.name,
          "--spec",
          input.specPath,
        ];

        if (input.apiName) {
          args.push("--api-name", input.apiName);
        }
        if (input.preview) {
          args.push("--preview");
        }
        appendApiVersion(args, input.apiVersion);

        const result = await execSfJson(args, { cwd: input.directory });
        return success({
          targetOrg: resolvedTargetOrg,
          result,
        });
      } catch (error) {
        return failure(error.message, error.context ?? null);
      }
    }
  );

  server.tool(
    "sf_agent_activate",
    "Activate an Agentforce agent by API name and optional version.",
    AgentActivateSchema,
    async (input) => {
      try {
        if (isReadOnly()) {
          assertWritable("sf_agent_activate");
        }

        const resolvedTargetOrg = await resolveAgentTargetOrg(input);
        assertMutationAllowed({
          toolName: "sf_agent_activate",
          targetOrg: resolvedTargetOrg,
          confirm: input.confirm,
        });

        const args = [
          "agent",
          "activate",
          "--target-org",
          resolvedTargetOrg,
          "--api-name",
          input.apiName,
        ];
        if (input.version !== undefined) {
          args.push("--version", String(input.version));
        }
        appendApiVersion(args, input.apiVersion);

        const result = await execSfJson(args, { cwd: input.directory });
        return success({
          targetOrg: resolvedTargetOrg,
          apiName: input.apiName,
          version: input.version ?? null,
          result,
        });
      } catch (error) {
        return failure(error.message, error.context ?? null);
      }
    }
  );

  server.tool(
    "sf_agent_deactivate",
    "Deactivate an Agentforce agent by API name.",
    AgentDeactivateSchema,
    async (input) => {
      try {
        if (isReadOnly()) {
          assertWritable("sf_agent_deactivate");
        }

        const resolvedTargetOrg = await resolveAgentTargetOrg(input);
        assertMutationAllowed({
          toolName: "sf_agent_deactivate",
          targetOrg: resolvedTargetOrg,
          confirm: input.confirm,
        });

        const args = [
          "agent",
          "deactivate",
          "--target-org",
          resolvedTargetOrg,
          "--api-name",
          input.apiName,
        ];
        appendApiVersion(args, input.apiVersion);

        const result = await execSfJson(args, { cwd: input.directory });
        return success({
          targetOrg: resolvedTargetOrg,
          apiName: input.apiName,
          result,
        });
      } catch (error) {
        return failure(error.message, error.context ?? null);
      }
    }
  );

  server.tool(
    "sf_agent_preview_start",
    "Start a programmatic Agentforce preview session.",
    AgentPreviewStartSchema,
    async (input) => {
      try {
        if (isReadOnly()) {
          assertWritable("sf_agent_preview_start");
        }

        validateAgentSelector(input.apiName, input.authoringBundle);
        validateModeFlags(input.useLiveActions, input.simulateActions);

        const resolvedTargetOrg = await resolveAgentTargetOrg(input);
        assertMutationAllowed({
          toolName: "sf_agent_preview_start",
          targetOrg: resolvedTargetOrg,
          confirm: input.confirm,
        });

        const args = ["agent", "preview", "start", "--target-org", resolvedTargetOrg];
        appendAgentSelector(args, input);
        appendApiVersion(args, input.apiVersion);

        if (input.useLiveActions) {
          args.push("--use-live-actions");
        }
        if (input.simulateActions) {
          args.push("--simulate-actions");
        }
        for (const value of input.contextVariables ?? []) {
          args.push("--context-variables", value);
        }

        const result = await execSfJson(args, { cwd: input.directory });
        return success({
          targetOrg: resolvedTargetOrg,
          result,
        });
      } catch (error) {
        return failure(error.message, error.context ?? null);
      }
    }
  );

  server.tool(
    "sf_agent_preview_send",
    "Send an utterance to an existing Agentforce preview session.",
    AgentPreviewSendSchema,
    async (input) => {
      try {
        if (isReadOnly()) {
          assertWritable("sf_agent_preview_send");
        }

        validateAgentSelector(input.apiName, input.authoringBundle);

        const resolvedTargetOrg = await resolveAgentTargetOrg(input);
        assertMutationAllowed({
          toolName: "sf_agent_preview_send",
          targetOrg: resolvedTargetOrg,
          confirm: input.confirm,
        });

        const args = [
          "agent",
          "preview",
          "send",
          "--target-org",
          resolvedTargetOrg,
          "--utterance",
          input.utterance,
        ];
        appendAgentSelector(args, input);
        appendApiVersion(args, input.apiVersion);

        if (input.sessionId) {
          args.push("--session-id", input.sessionId);
        }

        const result = await execSfJson(args, { cwd: input.directory });
        return success({
          targetOrg: resolvedTargetOrg,
          result,
        });
      } catch (error) {
        return failure(error.message, error.context ?? null);
      }
    }
  );

  server.tool(
    "sf_agent_preview_end",
    "End Agentforce preview sessions and return trace info.",
    AgentPreviewEndSchema,
    async (input) => {
      try {
        const resolvedTargetOrg = await resolveAgentTargetOrg(input);

        const args = ["agent", "preview", "end", "--target-org", resolvedTargetOrg];
        appendAgentSelector(args, input);
        appendApiVersion(args, input.apiVersion);

        if (input.endAll) {
          args.push("--all");
        }
        if (input.noPrompt) {
          args.push("--no-prompt");
        }
        if (input.sessionId) {
          args.push("--session-id", input.sessionId);
        }

        const result = await execSfJson(args, { cwd: input.directory });
        return success({
          targetOrg: resolvedTargetOrg,
          result,
        });
      } catch (error) {
        return failure(error.message, error.context ?? null);
      }
    }
  );

  server.tool(
    "sf_agent_preview_sessions",
    "List locally cached Agentforce preview sessions.",
    AgentPreviewSessionsSchema,
    async (input) => {
      try {
        const args = ["agent", "preview", "sessions"];
        const result = await execSfJson(args, { cwd: input.directory });
        return success({
          result,
        });
      } catch (error) {
        return failure(error.message, error.context ?? null);
      }
    }
  );
}
