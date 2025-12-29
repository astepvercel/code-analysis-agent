'use client';

import React from 'react';
import { useChat } from "@ai-sdk/react";
import { WorkflowChatTransport } from "@workflow/ai";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function getOrCreateConversationId() {
  if (typeof window === 'undefined') return 'conv-default';

  let convId = sessionStorage.getItem('conversation-id');
  if (!convId) {
    convId = `conv-${Math.random().toString(36).slice(2, 9)}`;
    sessionStorage.setItem('conversation-id', convId);
  }
  return convId;
}

export default function ChatPage() {

  const { messages, sendMessage, status } = useChat({
    transport: new WorkflowChatTransport({
      prepareSendMessagesRequest: ({ messages, ...rest }) => ({
        ...rest,
        body: {
          messages,
          conversationId: getOrCreateConversationId(),
        },
      }),

      onChatSendMessage: (response, options) => {
        console.log("Chat started - Extracting workflow run ID");
        const workflowRunId = response.headers.get("x-workflow-run-id");

        if (workflowRunId) {
          sessionStorage.setItem("workflow-run-id", workflowRunId);
          console.log("Workflow run ID saved:", workflowRunId);
        } else {
          console.error("No workflow run ID found in response headers!");
        }
        sessionStorage.setItem("chat-history", JSON.stringify(options.messages));
      },

      onChatEnd: ({ chatId, chunkIndex }) => {
        console.log("Chat ended successfully");
        console.log(`Final state: chatId=${chatId}, chunks=${chunkIndex}`);
      },

      prepareReconnectToStreamRequest: ({ id, api, ...rest }) => {
        console.log("Connection dropped! Attempting to reconnect...");

        const workflowRunId = sessionStorage.getItem("workflow-run-id");
        const conversationId = sessionStorage.getItem("conversation-id");

        if (!workflowRunId) {
          console.error("Can't reconnect - no workflow run ID found!");
          throw new Error("No active workflow run ID found");
        }

        if (!conversationId) {
          console.error("Can't reconnect - no conversation run ID found!");
          throw new Error("No active conversation run ID found");
        }

        const reconnectUrl = `/api/${encodeURIComponent(conversationId)}/stream/`;
        console.log("Reconnecting to:", reconnectUrl);

        return {
          ...rest,
          api: reconnectUrl,
        };
      },

      maxConsecutiveErrors: 5,
    }),
  });

  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: "#0a0a0a",
      color: "#ededed",
      fontFamily: "var(--font-mono), 'SF Mono', Monaco, 'Cascadia Code', monospace"
    }}>
      <div style={{
        borderBottom: "1px solid #2a2a2a",
        padding: "20px 40px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
      }}>
        <div>
          <h1 style={{
            fontSize: "24px",
            fontWeight: "600",
            margin: "0 0 8px 0",
            letterSpacing: "-0.02em"
          }}>
            Code Analysis Agent
          </h1>
          <div style={{
            fontSize: "12px",
            color: "#888",
            textTransform: "uppercase",
            letterSpacing: "0.05em"
          }}>
            Powered by Vercel Workflow, Vercel Sandboxes & AI Gateway
          </div>
        </div>

        <button
          onClick={() => {
            console.log("🆕 Starting new conversation");
            sessionStorage.clear();
            window.location.reload();
          }}
          style={{
            padding: "10px 20px",
            backgroundColor: "#1a1a1a",
            color: "#ededed",
            border: "1px solid #8b5cf6",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: "500",
            fontSize: "14px",
            fontFamily: "inherit",
            transition: "all 0.2s"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#8b5cf6";
            e.currentTarget.style.borderColor = "#a78bfa";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "#1a1a1a";
            e.currentTarget.style.borderColor = "#8b5cf6";
          }}
        >
          New Conversation
        </button>
      </div>

      <div style={{
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "40px"
      }}>
        <div style={{
          minHeight: "500px",
          maxHeight: "calc(100vh - 300px)",
          overflowY: "auto",
          marginBottom: "30px",
          paddingRight: "10px"
        }}>
          {messages.length === 0 ? (
            <div style={{
              textAlign: "center",
              padding: "60px 20px",
              color: "#666"
            }}>
              <div style={{ fontSize: "48px", marginBottom: "20px" }}>💬</div>
              <div style={{ fontSize: "18px", marginBottom: "10px" }}>Start a conversation</div>
              <div style={{ fontSize: "14px", color: "#555" }}>
                Ask me to analyze any GitHub repository
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                style={{
                  marginBottom: "24px",
                  padding: "20px",
                  backgroundColor: "#1a1a1a",
                  borderRadius: "8px",
                  border: `1px solid ${message.role === "user" ? "#3b3b3b" : "#8b5cf6"}`,
                  transition: "border-color 0.2s"
                }}
              >
                <div style={{
                  fontSize: "11px",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  marginBottom: "12px",
                  color: message.role === "user" ? "#888" : "#a78bfa",
                  fontWeight: "600"
                }}>
                  {message.role === "user" ? "You" : "Assistant"}
                </div>

                {message.parts.map((part, partIndex): React.ReactNode => {
                  if (part.type === "text") {
                    return (
                      <div key={partIndex} style={{
                        lineHeight: "1.6",
                        fontSize: "14px"
                      }}
                      className="markdown-content"
                      >
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {part.text}
                        </ReactMarkdown>
                      </div>
                    );
                  }

                  if (part.type.startsWith("tool-")) {
                    const toolPart = part as {
                      type: string;
                      state?: string;
                      input?: any;
                      output?: any;
                      errorText?: string;
                    };

                    const toolName = toolPart.type.replace("tool-", "");
                    const isExecuting = toolPart.state === "executing";
                    const isComplete = toolPart.state === "output-available" || toolPart.state === "done";
                    const isError = toolPart.state === "output-error";

                    return (
                      <div
                        key={partIndex}
                        style={{
                          marginTop: "16px",
                          padding: "16px",
                          backgroundColor: "#0f0f0f",
                          border: `1px solid ${isError ? "#dc2626" : isComplete ? "#10b981" : "#f59e0b"}`,
                          borderRadius: "6px"
                        }}
                      >
                        <div style={{
                          fontSize: "11px",
                          textTransform: "uppercase",
                          letterSpacing: "0.1em",
                          marginBottom: "12px",
                          fontWeight: "600",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px"
                        }}>
                          <span style={{
                            display: "inline-block",
                            width: "6px",
                            height: "6px",
                            borderRadius: "50%",
                            backgroundColor: isError ? "#dc2626" : isComplete ? "#10b981" : "#f59e0b"
                          }} />
                          <span style={{
                            color: isError ? "#fca5a5" : isComplete ? "#86efac" : "#fbbf24"
                          }}>
                            {isExecuting && "Executing"}
                            {isComplete && "Completed"}
                            {isError && "Failed"}
                          </span>
                          <span style={{ color: "#888" }}>•</span>
                          <span style={{ color: "#a78bfa" }}>{toolName}</span>
                        </div>

                        {toolPart.input && (
                          <details style={{ marginBottom: "12px" }}>
                            <summary style={{
                              cursor: "pointer",
                              color: "#888",
                              fontSize: "12px",
                              marginBottom: "8px",
                              userSelect: "none"
                            }}>
                              Input Parameters
                            </summary>
                            <pre style={{
                              backgroundColor: "#0a0a0a",
                              padding: "12px",
                              borderRadius: "4px",
                              overflow: "auto",
                              fontSize: "11px",
                              lineHeight: "1.5",
                              border: "1px solid #2a2a2a",
                              margin: 0
                            }}>
                              {JSON.stringify(toolPart.input, null, 2)}
                            </pre>
                          </details>
                        )}

                        {isComplete && toolPart.output && (
                          <div>
                            <div style={{
                              fontSize: "12px",
                              color: "#888",
                              marginBottom: "8px",
                              fontWeight: "600"
                            }}>
                              Output:
                            </div>
                            <pre style={{
                              backgroundColor: "#0a0a0a",
                              padding: "12px",
                              borderRadius: "4px",
                              overflow: "auto",
                              fontSize: "11px",
                              lineHeight: "1.5",
                              maxHeight: "300px",
                              border: "1px solid #2a2a2a",
                              margin: 0
                            }}>
                              {(() => {
                                try {
                                  const output = String(toolPart.output);
                                  const parsed = JSON.parse(output);
                                  return JSON.stringify(parsed, null, 2);
                                } catch {
                                  return String(toolPart.output);
                                }
                              })()}
                            </pre>
                          </div>
                        )}

                        {isError && toolPart.errorText && (
                          <div style={{
                            color: "#fca5a5",
                            backgroundColor: "#1a0a0a",
                            padding: "12px",
                            borderRadius: "4px",
                            fontSize: "12px",
                            border: "1px solid #dc2626"
                          }}>
                            <strong>Error:</strong> {toolPart.errorText}
                          </div>
                        )}
                      </div>
                    );
                  }

                  if (part.type === "data-workflow" && "data" in part) {
                    return (
                      <div
                        key={partIndex}
                        style={{
                          padding: "12px",
                          backgroundColor: "#0f0f0f",
                          border: "1px solid #3b82f6",
                          borderRadius: "4px",
                          fontSize: "11px",
                          marginTop: "12px",
                          fontFamily: "monospace"
                        }}
                      >
                        {JSON.stringify((part as { data: unknown }).data)}
                      </div>
                    );
                  }

                  return (
                    <div key={partIndex} style={{ color: "#666", fontSize: "11px" }}>
                      Unknown part type: {part.type}
                    </div>
                  );
                })}
              </div>
            ))
          )}

          {status === "streaming" && messages.length > 0 && (
            <div style={{
              padding: "20px",
              textAlign: "center",
              color: "#888",
              fontSize: "14px"
            }}>
              <div style={{
                display: "inline-block",
                animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
              }}>
                💭 Thinking...
              </div>
            </div>
          )}
        </div>

        <div style={{
          position: "sticky",
          bottom: "0",
          backgroundColor: "#0a0a0a",
          paddingTop: "20px",
          paddingBottom: "20px"
        }}>
          <div style={{
            display: "flex",
            gap: "12px",
            alignItems: "center",
            backgroundColor: "#1a1a1a",
            border: "1px solid #3b3b3b",
            borderRadius: "8px",
            padding: "4px",
            transition: "border-color 0.2s"
          }}
          onFocus={(e) => e.currentTarget.style.borderColor = "#8b5cf6"}
          onBlur={(e) => e.currentTarget.style.borderColor = "#3b3b3b"}
          >
            <input
              type="text"
              placeholder="Type your message and press Enter..."
              style={{
                flex: 1,
                padding: "12px 16px",
                fontSize: "14px",
                border: "none",
                borderRadius: "6px",
                outline: "none",
                backgroundColor: "transparent",
                color: "#ededed",
                fontFamily: "inherit"
              }}
              onKeyDown={async (e) => {
                if (e.key === "Enter" && e.currentTarget.value.trim()) {
                  const message = e.currentTarget.value;
                  const inputElement = e.currentTarget;

                  const workflowRunId = sessionStorage.getItem("workflow-run-id");
                  const conversationId = sessionStorage.getItem("conversation-id");

                  console.log("📤 conversationId =", conversationId);
                  console.log("📤 workflowRunId =", workflowRunId);

                  if (workflowRunId && conversationId) {
                    console.log("📤 Sending follow-up message via hook");
                    const messageUrl = `/api/${encodeURIComponent(conversationId)}/stream/`;

                    await fetch(messageUrl, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ message })
                    });
                  } else {
                    console.log("📤 Starting new workflow");
                    sendMessage({
                      text: message,
                      metadata: { createdAt: Date.now() }
                    });
                  }
                  inputElement.value = "";
                }
              }}
              disabled={false}
            />

            <div style={{
              padding: "8px 16px",
              borderRadius: "6px",
              fontSize: "12px",
              fontWeight: "600",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              backgroundColor: status === "streaming" ? "#0a0a0a" : "#0a0a0a",
              color: status === "streaming" ? "#fbbf24" : "#10b981",
              border: `1px solid ${status === "streaming" ? "#f59e0b" : "#10b981"}`,
              minWidth: "80px",
              textAlign: "center"
            }}>
              {status === "streaming" ? "Loading" : "Ready"}
            </div>
          </div>

          <div style={{
            marginTop: "12px",
            fontSize: "11px",
            color: "#666",
            textAlign: "center"
          }}>
            Type <code style={{
              backgroundColor: "#1a1a1a",
              padding: "2px 6px",
              borderRadius: "3px",
              border: "1px solid #3b3b3b"
            }}>/done</code> to end conversation and stop sandbox
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: .5;
          }
        }

        /* Custom scrollbar */
        *::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }

        *::-webkit-scrollbar-track {
          background: #0a0a0a;
        }

        *::-webkit-scrollbar-thumb {
          background: #3b3b3b;
          border-radius: 4px;
        }

        *::-webkit-scrollbar-thumb:hover {
          background: #8b5cf6;
        }

        /* Markdown Content Styling */
        .markdown-content {
          color: #ededed;
        }

        .markdown-content h1,
        .markdown-content h2,
        .markdown-content h3,
        .markdown-content h4,
        .markdown-content h5,
        .markdown-content h6 {
          color: #ededed;
          font-weight: 600;
          margin-top: 24px;
          margin-bottom: 16px;
          line-height: 1.25;
        }

        .markdown-content h1 {
          font-size: 2em;
          border-bottom: 1px solid #3b3b3b;
          padding-bottom: 0.3em;
        }

        .markdown-content h2 {
          font-size: 1.5em;
          border-bottom: 1px solid #3b3b3b;
          padding-bottom: 0.3em;
        }

        .markdown-content h3 {
          font-size: 1.25em;
        }

        .markdown-content h4 {
          font-size: 1em;
        }

        .markdown-content h5 {
          font-size: 0.875em;
        }

        .markdown-content h6 {
          font-size: 0.85em;
          color: #888;
        }

        .markdown-content p {
          margin-bottom: 16px;
          line-height: 1.6;
        }

        .markdown-content strong {
          font-weight: 600;
          color: #fff;
        }

        .markdown-content em {
          font-style: italic;
        }

        .markdown-content code {
          background-color: #1a1a1a;
          border: 1px solid #3b3b3b;
          border-radius: 3px;
          padding: 2px 6px;
          font-size: 0.9em;
          font-family: var(--font-mono), monospace;
        }

        .markdown-content pre {
          background-color: #0f0f0f;
          border: 1px solid #3b3b3b;
          border-radius: 6px;
          padding: 16px;
          overflow-x: auto;
          margin-bottom: 16px;
        }

        .markdown-content pre code {
          background: none;
          border: none;
          padding: 0;
          font-size: 0.875em;
          line-height: 1.5;
        }

        .markdown-content ul,
        .markdown-content ol {
          margin-bottom: 16px;
          padding-left: 2em;
        }

        .markdown-content li {
          margin-bottom: 8px;
        }

        .markdown-content ul {
          list-style-type: disc;
        }

        .markdown-content ol {
          list-style-type: decimal;
        }

        .markdown-content blockquote {
          border-left: 4px solid #8b5cf6;
          padding-left: 16px;
          margin-left: 0;
          margin-bottom: 16px;
          color: #aaa;
          font-style: italic;
        }

        .markdown-content a {
          color: #8b5cf6;
          text-decoration: none;
          border-bottom: 1px solid transparent;
          transition: border-color 0.2s;
        }

        .markdown-content a:hover {
          border-bottom-color: #8b5cf6;
        }

        .markdown-content hr {
          border: none;
          border-top: 1px solid #3b3b3b;
          margin: 24px 0;
        }

        .markdown-content table {
          border-collapse: collapse;
          width: 100%;
          margin-bottom: 16px;
        }

        .markdown-content th,
        .markdown-content td {
          border: 1px solid #3b3b3b;
          padding: 8px 12px;
          text-align: left;
        }

        .markdown-content th {
          background-color: #1a1a1a;
          font-weight: 600;
        }

        .markdown-content tr:nth-child(even) {
          background-color: #0f0f0f;
        }
      `}</style>
    </div>
  );
}
