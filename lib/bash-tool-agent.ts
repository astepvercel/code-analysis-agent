/**
 * Sandbox management for BASH-TOOL MODE (stateless request/response).
 *
 * ## Architecture: Why This File Exists Separately
 *
 * This codebase demonstrates TWO different approaches to building AI agents:
 *
 * 1. **Bash-Tool Mode** (this file) - Traditional stateless API pattern
 *    - Each HTTP request is independent
 *    - Sandbox persistence is managed via in-memory Map
 *    - Uses `bash-tool` library for tool creation
 *    - Simpler, but sandbox state can be lost on server restart
 *
 * 2. **Workflow Mode** (workflows/tools/sandbox.ts) - Durable workflow pattern
 *    - Uses Vercel Workflow's `'use step'` directive
 *    - Sandbox ID is checkpointed and survives replays
 *    - Guaranteed exactly-once execution
 *    - More complex, but resilient to failures
 *
 * ## Why Not Unify?
 *
 * These serve different purposes:
 * - Bash-tool mode needs the full Sandbox object to pass to `createBashTool()`
 * - Workflow mode only needs the sandboxId (steps reconnect via Sandbox.get())
 * - Bash-tool mode manages its own mapping; workflow mode relies on checkpointing
 *
 * ## When to Use Which
 *
 * - Use bash-tool mode for simple, stateless agents
 * - Use workflow mode when you need durability, long-running tasks, or recovery
 */

import { createBashTool } from "bash-tool";
import { Sandbox } from "@vercel/sandbox";
import { SANDBOX_CONFIG, log } from "./config";

// Server-side mapping: conversationId -> sandboxId
// Note: This is in-memory and will be lost on server restart.
// For production, consider using Redis or a database.
const sandboxMap = new Map<string, string>();

/**
 * Gets or creates a sandbox for the given conversation.
 *
 * Uses an in-memory Map to track sandbox IDs across requests.
 * Returns the full Sandbox object (needed by bash-tool library).
 */
export async function getOrCreateSandbox(
  conversationId: string
): Promise<Sandbox> {
  const existingSandboxId = sandboxMap.get(conversationId);

  if (existingSandboxId) {
    log.sandbox(`Reconnecting to sandbox: ${existingSandboxId}`);
    try {
      const sandbox = await Sandbox.get({ sandboxId: existingSandboxId });
      return sandbox;
    } catch {
      log.sandbox("Failed to reconnect, creating new sandbox");
      sandboxMap.delete(conversationId);
    }
  }

  log.sandbox(`Creating new sandbox for conversation: ${conversationId}`);
  const sandbox = await Sandbox.create({
    resources: { vcpus: SANDBOX_CONFIG.vcpus },
    timeout: SANDBOX_CONFIG.timeout,
    runtime: SANDBOX_CONFIG.runtime,
  });

  sandboxMap.set(conversationId, sandbox.sandboxId);
  log.sandbox(`Created sandbox: ${sandbox.sandboxId}`);

  // Create the workspace directory that bash-tool expects
  log.sandbox("Creating workspace directory...");
  await sandbox.runCommand("mkdir", ["-p", SANDBOX_CONFIG.workspacePath]);

  return sandbox;
}

/**
 * Creates bash tools with logging hooks.
 */
export async function createBashTools(sandbox: Sandbox) {
  const { tools } = await createBashTool({
    sandbox,
    onBeforeBashCall: ({ command }) => {
      log.step("bash", "Running:", command);
      return undefined;
    },
    onAfterBashCall: ({ command, result }) => {
      const status =
        result.exitCode === 0 ? "OK" : `FAILED (${result.exitCode})`;
      log.step("bash", `${status}:`, command.slice(0, 100));
      if (result.exitCode !== 0 && result.stderr) {
        log.error("bash", result.stderr.slice(0, 200));
      }
      return undefined;
    },
  });

  return tools;
}
