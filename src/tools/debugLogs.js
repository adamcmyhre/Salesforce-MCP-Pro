import { z } from "zod";
import {
  assertOrgAccess,
  assertWritable,
  isReadOnly,
} from "../config/permissions.js";
import { assertMutationAllowed } from "../config/safety.js";
import { failure, success } from "../lib/respond.js";
import { getJsforceConnection } from "../jsforce/connection.js";

const ListDebugLogsSchema = {
  targetOrg: z.string().optional(),
  directory: z.string().optional(),
  limit: z.number().int().min(1).max(200).optional(),
  username: z.string().optional(),
};

const ReadDebugLogSchema = {
  targetOrg: z.string().optional(),
  directory: z.string().optional(),
  logId: z.string().min(1),
};

const EnableDebugLogsSchema = {
  targetOrg: z.string().optional(),
  directory: z.string().optional(),
  username: z.string().min(1),
  expirationMinutes: z.number().int().min(1).max(1440).optional(),
  debugLevelDeveloperName: z.string().optional(),
  logType: z.string().optional(),
  confirm: z.boolean().optional(),
};

const DisableDebugLogsSchema = {
  targetOrg: z.string().optional(),
  directory: z.string().optional(),
  username: z.string().optional(),
  traceFlagId: z.string().optional(),
  confirm: z.boolean().optional(),
};

function escapeForSoql(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function buildListLogsQuery(limit, username) {
  const selectedLimit = limit ?? 20;
  const whereClause = username
    ? ` WHERE LogUser.Username = '${escapeForSoql(username)}'`
    : "";

  return (
    "SELECT Id, Application, DurationMilliseconds, Location, LogLength, " +
    "LogUserId, LogUser.Name, LogUser.Username, Operation, Request, " +
    "StartTime, Status " +
    `FROM ApexLog${whereClause} ORDER BY StartTime DESC LIMIT ${selectedLimit}`
  );
}

async function resolveUserId(connection, username) {
  const query =
    "SELECT Id, Username FROM User WHERE Username = '" +
    escapeForSoql(username) +
    "' LIMIT 1";
  const result = await connection.query(query);
  const record = result.records?.[0];
  if (!record?.Id) {
    throw new Error(`No User found with username "${username}".`);
  }
  return record.Id;
}

async function resolveDebugLevelId(connection, developerName) {
  const query =
    "SELECT Id, DeveloperName FROM DebugLevel WHERE DeveloperName = '" +
    escapeForSoql(developerName) +
    "' LIMIT 1";
  const result = await connection.tooling.query(query);
  const record = result.records?.[0];
  if (!record?.Id) {
    throw new Error(
      `No DebugLevel found with DeveloperName "${developerName}". Create it in Setup first.`
    );
  }
  return record.Id;
}

export function registerDebugLogTools(server) {
  server.tool(
    "sf_list_debug_logs",
    "List recent Apex debug logs from the target org.",
    ListDebugLogsSchema,
    async (input) => {
      try {
        const { targetOrg, connection } = await getJsforceConnection(input.targetOrg, {
          cwd: input.directory,
        });
        assertOrgAccess(targetOrg);
        assertMutationAllowed({
          toolName: "sf_enable_debug_logs",
          targetOrg,
          confirm: input.confirm,
        });

        const query = buildListLogsQuery(input.limit, input.username);
        const result = await connection.tooling.query(query);

        return success({
          targetOrg,
          totalSize: result.totalSize,
          records: result.records,
        });
      } catch (error) {
        return failure(error.message, error.context ?? null);
      }
    }
  );

  server.tool(
    "sf_get_debug_log",
    "Read the body and metadata for a specific Apex debug log id.",
    ReadDebugLogSchema,
    async (input) => {
      try {
        const { targetOrg, connection } = await getJsforceConnection(input.targetOrg, {
          cwd: input.directory,
        });
        assertOrgAccess(targetOrg);
        assertMutationAllowed({
          toolName: "sf_disable_debug_logs",
          targetOrg,
          confirm: input.confirm,
        });

        const metadataQuery =
          "SELECT Id, Application, DurationMilliseconds, Location, LogLength, " +
          "LogUserId, LogUser.Name, LogUser.Username, Operation, Request, " +
          "StartTime, Status FROM ApexLog WHERE Id = '" +
          escapeForSoql(input.logId) +
          "' LIMIT 1";
        const metadataResult = await connection.tooling.query(metadataQuery);
        const metadata = metadataResult.records?.[0] ?? null;

        if (!metadata) {
          throw new Error(`Debug log not found for id "${input.logId}".`);
        }

        const bodyPath = `/services/data/v${connection.version}/tooling/sobjects/ApexLog/${encodeURIComponent(
          input.logId
        )}/Body`;
        const body = await connection.request(bodyPath);

        return success({
          targetOrg,
          logId: input.logId,
          metadata,
          body,
        });
      } catch (error) {
        return failure(error.message, error.context ?? null);
      }
    }
  );

  server.tool(
    "sf_enable_debug_logs",
    "Enable debug logs for a user by creating a TraceFlag.",
    EnableDebugLogsSchema,
    async (input) => {
      try {
        if (isReadOnly()) {
          assertWritable("sf_enable_debug_logs");
        }

        const { targetOrg, connection } = await getJsforceConnection(input.targetOrg, {
          cwd: input.directory,
        });
        assertOrgAccess(targetOrg);

        const userId = await resolveUserId(connection, input.username);
        const debugLevelDeveloperName = input.debugLevelDeveloperName ?? "SFDC_DevConsole";
        const debugLevelId = await resolveDebugLevelId(connection, debugLevelDeveloperName);

        const startDate = new Date();
        const endDate = new Date(
          Date.now() + (input.expirationMinutes ?? 30) * 60 * 1000
        );

        const traceFlagPayload = {
          TracedEntityId: userId,
          DebugLevelId: debugLevelId,
          StartDate: startDate.toISOString(),
          ExpirationDate: endDate.toISOString(),
          LogType: input.logType ?? "DEVELOPER_LOG",
        };

        const createResult = await connection.tooling.sobject("TraceFlag").create(traceFlagPayload);
        return success({
          targetOrg,
          username: input.username,
          debugLevelDeveloperName,
          traceFlag: createResult,
        });
      } catch (error) {
        return failure(error.message, error.context ?? null);
      }
    }
  );

  server.tool(
    "sf_disable_debug_logs",
    "Disable debug logs by TraceFlag id or for all active flags of a user.",
    DisableDebugLogsSchema,
    async (input) => {
      try {
        if (isReadOnly()) {
          assertWritable("sf_disable_debug_logs");
        }

        const { targetOrg, connection } = await getJsforceConnection(input.targetOrg, {
          cwd: input.directory,
        });
        assertOrgAccess(targetOrg);

        if (input.traceFlagId) {
          const result = await connection.tooling
            .sobject("TraceFlag")
            .destroy(input.traceFlagId);
          return success({
            targetOrg,
            mode: "traceFlagId",
            traceFlagId: input.traceFlagId,
            result,
          });
        }

        if (!input.username) {
          throw new Error("Provide either traceFlagId or username.");
        }

        const userId = await resolveUserId(connection, input.username);
        const query =
          "SELECT Id, ExpirationDate FROM TraceFlag WHERE TracedEntityId = '" +
          escapeForSoql(userId) +
          "'";
        const traceFlags = await connection.tooling.query(query);
        const now = Date.now();
        const ids = (traceFlags.records ?? [])
          .filter((record) => {
            if (!record.ExpirationDate) {
              return true;
            }

            const expiry = Date.parse(record.ExpirationDate);
            return Number.isNaN(expiry) ? true : expiry >= now;
          })
          .map((record) => record.Id)
          .filter(Boolean);

        if (ids.length === 0) {
          return success({
            targetOrg,
            mode: "username",
            username: input.username,
            message: "No active trace flags found.",
            removed: 0,
          });
        }

        const result = await connection.tooling.sobject("TraceFlag").destroy(ids);
        return success({
          targetOrg,
          mode: "username",
          username: input.username,
          removed: ids.length,
          result,
        });
      } catch (error) {
        return failure(error.message, error.context ?? null);
      }
    }
  );
}
