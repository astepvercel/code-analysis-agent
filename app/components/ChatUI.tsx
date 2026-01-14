/**
 * ChatUI - Shared chat interface component.
 *
 * Renders messages, input, and status indicators for both
 * bash-tool and workflow modes. Handles auto-scroll and submission.
 */
"use client";

import { useRef, useEffect, useCallback } from 'react';
import type { Message, AgentMode } from "../client/types";
import { MessagePartRenderer } from './MessageRenderer';
import { UI_CONFIG } from '@/lib/config';

interface ChatUIProps {
  messages: Message[];
  status: string;
  onSend: (text: string) => void;
  mode: AgentMode;
}

export function ChatUI({ messages, status, onSend, mode }: ChatUIProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isNearBottomRef = useRef(true);
  const isSubmittingRef = useRef(false);
  const isStreaming = status === 'streaming';

  // Busy when streaming or submitted
  const isBusy = isStreaming || status === 'submitted';

  // Check if user is near bottom of scroll area
  const checkIfNearBottom = useCallback(() => {
    if (!scrollRef.current) return true;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    return scrollHeight - scrollTop - clientHeight < UI_CONFIG.autoScrollThreshold;
  }, []);

  // Update near-bottom state on scroll
  const handleScroll = useCallback(() => {
    isNearBottomRef.current = checkIfNearBottom();
  }, [checkIfNearBottom]);

  // Only autoscroll if user is near bottom
  useEffect(() => {
    if (scrollRef.current && isNearBottomRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, status]);

  // Reset submission lock when status changes from busy to ready
  useEffect(() => {
    if (!isBusy) {
      isSubmittingRef.current = false;
    }
  }, [isBusy]);

  const handleSubmit = useCallback(() => {
    // Prevent double submission
    if (isBusy || isSubmittingRef.current) return;

    const value = inputRef.current?.value.trim();
    if (!value) return;

    isSubmittingRef.current = true;
    onSend(value);
    if (inputRef.current) inputRef.current.value = '';
  }, [isBusy, onSend]);

  return (
    <div className="chat-container">
      <div className="messages" ref={scrollRef} onScroll={handleScroll}>
        {messages.length === 0 ? (
          <EmptyState mode={mode} />
        ) : (
          messages.map((message, index) => {
            const isLastAssistant = message.role === 'assistant' && index === messages.length - 1;
            const hasContent = message.parts?.some((p: any) => p.type === 'text' && p.text);
            const showThinking = isLastAssistant && isBusy && !hasContent;

            return (
              <div key={`${message.id}-${index}`} className={`message ${message.role}`}>
                <div className="message-role">
                  {message.role === 'user' ? 'You' : 'Assistant'}
                </div>
                <div className="message-content">
                  {/* Show "Thinking..." when waiting for first content */}
                  {showThinking && <ThinkingIndicator />}

                  {message.parts?.map((part, i) => (
                    <MessagePartRenderer key={i} part={part} />
                  ))}
                  {/* Fallback: render content if no parts */}
                  {!message.parts?.length && message.content && (
                    <p>{message.content}</p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="input-container">
        <input
          ref={inputRef}
          type="text"
          placeholder={isBusy ? "Waiting for response..." : "Type your message..."}
          className={`chat-input ${isBusy ? 'disabled' : ''}`}
          disabled={isBusy}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSubmit()}
          aria-label="Chat message input"
        />
        <button
          type="button"
          className={`send-button ${isBusy ? 'busy' : ''}`}
          onClick={handleSubmit}
          disabled={isBusy}
          aria-busy={isBusy}
        >
          {isBusy ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  );
}

function EmptyState({ mode }: { mode: AgentMode }) {
  const examplePrompts = [
    "Clone https://github.com/vercel/ai and explain the architecture",
    "Find all API routes and show me how error handling works",
    "What design patterns are used? Show me examples from the code",
  ];

  return (
    <div className="empty-state">
      <div className="empty-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </div>
      <h2 className="empty-title">Code Analysis Agent</h2>
      <p className="empty-description">
        An AI-powered assistant that can clone, explore, and analyze any GitHub repository
        in a secure sandbox environment. Ask complex questions about codebases, architecture,
        patterns, and more.
      </p>

      <div className="features-list">
        <div className="feature">
          <span className="feature-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </span>
          <span>Persistent sandbox — clone once, analyze across messages</span>
        </div>
        <div className="feature">
          <span className="feature-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </span>
          <span>Full bash access — run any command, install packages</span>
        </div>
        <div className="feature">
          <span className="feature-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </span>
          <span>Deep analysis — search patterns, read files, understand structure</span>
        </div>
      </div>

      <div className="mode-explanation">
        <p className="mode-explanation-title">Current Mode</p>
        <div className="mode-cards">
          <div className={`mode-card ${mode === 'bash-tool' ? 'active' : ''}`}>
            <div className="mode-card-header">
              <span className="mode-card-name">bash-tool</span>
              {mode === 'bash-tool' && <span className="mode-badge">Active</span>}
            </div>
            <p className="mode-card-desc">
              Stateless mode using the <code>bash-tool</code> library. Single bash tool with AI SDK streaming. Simple and fast.
            </p>
          </div>
          <div className={`mode-card ${mode === 'workflow' ? 'active' : ''}`}>
            <div className="mode-card-header">
              <span className="mode-card-name">Workflow</span>
              {mode === 'workflow' && <span className="mode-badge">Active</span>}
            </div>
            <p className="mode-card-desc">
              Durable mode using Vercel Workflows. Checkpointed steps, 5 specialized tools.
            </p>
          </div>
        </div>
      </div>

      <div className="examples-section">
        <p className="examples-title">Try asking:</p>
        <div className="example-prompts">
          {examplePrompts.map((prompt, i) => (
            <div key={i} className="example-prompt">
              <span className="example-quote">"</span>
              {prompt}
              <span className="example-quote">"</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Simple "Thinking..." indicator shown when waiting for assistant response
 * Inspired by flight booking app's shimmer effect
 */
function ThinkingIndicator() {
  return (
    <div className="thinking-indicator">
      <span className="thinking-text">Thinking</span>
      <span className="thinking-dots">
        <span className="dot" />
        <span className="dot" />
        <span className="dot" />
      </span>
    </div>
  );
}
