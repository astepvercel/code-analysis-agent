import { Sandbox } from "@vercel/sandbox";
import { log, STEP_NAMES } from "@/lib/config";

export async function searchFiles({
  pattern,
  path,
  filePattern,
  sandboxId,
}: {
  pattern: string;
  path: string;
  filePattern?: string;
  sandboxId: string;
}) {
  "use step";

  log.step(STEP_NAMES.searchFiles, "Searching for pattern:", pattern);

  const sandbox = await Sandbox.get({ sandboxId });
  const filter = filePattern ? `--include="${filePattern}"` : "";

  const result = await sandbox.runCommand("/bin/sh", [
    "-c",
    `grep -r ${filter} "${pattern}" "${path}" || true`,
  ]);
  const matches = await result.stdout();

  const matchCount = matches.split("\n").filter((line) => line.trim()).length;
  log.step(STEP_NAMES.searchFiles, "Found", matchCount, "matches");

  return {
    success: result.exitCode === 0,
    matches,
    matchCount,
    pattern,
  };
}
