/**
 * Client-side session management utilities.
 * Manage conversation state in sessionStorage. Not suitable for production use.
 */

import type { AgentMode } from "./types";
import { STORAGE_KEYS } from "@/lib/config";

/** Check if code is running in browser */
const isBrowser = typeof window !== "undefined";

/**
 * Gets or creates a conversation ID for the current session.
 */
export function getConversationId(): string {
  if (!isBrowser) return "";

  let id = sessionStorage.getItem(STORAGE_KEYS.conversationId);
  if (!id) {
    id = `conv-${Math.random().toString(36).slice(2, 9)}`;
    sessionStorage.setItem(STORAGE_KEYS.conversationId, id);
  }
  return id;
}

/**
 * Gets the current agent mode. Defaults to "bash-tool"
 */
export function getAgentMode(): AgentMode {
  if (!isBrowser) return "bash-tool";
  return (
    (sessionStorage.getItem(STORAGE_KEYS.agentMode) as AgentMode) ||
    "bash-tool"
  );
}

/**
 * Sets the agent mode preference.
 */
export function setAgentMode(mode: AgentMode): void {
  if (!isBrowser) return;
  sessionStorage.setItem(STORAGE_KEYS.agentMode, mode);
}

/**
 * Clears all conversation-related session data.
 */
export function clearConversation(): void {
  if (!isBrowser) return;
  sessionStorage.removeItem(STORAGE_KEYS.conversationId);
  sessionStorage.removeItem(STORAGE_KEYS.workflowRunId);
  sessionStorage.removeItem(STORAGE_KEYS.sandboxId);
}

/**
 * Gets the sandbox ID for the current session.
 * Returns null if not set or during SSR.
 */
export function getSandboxId(): string | null {
  if (!isBrowser) return null;
  return sessionStorage.getItem(STORAGE_KEYS.sandboxId);
}

/**
 * Stores the sandbox ID for session persistence.
 */
export function setSandboxId(sandboxId: string): void {
  if (!isBrowser) return;
  sessionStorage.setItem(STORAGE_KEYS.sandboxId, sandboxId);
}
