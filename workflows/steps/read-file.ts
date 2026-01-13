import { Sandbox } from "@vercel/sandbox";
import { log, STEP_NAMES } from "@/lib/config";

export async function readFile({
  path,
  sandboxId,
}: {
  path: string;
  sandboxId: string;
}) {
  "use step";

  log.step(STEP_NAMES.readFile, "Reading file:", path);

  const sandbox = await Sandbox.get({ sandboxId });
  const result = await sandbox.runCommand("/bin/sh", ["-c", `cat "${path}"`]);
  const content = await result.stdout();

  log.step(STEP_NAMES.readFile, "Read", content.length, "bytes");

  return {
    success: result.exitCode === 0,
    path,
    content,
    error: result.exitCode !== 0 ? content : undefined,
  };
}
