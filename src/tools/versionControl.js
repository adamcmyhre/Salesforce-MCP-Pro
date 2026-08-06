import { execFile } from "node:child_process";
import { z } from "zod";
import { failure, success } from "../lib/respond.js";

const GitStatusSchema = {
  directory: z.string().optional(),
};

const GitRecentCommitsSchema = {
  directory: z.string().optional(),
  limit: z.number().int().min(1).max(200).optional(),
};

const GitLastCommitForFileSchema = {
  filePath: z.string().min(1),
  directory: z.string().optional(),
};

const GitFileHistorySchema = {
  filePath: z.string().min(1),
  directory: z.string().optional(),
  limit: z.number().int().min(1).max(200).optional(),
};

const GitLastCommitFilesSchema = {
  directory: z.string().optional(),
};

function execGit(args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(
      "git",
      args,
      {
        cwd: options.cwd ?? process.cwd(),
        windowsHide: true,
        maxBuffer: 20 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(
            new Error(
              `Git command failed: git ${args.join(" ")}\n${stderr || error.message}`
            )
          );
          return;
        }
        resolve(stdout);
      }
    );
  });
}

function parseLogLine(line) {
  const [commit, authorName, authorEmail, dateIso, subject] = line.split("\t");
  return {
    commit,
    authorName,
    authorEmail,
    dateIso,
    subject,
  };
}

export function registerVersionControlTools(server) {
  server.tool(
    "git_status",
    "Get git branch and working tree status in the current project.",
    GitStatusSchema,
    async (input) => {
      try {
        const statusOutput = await execGit(["status", "--short", "--branch"], {
          cwd: input.directory,
        });
        return success({
          directory: input.directory ?? process.cwd(),
          status: statusOutput.trim(),
        });
      } catch (error) {
        return failure(error.message);
      }
    }
  );

  server.tool(
    "git_recent_commits",
    "List recent git commits with author, date, and message.",
    GitRecentCommitsSchema,
    async (input) => {
      try {
        const limit = input.limit ?? 20;
        const format = "%H%x09%an%x09%ae%x09%aI%x09%s";
        const output = await execGit(
          ["log", `--max-count=${limit}`, `--pretty=format:${format}`],
          { cwd: input.directory }
        );

        const commits = output
          .split(/\r?\n/)
          .filter(Boolean)
          .map(parseLogLine);

        return success({
          directory: input.directory ?? process.cwd(),
          commits,
        });
      } catch (error) {
        return failure(error.message);
      }
    }
  );

  server.tool(
    "git_last_commit_for_file",
    "Find the most recent commit where a specific file changed.",
    GitLastCommitForFileSchema,
    async (input) => {
      try {
        const format = "%H%x09%an%x09%ae%x09%aI%x09%s";
        const output = await execGit(
          ["log", "-n", "1", `--pretty=format:${format}`, "--", input.filePath],
          { cwd: input.directory }
        );

        if (!output.trim()) {
          return success({
            directory: input.directory ?? process.cwd(),
            filePath: input.filePath,
            found: false,
          });
        }

        return success({
          directory: input.directory ?? process.cwd(),
          filePath: input.filePath,
          found: true,
          commit: parseLogLine(output.trim()),
        });
      } catch (error) {
        return failure(error.message);
      }
    }
  );

  server.tool(
    "git_file_history",
    "List commit history entries for a specific file path.",
    GitFileHistorySchema,
    async (input) => {
      try {
        const limit = input.limit ?? 20;
        const format = "%H%x09%an%x09%ae%x09%aI%x09%s";
        const output = await execGit(
          ["log", `--max-count=${limit}`, `--pretty=format:${format}`, "--", input.filePath],
          { cwd: input.directory }
        );

        const commits = output
          .split(/\r?\n/)
          .filter(Boolean)
          .map(parseLogLine);

        return success({
          directory: input.directory ?? process.cwd(),
          filePath: input.filePath,
          commits,
        });
      } catch (error) {
        return failure(error.message);
      }
    }
  );

  server.tool(
    "git_last_commit_files",
    "List file paths changed in the latest commit (names only).",
    GitLastCommitFilesSchema,
    async (input) => {
      try {
        const output = await execGit(
          ["show", "--pretty=format:", "--name-only", "HEAD"],
          { cwd: input.directory }
        );

        const files = output
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean);

        return success({
          directory: input.directory ?? process.cwd(),
          files,
        });
      } catch (error) {
        return failure(error.message);
      }
    }
  );
}
