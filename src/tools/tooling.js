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

const ImpactAnalyzeMetadataSchema = {
  metadataName: z.string().min(1),
  metadataType: z.string().optional(),
  includeManaged: z.boolean().optional(),
  stopAtTypes: z.array(z.string().min(1)).max(100).optional(),
  maxDepth: z.number().int().min(1).max(5).optional(),
  maxResultsPerDirection: z.number().int().min(1).max(1000).optional(),
  targetOrg: z.string().optional(),
  directory: z.string().optional(),
};

function escapeSoql(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function normalizeComponent({
  id,
  name,
  type,
  namespace,
}) {
  return {
    id: id ?? null,
    name: name ?? null,
    type: type ?? null,
    namespace: namespace ?? null,
  };
}

function dedupeComponents(components) {
  const seen = new Set();
  const deduped = [];
  for (const component of components) {
    const key = [
      component.id ?? "",
      component.type ?? "",
      component.name ?? "",
      component.namespace ?? "",
    ].join("|");
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(component);
  }
  return deduped;
}

function pickTargetComponentFromSeeds(seeds, metadataType) {
  if (seeds.length === 0) {
    return null;
  }

  const typedSeeds = metadataType
    ? seeds.filter((seed) => (seed.type ?? "").toLowerCase() === metadataType.toLowerCase())
    : seeds;
  const pool = typedSeeds.length > 0 ? typedSeeds : seeds;

  const frequency = new Map();
  for (const seed of pool) {
    const key = [seed.id ?? "", seed.type ?? "", seed.name ?? "", seed.namespace ?? ""].join("|");
    const count = frequency.get(key) ?? 0;
    frequency.set(key, count + 1);
  }

  let best = pool[0];
  let bestCount = -1;
  for (const seed of pool) {
    const key = [seed.id ?? "", seed.type ?? "", seed.name ?? "", seed.namespace ?? ""].join("|");
    const count = frequency.get(key) ?? 0;
    if (count > bestCount) {
      best = seed;
      bestCount = count;
    }
  }

  return best;
}

function getDependencyQueryFields() {
  return (
    "MetadataComponentId, MetadataComponentName, MetadataComponentType, MetadataComponentNamespace, " +
    "RefMetadataComponentId, RefMetadataComponentName, RefMetadataComponentType, RefMetadataComponentNamespace"
  );
}

function chunkArray(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function componentKey(component) {
  return [
    component.id ?? "",
    component.type ?? "",
    component.name ?? "",
    component.namespace ?? "",
  ].join("|");
}

function summarizeComponentsByType(components) {
  const counts = new Map();
  for (const component of components) {
    const type = component.type ?? "Unknown";
    counts.set(type, (counts.get(type) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));
}

async function traverseDependencyDirection({
  connection,
  dependencyFields,
  targetId,
  direction,
  stopAtTypes,
  maxDepth,
  maxResultsPerDirection,
  includeManaged,
}) {
  const whereField =
    direction === "dependsOn" ? "MetadataComponentId" : "RefMetadataComponentId";
  const rowToComponent =
    direction === "dependsOn"
      ? (row) =>
          normalizeComponent({
            id: row.RefMetadataComponentId,
            name: row.RefMetadataComponentName,
            type: row.RefMetadataComponentType,
            namespace: row.RefMetadataComponentNamespace,
          })
      : (row) =>
          normalizeComponent({
            id: row.MetadataComponentId,
            name: row.MetadataComponentName,
            type: row.MetadataComponentType,
            namespace: row.MetadataComponentNamespace,
          });

  const visitedExpandIds = new Set();
  const seenComponentKeys = new Set();
  const results = [];
  const normalizedStopAtTypes = new Set(
    (stopAtTypes ?? []).map((value) => String(value).trim().toLowerCase()).filter(Boolean)
  );
  let frontier = [targetId];
  let depth = 1;
  let truncated = false;
  let queriesExecuted = 0;

  while (frontier.length > 0 && depth <= maxDepth && results.length < maxResultsPerDirection) {
    const nextFrontier = new Set();
    const frontierToExpand = frontier.filter((id) => id && !visitedExpandIds.has(id));

    if (frontierToExpand.length === 0) {
      break;
    }

    const batches = chunkArray(frontierToExpand, 100);
    for (const batch of batches) {
      if (results.length >= maxResultsPerDirection) {
        truncated = true;
        break;
      }

      const inClause = batch.map((id) => `'${escapeSoql(id)}'`).join(", ");
      const remaining = maxResultsPerDirection - results.length;
      const query =
        `SELECT ${dependencyFields} FROM MetadataComponentDependency ` +
        `WHERE ${whereField} IN (${inClause}) LIMIT ${remaining}`;
      const queryResult = await connection.tooling.query(query);
      queriesExecuted += 1;

      for (const row of queryResult.records ?? []) {
        if (results.length >= maxResultsPerDirection) {
          truncated = true;
          break;
        }

        const component = rowToComponent(row);
        if (!component.id || component.id === targetId) {
          continue;
        }
        if (!includeManaged && component.namespace) {
          continue;
        }

        const key = componentKey(component);
        if (!seenComponentKeys.has(key)) {
          seenComponentKeys.add(key);
          results.push({
            ...component,
            depth,
            traversalStopped: normalizedStopAtTypes.has(
              String(component.type ?? "").toLowerCase()
            ),
          });
        }

        const shouldStopExpansion = normalizedStopAtTypes.has(
          String(component.type ?? "").toLowerCase()
        );
        if (!shouldStopExpansion && !visitedExpandIds.has(component.id)) {
          nextFrontier.add(component.id);
        }
      }
    }

    for (const id of frontierToExpand) {
      visitedExpandIds.add(id);
    }

    frontier = [...nextFrontier];
    depth += 1;
  }

  return {
    components: results,
    truncated,
    queriesExecuted,
    reachedDepth: Math.max(0, depth - 1),
  };
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

  server.tool(
    "sf_impact_analyze_metadata",
    "Analyze metadata dependency impact (dependsOn and referencedBy) for a component.",
    ImpactAnalyzeMetadataSchema,
    async (input) => {
      try {
        const { targetOrg, connection } = await getJsforceConnection(input.targetOrg, {
          cwd: input.directory,
        });
        assertOrgAccess(targetOrg);

        const metadataName = input.metadataName.trim();
        const escapedName = escapeSoql(metadataName);
        const maxDepth = input.maxDepth ?? 1;
        const maxResultsPerDirection = input.maxResultsPerDirection ?? 200;
        const includeManaged = input.includeManaged === true;
        const stopAtTypes = input.stopAtTypes ?? [];
        const escapedType = input.metadataType?.trim()
          ? escapeSoql(input.metadataType.trim())
          : null;
        const dependencyFields = getDependencyQueryFields();

        const seedTypeClause = escapedType
          ? ` AND (MetadataComponentType = '${escapedType}' OR RefMetadataComponentType = '${escapedType}')`
          : "";
        const seedQuery =
          `SELECT ${dependencyFields} FROM MetadataComponentDependency ` +
          `WHERE (MetadataComponentName = '${escapedName}' OR RefMetadataComponentName = '${escapedName}')` +
          seedTypeClause +
          " LIMIT 2000";
        const seedResult = await connection.tooling.query(seedQuery);

        const seeds = [];
        for (const row of seedResult.records ?? []) {
          if (row.MetadataComponentName === metadataName) {
            seeds.push(
              normalizeComponent({
                id: row.MetadataComponentId,
                name: row.MetadataComponentName,
                type: row.MetadataComponentType,
                namespace: row.MetadataComponentNamespace,
              })
            );
          }
          if (row.RefMetadataComponentName === metadataName) {
            seeds.push(
              normalizeComponent({
                id: row.RefMetadataComponentId,
                name: row.RefMetadataComponentName,
                type: row.RefMetadataComponentType,
                namespace: row.RefMetadataComponentNamespace,
              })
            );
          }
        }

        const targetComponent = pickTargetComponentFromSeeds(seeds, input.metadataType);
        if (!targetComponent?.id) {
          throw new Error(
            `Could not resolve metadata component "${input.metadataName}"` +
              (input.metadataType ? ` of type "${input.metadataType}"` : "") +
              " from MetadataComponentDependency."
          );
        }

        const [dependsOnTraversal, referencedByTraversal] = await Promise.all([
          traverseDependencyDirection({
            connection,
            dependencyFields,
            targetId: targetComponent.id,
            direction: "dependsOn",
            stopAtTypes,
            maxDepth,
            maxResultsPerDirection,
            includeManaged,
          }),
          traverseDependencyDirection({
            connection,
            dependencyFields,
            targetId: targetComponent.id,
            direction: "referencedBy",
            stopAtTypes,
            maxDepth,
            maxResultsPerDirection,
            includeManaged,
          }),
        ]);

        const dependsOn = dedupeComponents(dependsOnTraversal.components);
        const referencedBy = dedupeComponents(referencedByTraversal.components);
        const blastRadius = dedupeComponents([...dependsOn, ...referencedBy]);

        return success({
          targetOrg,
          targetComponent,
          filters: {
            metadataName: input.metadataName,
            metadataType: input.metadataType ?? null,
            includeManaged,
            stopAtTypes,
            maxDepth,
            maxResultsPerDirection,
          },
          summary: {
            dependsOnCount: dependsOn.length,
            referencedByCount: referencedBy.length,
            blastRadiusCount: blastRadius.length,
            seedMatchCount: seeds.length,
            dependsOnByType: summarizeComponentsByType(dependsOn),
            referencedByByType: summarizeComponentsByType(referencedBy),
            blastRadiusByType: summarizeComponentsByType(blastRadius),
            dependsOnTruncated: dependsOnTraversal.truncated,
            referencedByTruncated: referencedByTraversal.truncated,
            dependsOnReachedDepth: dependsOnTraversal.reachedDepth,
            referencedByReachedDepth: referencedByTraversal.reachedDepth,
            totalTraversalQueries:
              dependsOnTraversal.queriesExecuted + referencedByTraversal.queriesExecuted,
          },
          dependsOn,
          referencedBy,
          notes: [
            "Uses Tooling API MetadataComponentDependency edges.",
            "If multiple components share the same name, metadataType improves target resolution.",
            "Set maxDepth > 1 to expand transitive dependencies and blast radius.",
            "Components whose type is listed in stopAtTypes are included in results but not traversed further.",
          ],
        });
      } catch (error) {
        return failure(error.message, error.context ?? null);
      }
    }
  );
}
