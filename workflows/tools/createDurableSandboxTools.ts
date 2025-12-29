import { tool, type UIMessageChunk } from "ai";
import { z } from "zod";
import { readFileStep } from "../steps/read-file";
import { listDirStep } from "../steps/list-dir";
import { gitCloneStep } from "../steps/git-clone";
import { searchFileStep } from "../steps/search-file";

export function createDurableSandboxTools(sandboxId?: string) {
    return {
      readFile: tool({
        description: "Read the contents of a file from the sandbox filesystem.",
        inputSchema: z.object({
          path: z.string().describe("Path to the file to read"),
        }),
        execute: async ({ path }) => {
          return readFileStep({ path: path, sandboxIdentifier: sandboxId });
        },
      }),

      listDir: tool({
        description: "List files and directories in a given path in the sandbox.",
        inputSchema: z.object({
          path: z
            .string()
            .optional()
            .describe("Directory path to list (defaults to current dir)"),
          recursive: z.boolean().optional().describe("List files recursively"),
          maxDepth: z
            .number()
            .optional()
            .describe("Max depth for recursive listing (default 3)"),
        }),
        execute: async ({ path, recursive, maxDepth }) => {
          return listDirStep({ path, recursive, maxDepth, sandboxIdentifier: sandboxId });
        },
      }),

      searchDir: tool({
        description: "Search for patterns in files using grep",
        inputSchema: z.object({
            pattern: z.string().describe("Search pattern"),
            path: z.string().default(".").describe("Directory to search"),
            file_pattern: z.string().optional().describe("File filter (e.g., '*.js')"),
          }),
        execute: async ({ pattern, path, file_pattern }) => {
          return searchFileStep({ pattern: pattern, path: path, file_pattern: file_pattern, sandboxIdentifier: sandboxId});
        },
      }),

      gitclone: tool({
        description: "Clone a GitHub repository. Only needs to be done once per repo.",
        inputSchema: z.object({
          repo_url: z.string().describe("GitHub repository URL"),
          destination: z.string().optional().describe("Directory name"),
        }),
        execute: async ({ repo_url, destination }) => {
          return gitCloneStep({ repo_url: repo_url, destination: destination || "" , sandboxIdentifier: sandboxId });
        },
      })

    };
  }
