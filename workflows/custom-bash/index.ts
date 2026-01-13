import {
  convertToModelMessages,
  UIMessageChunk,
  type UIMessage,
  tool,
} from "ai";
import { DurableAgent } from "@workflow/ai/agent";
import { getWritable } from "workflow";
import { z } from "zod";
import { chatMessageHook } from "@/workflows/hooks/chat-message";
import { createSandbox } from "../tools/sandbox";
import { readFile } from "../steps/read-file";
import { listDirectory } from "../steps/list-directory";
import { cloneRepository } from "../steps/git-clone";
import { searchFiles } from "../steps/search-files";
import { runBash } from "../steps/bash";
import { WORKFLOW_SYSTEM_PROMPT } from "@/lib/system-prompt";
import { MODEL_ID, log, TOOL_NAMES } from "@/lib/config";

function createTools(sandboxId: string) {
  return {
    [TOOL_NAMES.gitClone]: tool({
      description:
        "Clone a GitHub repository. Only needs to be done once per repo.",
      inputSchema: z.object({
        repoUrl: z.string().describe("GitHub repository URL"),
        destination: z.string().optional().describe("Directory name"),
      }),
      execute: async ({ repoUrl, destination }) => {
        return cloneRepository({ repoUrl, destination, sandboxId });
      },
    }),

    [TOOL_NAMES.listFiles]: tool({
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
        return listDirectory({ path, recursive, maxDepth, sandboxId });
      },
    }),

    [TOOL_NAMES.readFile]: tool({
      description: "Read the contents of a file from the sandbox filesystem.",
      inputSchema: z.object({
        path: z.string().describe("Path to the file to read"),
      }),
      execute: async ({ path }) => {
        return readFile({ path, sandboxId });
      },
    }),

    [TOOL_NAMES.searchFiles]: tool({
      description: "Search for patterns in files using grep",
      inputSchema: z.object({
        pattern: z.string().describe("Search pattern"),
        path: z.string().default(".").describe("Directory to search"),
        filePattern: z.string().optional().describe("File filter (e.g., '*.js')"),
      }),
      execute: async ({ pattern, path, filePattern }) => {
        return searchFiles({ pattern, path, filePattern, sandboxId });
      },
    }),

    [TOOL_NAMES.bash]: tool({
      description: "Execute a bash command in the sandbox",
      inputSchema: z.object({
        command: z.string().describe("The bash command to execute"),
      }),
      execute: async ({ command }) => {
        return runBash({ command, sandboxId });
      },
    }),
  };
}

export async function customBashWorkflow(
  conversationId: string,
  initMessages: UIMessage[]
) {
  "use workflow";

  log.workflow("Starting conversation:", conversationId);

  const sandboxId = await createSandbox();
  log.workflow("Sandbox ID:", sandboxId);

  const tools = createTools(sandboxId);
  const writable = getWritable<UIMessageChunk>();

  const agent = new DurableAgent({
    model: MODEL_ID,
    system: WORKFLOW_SYSTEM_PROMPT,
    tools,
  });
  log.workflow("Agent initialized with tools");

  const chatHook = chatMessageHook.create({ token: conversationId });
  const messages = await convertToModelMessages(initMessages);

  while (true) {
    log.workflow("Processing message (history length:", messages.length, ")");

    const { messages: result } = await agent.stream({
      messages: messages,
      writable,
      preventClose: true,
    });

    messages.push(...result.slice(messages.length));
    log.workflow("Response sent, waiting for next message...");

    const { message } = await chatHook;
    log.workflow("Received:", message);

    if (message === "/done") {
      log.workflow("Conversation ended by user");
      break;
    }

    messages.push({ role: "user", content: message });
  }

  log.workflow("Conversation complete");
  return { messages };
}
