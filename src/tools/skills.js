import { z } from "zod";
import { failure, success } from "../lib/respond.js";

const SKILLS_OWNER = "forcedotcom";
const SKILLS_REPO = "sf-skills";
const SKILLS_BRANCH = "main";
const SKILLS_ROOT = "skills";
const CACHE_TTL_MS = 10 * 60 * 1000;

const SkillsSearchSchema = {
  query: z.string().min(1),
  limit: z.number().int().min(1).max(100).optional(),
  includeContentSearch: z.boolean().optional(),
};

const SkillsGetSchema = {
  skillName: z.string().min(1),
  includeReferences: z.boolean().optional(),
};

const SkillsListDomainsSchema = {
  limitPerDomain: z.number().int().min(1).max(20).optional(),
};

const cache = new Map();

function getCache(key) {
  const item = cache.get(key);
  if (!item) return null;
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

function contentFromBase64(base64Value) {
  return Buffer.from(base64Value, "base64").toString("utf8");
}

function getSummaryFromMarkdown(markdown) {
  const lines = markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  for (const line of lines) {
    if (!line.startsWith("#")) {
      return line.slice(0, 240);
    }
  }
  return "";
}

async function listSkillsFolders() {
  const cacheKey = "skills:list";
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const url = `https://api.github.com/repos/${SKILLS_OWNER}/${SKILLS_REPO}/contents/${SKILLS_ROOT}?ref=${SKILLS_BRANCH}`;
  const entries = await githubFetchJson(url);
  const folders = entries
    .filter((entry) => entry.type === "dir")
    .map((entry) => ({
      name: entry.name,
      path: entry.path,
      htmlUrl: entry.html_url,
      url: entry.url,
    }));

  setCache(cacheKey, folders);
  return folders;
}

async function getSkillMarkdown(skillName) {
  const cacheKey = `skill:${skillName}:md`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const encodedName = encodeURIComponent(skillName);
  const url = `https://api.github.com/repos/${SKILLS_OWNER}/${SKILLS_REPO}/contents/${SKILLS_ROOT}/${encodedName}/SKILL.md?ref=${SKILLS_BRANCH}`;
  const file = await githubFetchJson(url);
  const markdown = contentFromBase64(file.content);
  const result = {
    skillName,
    markdown,
    summary: getSummaryFromMarkdown(markdown),
    sourceUrl: file.html_url,
  };
  setCache(cacheKey, result);
  return result;
}

function scoreSkill(query, skill, markdownSummary, includeContentSearch) {
  const q = query.toLowerCase();
  let score = 0;
  if (skill.name.toLowerCase() === q) score += 100;
  if (skill.name.toLowerCase().includes(q)) score += 40;
  if (skill.path.toLowerCase().includes(q)) score += 20;
  if (includeContentSearch && markdownSummary?.toLowerCase().includes(q)) score += 15;
  return score;
}

function inferDomain(skillName) {
  const index = skillName.indexOf("-");
  return index > 0 ? skillName.slice(0, index) : "other";
}

async function listSkillReferenceDocs(skillName) {
  const cacheKey = `skill:${skillName}:refs`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const encodedName = encodeURIComponent(skillName);
  const url = `https://api.github.com/repos/${SKILLS_OWNER}/${SKILLS_REPO}/contents/${SKILLS_ROOT}/${encodedName}/references?ref=${SKILLS_BRANCH}`;
  try {
    const entries = await githubFetchJson(url);
    const refs = entries
      .filter((entry) => entry.type === "file")
      .map((entry) => ({
        name: entry.name,
        path: entry.path,
        url: entry.html_url,
      }));
    setCache(cacheKey, refs);
    return refs;
  } catch (error) {
    return [];
  }
}

export function registerSkillsTools(server) {
  server.tool(
    "sf_skills_search",
    "Search remote Salesforce skills from forcedotcom/sf-skills without local clone.",
    SkillsSearchSchema,
    async (input) => {
      try {
        const skills = await listSkillsFolders();
        const query = input.query.trim();
        const includeContentSearch = input.includeContentSearch === true;
        const limit = input.limit ?? 20;

        const scored = [];
        for (const skill of skills) {
          let summary = "";
          if (includeContentSearch) {
            try {
              const md = await getSkillMarkdown(skill.name);
              summary = md.summary;
            } catch {
              summary = "";
            }
          }

          const score = scoreSkill(query, skill, summary, includeContentSearch);
          if (score > 0) {
            scored.push({
              name: skill.name,
              path: skill.path,
              domain: inferDomain(skill.name),
              summary,
              score,
              url: skill.htmlUrl,
            });
          }
        }

        scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
        return success({
          query,
          totalMatches: scored.length,
          results: scored.slice(0, limit),
          source: `https://github.com/${SKILLS_OWNER}/${SKILLS_REPO}`,
          cachedForSeconds: CACHE_TTL_MS / 1000,
        });
      } catch (error) {
        return failure(error.message);
      }
    }
  );

  server.tool(
    "sf_skills_get",
    "Fetch a Salesforce skill definition (SKILL.md) from forcedotcom/sf-skills.",
    SkillsGetSchema,
    async (input) => {
      try {
        const skill = await getSkillMarkdown(input.skillName.trim());
        const references = input.includeReferences
          ? await listSkillReferenceDocs(input.skillName.trim())
          : [];

        return success({
          skillName: skill.skillName,
          sourceUrl: skill.sourceUrl,
          summary: skill.summary,
          markdown: skill.markdown,
          references,
          source: `https://github.com/${SKILLS_OWNER}/${SKILLS_REPO}`,
        });
      } catch (error) {
        return failure(error.message);
      }
    }
  );

  server.tool(
    "sf_skills_list_domains",
    "List skill domains and sample skills from forcedotcom/sf-skills.",
    SkillsListDomainsSchema,
    async (input) => {
      try {
        const skills = await listSkillsFolders();
        const limitPerDomain = input.limitPerDomain ?? 8;
        const grouped = new Map();
        for (const skill of skills) {
          const domain = inferDomain(skill.name);
          if (!grouped.has(domain)) grouped.set(domain, []);
          grouped.get(domain).push(skill.name);
        }

        const domains = [...grouped.entries()]
          .map(([domain, names]) => ({
            domain,
            totalSkills: names.length,
            sampleSkills: names.sort().slice(0, limitPerDomain),
          }))
          .sort((a, b) => b.totalSkills - a.totalSkills || a.domain.localeCompare(b.domain));

        return success({
          totalDomains: domains.length,
          domains,
          source: `https://github.com/${SKILLS_OWNER}/${SKILLS_REPO}`,
        });
      } catch (error) {
        return failure(error.message);
      }
    }
  );
}
