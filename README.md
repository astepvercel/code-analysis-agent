# Code Analysis Agent Demo

An interactive, multi-turn AI-powered code analysis chatbot built with Next.js, Vercel Workflow DevKit, and Vercel Sandboxes.

## Project Overview

**Type:** Multi-turn AI-powered code analysis chatbot
**Stack:** Next.js 16 + Vercel Workflow DevKit + Vercel Sandboxes + Claude AI (via AWS Bedrock)
**Purpose:** An interactive chat interface where users can analyze GitHub repositories using an AI agent with persistent sandbox capabilities

---

## Architectural Overview

### Core Architecture Pattern: "1:1:1 Persistent Architecture"

- **1 Workflow per conversation** (long-running, durable)
- **1 DurableAgent per conversation** (maintains context)
- **1 persistent Sandbox per conversation** (survives across messages)

### Component Layers

```
┌─────────────────────────────────────────┐
│         Frontend (Next.js App)          │
│  - React chat UI (app/page.tsx)        │
│  - WorkflowChatTransport                │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│         API Routes (Next.js)            │
│  - /api/chat (start workflow)           │
│  - /api/[id]/stream (resume via hook)   │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│    Vercel Workflow (workflows/index.ts) │
│  - chatWorkflow (durable function)      │
│  - DurableAgent (AI orchestration)      │
│  - Hooks (multi-turn pause/resume)      │
└─────┬───────────────────────┬───────────┘
      │                       │
┌─────▼────────┐    ┌────────▼──────────┐
│ Vercel       │    │ Tools & Steps     │
│ Sandbox      │    │ - git_clone       │
│ (Persistent) │◄───┤ - list_files      │
│              │    │ - read_file       │
└──────────────┘    │ - search_files    │
                    └───────────────────┘
```

---

## Feature Overview

### 1. Multi-Turn Conversational AI
- Persistent conversation state across multiple messages
- Context-aware responses using full conversation history
- Checkpoint/replay mechanism for durability

### 2. Persistent Sandbox Environment
- **Vercel Sandbox** (Linux MicroVM) created once per conversation
- Sandbox persists across all messages in the conversation
- Cloned repositories, files, and state maintained between messages
- 2 vCPUs, configurable timeout (5 minutes default)

### 3. Code Analysis Tools

| Tool | Description | Implementation |
|------|-------------|----------------|
| **git_clone** | Clone GitHub repositories | `workflows/steps/git-clone.ts` |
| **list_files** | List directory contents | `workflows/steps/list-dir.ts` |
| **read_file** | Read file contents | `workflows/steps/read-file.ts` |
| **search_files** | Search with grep | `workflows/steps/search-file.ts` |

Each tool:
- Uses `'use step'` for checkpointing
- Automatic retries on failure
- Operates in persistent sandbox environment

### 4. Streaming Responses
- Real-time streaming of AI responses to the UI
- Token-by-token display using AI SDK's streaming API
- Tool execution shown inline with progress indicators

### 5. Durability & Fault Tolerance
- **Workflow checkpointing**: Automatic resume on failure
- **Step checkpointing**: Individual tool executions are durable
- **Hook-based resumption**: Multi-turn via `chatMessageHook`

---

## Vercel Technologies Demonstrated

### 1. Vercel Workflow DevKit

**Demonstrated features:**
- `'use workflow'` directive for durable workflows
- `'use step'` directive for checkpointed operations
- `defineHook()` and `invokeHook()` for multi-turn patterns
- Checkpoint/replay mechanism
- `getWritable()` for streaming to client
- Integration with AI SDK

**Example:**
```typescript
// workflows/index.ts
export async function chatWorkflow(conversationId: string, initMessages: UIMessage[]) {
  'use workflow'; // Makes entire function durable

  const sandboxId = await createConversationSandbox(); // Checkpointed with 'use step'
  const agent = new DurableAgent({...});
  const chatHook = chatMessageHook.create({ token: conversationId });

  while (true) {
    await agent.stream({ messages, writable });
    const { message } = await chatHook; // Pauses here, resumes on new message
    if (message === "/done") break;
    messages.push({ role: "user", content: message });
  }
}
```

### 2. Vercel Sandboxes

**Demonstrated features:**
- **Persistent sandbox pattern**: 1 sandbox per conversation
- **Sandbox lifecycle management**: Create → Use → Stop
- **Stateful operations**: Clone repos once, access many times
- **Command execution**: `sandbox.runCommand()` for bash operations
- **Integration with workflows**: Sandbox ID passed through steps

**Example:**
```typescript
// workflows/tools/sandbox.ts
export async function createConversationSandbox() {
  'use step'; // Critical for not creating multiple sandboxes on replay
  const sandbox = await Sandbox.create({
    resources: { vcpus: 2 },
    timeout: ms("5m"),
    runtime: "node22",
  });
  return sandbox.sandboxId; // Return ID, reconstruct in steps
}
```

### 3. AI Gateway

**Demonstrated features:**
- Model routing through Vercel AI Gateway
- Support for multiple providers 

### 4. @workflow/ai (DurableAgent)

**Demonstrated features:**
- `DurableAgent` for persistent AI agents in workflows
- Tool integration with AI SDK's `tool()` wrapper
- Streaming responses with `agent.stream()`
- Multi-turn agent with conversation history

### 5. WorkflowChatTransport

**Demonstrated features:**
- Custom chat transport for workflow integration
- Hook-based message passing to running workflows
- Automatic stream reconnection
- `onChatSendMessage` and `onChatEnd` lifecycle hooks

---

## Project Structure

```
demo-v2/
├── app/
│   ├── api/
│   │   ├── chat/route.ts              # Start new workflow
│   │   └── [id]/stream/route.ts       # Resume workflow via hook
│   ├── lib/
│   │   └── gateway.ts                 # AI Gateway config
│   ├── layout.tsx                     # Root layout
│   └── page.tsx                       # Main chat UI (455 lines)
│
├── workflows/
│   ├── index.ts                       # Main workflow orchestration
│   ├── config/
│   │   └── system-prompt.ts           # AI system prompt
│   ├── hooks/
│   │   └── chat-message.ts            # Hook definition for multi-turn
│   ├── tools/
│   │   ├── createDurableSandboxTools.ts  # Tool definitions
│   │   └── sandbox.ts                    # Sandbox creation/management
│   └── steps/
│       ├── git-clone.ts               # Git clone step
│       ├── list-dir.ts                # List directory step
│       ├── read-file.ts               # Read file step
│       └── search-file.ts             # Search files step
│
├── package.json                       # Dependencies
├── .env.local                         # Environment variables
└── README.md                          # This file
```

---

## Demo Workflow Example

**User:** "Analyze https://github.com/vercel/next.js"

### Behind the Scenes:

1. **Message 1**: "Clone and summarize structure"
   - Workflow starts, creates persistent sandbox
   - Agent calls `git_clone` tool → clones repo to sandbox
   - Agent calls `list_files` tool → explores structure
   - Streams response to UI

2. **Hook Pause**: Workflow waits at `await chatHook`

3. **Message 2**: "Show me the routing implementation"
   - Hook triggered, workflow resumes from pause
   - Same sandbox (repo still there!)
   - Agent calls `search_files` → finds routing files
   - Agent calls `read_file` → reads specific files
   - Streams response to UI

4. **User types** `/done` → Workflow stops sandbox and exits

---

## Getting Started

### Prerequisites

- Node.js 20+
- Vercel account with Workflow DevKit access
- AWS Bedrock access (or alternative AI provider)

### Installation

1. Clone this repository:
```bash
git clone <repository-url>
cd demo-v2
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:

Create a `.env.local` file with:
```bash
# Vercel OIDC Token (for Sandboxes)
VERCEL_OIDC_TOKEN=your_token_here

# AI Gateway API Key
AI_GATEWAY_API_KEY=your_api_key_here
```

To get these credentials:
- **VERCEL_OIDC_TOKEN**: Run `vercel env pull` or get from Vercel dashboard
- **AI_GATEWAY_API_KEY**: Create in Vercel dashboard under AI Gateway settings

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

### Usage

1. Type a message to start analyzing a repository (e.g., "Clone https://github.com/vercel/next.js")
2. Continue the conversation - the sandbox and context persist
3. Type `/done` to end the conversation and stop the sandbox

---

## Development

### Building for Production

```bash
npm run build
```

### Deploying to Vercel

```bash
vercel deploy
```

Make sure to set the environment variables in your Vercel project settings:
- `VERCEL_OIDC_TOKEN`
- `AI_GATEWAY_API_KEY`

---

## Key Concepts

### Workflow Durability
All workflow operations are checkpointed. If the workflow is interrupted, it automatically resumes from the last checkpoint.

### Persistent Sandbox Pattern
The sandbox is created once per conversation using `'use step'`. On workflow replays (e.g., when resuming after a hook), the same sandbox is reused rather than creating a new one.

### Multi-Turn via Hooks
The workflow pauses at `await chatHook`, allowing the frontend to send follow-up messages. Each new message triggers hook invocation, resuming the workflow from where it paused.

### Tool Checkpointing
Each tool's `execute` function uses `'use step'`, making individual tool calls durable with automatic retries on failure.

---

## More

- [Vercel Workflow DevKit Documentation](https://vercel.com/docs/workflow)
- [Vercel Sandboxes Documentation](https://vercel.com/docs/sandboxes)
- [Vercel AI SDK Documentation](https://sdk.vercel.ai/docs)
- [Next.js Documentation](https://nextjs.org/docs)
