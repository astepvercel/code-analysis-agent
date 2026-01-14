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
 * customBashWorkflow - Durable multi-turn chat with sandbox tools
 *
 * HOW IT WORKS:
 * 1. Creates a sandbox environment
 * 2. Streams agent responses to client
 * 3. Waits for follow-up messages via hook
 * 4. Emits user messages to stream (so client can detect turn boundaries)
 * 5. Loops until user sends "/done"
 */
export async function customBashWorkflow(
  conversationId: string,
  initMessages: UIMessage[]
) {
  "use workflow";

  log.workflow("Starting conversation:", conversationId);

  // Setup
  const sandboxId = await createSandbox();
  const tools = createTools(sandboxId);
  const writable = getWritable<UIMessageChunk>();
  const chatHook = chatMessageHook.create({ token: conversationId });
  const messages = await convertToModelMessages(initMessages);

  const agent = new DurableAgent({
    model: MODEL_ID,
    system: WORKFLOW_SYSTEM_PROMPT,
    tools,
  });

  // Main conversation loop
  while (true) {
    // Stream agent response
    const { messages: result } = await agent.stream({
      messages,
      writable,
      preventClose: true,
    });
    messages.push(...result.slice(messages.length));

    // Wait for user's next message
    const { message } = await chatHook;
    if (message === "/done") break;

    // Emit user message to stream (client uses this to split turns)
    await emitUserMessage(message);

    // Add to history and continue
    messages.push({ role: "user", content: message });
  }

  return { messages };
}

/**
 * Emit user message to stream as a data chunk.
 * Client scans for these to detect turn boundaries.
 */
async function emitUserMessage(text: string) {
  "use step";

  const writable = getWritable<UIMessageChunk>();
  const writer = writable.getWriter();

  try {
    await writer.write({
      type: "data-user-message",
      data: { text },
    } as unknown as UIMessageChunk);
  } finally {
    writer.releaseLock();
  }
}

/**
 * Create sandbox tools for the agent
 */
function createTools(sandboxId: string) {
  return {
    [TOOL_NAMES.gitClone]: tool({
      description: "Clone a GitHub repository. Only needs to be done once per repo.",
      inputSchema: z.object({
        repoUrl: z.string().describe("GitHub repository URL"),
        destination: z.string().optional().describe("Directory name"),
      }),
      execute: ({ repoUrl, destination }) =>
        cloneRepository({ repoUrl, destination, sandboxId }),
    }),

    [TOOL_NAMES.listFiles]: tool({
      description: "List files and directories in a given path in the sandbox.",
      inputSchema: z.object({
        path: z.string().optional().describe("Directory path (defaults to current)"),
        recursive: z.boolean().optional().describe("List files recursively"),
        maxDepth: z.number().optional().describe("Max depth for recursive listing"),
      }),
      execute: ({ path, recursive, maxDepth }) =>
        listDirectory({ path, recursive, maxDepth, sandboxId }),
    }),

    [TOOL_NAMES.readFile]: tool({
      description: "Read the contents of a file from the sandbox filesystem.",
      inputSchema: z.object({
        path: z.string().describe("Path to the file to read"),
      }),
      execute: ({ path }) => readFile({ path, sandboxId }),
    }),

    [TOOL_NAMES.searchFiles]: tool({
      description: "Search for patterns in files using grep",
      inputSchema: z.object({
        pattern: z.string().describe("Search pattern"),
        path: z.string().default(".").describe("Directory to search"),
        filePattern: z.string().optional().describe("File filter (e.g., '*.js')"),
      }),
      execute: ({ pattern, path, filePattern }) =>
        searchFiles({ pattern, path, filePattern, sandboxId }),
    }),

    [TOOL_NAMES.bash]: tool({
      description: "Execute a bash command in the sandbox",
      inputSchema: z.object({
        command: z.string().describe("The bash command to execute"),
      }),
      execute: ({ command }) => runBash({ command, sandboxId }),
    }),
  };
}
