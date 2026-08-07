import { z } from "zod";
import { assertOrgAccess } from "../config/permissions.js";
import { failure, success } from "../lib/respond.js";
import { getJsforceConnection } from "../jsforce/connection.js";
import { execSfJson } from "../sf/execSf.js";
import { resolveTargetOrg } from "../sf/resolveOrg.js";

const QuerySchema = {
  query: z.string().min(1),
  targetOrg: z.string().optional(),
  directory: z.string().optional(),
};

const SoslSchema = {
  search: z.string().min(1),
  targetOrg: z.string().optional(),
  directory: z.string().optional(),
};

const PaginatedQuerySchema = {
  query: z.string().min(1),
  targetOrg: z.string().optional(),
  directory: z.string().optional(),
  pageSize: z.number().int().min(1).max(2000).optional(),
  maxRecords: z.number().int().min(1).max(10000).optional(),
  nextRecordsUrl: z.string().optional(),
};

const NamedQuerySchema = {
  queryApiName: z.string().min(1),
  parameters: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
  targetOrg: z.string().optional(),
  directory: z.string().optional(),
};

const UserRecordAccessSchema = {
  userId: z.string().min(1),
  recordIds: z.array(z.string().min(1)).min(1).max(200),
  targetOrg: z.string().optional(),
  directory: z.string().optional(),
};

const UserObjectCreateAccessSchema = {
  userId: z.string().min(1),
  objectApiNames: z.array(z.string().min(1)).min(1).max(200),
  targetOrg: z.string().optional(),
  directory: z.string().optional(),
};

const SALESFORCE_ID_REGEX = /^[A-Za-z0-9]{15}(?:[A-Za-z0-9]{3})?$/;
const OBJECT_API_NAME_REGEX = /^[A-Za-z][A-Za-z0-9_]*(?:__[A-Za-z0-9]+)?$/;

function ensureSalesforceId(value, label) {
  const candidate = String(value).trim();
  if (!SALESFORCE_ID_REGEX.test(candidate)) {
    throw new Error(
      `Invalid ${label} "${value}". Expected a 15- or 18-character Salesforce ID.`
    );
  }
  return candidate;
}

function escapeForSoql(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function normalizeRecordIds(recordIds) {
  const unique = new Set();
  for (const recordId of recordIds) {
    unique.add(ensureSalesforceId(recordId, "recordId"));
  }
  return [...unique];
}

function normalizeObjectApiNames(objectApiNames) {
  const unique = new Set();
  for (const objectApiName of objectApiNames) {
    const candidate = String(objectApiName).trim();
    if (!OBJECT_API_NAME_REGEX.test(candidate)) {
      throw new Error(
        `Invalid objectApiName "${objectApiName}". Expected a Salesforce object API name like Account or Custom_Object__c.`
      );
    }
    unique.add(candidate);
  }
  return [...unique];
}

export function registerDataTools(server) {
  server.tool(
    "sf_get_user_record_access",
    "Check read/edit/delete/transfer access for a single user across up to 200 records.",
    UserRecordAccessSchema,
    async (input) => {
      try {
        const { targetOrg, connection } = await getJsforceConnection(input.targetOrg, {
          cwd: input.directory,
        });
        assertOrgAccess(targetOrg);

        const userId = ensureSalesforceId(input.userId, "userId");
        const recordIds = normalizeRecordIds(input.recordIds);
        const inClause = recordIds.map((id) => `'${escapeForSoql(id)}'`).join(", ");
        const soql =
          "SELECT RecordId, HasReadAccess, HasEditAccess, HasDeleteAccess, HasTransferAccess " +
          "FROM UserRecordAccess " +
          `WHERE UserId = '${escapeForSoql(userId)}' AND RecordId IN (${inClause})`;

        const result = await connection.query(soql);
        const accessByRecordId = Object.fromEntries(
          (result.records ?? []).map((record) => [
            record.RecordId,
            {
              hasReadAccess: Boolean(record.HasReadAccess),
              hasEditAccess: Boolean(record.HasEditAccess),
              hasDeleteAccess: Boolean(record.HasDeleteAccess),
              hasTransferAccess: Boolean(record.HasTransferAccess),
            },
          ])
        );

        return success({
          targetOrg,
          userId,
          requestedRecordCount: input.recordIds.length,
          uniqueRecordCount: recordIds.length,
          resolvedRecordCount: result.totalSize ?? Object.keys(accessByRecordId).length,
          accessByRecordId,
          notes: [
            "This query evaluates sharing and permissions at runtime via UserRecordAccess.",
            "Salesforce requires exactly one UserId filter and supports up to 200 RecordIds.",
          ],
        });
      } catch (error) {
        return failure(error.message, error.context ?? null);
      }
    }
  );

  server.tool(
    "sf_get_user_object_create_access",
    "Check object-level create permission for a single user across one or more objects.",
    UserObjectCreateAccessSchema,
    async (input) => {
      try {
        const { targetOrg, connection } = await getJsforceConnection(input.targetOrg, {
          cwd: input.directory,
        });
        assertOrgAccess(targetOrg);

        const userId = ensureSalesforceId(input.userId, "userId");
        const objectApiNames = normalizeObjectApiNames(input.objectApiNames);
        const requestedSet = new Set(objectApiNames);
        const soql =
          "SELECT EntityDefinition.QualifiedApiName, IsCreatable " +
          "FROM UserEntityAccess " +
          `WHERE UserId = '${escapeForSoql(userId)}'`;
        const result = await connection.tooling.query(soql);

        const objectCreateAccessByObject = {};
        for (const row of result.records ?? []) {
          const apiName = row.EntityDefinition?.QualifiedApiName;
          if (!apiName || !requestedSet.has(apiName)) {
            continue;
          }
          objectCreateAccessByObject[apiName] = Boolean(row.IsCreatable);
        }

        const unresolvedObjects = objectApiNames.filter(
          (apiName) => !(apiName in objectCreateAccessByObject)
        );

        return success({
          targetOrg,
          userId,
          requestedObjectCount: input.objectApiNames.length,
          uniqueObjectCount: objectApiNames.length,
          resolvedObjectCount: Object.keys(objectCreateAccessByObject).length,
          objectCreateAccessByObject,
          unresolvedObjects,
          notes: [
            "Uses UserEntityAccess for runtime object-level access evaluation.",
            "Returns unresolved objects when no UserEntityAccess row is returned for a requested object.",
          ],
        });
      } catch (error) {
        return failure(error.message, error.context ?? null);
      }
    }
  );

  server.tool(
    "sf_query_org",
    "Run a SOQL query against a Salesforce org.",
    QuerySchema,
    async ({ query, targetOrg, directory }) => {
      try {
        const resolvedTargetOrg = await resolveTargetOrg(targetOrg, {
          cwd: directory,
        });
        assertOrgAccess(resolvedTargetOrg);

        const args = [
          "data",
          "query",
          "--query",
          query,
          "--target-org",
          resolvedTargetOrg,
        ];

        const result = await execSfJson(args, { cwd: directory });
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
    "sf_query_org_paginated",
    "Run paginated SOQL queries with explicit nextRecordsUrl support.",
    PaginatedQuerySchema,
    async (input) => {
      try {
        const { targetOrg, connection } = await getJsforceConnection(input.targetOrg, {
          cwd: input.directory,
        });
        assertOrgAccess(targetOrg);

        const pageSize = input.pageSize ?? 200;
        const maxRecords = input.maxRecords ?? pageSize;
        const queryResult = input.nextRecordsUrl
          ? await connection.queryMore(input.nextRecordsUrl)
          : await connection.query(input.query, {
              autoFetch: false,
              maxFetch: maxRecords,
              scanAll: false,
            });

        const records = Array.isArray(queryResult.records)
          ? queryResult.records.slice(0, pageSize)
          : [];

        return success({
          targetOrg,
          totalSize: queryResult.totalSize ?? records.length,
          done: Boolean(queryResult.done),
          nextRecordsUrl: queryResult.nextRecordsUrl ?? null,
          records,
        });
      } catch (error) {
        return failure(error.message, error.context ?? null);
      }
    }
  );

  server.tool(
    "sf_search_org",
    "Run a SOSL search against a Salesforce org.",
    SoslSchema,
    async ({ search, targetOrg, directory }) => {
      try {
        const resolvedTargetOrg = await resolveTargetOrg(targetOrg, {
          cwd: directory,
        });
        assertOrgAccess(resolvedTargetOrg);

        const args = [
          "data",
          "search",
          "--query",
          search,
          "--target-org",
          resolvedTargetOrg,
        ];

        const result = await execSfJson(args, { cwd: directory });
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
    "sf_execute_named_query",
    "Execute a Salesforce Named Query API resource by query API name.",
    NamedQuerySchema,
    async (input) => {
      try {
        const { targetOrg, connection } = await getJsforceConnection(input.targetOrg, {
          cwd: input.directory,
        });
        assertOrgAccess(targetOrg);

        const queryString = new URLSearchParams();
        for (const [key, value] of Object.entries(input.parameters ?? {})) {
          queryString.set(key, String(value));
        }

        const encodedQueryName = encodeURIComponent(input.queryApiName);
        const suffix = queryString.toString() ? `?${queryString.toString()}` : "";
        const path = `/services/data/v${connection.version}/named/query/${encodedQueryName}${suffix}`;
        const result = await connection.request(path);

        return success({
          targetOrg,
          queryApiName: input.queryApiName,
          parameters: input.parameters ?? {},
          result,
        });
      } catch (error) {
        return failure(error.message, error.context ?? null);
      }
    }
  );
}
