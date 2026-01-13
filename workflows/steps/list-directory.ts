import { Sandbox } from "@vercel/sandbox";
import { log, STEP_NAMES } from "@/lib/config";

export async function listDirectory({
  path,
  recursive,
  maxDepth,
  sandboxId,
}: {
  path?: string;
  recursive?: boolean;
  maxDepth?: number;
  sandboxId: string;
}) {
  "use step";

  const targetPath = path || ".";
  log.step(STEP_NAMES.listDirectory, "Listing directory:", targetPath);

  const sandbox = await Sandbox.get({ sandboxId });

  let cmd = `ls -la "${targetPath}"`;
  if (recursive) {
    const depthArg = maxDepth ? `-maxdepth ${maxDepth}` : "";
    cmd = `find "${targetPath}" ${depthArg} -type f -o -type d`;
  }

  const result = await sandbox.runCommand("/bin/sh", ["-c", cmd]);
  const output = await result.stdout();
  const files = output.split("\n").filter((line) => line.trim());

  log.step(STEP_NAMES.listDirectory, "Found", files.length, "items");

  return {
    path: targetPath,
    files: output,
    fileCount: files.length,
    truncated: false,
    error: result.exitCode !== 0 ? output : undefined,
  };
}
