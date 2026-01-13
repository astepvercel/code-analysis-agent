"use client";

import { useState, useEffect } from "react";
import type { BashImplementation } from "./client/types";
import {
  getImplementation,
  setImplementation,
  clearConversation,
} from "./client/session";
import { BashToolChat } from "./components/BashToolChat";
import { WorkflowChat } from "./components/WorkflowChat";
import { STORAGE_KEYS } from "@/lib/config";

export default function ChatPage() {
  const [currentMode, setCurrentMode] = useState<BashImplementation>("bash-tool");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setCurrentMode(getImplementation());
    setMounted(true);
  }, []);

  const handleModeSwitch = (newMode: BashImplementation) => {
    if (newMode === currentMode) return;

    const hasActiveSession =
      sessionStorage.getItem(STORAGE_KEYS.workflowRunId) ||
      sessionStorage.getItem(STORAGE_KEYS.conversationId);

    if (
      hasActiveSession &&
      !confirm("Switching modes requires a new conversation. Continue?")
    ) {
      return;
    }

    clearConversation();
    setImplementation(newMode);
    setCurrentMode(newMode);
    window.location.reload();
  };

  const startNewConversation = () => {
    sessionStorage.clear();
    window.location.reload();
  };

  if (!mounted) {
    return <div className="page loading">Loading...</div>;
  }

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
              className={currentMode === "custom" ? "active" : ""}
              onClick={() => handleModeSwitch("custom")}
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
    </div>
  );
}
