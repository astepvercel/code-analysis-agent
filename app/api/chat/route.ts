import { start } from "workflow/api";
import { customBashWorkflow } from "@/workflows/custom-bash";
import { createUIMessageStreamResponse, type UIMessage } from "ai";
import { log } from "@/lib/config";

export const maxDuration = 300;

export async function POST(req: Request) {
  log.api("POST /api/chat - Starting workflow");

  const {
    conversationId,
    messages,
  }: { conversationId: string; messages: UIMessage[] } = await req.json();

  log.api("Conversation ID:", conversationId);
  log.api("Starting workflow with", messages.length, "message(s)");

  const run = await start(customBashWorkflow, [conversationId, messages]);

  log.api("Workflow started - Run ID:", run.runId);

  return createUIMessageStreamResponse({
    stream: run.readable,
    headers: {
      "x-workflow-run-id": run.runId,
    },
  });
}
