export async function gitCloneStep({
  repo_url,
  destination,
  sandboxIdentifier,
}: {
  repo_url: string;
  destination: string;
  sandboxIdentifier?: string;
}) {
  'use step';

  const sandboxId = sandboxIdentifier || "default-session";

  console.log("🔧 [git_clone] Cloning repository:", repo_url);

  const { Sandbox } = await import("@vercel/sandbox");
  const sandbox = await Sandbox.get({ sandboxId });
  const repoName = destination || repo_url.split('/').pop()?.replace('.git', '') || 'repo';

  let checkCmd, checkOutput;
  try {
    checkCmd = await sandbox.runCommand('/bin/sh', ['-c', `test -d "${repoName}" && echo "exists" || echo "not_exists"`]);
    checkOutput = await checkCmd.stdout();
  } catch (error) {
    console.error("🔧 [git_clone] Error checking if repo exists:", (error as any).message);
    throw error;
  }

  if (checkOutput.trim() === "exists") {
    console.log("🔧 [git_clone] Repository already exists, skipping clone");
    return {
      success: true,
      output: `Repository '${repoName}' already exists. Skipped.`,
      repoName,
      alreadyCloned: true,
    };
  }

  console.log("🔧 [git_clone] Cloning repository...");
  const result = await sandbox.runCommand('/bin/sh', ['-c', `git clone ${repo_url} ${repoName}`]);
  const output = await result.output("both");

  console.log("🔧 [git_clone] Clone completed with exit code:", result.exitCode);

  return {
    success: result.exitCode === 0,
    output,
    repoName,
    alreadyCloned: false,
  };
}
