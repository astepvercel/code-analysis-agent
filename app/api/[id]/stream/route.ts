import { chatMessageHook } from "@/workflows/hooks/chat-message";
import { log } from "@/lib/config";
import { getRun } from "workflow/api";
import { createUIMessageStreamResponse } from "ai";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: conversationId } = await params;
  const { message, workflowRunId } = await request.json();

  log.api("Resuming conversation:", conversationId, "workflow:", workflowRunId);

  // Resume the hook to inject the new message into the workflow
  await chatMessageHook.resume(conversationId, {
    message,
    conversationId,
  });

  log.api("Hook resumed, returning stream");

  // Return the workflow's readable stream so client receives new content
  const run = getRun(workflowRunId);
  return createUIMessageStreamResponse({ stream: run.getReadable() });
}
