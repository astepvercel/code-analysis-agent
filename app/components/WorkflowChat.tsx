"use client";

import { useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { WorkflowChatTransport } from "@workflow/ai";
import { ChatUI } from "./ChatUI";
import { getConversationId } from "../client/session";
import { STORAGE_KEYS } from "@/lib/config";

export function WorkflowChat() {
  // Memoize transport to prevent recreation on every render
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
          if (runId) sessionStorage.setItem(STORAGE_KEYS.workflowRunId, runId);
        },
        prepareReconnectToStreamRequest: ({ api, ...rest }) => {
          const workflowRunId = sessionStorage.getItem(STORAGE_KEYS.workflowRunId);
          const conversationId = sessionStorage.getItem(STORAGE_KEYS.conversationId);
          if (!workflowRunId || !conversationId) {
            throw new Error(
              "Cannot reconnect - missing workflow or conversation ID"
            );
          }
          return {
            ...rest,
            api: `/api/${encodeURIComponent(conversationId)}/stream/`,
          };
        },
        maxConsecutiveErrors: 5,
      }),
    []
  );

  const { messages, sendMessage, status } = useChat({
    transport: transport as any,
  });

  const handleSend = async (text: string) => {
    const workflowRunId = sessionStorage.getItem(STORAGE_KEYS.workflowRunId);
    const conversationId = sessionStorage.getItem(STORAGE_KEYS.conversationId);

    if (workflowRunId && conversationId) {
      // For follow-up messages, we need to:
      // 1. Send the message to resume the workflow
      // 2. Use sendMessage to update the UI state

      // Trigger the workflow hook to resume
      fetch(`/api/${encodeURIComponent(conversationId)}/stream/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      // Also call sendMessage so useChat updates its state
      sendMessage({ text, metadata: { createdAt: Date.now() } });
    } else {
      // First message - just use sendMessage
      sendMessage({ text, metadata: { createdAt: Date.now() } });
    }
  };

  return <ChatUI messages={messages} status={status} onSend={handleSend} />;
}
