/** Available agent implementation modes */
export type AgentMode = 'bash-tool' | 'workflow';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  parts?: MessagePart[];
  content?: string; // useChat may use content instead of parts for local user messages
}

export interface MessagePart {
  type: string;
  text?: string;
  state?: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
  data?: unknown;
}
