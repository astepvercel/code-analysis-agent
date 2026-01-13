import { Sandbox } from "@vercel/sandbox";
import { log, STEP_NAMES } from "@/lib/config";

export async function runBash({
  command,
  sandboxId,
}: {
  command: string;
  sandboxId: string;
}) {
  "use step";

  log.step(STEP_NAMES.bash, "Executing:", command);

  const sandbox = await Sandbox.get({ sandboxId });
  const result = await sandbox.runCommand("/bin/sh", ["-c", command]);

  const stdout = await result.stdout();
  const stderr = await result.stderr();

  log.step(STEP_NAMES.bash, "Exit code:", result.exitCode);

  return {
    success: result.exitCode === 0,
    command,
    stdout,
    stderr,
    exitCode: result.exitCode,
  };
}
