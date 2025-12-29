import { start } from "workflow/api";
import { chatWorkflow } from "@/workflows";
import { createUIMessageStreamResponse, type UIMessage } from "ai";

export async function POST(req: Request) {
	console.log("🔵 [API] POST /api/chat - Starting conversation");

	const { conversationId, messages }: { conversationId: string, messages: UIMessage[] } = await req.json();

	console.log("🔵 [API] Conversation ID:", conversationId);
	console.log("🔵 [API] Starting workflow with", messages.length, "message(s)");

	const run = await start(chatWorkflow, [conversationId, messages]);

	console.log("🔵 [API] Workflow started - Run ID:", run.runId);

	return createUIMessageStreamResponse({
		stream: run.readable,
		headers: {
			"x-workflow-run-id": run.runId,
		},
	});
}
