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

const DescribeFieldSchema = {
  objectName: z.string().min(1),
  fieldName: z.string().min(1),
  targetOrg: z.string().optional(),
  directory: z.string().optional(),
};

const ListObjectFieldsSchema = {
  objectName: z.string().min(1),
  targetOrg: z.string().optional(),
  directory: z.string().optional(),
  nameContains: z.string().optional(),
  fieldType: z.string().optional(),
  isCreateable: z.boolean().optional(),
  isUpdateable: z.boolean().optional(),
  isNillable: z.boolean().optional(),
  includeCalculated: z.boolean().optional(),
  limit: z.number().int().min(1).max(2000).optional(),
};

function getFieldByName(fields, requestedFieldName) {
  const normalized = requestedFieldName.trim().toLowerCase();
  return (fields ?? []).find((entry) => entry.name?.toLowerCase() === normalized) ?? null;
}

function isRequiredField(field) {
  return Boolean(field) && field.nillable === false && field.defaultedOnCreate !== true;
}

function normalizeFieldSummary(field) {
  return {
    name: field.name ?? null,
    label: field.label ?? null,
    type: field.type ?? null,
    length: field.length ?? null,
    precision: field.precision ?? null,
    scale: field.scale ?? null,
    isNillable: Boolean(field.nillable),
    isRequired: isRequiredField(field),
    isCreateable: Boolean(field.createable),
    isUpdateable: Boolean(field.updateable),
    isCalculated: Boolean(field.calculated),
    defaultedOnCreate: Boolean(field.defaultedOnCreate),
    referenceTo: Array.isArray(field.referenceTo) ? field.referenceTo : [],
    picklistValueCount: Array.isArray(field.picklistValues)
      ? field.picklistValues.length
      : 0,
  };
}

export function registerDescribeTools(server) {
  server.tool(
    "sf_describe_field",
    "Describe one Salesforce field and its metadata on a specific object.",
    DescribeFieldSchema,
    async (input) => {
      try {
        const { targetOrg, connection } = await getJsforceConnection(input.targetOrg, {
          cwd: input.directory,
        });
        assertOrgAccess(targetOrg);

        const describe = await connection.sobject(input.objectName).describe();
        const field = getFieldByName(describe.fields, input.fieldName);
        if (!field) {
          throw new Error(
            `Field "${input.fieldName}" not found on object "${input.objectName}".`
          );
        }

        return success({
          targetOrg,
          objectName: input.objectName,
          fieldName: field.name,
          summary: normalizeFieldSummary(field),
          result: field,
        });
      } catch (error) {
        return failure(error.message, error.context ?? null);
      }
    }
  );

  server.tool(
    "sf_list_object_fields",
    "List object fields with optional filter conditions.",
    ListObjectFieldsSchema,
    async (input) => {
      try {
        const { targetOrg, connection } = await getJsforceConnection(input.targetOrg, {
          cwd: input.directory,
        });
        assertOrgAccess(targetOrg);

        const describe = await connection.sobject(input.objectName).describe();
        let fields = Array.isArray(describe.fields) ? [...describe.fields] : [];

        if (input.nameContains?.trim()) {
          const q = input.nameContains.trim().toLowerCase();
          fields = fields.filter(
            (field) =>
              field.name?.toLowerCase().includes(q) ||
              field.label?.toLowerCase().includes(q)
          );
        }

        if (input.fieldType?.trim()) {
          const desiredType = input.fieldType.trim().toLowerCase();
          fields = fields.filter((field) => String(field.type ?? "").toLowerCase() === desiredType);
        }

        if (input.isCreateable !== undefined) {
          fields = fields.filter((field) => Boolean(field.createable) === input.isCreateable);
        }

        if (input.isUpdateable !== undefined) {
          fields = fields.filter((field) => Boolean(field.updateable) === input.isUpdateable);
        }

        if (input.isNillable !== undefined) {
          fields = fields.filter((field) => Boolean(field.nillable) === input.isNillable);
        }

        if (input.includeCalculated !== true) {
          fields = fields.filter((field) => field.calculated !== true);
        }

        const limit = input.limit ?? 300;
        const normalized = fields
          .map((field) => normalizeFieldSummary(field))
          .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""))
          .slice(0, limit);

        return success({
          targetOrg,
          objectName: input.objectName,
          totalMatched: fields.length,
          returned: normalized.length,
          limit,
          filters: {
            nameContains: input.nameContains ?? null,
            fieldType: input.fieldType ?? null,
            isCreateable: input.isCreateable ?? null,
            isUpdateable: input.isUpdateable ?? null,
            isNillable: input.isNillable ?? null,
            includeCalculated: input.includeCalculated === true,
          },
          fields: normalized,
        });
      } catch (error) {
        return failure(error.message, error.context ?? null);
      }
    }
  );

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
        const field = getFieldByName(describe.fields, input.fieldName);

        if (!field) {
          throw new Error(
            `Field "${input.fieldName}" not found on object "${input.objectName}".`
          );
        }

        return success({
          targetOrg,
          objectName: input.objectName,
          fieldName: field.name,
          isNillable: normalizeFieldSummary(field).isNillable,
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
