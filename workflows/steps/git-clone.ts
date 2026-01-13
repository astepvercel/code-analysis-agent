import { Sandbox } from "@vercel/sandbox";
import { log, STEP_NAMES } from "@/lib/config";

export async function cloneRepository({
  repoUrl,
  destination,
  sandboxId,
}: {
  repoUrl: string;
  destination?: string;
  sandboxId: string;
}) {
  "use step";

  log.step(STEP_NAMES.gitClone, "Cloning repository:", repoUrl);

  const sandbox = await Sandbox.get({ sandboxId });
  const repoName =
    destination || repoUrl.split("/").pop()?.replace(".git", "") || "repo";

  // Check if repo already exists
  const checkResult = await sandbox.runCommand("/bin/sh", [
    "-c",
    `test -d "${repoName}" && echo "exists" || echo "not_exists"`,
  ]);
  const checkOutput = await checkResult.stdout();

  if (checkOutput.trim() === "exists") {
    log.step(STEP_NAMES.gitClone, "Repository already exists, skipping clone");
    return {
      success: true,
      output: `Repository '${repoName}' already exists. Skipped.`,
      repoName,
      alreadyCloned: true,
    };
  }

  log.step(STEP_NAMES.gitClone, "Cloning repository...");
  const result = await sandbox.runCommand("/bin/sh", [
    "-c",
    `git clone ${repoUrl} ${repoName}`,
  ]);
  const output = await result.output("both");

  log.step(STEP_NAMES.gitClone, "Clone completed with exit code:", result.exitCode);

  return {
    success: result.exitCode === 0,
    output,
    repoName,
    alreadyCloned: false,
  };
}
