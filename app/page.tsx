"use client";

import { useState, useEffect, useCallback } from "react";
import type { AgentMode } from "./client/types";
import {
  getAgentMode,
  setAgentMode,
  clearConversation,
} from "./client/session";
import { BashToolChat } from "./components/BashToolChat";
import { WorkflowChat } from "./components/WorkflowChat";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { STORAGE_KEYS } from "@/lib/config";

export default function ChatPage() {
  const [currentMode, setCurrentMode] = useState<AgentMode>("bash-tool");
  const [mounted, setMounted] = useState(false);
  const [pendingMode, setPendingMode] = useState<AgentMode | null>(null);

  useEffect(() => {
    setCurrentMode(getAgentMode());
    setMounted(true);
  }, []);

  const hasActiveSession = useCallback(() => {
    return !!(
      sessionStorage.getItem(STORAGE_KEYS.workflowRunId) ||
      sessionStorage.getItem(STORAGE_KEYS.conversationId)
    );
  }, []);

  const handleModeSwitch = (newMode: AgentMode) => {
    if (newMode === currentMode) return;

    if (hasActiveSession()) {
      // Show confirmation dialog
      setPendingMode(newMode);
    } else {
      // No active session, switch immediately
      performModeSwitch(newMode);
    }
  };

  const performModeSwitch = (newMode: AgentMode) => {
    clearConversation();
    setAgentMode(newMode);
    setCurrentMode(newMode);
    window.location.reload();
  };

  const handleConfirmSwitch = () => {
    if (pendingMode) {
      performModeSwitch(pendingMode);
    }
  };

  const handleCancelSwitch = () => {
    setPendingMode(null);
  };

  const startNewConversation = () => {
    sessionStorage.clear();
    window.location.reload();
  };

  if (!mounted) return null;

  return (
    <div className="page">
      <header>
        <div className="header-left">
          <h1>Code Analysis Agent</h1>
          <p className="subtitle">
            {currentMode === "bash-tool"
              ? "bash-tool + AI SDK"
              : "Vercel Workflow + Sandboxes"}
          </p>
        </div>
        <div className="header-right">
          <div className="mode-toggle">
            <span className="toggle-label">Mode:</span>
            <button
              className={currentMode === "bash-tool" ? "active" : ""}
              onClick={() => handleModeSwitch("bash-tool")}
            >
              bash-tool
            </button>
            <button
              className={currentMode === "workflow" ? "active" : ""}
              onClick={() => handleModeSwitch("workflow")}
            >
              Workflow
            </button>
          </div>
          <button className="new-conversation" onClick={startNewConversation}>
            New Conversation
          </button>
        </div>
      </header>

      <main>
        {currentMode === "bash-tool" ? <BashToolChat /> : <WorkflowChat />}
      </main>

      <ConfirmDialog
        isOpen={pendingMode !== null}
        title="Switch Mode?"
        message="Switching modes requires starting a new conversation. Your current conversation will be cleared."
        confirmLabel="Switch Mode"
        cancelLabel="Cancel"
        onConfirm={handleConfirmSwitch}
        onCancel={handleCancelSwitch}
      />
    </div>
  );
}
