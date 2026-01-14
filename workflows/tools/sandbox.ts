/**
 * Sandbox management for WORKFLOW MODE (durable, checkpointed).
 */

import { Sandbox } from "@vercel/sandbox";
import { SANDBOX_CONFIG, log } from "@/lib/config";

/**
 * Creates a sandbox for the workflow.
 *
 * Durable step - the sandboxId is checkpointed.
 * Returns only the sandboxId; reconnect via Sandbox.get().
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
