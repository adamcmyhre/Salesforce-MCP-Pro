import { z } from "zod";
import {
  assertOrgAccess,
  assertWritable,
  isReadOnly,
} from "../config/permissions.js";
import { assertMutationAllowed } from "../config/safety.js";
import { failure, success } from "../lib/respond.js";
import { getJsforceConnection } from "../jsforce/connection.js";

const CreateSchema = {
  objectName: z.string().min(1),
  records: z.array(z.record(z.any())).min(1),
  targetOrg: z.string().optional(),
  directory: z.string().optional(),
  confirm: z.boolean().optional(),
};

const UpdateSchema = {
  objectName: z.string().min(1),
  records: z.array(z.record(z.any())).min(1),
  targetOrg: z.string().optional(),
  directory: z.string().optional(),
  confirm: z.boolean().optional(),
};

const DeleteSchema = {
  objectName: z.string().min(1),
  ids: z.array(z.string().min(1)).min(1),
  targetOrg: z.string().optional(),
  directory: z.string().optional(),
  confirm: z.boolean().optional(),
};

const UpsertSchema = {
  objectName: z.string().min(1),
  externalIdField: z.string().min(1),
  records: z.array(z.record(z.any())).min(1),
  targetOrg: z.string().optional(),
  directory: z.string().optional(),
  confirm: z.boolean().optional(),
};

async function withConnection(input, callback) {
  const { targetOrg, connection } = await getJsforceConnection(input.targetOrg, {
    cwd: input.directory,
  });
  assertOrgAccess(targetOrg);
  return callback({ targetOrg, connection });
}

function enforceWritable(toolName) {
  if (isReadOnly()) {
    assertWritable(toolName);
  }
}

export function registerCrudTools(server) {
  server.tool(
    "sf_create_records",
    "Create records in a Salesforce object using jsforce.",
    CreateSchema,
    async (input) => {
      try {
        enforceWritable("sf_create_records");
        return await withConnection(input, async ({ targetOrg, connection }) => {
          assertMutationAllowed({
            toolName: "sf_create_records",
            targetOrg,
            confirm: input.confirm,
          });
          const result = await connection.sobject(input.objectName).create(input.records);
          return success({
            targetOrg,
            objectName: input.objectName,
            operation: "create",
            result,
          });
        });
      } catch (error) {
        return failure(error.message, error.context ?? null);
      }
    }
  );

  server.tool(
    "sf_update_records",
    "Update records in a Salesforce object using jsforce.",
    UpdateSchema,
    async (input) => {
      try {
        enforceWritable("sf_update_records");
        return await withConnection(input, async ({ targetOrg, connection }) => {
          assertMutationAllowed({
            toolName: "sf_update_records",
            targetOrg,
            confirm: input.confirm,
          });
          const result = await connection.sobject(input.objectName).update(input.records);
          return success({
            targetOrg,
            objectName: input.objectName,
            operation: "update",
            result,
          });
        });
      } catch (error) {
        return failure(error.message, error.context ?? null);
      }
    }
  );

  server.tool(
    "sf_delete_records",
    "Delete records in a Salesforce object using jsforce.",
    DeleteSchema,
    async (input) => {
      try {
        enforceWritable("sf_delete_records");
        return await withConnection(input, async ({ targetOrg, connection }) => {
          assertMutationAllowed({
            toolName: "sf_delete_records",
            targetOrg,
            confirm: input.confirm,
          });
          const result = await connection.sobject(input.objectName).destroy(input.ids);
          return success({
            targetOrg,
            objectName: input.objectName,
            operation: "delete",
            result,
          });
        });
      } catch (error) {
        return failure(error.message, error.context ?? null);
      }
    }
  );

  server.tool(
    "sf_upsert_records",
    "Upsert records in a Salesforce object using jsforce.",
    UpsertSchema,
    async (input) => {
      try {
        enforceWritable("sf_upsert_records");
        return await withConnection(input, async ({ targetOrg, connection }) => {
          assertMutationAllowed({
            toolName: "sf_upsert_records",
            targetOrg,
            confirm: input.confirm,
          });
          const result = await connection
            .sobject(input.objectName)
            .upsert(input.records, input.externalIdField);

          return success({
            targetOrg,
            objectName: input.objectName,
            operation: "upsert",
            externalIdField: input.externalIdField,
            result,
          });
        });
      } catch (error) {
        return failure(error.message, error.context ?? null);
      }
    }
  );
}
