/**
 * Sandbox management for WORKFLOW MODE (durable, checkpointed).
 *
 * ## Architecture: Why This File Exists Separately
 *
 * This codebase demonstrates TWO different approaches to building AI agents:
 *
 * 1. **Bash-Tool Mode** (lib/bash-tool-agent.ts) - Traditional stateless API
 *    - Manages sandbox via in-memory Map
 *    - Returns full Sandbox object for bash-tool library
 *    - Simpler but not durable
 *
 * 2. **Workflow Mode** (this file) - Durable workflow pattern
 *    - Uses `'use step'` directive for checkpointing
 *    - Returns only sandboxId (steps reconnect via Sandbox.get())
 *    - Survives server restarts and workflow replays
 *    - Guaranteed exactly-once sandbox creation
 *
 * ## Why `'use step'` Matters
 *
 * The `'use step'` directive makes this function a "durable step":
 * - First execution: Creates sandbox, checkpoints the sandboxId
 * - Replay (after crash/restart): Returns checkpointed sandboxId, skips creation
 *
 * This prevents duplicate sandbox creation if the workflow is interrupted
 * and replayed from a checkpoint.
 *
 * ## Why Only Return sandboxId?
 *
 * Workflow steps should return serializable data only. The Sandbox object
 * contains connections and state that can't be serialized. Each step that
 * needs the sandbox reconnects via `Sandbox.get({ sandboxId })`.
 */

import { Sandbox } from "@vercel/sandbox";
import { SANDBOX_CONFIG, log } from "@/lib/config";

/**
 * Creates a sandbox for the workflow.
 *
 * This is a durable step - the sandboxId is checkpointed and survives replays.
 * Returns only the sandboxId; callers reconnect via Sandbox.get().
 */
export async function createSandbox() {
  "use step";

  log.sandbox("Creating...");

  const sandbox = await Sandbox.create({
    resources: { vcpus: SANDBOX_CONFIG.vcpus },
    timeout: SANDBOX_CONFIG.timeout,
    runtime: SANDBOX_CONFIG.runtime,
  });

  log.sandbox("Created with ID:", sandbox.sandboxId);

  return sandbox.sandboxId;
}
