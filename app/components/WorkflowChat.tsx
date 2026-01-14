/**
 * WorkflowChat - Multi-turn chat component for Workflow mode.
 *
 * Uses Vercel Workflows for durable, checkpointed conversations.
 * User messages are emitted to the stream as `data-user-message` chunks,
 * allowing turn boundaries to be detected by scanning the parts array.
 */
"use client";

import { useState, useCallback, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { WorkflowChatTransport } from "@workflow/ai";
import { ChatUI } from "./ChatUI";
import { getConversationId } from "../client/session";
import { STORAGE_KEYS } from "@/lib/config";
import type { Message } from "../client/types";
export function WorkflowChat() {
  // Track workflow run ID for follow-up messages
  const [workflowRunId, setWorkflowRunId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem(STORAGE_KEYS.workflowRunId);
    }
    return null;
  });

  // Configure transport to capture workflow run ID from response headers
  const transport = useMemo(
    () =>
      new WorkflowChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ messages, ...rest }) => ({
          ...rest,
          body: { messages, conversationId: getConversationId() },
        }),
        onChatSendMessage: (response: Response) => {
          const runId = response.headers.get("x-workflow-run-id");
          if (runId) {
            sessionStorage.setItem(STORAGE_KEYS.workflowRunId, runId);
            setWorkflowRunId(runId);
          }
        },
      }),
    []
  );

  const { messages: streamMessages, sendMessage, status } = useChat({
    transport: transport as any,
  });

  // Extract parts from the assistant message
  const assistantMessage = streamMessages.find((m) => m.role === "assistant");
  const allParts = assistantMessage?.parts || [];

  // Build display messages by splitting on user message chunks
  const displayMessages = useMemo(() => {
    const result: Message[] = [];

    // Add initial user message
    const firstUser = streamMessages.find((m) => m.role === "user");
    if (firstUser) {
      result.push(firstUser as Message);
    }

    // Scan parts: split on data-user-message chunks
    let assistantParts: any[] = [];

    for (const part of allParts) {
      const p = part as any;

      if (p.type === "data-user-message" && p.data?.text) {
        // Found user message = end of assistant turn
        if (assistantParts.length > 0 || result.length > 0) {
          result.push(createAssistantMessage(result.length, assistantParts));
        }
        result.push(createUserMessage(result.length, p.data.text));
        assistantParts = [];
      } else {
        assistantParts.push(part);
      }
    }

    // Add final/current assistant turn
    if (assistantParts.length > 0 || result[result.length - 1]?.role === "user") {
      result.push(createAssistantMessage(result.length, assistantParts));
    }

    return result;
  }, [streamMessages, allParts]);

  // Determine if we're waiting for a response
  const lastMessage = displayMessages[displayMessages.length - 1];
  const isWaiting =
    lastMessage?.role === "user" ||
    (lastMessage?.role === "assistant" && !lastMessage.parts?.length);
  const effectiveStatus = isWaiting ? "streaming" : "ready";

  // Send message handler
  const handleSend = useCallback(
    async (text: string) => {
      if (!workflowRunId) {
        // First message: start workflow
        await sendMessage({ text, metadata: { createdAt: Date.now() } });
      } else {
        // Follow-up: resume workflow hook (user message appears via stream)
        await fetch(`/api/${encodeURIComponent(getConversationId())}/stream/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text }),
        });
      }
    },
    [workflowRunId, sendMessage]
  );

  return (
    <ChatUI
      messages={displayMessages}
      status={effectiveStatus}
      onSend={handleSend}
      mode="workflow"
    />
  );
}

// Helper: create assistant message
function createAssistantMessage(index: number, parts: any[]): Message {
  return { id: `assistant-${index}`, role: "assistant", content: "", parts };
}

// Helper: create user message
function createUserMessage(index: number, text: string): Message {
  return {
    id: `user-${index}`,
    role: "user",
    content: text,
    parts: [{ type: "text", text }],
  };
}
