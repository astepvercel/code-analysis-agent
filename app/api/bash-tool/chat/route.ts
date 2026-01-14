import { ToolLoopAgent, createAgentUIStreamResponse, stepCountIs } from "ai";
import { getOrCreateSandbox, createBashTools } from "@/lib/bash-tool-agent";
import { BASH_TOOL_SYSTEM_PROMPT } from "@/lib/system-prompt";
import { MODEL_ID, AGENT_CONFIG, log } from "@/lib/config";

export async function POST(req: Request) {
  log.api("POST /api/bash-tool/chat");

  const { 
    conversationId,
    sandboxId: clientSandboxId,
    messages 
  } = await req.json();

  log.api("Conversation ID:", conversationId);
  log.api("Sandbox ID from client:", clientSandboxId ?? "none");
  log.api("Messages:", messages.length);

  try {
    const { sandbox, sandboxId } = await getOrCreateSandbox(clientSandboxId);
    const tools = await createBashTools(sandbox);

    const agent = new ToolLoopAgent({
      model: MODEL_ID,
      instructions: BASH_TOOL_SYSTEM_PROMPT,
      tools: tools,
      stopWhen: stepCountIs(AGENT_CONFIG.maxSteps),
    });
    log.api("Agent created, starting stream");

    return createAgentUIStreamResponse({
      agent,
      uiMessages: messages,
      headers: {
        "x-conversation-id": conversationId,
        "x-sandbox-id": sandboxId,
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
