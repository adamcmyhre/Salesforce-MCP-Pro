import { z } from "zod";
import { assertOrgAccess } from "../config/permissions.js";
import { failure, success } from "../lib/respond.js";
import { getJsforceConnection } from "../jsforce/connection.js";

const ToolingQuerySchema = {
  query: z.string().min(1),
  targetOrg: z.string().optional(),
  directory: z.string().optional(),
};

const ToolingListObjectsSchema = {
  targetOrg: z.string().optional(),
  directory: z.string().optional(),
};

const ToolingDescribeObjectSchema = {
  objectName: z.string().min(1),
  targetOrg: z.string().optional(),
  directory: z.string().optional(),
};

const ToolingGetApexClassSchema = {
  className: z.string().min(1),
  targetOrg: z.string().optional(),
  directory: z.string().optional(),
};

function escapeSoql(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export function registerToolingApiTools(server) {
  server.tool(
    "sf_tooling_query",
    "Run a SOQL query against Salesforce Tooling API objects.",
    ToolingQuerySchema,
    async (input) => {
      try {
        const { targetOrg, connection } = await getJsforceConnection(input.targetOrg, {
          cwd: input.directory,
        });
        assertOrgAccess(targetOrg);

        const result = await connection.tooling.query(input.query);
        return success({
          targetOrg,
          result,
        });
      } catch (error) {
        return failure(error.message, error.context ?? null);
      }
    }
  );

  server.tool(
    "sf_tooling_list_objects",
    "List Tooling API sObject types available in the target org.",
    ToolingListObjectsSchema,
    async (input) => {
      try {
        const { targetOrg, connection } = await getJsforceConnection(input.targetOrg, {
          cwd: input.directory,
        });
        assertOrgAccess(targetOrg);

        const path = `/services/data/v${connection.version}/tooling/sobjects`;
        const result = await connection.request(path);
        return success({
          targetOrg,
          result,
        });
      } catch (error) {
        return failure(error.message, error.context ?? null);
      }
    }
  );

  server.tool(
    "sf_tooling_describe_object",
    "Describe a Tooling API object schema by object name.",
    ToolingDescribeObjectSchema,
    async (input) => {
      try {
        const { targetOrg, connection } = await getJsforceConnection(input.targetOrg, {
          cwd: input.directory,
        });
        assertOrgAccess(targetOrg);

        const objectName = encodeURIComponent(input.objectName);
        const path = `/services/data/v${connection.version}/tooling/sobjects/${objectName}/describe`;
        const result = await connection.request(path);
        return success({
          targetOrg,
          objectName: input.objectName,
          result,
        });
      } catch (error) {
        return failure(error.message, error.context ?? null);
      }
    }
  );

  server.tool(
    "sf_tooling_get_apex_class",
    "Fetch ApexClass metadata and body by class name via Tooling API.",
    ToolingGetApexClassSchema,
    async (input) => {
      try {
        const { targetOrg, connection } = await getJsforceConnection(input.targetOrg, {
          cwd: input.directory,
        });
        assertOrgAccess(targetOrg);

        const query =
          "SELECT Id, Name, ApiVersion, Status, Body, LengthWithoutComments " +
          "FROM ApexClass WHERE Name = '" +
          escapeSoql(input.className) +
          "' LIMIT 1";
        const result = await connection.tooling.query(query);
        const record = result.records?.[0] ?? null;

        if (!record) {
          throw new Error(`ApexClass not found: "${input.className}".`);
        }

        return success({
          targetOrg,
          className: input.className,
          result: record,
        });
      } catch (error) {
        return failure(error.message, error.context ?? null);
      }
    }
  );
}
