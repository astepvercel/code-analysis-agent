"use client";

import { useState, useCallback, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { WorkflowChatTransport } from "@workflow/ai";
import { ChatUI } from "./ChatUI";
import { getConversationId } from "../client/session";
import { STORAGE_KEYS } from "@/lib/config";
import type { Message } from "../client/types";

/**
 * Multi-turn workflow chat.
 *
 * Simple approach inspired by flight booking example:
 * - User messages are emitted to stream as data-user-message chunks
 * - Client scans parts for these chunks to detect turn boundaries
 * - No manual tracking needed - turns are self-evident in the stream
 */
export function WorkflowChat() {
  const [workflowRunId, setWorkflowRunId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem(STORAGE_KEYS.workflowRunId);
    }
    return null;
  });

  const transport = useMemo(
    () =>
      new WorkflowChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ messages, ...rest }) => {
          const conversationId = getConversationId();
          return {
            ...rest,
            body: { messages, conversationId },
          };
        },
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

  const {
    messages: streamMessages,
    sendMessage: sendInitialMessage,
    status,
  } = useChat({
    transport: transport as any,
  });

  // Get assistant message and all parts from stream
  const streamAssistant = useMemo(
    () => streamMessages.find((m) => m.role === "assistant"),
    [streamMessages]
  );
  const allParts = useMemo(
    () => streamAssistant?.parts || [],
    [streamAssistant]
  );

  // Build display messages by scanning parts for user message chunks
  const displayMessages = useMemo(() => {
    const result: Message[] = [];

    // First user message (from initial send via useChat)
    const firstUser = streamMessages.find((m) => m.role === "user");
    if (firstUser) {
      result.push(firstUser as Message);
    }

    // Scan parts and split on user message chunks
    let currentAssistantParts: any[] = [];

    for (const part of allParts) {
      const partAny = part as any;
      if (partAny.type === "data-user-message" && partAny.data?.text) {
        const userText = partAny.data.text as string;
        // End current assistant turn
        if (currentAssistantParts.length > 0 || result.length > 0) {
          result.push({
            id: `assistant-${result.length}`,
            role: "assistant",
            content: "",
            parts: currentAssistantParts,
          } as Message);
        }

        // Add user message from stream
        result.push({
          id: `user-${result.length}`,
          role: "user",
          content: userText,
          parts: [{ type: "text", text: userText }],
        } as Message);

        currentAssistantParts = []; // Reset for next turn
      } else {
        currentAssistantParts.push(part);
      }
    }

    // Add final assistant turn (current/in-progress response)
    if (currentAssistantParts.length > 0 || result[result.length - 1]?.role === "user") {
      result.push({
        id: `assistant-${result.length}`,
        role: "assistant",
        content: "",
        parts: currentAssistantParts,
      } as Message);
    }

    return result;
  }, [streamMessages, allParts]);

  // Status: streaming if last message is user or assistant with no parts
  const lastMessage = displayMessages[displayMessages.length - 1];
  const isWaiting =
    displayMessages.length > 0 &&
    (lastMessage?.role === "user" ||
      (lastMessage?.role === "assistant" && lastMessage?.parts?.length === 0));
  const effectiveStatus = isWaiting ? "streaming" : "ready";

  // Handle sending messages
  const handleSend = useCallback(
    async (text: string) => {
      if (!workflowRunId) {
        // First message - start workflow
        await sendInitialMessage({ text, metadata: { createdAt: Date.now() } });
      } else {
        // Follow-up - just resume the workflow hook
        // User message will appear in stream via data-user-message chunk
        const conversationId = getConversationId();
        try {
          await fetch(`/api/${encodeURIComponent(conversationId)}/stream/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: text }),
          });
        } catch (error) {
          console.error("[WorkflowChat] Hook resume failed:", error);
        }
      }
    },
    [workflowRunId, sendInitialMessage]
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
