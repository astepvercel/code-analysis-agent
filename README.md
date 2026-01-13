# Code Analysis Agent

AI-powered code analysis chatbot with two architecture options.

## Quick Start

```bash
npm install
vercel env pull
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Two Architectures

This demo shows two approaches to building AI agents with Vercel infrastructure:

### 1. Bash-Tool Mode (Recommended for demos)

**Path:** `/api/bash-tool/chat`

Simple stateless API pattern using the `bash-tool` library.

```
Request → Create/Reuse Sandbox → Run Agent → Stream Response
```

**Pros:**
- Simple, easy to understand
- Fast iteration during development
- No workflow complexity
- Works well for single-turn or simple multi-turn

**Cons:**
- Sandbox state in memory (lost on server restart)
- No automatic retries or durability
- Less resilient to failures

### 2. Workflow Mode (Production-ready)

**Path:** `/api/chat`

Durable workflow pattern using Vercel Workflow DevKit.

```
Request → Start Workflow → Create Sandbox (checkpointed) → Run Agent → Wait for Hook → Resume
```

**Pros:**
- Durable: survives crashes, auto-resumes
- Checkpointed: sandbox created exactly once
- Production-ready patterns
- True multi-turn with hook-based resumption

**Cons:**
- More complex to debug
- Hook system adds latency
- Overkill for simple use cases

## Architecture Comparison

| Feature | Bash-Tool Mode | Workflow Mode |
|---------|---------------|---------------|
| Complexity | Low | High |
| Durability | None | Full |
| Multi-turn | Basic | Native (hooks) |
| Sandbox persistence | In-memory map | Checkpointed |
| Best for | Demos, prototypes | Production |

## Tech Stack

- **Next.js 16** - App router
- **Vercel Sandbox** - Isolated code execution
- **Vercel Workflow** - Durable functions (workflow mode)
- **AI SDK** - Agent orchestration
- **bash-tool** - Simplified tool creation

## Project Structure

```
├── app/
│   ├── api/
│   │   ├── bash-tool/chat/   # Bash-tool mode endpoint
│   │   ├── chat/             # Workflow mode endpoint
│   │   └── [id]/stream/      # Workflow hook resume
│   └── components/           # React UI
├── lib/
│   ├── bash-tool-agent.ts    # Bash-tool sandbox management
│   ├── config.ts             # Shared config
│   └── system-prompt.ts      # AI prompts
└── workflows/
    ├── custom-bash/          # Workflow definition
    ├── steps/                # Durable tool steps
    └── hooks/                # Multi-turn hooks
```

## Usage

1. Select mode (toggle in header)
2. Ask to analyze a repo: "Analyze https://github.com/user/repo"
3. Follow up with questions about the code
4. Sandbox persists across messages

## Links

- [Vercel Sandbox Docs](https://vercel.com/docs/sandboxes)
- [Vercel Workflow Docs](https://vercel.com/docs/workflow)
- [AI SDK Docs](https://sdk.vercel.ai/docs)
