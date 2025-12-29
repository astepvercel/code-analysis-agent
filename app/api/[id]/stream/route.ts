import { chatMessageHook } from "@/workflows/hooks/chat-message";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }) {

  const { id: conversationId } = await params;
  const { message } = await request.json();

  console.log("🔵 [API] Resuming conversation:", conversationId);

  await chatMessageHook.resume(conversationId, {
    message: message,
    conversationId: conversationId
  });

  console.log("🔵 [API] Hook resumed successfully");

  return new Response("OK");
}
