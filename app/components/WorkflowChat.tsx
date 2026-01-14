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
  const assistantContentLengthAtSplit = useRef(0);

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

    // Add first assistant response (content up to split point, or all if no follow-ups)
    if (streamAssistant) {
      const firstAssistantContent = followUpMessages.length > 0
        ? totalAssistantContent.slice(0, assistantContentLengthAtSplit.current)
        : totalAssistantContent;

      if (firstAssistantContent) {
        result.push({
          id: "assistant-turn-1",
          role: "assistant",
          content: firstAssistantContent,
          parts: followUpMessages.length > 0
            ? [{ type: "text", text: firstAssistantContent }]
            : streamAssistant.parts,
        } as Message);
      }
    }

    // Add follow-up messages (user messages + their assistant responses)
    let contentOffset = assistantContentLengthAtSplit.current;
    for (const msg of followUpMessages) {
      if (msg.role === "user") {
        result.push(msg);
      } else if (msg.role === "assistant") {
        // Get this assistant turn's content from the stream
        const turnContent = totalAssistantContent.slice(contentOffset);
        result.push({
          ...msg,
          content: turnContent,
          parts: [{ type: "text", text: turnContent }],
        } as Message);
        contentOffset = totalAssistantContent.length;
      }
    }

    return result;
  }, [streamMessages, streamAssistant, totalAssistantContent, followUpMessages]);

  // Check if last follow-up assistant message needs content update
  useEffect(() => {
    if (followUpMessages.length === 0) return;

    const lastFollowUp = followUpMessages[followUpMessages.length - 1];
    if (lastFollowUp.role === "assistant") {
      // Content comes from stream, already handled in displayMessages useMemo
      // Just trigger re-render by updating the message
      const newContent = totalAssistantContent.slice(assistantContentLengthAtSplit.current);
      if (newContent && newContent !== lastFollowUp.content) {
        setFollowUpMessages(prev => prev.map((m, i) =>
          i === prev.length - 1 ? { ...m, content: newContent } : m
        ));
      }
    }
  }, [totalAssistantContent, followUpMessages]);

  // Status logic
  // Show streaming indicator when:
  // 1. Waiting for first response (last message is user)
  // 2. OR actively streaming content (useChat status is streaming)
  const lastMessage = displayMessages[displayMessages.length - 1];
  const hasSentMessage = displayMessages.length > 0 || status === "submitted";
  const isWaitingForFirstToken = hasSentMessage && (lastMessage?.role === "user" || status === "submitted");
  const isActivelyStreaming = status === "streaming";

  //new
  const isWaitingForResponse = lastMessage?.role === "user" || status === "submitted";
  var effectiveStatus = isWaitingForResponse ? "streaming" : "ready";

  const showStreamingIndicator = effectiveStatus || isActivelyStreaming;


  // Handle sending messages
  const handleSend = useCallback(
    async (text: string) => {
      if (!workflowRunId) {
        // First message - start workflow via transport
        await sendInitialMessage({ text, metadata: { createdAt: Date.now() } });
      } else {
        // Follow-up message
        // Record where to split assistant content
        assistantContentLengthAtSplit.current = totalAssistantContent.length;

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

  effectiveStatus = showStreamingIndicator ? "streaming" : "ready";

  return (
    <ChatUI
      messages={displayMessages}
      status={effectiveStatus}
      onSend={handleSend}
      mode="workflow"
    />
  );
}
