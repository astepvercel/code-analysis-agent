"use client";

import { useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { ChatUI } from "./ChatUI";
import { getConversationId } from "../client/session";

export function BashToolChat() {
  // Memoize transport to prevent recreation on every render
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/bash-tool/chat",
        prepareSendMessagesRequest: ({ messages, ...rest }) => ({
          ...rest,
          body: { messages, conversationId: getConversationId() },
        }),
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
    />
  );
}
