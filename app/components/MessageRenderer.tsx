/**
 * MessageRenderer - Renders message parts (text, tools, data).
 *
 * Handles different part types from the AI SDK stream:
 * - Text parts: rendered as markdown
 * - Tool parts: rendered with status (Running/Completed/Failed)
 * - Data parts: rendered as JSON
 */
"use client";

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { MessagePart } from "../client/types";
import { UI_CONFIG } from '@/lib/config';

export function MessagePartRenderer({ part }: { part: MessagePart }) {
  if (part.type === 'text' && part.text) {
    return (
      <div className="markdown-content">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{part.text}</ReactMarkdown>
      </div>
    );
  }

  if (part.type?.startsWith('tool-')) {
    const toolName = part.type.replace('tool-', '');
    const command = (part.input as { command?: string })?.command;

    // Tool states (inspired by flight booking app)
    const { label, className } = getToolState(part.state);

    return (
      <div className={`tool-call ${className}`}>
        <div className="tool-header">
          <span className="tool-status-dot" />
          <span className="tool-status-text">{label}</span>
          <span className="tool-name">{toolName}</span>
        </div>
        {command && (
          <code className="tool-command-preview">
            {command.length > UI_CONFIG.commandPreviewLength
              ? `${command.slice(0, UI_CONFIG.commandPreviewLength)}...`
              : command}
          </code>
        )}

        {part.input ? (
          <details className="tool-details">
            <summary>Input</summary>
            <pre>{JSON.stringify(part.input, null, 2)}</pre>
          </details>
        ) : null}

        {part.state === 'output-available' && part.output ? (
          <ToolOutputRenderer output={part.output} />
        ) : null}

        {part.state === 'output-error' && part.errorText ? (
          <div className="tool-error">Error: {part.errorText}</div>
        ) : null}
      </div>
    );
  }

  if (part.type === 'data-workflow' && part.data) {
    return <div className="workflow-data">{JSON.stringify(part.data)}</div>;
  }

  return null;
}

function ToolOutputRenderer({ output }: { output: unknown }) {
  if (typeof output === 'object' && output !== null) {
    const obj = output as Record<string, unknown>;

    if ('stdout' in obj || 'stderr' in obj || 'output' in obj) {
      const stdout = obj.stdout || obj.output || '';
      const stderr = obj.stderr || '';
      const exitCode = typeof obj.exitCode === 'number' ? obj.exitCode : 0;
      const hasStdout = stdout && String(stdout).trim();
      const hasStderr = stderr && String(stderr).trim();
      const isError = exitCode !== 0;

      return (
        <div className="tool-output">
          {hasStdout ? (
            <>
              <div className="tool-output-label">Output</div>
              <pre className="stdout">{String(stdout)}</pre>
            </>
          ) : null}

          {hasStderr ? (
            <>
              <div className={`tool-output-label ${isError ? 'stderr-label' : ''}`}>
                {isError ? 'Error' : 'Info'}
              </div>
              <pre className={isError ? 'stderr' : 'stdout-info'}>{String(stderr)}</pre>
            </>
          ) : null}

          {!hasStdout && !hasStderr ? (
            <>
              <div className="tool-output-label">Output</div>
              <div className="stdout">(no output)</div>
            </>
          ) : null}

          <details className="raw-json">
            <summary>View raw JSON</summary>
            <pre>{JSON.stringify(output, null, 2)}</pre>
          </details>
        </div>
      );
    }
  }

  // Fallback: try to render as markdown
  const content = formatOutput(output);
  return (
    <div className="tool-output">
      <div className="tool-output-label">Output</div>
      <div className="stdout markdown-content">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>
    </div>
  );
}

function formatOutput(output: unknown): string {
  if (output === null || output === undefined) {
    return String(output);
  }

  if (typeof output === 'object') {
    return JSON.stringify(output, null, 2);
  }

  if (typeof output === 'string') {
    try {
      return JSON.stringify(JSON.parse(output), null, 2);
    } catch {
      return output;
    }
  }

  return String(output);
}

/**
 * Get tool state label and CSS class
 *
 * AI SDK states vary by mode:
 * - Workflow: may use input-streaming, input-available, output-available
 * - Bash-tool: uses executing, output-available, done, output-error
 */
function getToolState(state?: string): { label: string; className: string } {
  // Completed states
  if (state === 'output-available' || state === 'done') {
    return { label: 'Completed', className: 'complete' };
  }

  // Error state
  if (state === 'output-error') {
    return { label: 'Failed', className: 'error' };
  }

  // Running states (tool is executing)
  if (state === 'executing' || state === 'input-available') {
    return { label: 'Running', className: 'running' };
  }

  // Default: still running/pending (input-streaming or undefined)
  return { label: 'Running', className: 'running' };
}
