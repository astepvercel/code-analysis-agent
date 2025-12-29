import { convertToModelMessages, UIMessageChunk, type UIMessage } from "ai";
import { DurableAgent } from "@workflow/ai/agent";
import { getWritable } from "workflow";
import { chatMessageHook } from "@/workflows/hooks/chat-message";
import {
	createConversationSandbox,
	stopConversationSandbox
} from './tools/sandbox';
import { CODE_ANALYSIS_SYSTEM_PROMPT } from "@/workflows/config/system-prompt";
import { createDurableSandboxTools } from './tools/createDurableSandboxTools';

export async function chatWorkflow(conversationId: string, initMessages: UIMessage[]) {
	'use workflow';

	console.log("🟢 [Workflow] Starting conversation:", conversationId);

	const sandboxId = await createConversationSandbox();
	console.log("🟢 [Workflow] Sandbox ID:", sandboxId);

	const writable = getWritable<UIMessageChunk>();
	const sandboxTools = createDurableSandboxTools(sandboxId);

	const agent = new DurableAgent({
		model: "bedrock/claude-4-sonnet-20250514-v1",
		system: CODE_ANALYSIS_SYSTEM_PROMPT,
		tools: {
			git_clone: sandboxTools.gitclone,
			list_files: sandboxTools.listDir,
			read_file: sandboxTools.readFile,
			search_files: sandboxTools.searchDir,
		}
	});
	console.log("🟢 [Workflow] Agent initialized");

	const chatHook = chatMessageHook.create({ token: conversationId });
	const messages = convertToModelMessages(initMessages);

	while (true) {
		console.log("🟢 [Workflow] Processing message (history length:", messages.length, ")");

		const { messages: result } = await agent.stream({
			messages: messages,
			writable,
			preventClose: true,
		});

		messages.push(...result.slice(messages.length));
		console.log("🟢 [Workflow] Response sent, waiting for next message...");

		const { message } = await chatHook;
		console.log("🟢 [Workflow] Received:", message);

		if (message === "/done") {
			console.log("🟢 [Workflow] Conversation ended by user");
			break;
		}

		messages.push({ role: "user", content: message });
	}

	console.log("🟢 [Workflow] Conversation complete");
	return { messages };
}