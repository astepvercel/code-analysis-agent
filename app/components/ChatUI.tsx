'use client';

import { useRef, useEffect, useCallback } from 'react';
import type { Message } from "../client/types";
import { MessagePartRenderer } from './MessageRenderer';

interface ChatUIProps {
  messages: Message[];
  status: string;
  onSend: (text: string) => void;
}

export function ChatUI({ messages, status, onSend }: ChatUIProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isNearBottomRef = useRef(true);
  const isStreaming = status === 'streaming';

  // Check if user is near bottom (within 100px)
  const checkIfNearBottom = useCallback(() => {
    if (!scrollRef.current) return true;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    return scrollHeight - scrollTop - clientHeight < 100;
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

  const handleSubmit = () => {
    const value = inputRef.current?.value.trim();
    if (value) {
      onSend(value);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="chat-container">
      <div className="messages" ref={scrollRef} onScroll={handleScroll}>
        {messages.length === 0 ? (
          <EmptyState />
        ) : (
          messages.map((message) => (
            <div key={message.id} className={`message ${message.role}`}>
              <div className="message-role">
                {message.role === 'user' ? 'You' : 'Assistant'}
              </div>
              <div className="message-content">
                {message.parts?.map((part, i) => (
                  <MessagePartRenderer key={i} part={part} />
                ))}
              </div>
            </div>
          ))
        )}
        {isStreaming && messages.length > 0 && <StreamingIndicator />}
      </div>

      <div className="input-container">
        <input
          ref={inputRef}
          type="text"
          placeholder="Type your message..."
          className="chat-input"
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        />
        <div className={`status-badge ${isStreaming ? 'streaming' : 'ready'}`}>
          {isStreaming ? 'Streaming' : 'Ready'}
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </div>
      <p className="empty-title">Start a conversation</p>
      <p className="empty-subtitle">Ask me to analyze any GitHub repository</p>
    </div>
  );
}

function StreamingIndicator() {
  return (
    <div className="streaming-indicator">
      <span className="dot" />
      <span className="dot" />
      <span className="dot" />
    </div>
  );
}
