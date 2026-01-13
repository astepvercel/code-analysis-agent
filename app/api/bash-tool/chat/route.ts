import { ToolLoopAgent, createAgentUIStreamResponse, stepCountIs } from "ai";
import { getOrCreateSandbox, createBashTools } from "@/lib/bash-tool-agent";
import { BASH_TOOL_SYSTEM_PROMPT } from "@/lib/system-prompt";
import { MODEL_ID, log } from "@/lib/config";

export const maxDuration = 300;

export async function POST(req: Request) {
  log.api("POST /api/bash-tool/chat");

  const { conversationId, messages } = await req.json();

  log.api("Conversation ID:", conversationId);
  log.api("Messages:", messages.length);

  try {
    const sandbox = await getOrCreateSandbox(conversationId);
    const tools = await createBashTools(sandbox);

    const agent = new ToolLoopAgent({
      model: MODEL_ID,
      instructions: BASH_TOOL_SYSTEM_PROMPT,
      tools: { bash: tools.bash },
      stopWhen: stepCountIs(50),
    });

    log.api("Agent created, starting stream");

    return createAgentUIStreamResponse({
      agent,
      uiMessages: messages,
      headers: {
        "x-conversation-id": conversationId,
      },
    });
  } catch (error) {
    log.error("API", error instanceof Error ? error.message : "Unknown error");
    return Response.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
