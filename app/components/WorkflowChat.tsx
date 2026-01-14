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
 * Simplified approach:
 * - First turn: Use streamMessages directly from useChat
 * - Follow-ups: Track locally added user messages and splice in new assistant content
 */
export function WorkflowChat() {
  const [workflowRunId, setWorkflowRunId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem(STORAGE_KEYS.workflowRunId);
    }
    return null;
  });

  // Follow-up messages we add locally (user messages + assistant responses after first turn)
  const [followUpMessages, setFollowUpMessages] = useState<Message[]>([]);

  // Track split points - array of content lengths and part indices where each turn ends
  // splitPoints[0] = { content: X, parts: Y } where first assistant response ends
  const splitPoints = useRef<{ content: number; parts: number }[]>([]);

  // Transport for initial message
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

  // Get the assistant message from stream (memoized to prevent reference changes)
  const streamAssistant = useMemo(
    () => streamMessages.find(m => m.role === "assistant"),
    [streamMessages]
  );

  // Get the full assistant content from stream (it's all concatenated)
  const totalAssistantContent = useMemo(() => {
    if (!streamAssistant) return "";
    return streamAssistant.parts?.filter((p: any) => p.type === "text").map((p: any) => p.text).join("") || "";
  }, [streamAssistant]);

  // Get all parts from the stream assistant (memoized to prevent reference changes)
  const allParts = useMemo(
    () => streamAssistant?.parts || [],
    [streamAssistant]
  );

  // Build display messages: first turn from stream + follow-ups
  const displayMessages = useMemo(() => {
    const result: Message[] = [];

    // Add first user message from stream
    const firstUser = streamMessages.find(m => m.role === "user");
    if (firstUser) {
      result.push(firstUser as Message);
    }

    // Add first assistant response
    if (streamAssistant) {
      // First assistant: from 0 to first split point (or all if no follow-ups)
      const firstSplit = splitPoints.current[0];
      const firstAssistantContent = firstSplit !== undefined
        ? totalAssistantContent.slice(0, firstSplit.content)
        : totalAssistantContent;
      const firstAssistantParts = firstSplit !== undefined
        ? allParts.slice(0, firstSplit.parts)
        : allParts;

      if (firstAssistantContent || firstAssistantParts.length > 0 || splitPoints.current.length > 0) {
        result.push({
          id: "assistant-turn-1",
          role: "assistant",
          content: firstAssistantContent,
          parts: firstAssistantParts,
        } as Message);
      }
    }

    // Add follow-up messages (user messages + their assistant responses)
    let assistantIndex = 0; // Track which assistant placeholder we're on
    for (const msg of followUpMessages) {
      if (msg.role === "user") {
        result.push(msg);
      } else if (msg.role === "assistant") {
        // Get this assistant turn's content and parts from the stream
        const startSplit = splitPoints.current[assistantIndex];
        const endSplit = splitPoints.current[assistantIndex + 1];

        const contentStart = startSplit?.content || 0;
        const contentEnd = endSplit?.content;
        const turnContent = contentEnd !== undefined
          ? totalAssistantContent.slice(contentStart, contentEnd)
          : totalAssistantContent.slice(contentStart);

        const partsStart = startSplit?.parts || 0;
        const partsEnd = endSplit?.parts;
        const turnParts = partsEnd !== undefined
          ? allParts.slice(partsStart, partsEnd)
          : allParts.slice(partsStart);

        result.push({
          ...msg,
          content: turnContent,
          parts: turnParts,
        } as Message);
        assistantIndex++;
      }
    }

    return result;
  }, [streamMessages, streamAssistant, totalAssistantContent, followUpMessages, allParts]);


  // Status logic - SIMPLE:
  // No messages = ready
  // Last message is user = busy (waiting for response)
  // Last message is empty assistant (placeholder) = busy (waiting for content)
  // Last message is assistant with content = ready
  const lastMessage = displayMessages[displayMessages.length - 1];
  const hasSentMessage = displayMessages.length > 0;
  const isEmptyAssistant = lastMessage?.role === "assistant" && !lastMessage?.content;
  const isWaitingForResponse = hasSentMessage && (lastMessage?.role === "user" || isEmptyAssistant);
  const effectiveStatus = isWaitingForResponse ? "streaming" : "ready";


  // Handle sending messages
  const handleSend = useCallback(
    async (text: string) => {
      if (!workflowRunId) {
        // First message - start workflow via transport
        await sendInitialMessage({ text, metadata: { createdAt: Date.now() } });
      } else {
        // Follow-up message
        // Record the current content length and parts count as a split point
        splitPoints.current.push({
          content: totalAssistantContent.length,
          parts: allParts.length,
        });

        // Add user message
        const userMessage: Message = {
          id: `user-followup-${Date.now()}`,
          role: "user",
          content: text,
          parts: [{ type: "text", text }],
        };

        // Add placeholder for assistant response
        const assistantPlaceholder: Message = {
          id: `assistant-followup-${Date.now()}`,
          role: "assistant",
          content: "",
          parts: [{ type: "text", text: "" }],
        };

        setFollowUpMessages(prev => [...prev, userMessage, assistantPlaceholder]);

        // Resume the workflow hook
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
    [workflowRunId, sendInitialMessage, totalAssistantContent, allParts]
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
