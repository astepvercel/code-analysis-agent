import { chatMessageHook } from "@/workflows/hooks/chat-message";
import { log } from "@/lib/config";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: conversationId } = await params;
  const { message } = await request.json();

  log.api("Resuming conversation:", conversationId);

  await chatMessageHook.resume(conversationId, {
    message,
    conversationId,
  });

  log.api("Hook resumed successfully");

  return new Response("OK");
}
