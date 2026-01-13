import type { BashImplementation } from "./types";
import { STORAGE_KEYS } from "@/lib/config";

export function getConversationId(): string {
  if (typeof window === "undefined") return "conv-default";

  let id = sessionStorage.getItem(STORAGE_KEYS.conversationId);
  if (!id) {
    id = `conv-${Math.random().toString(36).slice(2, 9)}`;
    sessionStorage.setItem(STORAGE_KEYS.conversationId, id);
  }
  return id;
}

export function getImplementation(): BashImplementation {
  if (typeof window === "undefined") return "bash-tool";
  return (
    (sessionStorage.getItem(STORAGE_KEYS.implementation) as BashImplementation) ||
    "bash-tool"
  );
}

export function setImplementation(impl: BashImplementation): void {
  if (typeof window !== "undefined") {
    sessionStorage.setItem(STORAGE_KEYS.implementation, impl);
  }
}

export function clearConversation(): void {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(STORAGE_KEYS.conversationId);
    sessionStorage.removeItem(STORAGE_KEYS.workflowRunId);
    sessionStorage.removeItem(STORAGE_KEYS.chatHistory);
  }
}
