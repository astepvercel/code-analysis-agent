export async function listDirStep({
    path,
    recursive,
    maxDepth,
    sandboxIdentifier,
  }: {
    path?: string;
    recursive?: boolean;
    maxDepth?: number;
    sandboxIdentifier?: string;
  }) {
    'use step';

    const sandboxId = sandboxIdentifier || "default-session";
    const targetPath = path || ".";

    console.log("🔧 [list_dir] Listing directory:", targetPath);

    const { Sandbox } = await import("@vercel/sandbox");
    const sandbox = await Sandbox.get({ sandboxId });

    let cmd = `ls -la "${targetPath}"`;
    if (recursive) {
      const depthArg = maxDepth ? `-maxdepth ${maxDepth}` : "";
      cmd = `find "${targetPath}" ${depthArg} -type f -o -type d`;
    }

    const result = await sandbox.runCommand('/bin/sh', ['-c', cmd]);
    const output = await result.stdout();
    const files = output.split('\n').filter(l => l.trim());

    console.log("🔧 [list_dir] Found", files.length, "items");

    return {
      path: targetPath,
      files: output,
      fileCount: files.length,
      truncated: false,
      error: result.exitCode !== 0 ? output : undefined,
    };

  }