export async function searchFileStep({
    pattern,
    path,
    file_pattern,
    sandboxIdentifier,
  }: {
    pattern: string;
    path: string;
    file_pattern?: string;
    sandboxIdentifier?: string;
  }) {
    'use step';

    const sandboxId = sandboxIdentifier || "default-session";

    console.log("🔧 [search_files] Searching for pattern:", pattern);

    const { Sandbox } = await import("@vercel/sandbox");
    const sandbox = await Sandbox.get({ sandboxId });
    const filter = file_pattern ? `--include="${file_pattern}"` : "";

    const result = await sandbox.runCommand('/bin/sh', ['-c', `grep -r ${filter} "${pattern}" "${path}" || true`]);
    const matches = await result.stdout();

    const matchCount = matches.split('\n').filter(l => l.trim()).length;
    console.log("🔧 [search_files] Found", matchCount, "matches");

    return {
        success: result.exitCode === 0,
        matches,
        matchCount,
        pattern
    };
  }