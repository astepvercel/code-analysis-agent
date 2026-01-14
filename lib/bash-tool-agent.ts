/**
 * Sandbox management for BASH-TOOL MODE (stateless request/response).
 */

import { createBashTool } from "bash-tool";
import { Sandbox } from "@vercel/sandbox";
import { SANDBOX_CONFIG, log } from "./config";

/**
 * Gets an existing sandbox or creates a new one.
 * @param sandboxId - Optional existing sandbox ID from client storage
 * @returns Object containing the sandbox and its ID
 */
export async function getOrCreateSandbox(
  sandboxId?: string | null
): Promise<{ sandbox: Sandbox; sandboxId: string }> {
  if (sandboxId) {
    log.sandbox(`Reconnecting to sandbox: ${sandboxId}`);
    try {
      const sandbox = await Sandbox.get({ sandboxId });
      return { sandbox, sandboxId };
    } catch {
      log.sandbox("Failed to reconnect, creating new sandbox");
    }
  }

  log.sandbox("Creating new sandbox");
  const sandbox = await Sandbox.create({
    resources: { vcpus: SANDBOX_CONFIG.vcpus },
    timeout: SANDBOX_CONFIG.timeout,
    runtime: SANDBOX_CONFIG.runtime,
  });

  log.sandbox(`Created sandbox: ${sandbox.sandboxId}`);

  // TODO - Update. Create the workspace directory that bash-tool expects
  log.sandbox("Creating workspace directory...");
  await sandbox.runCommand("mkdir", ["-p", SANDBOX_CONFIG.workspacePath]);

  return { sandbox, sandboxId: sandbox.sandboxId };
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
