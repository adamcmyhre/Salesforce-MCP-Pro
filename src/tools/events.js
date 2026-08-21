import { z } from "zod";
import {
  assertOrgAccess,
  assertWritable,
  isReadOnly,
} from "../config/permissions.js";
import { assertMutationAllowed } from "../config/safety.js";
import { failure, success } from "../lib/respond.js";
import { getJsforceConnection } from "../jsforce/connection.js";

const PublishPlatformEventSchema = {
  eventApiName: z.string().min(1),
  payload: z.record(z.unknown()).optional(),
  events: z.array(z.record(z.unknown())).min(1).max(200).optional(),
  targetOrg: z.string().optional(),
  directory: z.string().optional(),
  confirm: z.boolean().optional(),
};

const PlatformEventFieldSchema = z.object({
  fullName: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(["Text", "LongTextArea", "Number", "Checkbox", "Date", "DateTime"]),
  description: z.string().optional(),
  required: z.boolean().optional(),
  length: z.number().int().min(1).max(131072).optional(),
  visibleLines: z.number().int().min(1).max(1000).optional(),
  precision: z.number().int().min(1).max(18).optional(),
  scale: z.number().int().min(0).max(18).optional(),
  defaultValue: z.string().optional(),
});

const CreatePlatformEventDefinitionSchema = {
  eventApiName: z.string().min(1),
  label: z.string().min(1),
  pluralLabel: z.string().optional(),
  description: z.string().optional(),
  publishBehavior: z.enum(["PublishImmediately", "PublishAfterCommit"]).optional(),
  eventType: z.enum(["HighVolume"]).optional(),
  fields: z.array(PlatformEventFieldSchema).max(100).optional(),
  targetOrg: z.string().optional(),
  directory: z.string().optional(),
  confirm: z.boolean().optional(),
};

function normalizeEventApiName(value) {
  const apiName = String(value ?? "").trim();
  if (!apiName.endsWith("__e")) {
    throw new Error(
      `Invalid eventApiName "${value}". Platform Event API names must end with "__e".`
    );
  }
  return apiName;
}

function resolveEventRecords(input) {
  if (Array.isArray(input.events) && input.events.length > 0) {
    return input.events;
  }
  if (input.payload && typeof input.payload === "object") {
    return [input.payload];
  }
  throw new Error("Provide either payload or events.");
}

function toArray(value) {
  return Array.isArray(value) ? value : value ? [value] : [];
}

function toFieldApiName(value) {
  const trimmed = String(value ?? "").trim();
  return trimmed.endsWith("__c") ? trimmed : `${trimmed}__c`;
}

function ensureFieldTypeOptions(field) {
  if (field.type === "Text" && field.length === undefined) {
    return { ...field, length: 255 };
  }
  if (field.type === "LongTextArea") {
    return {
      ...field,
      length: field.length ?? 32768,
      visibleLines: field.visibleLines ?? 3,
    };
  }
  if (field.type === "Number") {
    return {
      ...field,
      precision: field.precision ?? 18,
      scale: field.scale ?? 0,
    };
  }
  return field;
}

function normalizePlatformEventFieldMetadata(inputField) {
  const field = ensureFieldTypeOptions(inputField);
  return {
    fullName: toFieldApiName(field.fullName),
    label: String(field.label).trim(),
    type: field.type,
    description: field.description?.trim() || undefined,
    required: field.required === true,
    length: field.length,
    visibleLines: field.visibleLines,
    precision: field.precision,
    scale: field.scale,
    defaultValue: field.defaultValue,
    externalId: false,
    isFilteringDisabled: false,
    isNameField: false,
    isSortingDisabled: false,
  };
}

function buildPlatformEventMetadata(input) {
  const eventApiName = normalizeEventApiName(input.eventApiName);
  const label = String(input.label).trim();
  const pluralLabel = input.pluralLabel?.trim() || `${label}s`;
  const fields = (input.fields ?? []).map(normalizePlatformEventFieldMetadata);

  return {
    fullName: eventApiName,
    deploymentStatus: "Deployed",
    eventType: input.eventType ?? "HighVolume",
    label,
    pluralLabel,
    description: input.description?.trim() || undefined,
    publishBehavior: input.publishBehavior ?? "PublishImmediately",
    fields,
  };
}

export function registerEventsTools(server) {
  server.tool(
    "sf_create_platform_event_definition",
    "Create a Salesforce Platform Event definition (__e), optionally with custom fields.",
    CreatePlatformEventDefinitionSchema,
    async (input) => {
      try {
        if (isReadOnly()) {
          assertWritable("sf_create_platform_event_definition");
        }

        const metadata = buildPlatformEventMetadata(input);
        const { targetOrg, connection } = await getJsforceConnection(input.targetOrg, {
          cwd: input.directory,
        });
        assertOrgAccess(targetOrg);
        assertMutationAllowed({
          toolName: "sf_create_platform_event_definition",
          targetOrg,
          confirm: input.confirm,
        });

        const result = await connection.metadata.create("CustomObject", metadata);
        const normalizedResult = toArray(result);
        const successCount = normalizedResult.filter((entry) => entry?.success === true).length;

        return success({
          targetOrg,
          eventApiName: metadata.fullName,
          label: metadata.label,
          pluralLabel: metadata.pluralLabel,
          publishBehavior: metadata.publishBehavior,
          eventType: metadata.eventType,
          fieldCount: metadata.fields.length,
          created: successCount > 0,
          result,
        });
      } catch (error) {
        return failure(error.message, error.context ?? null);
      }
    }
  );

  server.tool(
    "sf_publish_platform_event",
    "Publish one or more Salesforce Platform Event messages.",
    PublishPlatformEventSchema,
    async (input) => {
      try {
        if (isReadOnly()) {
          assertWritable("sf_publish_platform_event");
        }

        const eventApiName = normalizeEventApiName(input.eventApiName);
        const eventRecords = resolveEventRecords(input);
        const { targetOrg, connection } = await getJsforceConnection(input.targetOrg, {
          cwd: input.directory,
        });
        assertOrgAccess(targetOrg);
        assertMutationAllowed({
          toolName: "sf_publish_platform_event",
          targetOrg,
          confirm: input.confirm,
        });

        const publishResult = await connection.sobject(eventApiName).create(eventRecords);
        const results = toArray(publishResult);
        const successCount = results.filter((entry) => entry?.success === true).length;

        return success({
          targetOrg,
          eventApiName,
          requested: eventRecords.length,
          published: successCount,
          failed: Math.max(eventRecords.length - successCount, 0),
          result: publishResult,
        });
      } catch (error) {
        return failure(error.message, error.context ?? null);
      }
    }
  );
}
