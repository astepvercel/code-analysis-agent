import ms from "ms";
import { Sandbox } from "@vercel/sandbox";

const SANDBOX_CONFIG = {
  timeout: ms("20m"),
  vcpus: 2,
  runtime: "node22" as const,
};

export async function createConversationSandbox() {
  'use step';
  console.log("[Sandbox] Creating...");

  const sandbox = await Sandbox.create({
    resources: { vcpus: SANDBOX_CONFIG.vcpus },
    timeout: SANDBOX_CONFIG.timeout,
    runtime: SANDBOX_CONFIG.runtime,
  });

  console.log("[Sandbox] ID:", sandbox.sandboxId);

  return sandbox.sandboxId;
}

export async function stopConversationSandbox(sandboxId: string): Promise<void> {
  'use step';

  console.log("[Sandbox] Stopping...");

  const sandbox = await Sandbox.get({ sandboxId });

  await sandbox.stop().catch((err) => {
    console.error("[Sandbox] Stop failed:", err);
  });
}
