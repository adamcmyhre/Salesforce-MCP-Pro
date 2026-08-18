import { z } from "zod";
import { failure, success } from "../lib/respond.js";

const RECIPES_OWNER = "trailheadapps";
const RECIPES_REPO = "lwc-recipes";
const RECIPES_BRANCH = "main";
const LWC_ROOT = "force-app/main/default/lwc";
const CACHE_TTL_MS = 10 * 60 * 1000;

const RecipesSearchSchema = {
  query: z.string().min(1),
  limit: z.number().int().min(1).max(100).optional(),
  includeFileNameSearch: z.boolean().optional(),
};

const RecipesGetComponentSchema = {
  componentName: z.string().min(1),
  includeContent: z.boolean().optional(),
};

const cache = new Map();

function getCache(key) {
  const item = cache.get(key);
  if (!item) {
    return null;
  }
  if (Date.now() - item.createdAt > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return item.value;
}

function setCache(key, value) {
  cache.set(key, { value, createdAt: Date.now() });
}

function getGitHubHeaders() {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "salesforce-mcp-pro",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

async function githubFetchJson(url) {
  const response = await fetch(url, {
    headers: getGitHubHeaders(),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub API request failed (${response.status}): ${body}`);
  }
  return response.json();
}

function decodeBase64(value) {
  return Buffer.from(value, "base64").toString("utf8");
}

async function listLwcComponentFolders() {
  const cacheKey = "lwc-recipes:components";
  const cached = getCache(cacheKey);
  if (cached) {
    return cached;
  }

  const url = `https://api.github.com/repos/${RECIPES_OWNER}/${RECIPES_REPO}/contents/${LWC_ROOT}?ref=${RECIPES_BRANCH}`;
  const entries = await githubFetchJson(url);
  const folders = entries
    .filter((entry) => entry.type === "dir")
    .map((entry) => ({
      name: entry.name,
      path: entry.path,
      url: entry.url,
      htmlUrl: entry.html_url,
    }));

  setCache(cacheKey, folders);
  return folders;
}

async function listComponentFiles(componentName) {
  const cacheKey = `lwc-recipes:component-files:${componentName}`;
  const cached = getCache(cacheKey);
  if (cached) {
    return cached;
  }

  const safeComponentName = encodeURIComponent(componentName);
  const url = `https://api.github.com/repos/${RECIPES_OWNER}/${RECIPES_REPO}/contents/${LWC_ROOT}/${safeComponentName}?ref=${RECIPES_BRANCH}`;
  const entries = await githubFetchJson(url);
  const files = entries
    .filter((entry) => entry.type === "file")
    .map((entry) => ({
      name: entry.name,
      path: entry.path,
      size: entry.size,
      downloadUrl: entry.download_url,
      htmlUrl: entry.html_url,
      apiUrl: entry.url,
    }));

  setCache(cacheKey, files);
  return files;
}

function scoreMatch(query, component, includeFileNameSearch, fileNames) {
  const q = query.toLowerCase();
  let score = 0;

  if (component.name.toLowerCase() === q) score += 100;
  if (component.name.toLowerCase().includes(q)) score += 50;
  if (component.path.toLowerCase().includes(q)) score += 20;

  if (includeFileNameSearch) {
    for (const fileName of fileNames) {
      if (fileName.toLowerCase().includes(q)) {
        score += 10;
      }
    }
  }

  return score;
}

async function getComponentContent(file) {
  const cacheKey = `lwc-recipes:file-content:${file.path}`;
  const cached = getCache(cacheKey);
  if (cached) {
    return cached;
  }

  const filePayload = await githubFetchJson(file.apiUrl);
  const content = decodeBase64(filePayload.content ?? "");
  const result = {
    ...file,
    content,
  };
  setCache(cacheKey, result);
  return result;
}

export function registerLwcRecipesTools(server) {
  server.tool(
    "sf_lwc_recipes_search",
    "Search remote LWC recipes components from trailheadapps/lwc-recipes.",
    RecipesSearchSchema,
    async (input) => {
      try {
        const query = input.query.trim();
        const limit = input.limit ?? 20;
        const includeFileNameSearch = input.includeFileNameSearch === true;

        const components = await listLwcComponentFolders();
        const scored = [];

        for (const component of components) {
          const files = includeFileNameSearch
            ? await listComponentFiles(component.name)
            : [];
          const fileNames = files.map((file) => file.name);
          const score = scoreMatch(query, component, includeFileNameSearch, fileNames);
          if (score > 0) {
            scored.push({
              componentName: component.name,
              path: component.path,
              fileNames,
              score,
              url: component.htmlUrl,
            });
          }
        }

        scored.sort(
          (a, b) => b.score - a.score || a.componentName.localeCompare(b.componentName)
        );

        return success({
          query,
          totalMatches: scored.length,
          results: scored.slice(0, limit),
          source: `https://github.com/${RECIPES_OWNER}/${RECIPES_REPO}`,
          cachedForSeconds: CACHE_TTL_MS / 1000,
        });
      } catch (error) {
        return failure(error.message);
      }
    }
  );

  server.tool(
    "sf_lwc_recipes_get_component",
    "Fetch file list and optional file contents for one LWC recipe component.",
    RecipesGetComponentSchema,
    async (input) => {
      try {
        const componentName = input.componentName.trim();
        const files = await listComponentFiles(componentName);

        const selectedFiles =
          input.includeContent === true
            ? await Promise.all(files.map((file) => getComponentContent(file)))
            : files;

        return success({
          componentName,
          componentPath: `${LWC_ROOT}/${componentName}`,
          fileCount: selectedFiles.length,
          files: selectedFiles,
          source: `https://github.com/${RECIPES_OWNER}/${RECIPES_REPO}/tree/${RECIPES_BRANCH}/${LWC_ROOT}/${componentName}`,
        });
      } catch (error) {
        return failure(error.message);
      }
    }
  );
}
