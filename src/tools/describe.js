import { z } from "zod";
import { assertOrgAccess } from "../config/permissions.js";
import { failure, success } from "../lib/respond.js";
import { getJsforceConnection } from "../jsforce/connection.js";

const DescribeSchema = {
  objectName: z.string().min(1),
  targetOrg: z.string().optional(),
  directory: z.string().optional(),
};

const FieldNillableSchema = {
  objectName: z.string().min(1),
  fieldName: z.string().min(1),
  targetOrg: z.string().optional(),
  directory: z.string().optional(),
};

export function registerDescribeTools(server) {
  server.tool(
    "sf_is_field_nillable",
    "Determine whether a Salesforce field is nillable on a specific object.",
    FieldNillableSchema,
    async (input) => {
      try {
        const { targetOrg, connection } = await getJsforceConnection(input.targetOrg, {
          cwd: input.directory,
        });
        assertOrgAccess(targetOrg);

        const describe = await connection.sobject(input.objectName).describe();
        const requestedFieldName = input.fieldName.trim();
        const field = (describe.fields ?? []).find(
          (entry) => entry.name?.toLowerCase() === requestedFieldName.toLowerCase()
        );

        if (!field) {
          throw new Error(
            `Field "${input.fieldName}" not found on object "${input.objectName}".`
          );
        }

        return success({
          targetOrg,
          objectName: input.objectName,
          fieldName: field.name,
          isNillable: Boolean(field.nillable),
          fieldType: field.type ?? null,
          label: field.label ?? null,
        });
      } catch (error) {
        return failure(error.message, error.context ?? null);
      }
    }
  );

  server.tool(
    "sf_describe_object",
    "Describe a Salesforce object schema including fields and relationships.",
    DescribeSchema,
    async (input) => {
      try {
        const { targetOrg, connection } = await getJsforceConnection(input.targetOrg, {
          cwd: input.directory,
        });
        assertOrgAccess(targetOrg);

        const describe = await connection.sobject(input.objectName).describe();
        return success({
          targetOrg,
          objectName: input.objectName,
          result: describe,
        });
      } catch (error) {
        return failure(error.message, error.context ?? null);
      }
    }
  );
}
