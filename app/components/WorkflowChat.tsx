"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import { useChat } from "@ai-sdk/react";
import { WorkflowChatTransport } from "@workflow/ai";
import { ChatUI } from "./ChatUI";
import { getConversationId } from "../client/session";
import { STORAGE_KEYS } from "@/lib/config";
import type { Message } from "../client/types";

/**
 * Multi-turn workflow chat.
 *
 * SIMPLIFIED APPROACH:
 * - Track turn boundaries by part index only (no content-length tracking)
 * - turnBoundaries[0] = part index where turn 1 starts
 * - Turn 0: parts[0..turnBoundaries[0])
 * - Turn N: parts[turnBoundaries[N-1]..turnBoundaries[N])
 */
export function WorkflowChat() {
  const [workflowRunId, setWorkflowRunId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem(STORAGE_KEYS.workflowRunId);
    }
    return null;
  });

  // User's follow-up messages (we derive assistant content from parts)
  const [followUpUserMessages, setFollowUpUserMessages] = useState<Message[]>([]);

  // Part indices where each new turn starts
  // turnBoundaries[0] = index where turn 1 starts, etc.
  const turnBoundaries = useRef<number[]>([]);

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

  // Get assistant message and parts from stream
  const streamAssistant = useMemo(
    () => streamMessages.find((m) => m.role === "assistant"),
    [streamMessages]
  );
  const allParts = useMemo(
    () => streamAssistant?.parts || [],
    [streamAssistant]
  );

  // Helper: get parts for a specific turn
  const getPartsForTurn = useCallback(
    (turnIndex: number) => {
      const start = turnIndex === 0 ? 0 : turnBoundaries.current[turnIndex - 1];
      const end = turnBoundaries.current[turnIndex];
      return end !== undefined ? allParts.slice(start, end) : allParts.slice(start);
    },
    [allParts]
  );

  // Build display messages
  const displayMessages = useMemo(() => {
    const result: Message[] = [];

    // First user message
    const firstUser = streamMessages.find((m) => m.role === "user");
    if (firstUser) {
      result.push(firstUser as Message);
    }

    // First assistant turn (turn 0)
    const turn0Parts = getPartsForTurn(0);
    if (turn0Parts.length > 0 || followUpUserMessages.length > 0) {
      result.push({
        id: "assistant-turn-0",
        role: "assistant",
        content: "", // Content derived from parts by renderer
        parts: turn0Parts,
      } as Message);
    }

    // Follow-up turns: interleave user messages with assistant responses
    followUpUserMessages.forEach((userMsg, index) => {
      // User message
      result.push(userMsg);

      // Assistant response for this turn (turn index+1 since turn 0 is first response)
      const turnParts = getPartsForTurn(index + 1);
      result.push({
        id: `assistant-turn-${index + 1}`,
        role: "assistant",
        content: "",
        parts: turnParts,
      } as Message);
    });

    return result;
  }, [streamMessages, followUpUserMessages, getPartsForTurn]);

  // Status: streaming if last message is assistant with no parts
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
        // Follow-up message
        // Record current parts count as boundary for next turn
        turnBoundaries.current.push(allParts.length);

        // Add user message
        const userMessage: Message = {
          id: `user-followup-${Date.now()}`,
          role: "user",
          content: text,
          parts: [{ type: "text", text }],
        };
        setFollowUpUserMessages((prev) => [...prev, userMessage]);

        // Resume workflow
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
    [workflowRunId, sendInitialMessage, allParts.length]
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
