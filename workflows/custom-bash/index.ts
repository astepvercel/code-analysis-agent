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

/**
 * Step function to emit signals to the stream for a new assistant message turn.
 * This signals to the client that a new assistant message is beginning.
 * Must be a step because getWriter() is not supported in workflow functions.
 */
async function emitNewMessageSignals() {
  "use step";

  log.step("emit-start", "Emitting signals for new message turn");

  const writable = getWritable<UIMessageChunk>();
  const writer = writable.getWriter();

  try {
    // Emit start signal to indicate new message, similar to how doStreamStep does it
    await writer.write({ type: "start" } as UIMessageChunk);
  } finally {
    writer.releaseLock();
  }

  return { success: true };
}

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

  let isFirstTurn = true;

  while (true) {
    log.workflow("Processing message (history length:", messages.length, ")");

    // For subsequent turns, emit signals to indicate new assistant message
    if (!isFirstTurn) {
      await emitNewMessageSignals();
    }
    isFirstTurn = false;

    const { messages: result } = await agent.stream({
      messages: messages,
      writable,
      preventClose: true,
    });

    messages.push(...result.slice(messages.length));
    log.workflow("Response sent, waiting for next message...");

    const { message } = await chatHook;
    log.workflow("Received follow-up message:", message);

    if (message === "/done") {
      log.workflow("Conversation ended by user");
      break;
    }

    // User message is managed by the client - just add to history for context
    messages.push({ role: "user", content: message });
    log.workflow("User message added to history, processing...");
  }

  log.workflow("Conversation complete");
  return { messages };
}
