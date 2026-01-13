export type BashImplementation = 'bash-tool' | 'custom';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  parts?: MessagePart[];
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
