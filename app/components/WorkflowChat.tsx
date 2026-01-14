"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
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

  // Track split points - array of content lengths where each turn ends
  // splitPoints[0] = where first assistant response ends
  // splitPoints[1] = where second assistant response ends, etc.
  const splitPoints = useRef<number[]>([]);

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

  // Get the full assistant content from stream (it's all concatenated)
  const streamAssistant = streamMessages.find(m => m.role === "assistant");
  const totalAssistantContent = streamAssistant?.content ||
    streamAssistant?.parts?.filter((p: any) => p.type === "text").map((p: any) => p.text).join("") || "";

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
      // First assistant content: from 0 to first split point (or all if no follow-ups)
      const firstSplitPoint = splitPoints.current[0];
      const firstAssistantContent = firstSplitPoint !== undefined
        ? totalAssistantContent.slice(0, firstSplitPoint)
        : totalAssistantContent;

      if (firstAssistantContent || splitPoints.current.length > 0) {
        result.push({
          id: "assistant-turn-1",
          role: "assistant",
          content: firstAssistantContent,
          parts: firstSplitPoint !== undefined
            ? [{ type: "text", text: firstAssistantContent }]
            : streamAssistant.parts,
        } as Message);
      }
    }

    // Add follow-up messages (user messages + their assistant responses)
    let assistantIndex = 0; // Track which assistant placeholder we're on
    for (const msg of followUpMessages) {
      if (msg.role === "user") {
        result.push(msg);
      } else if (msg.role === "assistant") {
        // Get this assistant turn's content from the stream
        const startPoint = splitPoints.current[assistantIndex] || 0;
        const endPoint = splitPoints.current[assistantIndex + 1];
        const turnContent = endPoint !== undefined
          ? totalAssistantContent.slice(startPoint, endPoint)
          : totalAssistantContent.slice(startPoint);

        result.push({
          ...msg,
          content: turnContent,
          parts: [{ type: "text", text: turnContent }],
        } as Message);
        assistantIndex++;
      }
    }

    return result;
  }, [streamMessages, streamAssistant, totalAssistantContent, followUpMessages]);

  // Check if last follow-up assistant message needs content update
  useEffect(() => {
    if (followUpMessages.length === 0) return;

    const lastFollowUp = followUpMessages[followUpMessages.length - 1];
    if (lastFollowUp.role === "assistant") {
      // Get the start point for this assistant turn
      const assistantCount = followUpMessages.filter(m => m.role === "assistant").length;
      const startPoint = splitPoints.current[assistantCount - 1] || 0;
      const newContent = totalAssistantContent.slice(startPoint);

      if (newContent && newContent !== lastFollowUp.content) {
        setFollowUpMessages(prev => prev.map((m, i) =>
          i === prev.length - 1 ? { ...m, content: newContent } : m
        ));
      }
    }
  }, [totalAssistantContent, followUpMessages]);

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
        // Record the current content length as a split point
        splitPoints.current.push(totalAssistantContent.length);

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
    [workflowRunId, sendInitialMessage, totalAssistantContent]
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
