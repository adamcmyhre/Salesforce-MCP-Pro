import { z } from "zod";
import {
  assertOrgAccess,
  assertWritable,
  isReadOnly,
} from "../config/permissions.js";
import { assertMutationAllowed } from "../config/safety.js";
import { failure, success } from "../lib/respond.js";
import { getJsforceConnection } from "../jsforce/connection.js";

const PostToRecordSchema = {
  recordId: z.string().min(1),
  message: z.string().min(1),
  targetOrg: z.string().optional(),
  directory: z.string().optional(),
  confirm: z.boolean().optional(),
};

const GetRecordFeedSchema = {
  recordId: z.string().min(1),
  pageSize: z.number().int().min(1).max(100).optional(),
  targetOrg: z.string().optional(),
  directory: z.string().optional(),
};

const PostToGroupSchema = {
  groupId: z.string().min(1),
  message: z.string().min(1),
  title: z.string().optional(),
  targetOrg: z.string().optional(),
  directory: z.string().optional(),
  confirm: z.boolean().optional(),
};

function buildMessageSegments(message) {
  return [
    {
      type: "Text",
      text: message,
    },
  ];
}

function buildGroupMessage(title, message) {
  const cleanTitle = title?.trim();
  if (!cleanTitle) {
    return message;
  }
  return `[${cleanTitle}] ${message}`;
}

async function requestPost(connection, path, payload) {
  if (typeof connection.requestPost === "function") {
    return connection.requestPost(path, payload);
  }

  return connection.request({
    method: "POST",
    url: path,
    body: payload,
  });
}

export function registerChatterTools(server) {
  server.tool(
    "sf_chatter_post_to_record",
    "Post a Chatter feed item to a Salesforce record feed.",
    PostToRecordSchema,
    async (input) => {
      try {
        if (isReadOnly()) {
          assertWritable("sf_chatter_post_to_record");
        }

        const { targetOrg, connection } = await getJsforceConnection(input.targetOrg, {
          cwd: input.directory,
        });
        assertOrgAccess(targetOrg);
        assertMutationAllowed({
          toolName: "sf_chatter_post_to_record",
          targetOrg,
          confirm: input.confirm,
        });

        const path = `/services/data/v${connection.version}/chatter/feed-elements`;
        const payload = {
          feedElementType: "FeedItem",
          subjectId: input.recordId,
          body: {
            messageSegments: buildMessageSegments(input.message),
          },
        };
        const result = await requestPost(connection, path, payload);

        return success({
          targetOrg,
          recordId: input.recordId,
          result,
        });
      } catch (error) {
        return failure(error.message, error.context ?? null);
      }
    }
  );

  server.tool(
    "sf_chatter_get_record_feed",
    "Get Chatter feed elements for a Salesforce record.",
    GetRecordFeedSchema,
    async (input) => {
      try {
        const { targetOrg, connection } = await getJsforceConnection(input.targetOrg, {
          cwd: input.directory,
        });
        assertOrgAccess(targetOrg);

        const pageSize = input.pageSize ?? 20;
        const recordId = encodeURIComponent(input.recordId);
        const path =
          `/services/data/v${connection.version}/chatter/feeds/record/${recordId}/feed-elements` +
          `?pageSize=${pageSize}&sort=createdDateDesc`;
        const result = await connection.request(path);

        return success({
          targetOrg,
          recordId: input.recordId,
          pageSize,
          result,
        });
      } catch (error) {
        return failure(error.message, error.context ?? null);
      }
    }
  );

  server.tool(
    "sf_chatter_post_to_group",
    "Post a Chatter feed item to a collaboration group.",
    PostToGroupSchema,
    async (input) => {
      try {
        if (isReadOnly()) {
          assertWritable("sf_chatter_post_to_group");
        }

        const { targetOrg, connection } = await getJsforceConnection(input.targetOrg, {
          cwd: input.directory,
        });
        assertOrgAccess(targetOrg);
        assertMutationAllowed({
          toolName: "sf_chatter_post_to_group",
          targetOrg,
          confirm: input.confirm,
        });

        const message = buildGroupMessage(input.title, input.message);
        const path = `/services/data/v${connection.version}/chatter/feed-elements`;
        const payload = {
          feedElementType: "FeedItem",
          subjectId: input.groupId,
          body: {
            messageSegments: buildMessageSegments(message),
          },
        };
        const result = await requestPost(connection, path, payload);

        return success({
          targetOrg,
          groupId: input.groupId,
          title: input.title ?? null,
          result,
        });
      } catch (error) {
        return failure(error.message, error.context ?? null);
      }
    }
  );
}
