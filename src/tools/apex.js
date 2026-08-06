import { z } from "zod";
import {
  assertOrgAccess,
  assertWritable,
  isReadOnly,
} from "../config/permissions.js";
import { assertMutationAllowed } from "../config/safety.js";
import { failure, success } from "../lib/respond.js";
import { getJsforceConnection } from "../jsforce/connection.js";

const ExecuteAnonymousSchema = {
  apexCode: z.string().min(1),
  targetOrg: z.string().optional(),
  directory: z.string().optional(),
  confirm: z.boolean().optional(),
};

const BuildApexCursorQuerySchema = {
  soqlQuery: z.string().optional(),
  objectName: z.string().optional(),
  fields: z.array(z.string().min(1)).optional(),
  whereClause: z.string().optional(),
  orderBy: z.string().optional(),
  limit: z.number().int().min(1).max(50000000).optional(),
  accessLevel: z.enum(["USER_MODE", "SYSTEM_MODE"]).optional(),
  fetchSize: z.number().int().min(1).max(2000).optional(),
  startPosition: z.number().int().min(0).optional(),
  cursorVariableName: z.string().optional(),
  recordsVariableName: z.string().optional(),
  usePaginationCursor: z.boolean().optional(),
  includeQueueableSkeleton: z.boolean().optional(),
};

const ExecuteApexCursorQuerySchema = {
  ...BuildApexCursorQuerySchema,
  targetOrg: z.string().optional(),
  directory: z.string().optional(),
  confirm: z.boolean().optional(),
};

const ScheduleApexJobSchema = {
  className: z.string().min(1),
  jobName: z.string().min(1),
  cronExpression: z.string().min(1),
  targetOrg: z.string().optional(),
  directory: z.string().optional(),
  confirm: z.boolean().optional(),
};

const UnscheduleApexJobSchema = {
  jobId: z.string().optional(),
  jobName: z.string().optional(),
  abortAllMatches: z.boolean().optional(),
  targetOrg: z.string().optional(),
  directory: z.string().optional(),
  confirm: z.boolean().optional(),
};

const ExecuteBatchJobSchema = {
  batchClassName: z.string().min(1),
  scopeSize: z.number().int().min(1).max(2000).optional(),
  targetOrg: z.string().optional(),
  directory: z.string().optional(),
  confirm: z.boolean().optional(),
};

function escapeForApexString(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function normalizeIdentifier(value, fallback) {
  const candidate = String(value ?? "").trim();
  if (!candidate) {
    return fallback;
  }

  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(candidate)) {
    throw new Error(
      `Invalid identifier "${candidate}". Use only letters, numbers, and underscore, starting with a letter or underscore.`
    );
  }
  return candidate;
}

function normalizeApexTypeName(value, fieldName) {
  const candidate = String(value ?? "").trim();
  if (!candidate) {
    throw new Error(`${fieldName} is required.`);
  }

  if (!/^[A-Za-z_][A-Za-z0-9_.]*$/.test(candidate)) {
    throw new Error(
      `${fieldName} contains invalid characters. Use an Apex class name (letters, numbers, underscore, optional namespace dot).`
    );
  }

  return candidate;
}

function buildSoqlFromParts(input) {
  if (input.soqlQuery?.trim()) {
    return input.soqlQuery.trim();
  }

  if (!input.objectName?.trim()) {
    throw new Error("Provide either soqlQuery or objectName.");
  }

  const fields = input.fields?.length ? input.fields : ["Id"];
  const parts = [`SELECT ${fields.join(", ")} FROM ${input.objectName.trim()}`];

  if (input.whereClause?.trim()) {
    parts.push(`WHERE ${input.whereClause.trim()}`);
  }

  if (input.orderBy?.trim()) {
    parts.push(`ORDER BY ${input.orderBy.trim()}`);
  }

  if (input.limit !== undefined) {
    parts.push(`LIMIT ${input.limit}`);
  }

  return parts.join(" ");
}

function buildStandardCursorApex(input, soqlQuery) {
  const cursorVar = normalizeIdentifier(input.cursorVariableName, "cursor");
  const recordsVar = normalizeIdentifier(input.recordsVariableName, "chunk");
  const fetchSize = input.fetchSize ?? 200;
  const startPosition = input.startPosition ?? 0;
  const accessLevelArg = input.accessLevel ? `, AccessLevel.${input.accessLevel}` : "";
  const escapedSoql = escapeForApexString(soqlQuery);

  let code = `String soql = '${escapedSoql}';
Database.Cursor ${cursorVar} = Database.getCursor(soql${accessLevelArg});
Integer totalRecords = ${cursorVar}.getNumRecords();
Integer position = ${startPosition};
Integer chunkSize = ${fetchSize};

while (position < totalRecords) {
    List<SObject> ${recordsVar} = ${cursorVar}.fetch(position, chunkSize);
    if (${recordsVar}.isEmpty()) {
        break;
    }

    // TODO: process ${recordsVar}

    position += ${recordsVar}.size();
}
`;

  if (input.includeQueueableSkeleton) {
    code += `
// Optional queueable skeleton for chunked processing:
public with sharing class CursorProcessorJob implements Queueable {
    private Integer position;

    public CursorProcessorJob(Integer position) {
        this.position = position;
    }

    public void execute(QueueableContext context) {
        Database.Cursor cursor = Database.getCursor(soql${accessLevelArg});
        Integer total = cursor.getNumRecords();
        List<SObject> rows = cursor.fetch(position, chunkSize);
        if (rows.isEmpty()) return;
        // TODO: process rows
        Integer nextPosition = position + rows.size();
        if (nextPosition < total) {
            System.enqueueJob(new CursorProcessorJob(nextPosition));
        }
    }
}
`;
  }

  return code;
}

function buildPaginationCursorApex(input, soqlQuery) {
  const cursorVar = normalizeIdentifier(input.cursorVariableName, "paginationCursor");
  const recordsVar = normalizeIdentifier(input.recordsVariableName, "pageRecords");
  const pageSize = input.fetchSize ?? 200;
  const startPosition = input.startPosition ?? 0;
  const escapedSoql = escapeForApexString(soqlQuery);

  return `String soql = '${escapedSoql}';
Database.PaginationCursor ${cursorVar} = Database.getPaginationCursor(soql);
Integer nextIndex = ${startPosition};
Integer pageSize = ${pageSize};
Boolean done = false;

while (!done) {
    Database.CursorFetchResult pageResult = ${cursorVar}.fetchPage(nextIndex, pageSize);
    List<SObject> ${recordsVar} = pageResult.getRecords();
    Integer skippedDeletedRows = pageResult.getDeletedRows();

    // TODO: process ${recordsVar}
    // Optionally inspect skippedDeletedRows

    nextIndex = pageResult.getNextIndex();
    done = pageResult.isDone();
}
`;
}

function buildScheduleApexCode(input) {
  const className = normalizeApexTypeName(input.className, "className");
  const jobName = escapeForApexString(input.jobName);
  const cronExpression = escapeForApexString(input.cronExpression);

  return `String scheduledJobId = System.schedule('${jobName}', '${cronExpression}', new ${className}());
System.debug('SCHEDULED_JOB_ID=' + scheduledJobId);`;
}

function buildUnscheduleApexCode(input) {
  if (input.jobId?.trim()) {
    const jobId = escapeForApexString(input.jobId.trim());
    return `System.abortJob('${jobId}');
System.debug('ABORTED_JOB_ID=${jobId}');`;
  }

  const jobName = input.jobName?.trim();
  if (!jobName) {
    throw new Error("Provide jobId or jobName.");
  }

  const escapedJobName = escapeForApexString(jobName);
  const abortAllMatches = input.abortAllMatches === true;
  const limitClause = abortAllMatches ? "" : " LIMIT 1";

  return `List<CronTrigger> jobsToAbort = [
    SELECT Id, CronJobDetail.Name
    FROM CronTrigger
    WHERE CronJobDetail.Name = '${escapedJobName}'
      AND State != 'DELETED'
${limitClause}
];

Integer aborted = 0;
for (CronTrigger job : jobsToAbort) {
    System.abortJob(job.Id);
    aborted++;
}

System.debug('ABORTED_COUNT=' + aborted);`;
}

function buildExecuteBatchApexCode(input) {
  const batchClassName = normalizeApexTypeName(input.batchClassName, "batchClassName");
  const scopeSizeArgument = input.scopeSize ? `, ${input.scopeSize}` : "";

  return `Id batchJobId = Database.executeBatch(new ${batchClassName}()${scopeSizeArgument});
System.debug('BATCH_JOB_ID=' + batchJobId);`;
}

async function executeAnonymous(connection, apexCode) {
  if (typeof connection.tooling?.executeAnonymous === "function") {
    return connection.tooling.executeAnonymous(apexCode);
  }

  const path = `/services/data/v${connection.version}/tooling/executeAnonymous/?anonymousBody=${encodeURIComponent(
    apexCode
  )}`;
  return connection.request(path);
}

async function executeAnonymousWithSafety(input, toolName, apexCode) {
  if (isReadOnly()) {
    assertWritable(toolName);
  }

  const { targetOrg, connection } = await getJsforceConnection(input.targetOrg, {
    cwd: input.directory,
  });
  assertOrgAccess(targetOrg);
  assertMutationAllowed({
    toolName,
    targetOrg,
    confirm: input.confirm,
  });

  const result = await executeAnonymous(connection, apexCode);
  return {
    targetOrg,
    result,
  };
}

export function registerApexTools(server) {
  server.tool(
    "sf_schedule_apex_job",
    "Schedule a Schedulable Apex class using a cron expression.",
    ScheduleApexJobSchema,
    async (input) => {
      try {
        const apexCode = buildScheduleApexCode(input);
        const { targetOrg, result } = await executeAnonymousWithSafety(
          input,
          "sf_schedule_apex_job",
          apexCode
        );

        return success({
          targetOrg,
          apexCode,
          result,
          notes: [
            "Ensure className implements Schedulable.",
            "Use sf_unschedule_apex_job with jobId or jobName to abort it later.",
          ],
        });
      } catch (error) {
        return failure(error.message, error.context ?? null);
      }
    }
  );

  server.tool(
    "sf_unschedule_apex_job",
    "Unschedule one or more scheduled jobs by jobId or jobName.",
    UnscheduleApexJobSchema,
    async (input) => {
      try {
        const apexCode = buildUnscheduleApexCode(input);
        const { targetOrg, result } = await executeAnonymousWithSafety(
          input,
          "sf_unschedule_apex_job",
          apexCode
        );

        return success({
          targetOrg,
          apexCode,
          result,
          notes: [
            "Provide jobId for a precise abort.",
            "When only jobName is provided, set abortAllMatches=true to abort every matching schedule.",
          ],
        });
      } catch (error) {
        return failure(error.message, error.context ?? null);
      }
    }
  );

  server.tool(
    "sf_execute_batch_job",
    "Run an Apex batch class immediately via Database.executeBatch.",
    ExecuteBatchJobSchema,
    async (input) => {
      try {
        const apexCode = buildExecuteBatchApexCode(input);
        const { targetOrg, result } = await executeAnonymousWithSafety(
          input,
          "sf_execute_batch_job",
          apexCode
        );

        return success({
          targetOrg,
          apexCode,
          result,
          notes: [
            "Ensure batchClassName implements Database.Batchable.",
            "Batch class must support a no-arg constructor for this tool.",
          ],
        });
      } catch (error) {
        return failure(error.message, error.context ?? null);
      }
    }
  );

  server.tool(
    "sf_execute_anonymous_apex",
    "Execute anonymous Apex in the target org.",
    ExecuteAnonymousSchema,
    async (input) => {
      try {
        const { targetOrg, result } = await executeAnonymousWithSafety(
          input,
          "sf_execute_anonymous_apex",
          input.apexCode
        );
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
    "sf_execute_apex_cursor_query",
    "Build Apex cursor query code and execute it via anonymous Apex in one step.",
    ExecuteApexCursorQuerySchema,
    async (input) => {
      try {
        const soqlQuery = buildSoqlFromParts(input);
        const usePaginationCursor = input.usePaginationCursor === true;
        const apexCode = usePaginationCursor
          ? buildPaginationCursorApex(input, soqlQuery)
          : buildStandardCursorApex(input, soqlQuery);

        const execution = await executeAnonymousWithSafety(
          input,
          "sf_execute_apex_cursor_query",
          apexCode
        );

        return success({
          cursorType: usePaginationCursor ? "pagination" : "standard",
          soqlQuery,
          apexCode,
          targetOrg: execution.targetOrg,
          executionResult: execution.result,
          notes: [
            "Executed via anonymous Apex.",
            "Cursor fetch calls count against SOQL query and row limits.",
          ],
        });
      } catch (error) {
        return failure(error.message, error.context ?? null);
      }
    }
  );

  server.tool(
    "sf_build_apex_cursor_query",
    "Build SOQL and Apex cursor code templates for large-record processing.",
    BuildApexCursorQuerySchema,
    async (input) => {
      try {
        const soqlQuery = buildSoqlFromParts(input);
        const usePaginationCursor = input.usePaginationCursor === true;
        const apexCode = usePaginationCursor
          ? buildPaginationCursorApex(input, soqlQuery)
          : buildStandardCursorApex(input, soqlQuery);

        return success({
          cursorType: usePaginationCursor ? "pagination" : "standard",
          soqlQuery,
          apexCode,
          notes: [
            "Cursor.fetch() and PaginationCursor.fetchPage() count against SOQL query and row limits.",
            "Standard cursor max fetch size per call is 2000 rows.",
            "Track and persist position/nextIndex across async retries when needed.",
          ],
        });
      } catch (error) {
        return failure(error.message, error.context ?? null);
      }
    }
  );
}
