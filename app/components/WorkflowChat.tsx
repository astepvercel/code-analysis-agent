"use client";

import { useMemo, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import { WorkflowChatTransport } from "@workflow/ai";
import { ChatUI } from "./ChatUI";
import { getConversationId } from "../client/session";
import { STORAGE_KEYS } from "@/lib/config";
import type { Message } from "../client/types";

export function WorkflowChat() {
  // Memoize transport to prevent recreation on every render
  const transport = useMemo(
    () =>
      new WorkflowChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ messages, ...rest }) => {
          const workflowRunId = sessionStorage.getItem(STORAGE_KEYS.workflowRunId);
          const conversationId = getConversationId();

          // If we have a workflowRunId, this is a follow-up message
          // Route to the stream endpoint to resume the workflow
          if (workflowRunId) {
            const lastMessage = messages[messages.length - 1];
            const messageText = (lastMessage?.parts?.[0] as any)?.text || '';

            return {
              ...rest,
              api: `/api/${encodeURIComponent(conversationId)}/stream/`,
              body: {
                message: messageText,
                workflowRunId,
              },
            };
          }

          // First message - start the workflow
          return {
            ...rest,
            body: { messages, conversationId },
          };
        },
        onChatSendMessage: (response: Response) => {
          const runId = response.headers.get("x-workflow-run-id");
          if (runId) sessionStorage.setItem(STORAGE_KEYS.workflowRunId, runId);
        },
        prepareReconnectToStreamRequest: ({ api, ...rest }) => {
          const workflowRunId = sessionStorage.getItem(STORAGE_KEYS.workflowRunId);
          const conversationId = sessionStorage.getItem(STORAGE_KEYS.conversationId);
          if (!workflowRunId || !conversationId) {
            throw new Error("Cannot reconnect - missing workflow or conversation ID");
          }
          return {
            ...rest,
            api: `/api/${encodeURIComponent(conversationId)}/stream/`,
            body: { workflowRunId },
          };
        },
        maxConsecutiveErrors: 5,
      }),
    []
  );

  const { messages: streamMessages, sendMessage, status } = useChat({
    transport: transport as any,
  });

  // useChat handles both user messages and assistant responses
  // User messages are added locally, assistant responses come from the stream
  const messages = streamMessages as Message[];

  const handleSend = useCallback((text: string) => {
    // Always use sendMessage - transport routes appropriately based on workflowRunId
    // useChat will handle adding the user message and processing the stream response
    sendMessage({ text, metadata: { createdAt: Date.now() } });
  }, [sendMessage]);

  return <ChatUI messages={messages} status={status} onSend={handleSend} mode="workflow" />;
}
