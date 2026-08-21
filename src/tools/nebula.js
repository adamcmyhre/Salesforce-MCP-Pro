import { z } from "zod";
import { assertOrgAccess } from "../config/permissions.js";
import { failure, success } from "../lib/respond.js";
import { getJsforceConnection } from "../jsforce/connection.js";

const NebulaListLogsSchema = {
  targetOrg: z.string().optional(),
  directory: z.string().optional(),
  namespace: z.string().optional(),
  limit: z.number().int().min(1).max(200).optional(),
  sinceHours: z.number().int().min(1).max(24 * 30).optional(),
  userId: z.string().optional(),
};

const NebulaGetLogEntriesSchema = {
  targetOrg: z.string().optional(),
  directory: z.string().optional(),
  namespace: z.string().optional(),
  logId: z.string().min(1),
  limit: z.number().int().min(1).max(2000).optional(),
  loggingLevels: z.array(z.string().min(1)).max(20).optional(),
};

const NebulaSearchEntriesSchema = {
  targetOrg: z.string().optional(),
  directory: z.string().optional(),
  namespace: z.string().optional(),
  query: z.string().min(1),
  limit: z.number().int().min(1).max(500).optional(),
  sinceHours: z.number().int().min(1).max(24 * 30).optional(),
  loggingLevels: z.array(z.string().min(1)).max(20).optional(),
  tags: z.array(z.string().min(1)).max(50).optional(),
  logId: z.string().optional(),
};

const NebulaFindLogsByTagSchema = {
  targetOrg: z.string().optional(),
  directory: z.string().optional(),
  namespace: z.string().optional(),
  tags: z.array(z.string().min(1)).min(1).max(50),
  matchMode: z.enum(["any", "all"]).optional(),
  limit: z.number().int().min(1).max(200).optional(),
  sinceHours: z.number().int().min(1).max(24 * 30).optional(),
  includeEntries: z.boolean().optional(),
  entriesPerLog: z.number().int().min(1).max(200).optional(),
};

function escapeForSoql(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function normalizeNamespace(value) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return "";
  }
  return raw.endsWith("__") ? raw.slice(0, -2) : raw;
}

function namespacePrefix(namespace) {
  return namespace ? `${namespace}__` : "";
}

function fieldMatchesSuffix(fieldName, suffix) {
  return fieldName === suffix || fieldName.endsWith(`__${suffix}`);
}

function pickFieldBySuffix(fields, suffix) {
  const exact = fields.find((field) => field.name === suffix);
  if (exact) {
    return exact.name;
  }
  const namespaced = fields.find((field) => fieldMatchesSuffix(field.name, suffix));
  return namespaced?.name ?? null;
}

async function detectNebulaObjects(connection, explicitNamespace) {
  const globalDescribe = await connection.describeGlobal();
  const objectNames = new Set((globalDescribe?.sobjects ?? []).map((sobject) => sobject.name));

  const requestedNamespace = normalizeNamespace(explicitNamespace);
  if (requestedNamespace) {
    const prefix = namespacePrefix(requestedNamespace);
    const logObjectApiName = `${prefix}Log__c`;
    const logEntryObjectApiName = `${prefix}LogEntry__c`;
    if (!objectNames.has(logObjectApiName) || !objectNames.has(logEntryObjectApiName)) {
      throw new Error(
        `Could not find Nebula objects for namespace "${requestedNamespace}". Expected "${logObjectApiName}" and "${logEntryObjectApiName}".`
      );
    }
    return {
      namespace: requestedNamespace,
      prefix,
      logObjectApiName,
      logEntryObjectApiName,
      logEntryTagObjectApiName: objectNames.has(`${prefix}LogEntryTag__c`)
        ? `${prefix}LogEntryTag__c`
        : null,
      loggerTagObjectApiName: objectNames.has(`${prefix}LoggerTag__c`)
        ? `${prefix}LoggerTag__c`
        : null,
    };
  }

  if (objectNames.has("Log__c") && objectNames.has("LogEntry__c")) {
    return {
      namespace: "",
      prefix: "",
      logObjectApiName: "Log__c",
      logEntryObjectApiName: "LogEntry__c",
      logEntryTagObjectApiName: objectNames.has("LogEntryTag__c") ? "LogEntryTag__c" : null,
      loggerTagObjectApiName: objectNames.has("LoggerTag__c") ? "LoggerTag__c" : null,
    };
  }

  if (objectNames.has("Nebula__Log__c") && objectNames.has("Nebula__LogEntry__c")) {
    return {
      namespace: "Nebula",
      prefix: "Nebula__",
      logObjectApiName: "Nebula__Log__c",
      logEntryObjectApiName: "Nebula__LogEntry__c",
      logEntryTagObjectApiName: objectNames.has("Nebula__LogEntryTag__c")
        ? "Nebula__LogEntryTag__c"
        : null,
      loggerTagObjectApiName: objectNames.has("Nebula__LoggerTag__c")
        ? "Nebula__LoggerTag__c"
        : null,
    };
  }

  for (const objectName of objectNames) {
    const match = objectName.match(/^([A-Za-z0-9_]+)__Log__c$/);
    if (!match) {
      continue;
    }
    const namespace = match[1];
    const logEntryObjectApiName = `${namespace}__LogEntry__c`;
    if (objectNames.has(logEntryObjectApiName)) {
      return {
        namespace,
        prefix: `${namespace}__`,
        logObjectApiName: objectName,
        logEntryObjectApiName,
        logEntryTagObjectApiName: objectNames.has(`${namespace}__LogEntryTag__c`)
          ? `${namespace}__LogEntryTag__c`
          : null,
        loggerTagObjectApiName: objectNames.has(`${namespace}__LoggerTag__c`)
          ? `${namespace}__LoggerTag__c`
          : null,
      };
    }
  }

  throw new Error(
    "Nebula Logger objects were not found in this org. Expected Log__c/LogEntry__c (or namespaced equivalents)."
  );
}

async function describeNebulaModel(connection, explicitNamespace) {
  const objects = await detectNebulaObjects(connection, explicitNamespace);
  const logDescribe = await connection.sobject(objects.logObjectApiName).describe();
  const logEntryDescribe = await connection.sobject(objects.logEntryObjectApiName).describe();

  const logFields = logDescribe?.fields ?? [];
  const logEntryFields = logEntryDescribe?.fields ?? [];
  const linkField = pickFieldBySuffix(logEntryFields, "Log__c");
  const levelField = pickFieldBySuffix(logEntryFields, "LoggingLevel__c");
  const messageField = pickFieldBySuffix(logEntryFields, "Message__c");
  let logEntryTagFields = [];
  let logEntryTagToEntryField = null;
  let logEntryTagToTagField = null;
  if (objects.logEntryTagObjectApiName) {
    const logEntryTagDescribe = await connection.sobject(objects.logEntryTagObjectApiName).describe();
    logEntryTagFields = logEntryTagDescribe?.fields ?? [];
    logEntryTagToEntryField = pickFieldBySuffix(logEntryTagFields, "LogEntry__c");
    logEntryTagToTagField = pickFieldBySuffix(logEntryTagFields, "LoggerTag__c");
  }

  return {
    ...objects,
    logFields,
    logEntryFields,
    logEntryTagFields,
    linkField,
    levelField,
    messageField,
    logEntryTagToEntryField,
    logEntryTagToTagField,
  };
}

function addOptionalField(selection, fieldName) {
  if (fieldName && !selection.includes(fieldName)) {
    selection.push(fieldName);
  }
}

function buildSinceDateLiteral(sinceHours) {
  if (!sinceHours) {
    return null;
  }
  const now = Date.now();
  const since = new Date(now - sinceHours * 60 * 60 * 1000);
  return since.toISOString();
}

function buildInClause(values) {
  return values.map((value) => `'${escapeForSoql(value)}'`).join(", ");
}

function normalizeLevels(levels) {
  if (!Array.isArray(levels)) {
    return [];
  }
  return levels
    .map((entry) => String(entry ?? "").trim())
    .filter(Boolean);
}

function normalizeTags(tags) {
  if (!Array.isArray(tags)) {
    return [];
  }
  return tags
    .map((entry) => String(entry ?? "").trim())
    .filter(Boolean);
}

function buildTagWhereClause(model, tagNames) {
  if (tagNames.length === 0) {
    return null;
  }
  if (
    !model.logEntryTagObjectApiName ||
    !model.logEntryTagToEntryField ||
    !model.logEntryTagToTagField
  ) {
    throw new Error(
      "Tag filtering is unavailable because LogEntryTag relationship objects/fields were not found in this org."
    );
  }

  return (
    `Id IN (SELECT ${model.logEntryTagToEntryField} FROM ${model.logEntryTagObjectApiName} ` +
    `WHERE ${model.logEntryTagToTagField}.Name IN (${buildInClause(tagNames)}))`
  );
}

export function registerNebulaTools(server) {
  server.tool(
    "sf_nebula_list_logs",
    "List Nebula Logger parent log records (namespace-aware).",
    NebulaListLogsSchema,
    async (input) => {
      try {
        const { targetOrg, connection } = await getJsforceConnection(input.targetOrg, {
          cwd: input.directory,
        });
        assertOrgAccess(targetOrg);

        const model = await describeNebulaModel(connection, input.namespace);
        const selectedFields = ["Id", "Name", "CreatedDate", "LastModifiedDate", "OwnerId"];
        addOptionalField(selectedFields, pickFieldBySuffix(model.logFields, "Scenario__c"));
        addOptionalField(selectedFields, pickFieldBySuffix(model.logFields, "Status__c"));
        addOptionalField(selectedFields, pickFieldBySuffix(model.logFields, "EntryCount__c"));
        addOptionalField(
          selectedFields,
          pickFieldBySuffix(model.logFields, "DurationMilliseconds__c")
        );
        addOptionalField(selectedFields, pickFieldBySuffix(model.logFields, "RequestId__c"));
        addOptionalField(selectedFields, pickFieldBySuffix(model.logFields, "LogRetentionDate__c"));

        const where = [];
        if (input.userId?.trim()) {
          where.push(`OwnerId = '${escapeForSoql(input.userId.trim())}'`);
        }
        const sinceLiteral = buildSinceDateLiteral(input.sinceHours);
        if (sinceLiteral) {
          where.push(`CreatedDate >= ${sinceLiteral}`);
        }

        const whereClause = where.length > 0 ? ` WHERE ${where.join(" AND ")}` : "";
        const limit = input.limit ?? 25;
        const query =
          `SELECT ${selectedFields.join(", ")} FROM ${model.logObjectApiName}` +
          whereClause +
          ` ORDER BY CreatedDate DESC LIMIT ${limit}`;

        const result = await connection.query(query);

        return success({
          targetOrg,
          namespace: model.namespace || null,
          objects: {
            log: model.logObjectApiName,
            logEntry: model.logEntryObjectApiName,
          },
          selectedFields,
          filters: {
            limit,
            sinceHours: input.sinceHours ?? null,
            userId: input.userId ?? null,
          },
          totalSize: result.totalSize,
          records: result.records ?? [],
        });
      } catch (error) {
        return failure(error.message, error.context ?? null);
      }
    }
  );

  server.tool(
    "sf_nebula_get_log_entries",
    "Get Nebula Logger entries for a single parent log id.",
    NebulaGetLogEntriesSchema,
    async (input) => {
      try {
        const { targetOrg, connection } = await getJsforceConnection(input.targetOrg, {
          cwd: input.directory,
        });
        assertOrgAccess(targetOrg);

        const model = await describeNebulaModel(connection, input.namespace);
        if (!model.linkField) {
          throw new Error(`Could not identify log link field on ${model.logEntryObjectApiName}.`);
        }

        const selectedFields = ["Id", "Name", "CreatedDate", "LastModifiedDate"];
        addOptionalField(selectedFields, model.linkField);
        addOptionalField(selectedFields, model.levelField);
        addOptionalField(selectedFields, model.messageField);
        addOptionalField(selectedFields, pickFieldBySuffix(model.logEntryFields, "StackTrace__c"));
        addOptionalField(selectedFields, pickFieldBySuffix(model.logEntryFields, "RecordId__c"));
        addOptionalField(selectedFields, pickFieldBySuffix(model.logEntryFields, "ExceptionType__c"));
        addOptionalField(selectedFields, pickFieldBySuffix(model.logEntryFields, "Tags__c"));

        const where = [`${model.linkField} = '${escapeForSoql(input.logId)}'`];
        const levels = normalizeLevels(input.loggingLevels);
        if (levels.length > 0) {
          if (!model.levelField) {
            throw new Error(
              `Cannot filter by logging level because no LoggingLevel field exists on ${model.logEntryObjectApiName}.`
            );
          }
          where.push(`${model.levelField} IN (${buildInClause(levels)})`);
        }

        const limit = input.limit ?? 500;
        const query =
          `SELECT ${selectedFields.join(", ")} FROM ${model.logEntryObjectApiName}` +
          ` WHERE ${where.join(" AND ")}` +
          ` ORDER BY CreatedDate ASC LIMIT ${limit}`;
        const result = await connection.query(query);

        return success({
          targetOrg,
          namespace: model.namespace || null,
          objects: {
            log: model.logObjectApiName,
            logEntry: model.logEntryObjectApiName,
          },
          selectedFields,
          filters: {
            logId: input.logId,
            loggingLevels: levels,
            limit,
          },
          totalSize: result.totalSize,
          records: result.records ?? [],
        });
      } catch (error) {
        return failure(error.message, error.context ?? null);
      }
    }
  );

  server.tool(
    "sf_nebula_search_entries",
    "Search Nebula Logger entry messages by text and optional level/time filters.",
    NebulaSearchEntriesSchema,
    async (input) => {
      try {
        const { targetOrg, connection } = await getJsforceConnection(input.targetOrg, {
          cwd: input.directory,
        });
        assertOrgAccess(targetOrg);

        const model = await describeNebulaModel(connection, input.namespace);
        if (!model.messageField) {
          throw new Error(
            `Could not identify message field on ${model.logEntryObjectApiName} for text search.`
          );
        }

        const selectedFields = ["Id", "Name", "CreatedDate"];
        addOptionalField(selectedFields, model.linkField);
        addOptionalField(selectedFields, model.levelField);
        addOptionalField(selectedFields, model.messageField);
        addOptionalField(selectedFields, pickFieldBySuffix(model.logEntryFields, "RecordId__c"));
        addOptionalField(selectedFields, pickFieldBySuffix(model.logEntryFields, "ExceptionType__c"));

        const where = [`${model.messageField} LIKE '%${escapeForSoql(input.query.trim())}%'`];
        const levels = normalizeLevels(input.loggingLevels);
        const tags = normalizeTags(input.tags);
        if (levels.length > 0) {
          if (!model.levelField) {
            throw new Error(
              `Cannot filter by logging level because no LoggingLevel field exists on ${model.logEntryObjectApiName}.`
            );
          }
          where.push(`${model.levelField} IN (${buildInClause(levels)})`);
        }
        const tagWhere = buildTagWhereClause(model, tags);
        if (tagWhere) {
          where.push(tagWhere);
        }

        const sinceLiteral = buildSinceDateLiteral(input.sinceHours);
        if (sinceLiteral) {
          where.push(`CreatedDate >= ${sinceLiteral}`);
        }

        if (input.logId?.trim()) {
          if (!model.linkField) {
            throw new Error(
              `Cannot filter by logId because no log link field exists on ${model.logEntryObjectApiName}.`
            );
          }
          where.push(`${model.linkField} = '${escapeForSoql(input.logId.trim())}'`);
        }

        const limit = input.limit ?? 100;
        const query =
          `SELECT ${selectedFields.join(", ")} FROM ${model.logEntryObjectApiName}` +
          ` WHERE ${where.join(" AND ")}` +
          ` ORDER BY CreatedDate DESC LIMIT ${limit}`;
        const result = await connection.query(query);

        return success({
          targetOrg,
          namespace: model.namespace || null,
          objects: {
            log: model.logObjectApiName,
            logEntry: model.logEntryObjectApiName,
          },
          selectedFields,
          filters: {
            query: input.query.trim(),
            loggingLevels: levels,
            tags,
            sinceHours: input.sinceHours ?? null,
            logId: input.logId ?? null,
            limit,
          },
          totalSize: result.totalSize,
          records: result.records ?? [],
        });
      } catch (error) {
        return failure(error.message, error.context ?? null);
      }
    }
  );

  server.tool(
    "sf_nebula_find_logs_by_tag",
    "Find Nebula logs using one or more tags (any/all), with optional entry previews.",
    NebulaFindLogsByTagSchema,
    async (input) => {
      try {
        const { targetOrg, connection } = await getJsforceConnection(input.targetOrg, {
          cwd: input.directory,
        });
        assertOrgAccess(targetOrg);

        const model = await describeNebulaModel(connection, input.namespace);
        const tags = normalizeTags(input.tags);
        if (tags.length === 0) {
          throw new Error("Provide at least one tag.");
        }
        if (
          !model.logEntryTagObjectApiName ||
          !model.logEntryTagToEntryField ||
          !model.logEntryTagToTagField ||
          !model.linkField
        ) {
          throw new Error(
            "Tag lookup is unavailable because required Nebula tag objects/fields were not found in this org."
          );
        }

        const matchMode = input.matchMode ?? "any";
        const limit = input.limit ?? 50;
        const sinceLiteral = buildSinceDateLiteral(input.sinceHours);
        const selectedLogFields = ["Id", "Name", "CreatedDate", "LastModifiedDate", "OwnerId"];
        addOptionalField(selectedLogFields, pickFieldBySuffix(model.logFields, "Status__c"));
        addOptionalField(selectedLogFields, pickFieldBySuffix(model.logFields, "Scenario__c"));
        addOptionalField(selectedLogFields, pickFieldBySuffix(model.logFields, "EntryCount__c"));

        let logEntryQuery =
          `SELECT Id, ${model.linkField} FROM ${model.logEntryObjectApiName} ` +
          `WHERE Id IN (SELECT ${model.logEntryTagToEntryField} FROM ${model.logEntryTagObjectApiName} ` +
          `WHERE ${model.logEntryTagToTagField}.Name IN (${buildInClause(tags)}))`;
        if (sinceLiteral) {
          logEntryQuery += ` AND CreatedDate >= ${sinceLiteral}`;
        }
        if (matchMode === "all") {
          logEntryQuery +=
            ` GROUP BY Id, ${model.linkField}` +
            ` HAVING COUNT_DISTINCT(${model.logEntryTagToTagField}) >= ${tags.length}`;
        }

        const logEntryResult = await connection.query(logEntryQuery);
        const logIds = Array.from(
          new Set(
            (logEntryResult.records ?? [])
              .map((record) => record?.[model.linkField])
              .filter(Boolean)
          )
        );

        if (logIds.length === 0) {
          return success({
            targetOrg,
            namespace: model.namespace || null,
            objects: {
              log: model.logObjectApiName,
              logEntry: model.logEntryObjectApiName,
              logEntryTag: model.logEntryTagObjectApiName,
              loggerTag: model.loggerTagObjectApiName,
            },
            filters: {
              tags,
              matchMode,
              sinceHours: input.sinceHours ?? null,
              limit,
            },
            totalSize: 0,
            records: [],
            entryPreviewByLog: {},
          });
        }

        const truncatedLogIds = logIds.slice(0, limit);
        const logQuery =
          `SELECT ${selectedLogFields.join(", ")} FROM ${model.logObjectApiName}` +
          ` WHERE Id IN (${buildInClause(truncatedLogIds)})` +
          " ORDER BY CreatedDate DESC";
        const logsResult = await connection.query(logQuery);

        let entryPreviewByLog = {};
        if (input.includeEntries === true) {
          const entryLimit = input.entriesPerLog ?? 20;
          const entryFields = ["Id", "CreatedDate"];
          addOptionalField(entryFields, model.linkField);
          addOptionalField(entryFields, model.levelField);
          addOptionalField(entryFields, model.messageField);
          addOptionalField(entryFields, pickFieldBySuffix(model.logEntryFields, "Tags__c"));

          const entryQuery =
            `SELECT ${entryFields.join(", ")} FROM ${model.logEntryObjectApiName}` +
            ` WHERE ${model.linkField} IN (${buildInClause(truncatedLogIds)})` +
            ` AND Id IN (SELECT ${model.logEntryTagToEntryField} FROM ${model.logEntryTagObjectApiName}` +
            ` WHERE ${model.logEntryTagToTagField}.Name IN (${buildInClause(tags)}))` +
            " ORDER BY CreatedDate DESC";
          const entryResult = await connection.query(entryQuery);
          const bucket = {};
          for (const record of entryResult.records ?? []) {
            const logId = record?.[model.linkField];
            if (!logId) {
              continue;
            }
            if (!bucket[logId]) {
              bucket[logId] = [];
            }
            if (bucket[logId].length < entryLimit) {
              bucket[logId].push(record);
            }
          }
          entryPreviewByLog = bucket;
        }

        return success({
          targetOrg,
          namespace: model.namespace || null,
          objects: {
            log: model.logObjectApiName,
            logEntry: model.logEntryObjectApiName,
            logEntryTag: model.logEntryTagObjectApiName,
            loggerTag: model.loggerTagObjectApiName,
          },
          filters: {
            tags,
            matchMode,
            sinceHours: input.sinceHours ?? null,
            limit,
            includeEntries: input.includeEntries === true,
            entriesPerLog: input.entriesPerLog ?? null,
          },
          selectedLogFields,
          totalSize: logsResult.totalSize,
          records: logsResult.records ?? [],
          entryPreviewByLog,
        });
      } catch (error) {
        return failure(error.message, error.context ?? null);
      }
    }
  );
}

