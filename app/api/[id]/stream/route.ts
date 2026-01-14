import { chatMessageHook } from "@/workflows/hooks/chat-message";
import { log } from "@/lib/config";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: conversationId } = await params;
  const body = await request.json();
  const { message } = body;

  log.api("=== FOLLOW-UP MESSAGE RECEIVED ===");
  log.api("Conversation ID:", conversationId);
  log.api("Message:", message);
  log.api("Full body:", JSON.stringify(body));

  // Resume the hook to inject the new message into the workflow
  // The client maintains its connection to the original stream
  log.api("Calling chatMessageHook.resume...");
  await chatMessageHook.resume(conversationId, {
    message,
    conversationId,
  });

  log.api("Hook resumed successfully");

  // Don't return a stream - just acknowledge success
  // New content flows through the existing stream connection
  return Response.json({ success: true });
}
