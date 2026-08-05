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

export function registerDataTools(server) {
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
