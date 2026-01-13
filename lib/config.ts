import ms from "ms";

/**
 * Centralized configuration for the Code Analysis Agent.
 */

// Model configuration
export const MODEL_ID = "anthropic/claude-haiku-4.5" as const;

// Sandbox configuration - shared across all modes
export const SANDBOX_CONFIG = {
  timeout: ms("20m"),
  vcpus: 2,
  runtime: "node22" as const,
  workspacePath: "/vercel/sandbox/workspace",
} as const;

// Session storage keys
export const STORAGE_KEYS = {
  conversationId: "conversation-id",
  workflowRunId: "workflow-run-id",
  implementation: "bash-implementation",
  chatHistory: "chat-history",
} as const;

/**
 * Step names for consistent logging.
 *
 * Convention: kebab-case for all step identifiers.
 * Used in log.step(STEP_NAMES.bash, "message")
 */
export const STEP_NAMES = {
  bash: "bash",
  gitClone: "git-clone",
  readFile: "read-file",
  listDirectory: "list-directory",
  searchFiles: "search-files",
} as const;

/**
 * Tool names as exposed to the AI model.
 *
 * ## Naming Convention
 *
 * Tool names use snake_case (AI SDK convention) while internal
 * function names use camelCase (TypeScript convention).
 *
 * Mapping:
 * - git_clone    → cloneRepository()
 * - list_files   → listDirectory()
 * - read_file    → readFile()
 * - search_files → searchFiles()
 * - bash         → runBash()
 */
export const TOOL_NAMES = {
  gitClone: "git_clone",
  listFiles: "list_files",
  readFile: "read_file",
  searchFiles: "search_files",
  bash: "bash",
} as const;

/**
 * Consistent logging utility.
 * All logs follow the pattern: [Context] message
 */
export const log = {
  api: (message: string, ...args: unknown[]) =>
    console.log(`[API] ${message}`, ...args),

  workflow: (message: string, ...args: unknown[]) =>
    console.log(`[Workflow] ${message}`, ...args),

  step: (name: string, message: string, ...args: unknown[]) =>
    console.log(`[Step:${name}] ${message}`, ...args),

  sandbox: (message: string, ...args: unknown[]) =>
    console.log(`[Sandbox] ${message}`, ...args),

  error: (context: string, message: string, ...args: unknown[]) =>
    console.error(`[${context}] ERROR: ${message}`, ...args),
} as const;
