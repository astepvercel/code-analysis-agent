/**
 * BashToolChat - Chat component for Bash-Tool mode.
 *
 * Stateless mode using the bash-tool library. Each request creates
 * or reuses a sandbox, runs the agent, and streams the response.
 */
"use client";

import { useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { ChatUI } from "./ChatUI";
import { getConversationId, getSandboxId, setSandboxId } from "../client/session";

export function BashToolChat() {
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/bash-tool/chat",
        prepareSendMessagesRequest: ({ messages, ...rest }) => ({
          ...rest,
          body: {
            messages,
            conversationId: getConversationId(),
            sandboxId: getSandboxId(),
          },
        }),
        fetch: async (url, options) => {
          const response = await fetch(url, options);
          const sandboxId = response.headers.get("x-sandbox-id");
          if (sandboxId) {
            setSandboxId(sandboxId);
          }
          return response;
        },
      }),
    []
  );

  const { messages, sendMessage, status } = useChat({
    transport: transport as any,
  });

  return (
    <ChatUI
      messages={messages}
      status={status}
      onSend={(text) =>
        sendMessage({ text, metadata: { createdAt: Date.now() } })
      }
      mode="bash-tool"
    />
  );
}
