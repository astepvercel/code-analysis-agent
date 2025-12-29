export async function readFileStep({
    path,
    sandboxIdentifier,
  }: {
    path: string;
    sandboxIdentifier?: string;
  }) {
    'use step';

    const sandboxId = sandboxIdentifier || "default-session";

    console.log("🔧 [read_file] Reading file:", path);

    const { Sandbox } = await import("@vercel/sandbox");
    const sandbox = await Sandbox.get({ sandboxId });
    const result = await sandbox.runCommand('/bin/sh', ['-c', `cat "${path}"`]);
    const content = await result.stdout();

    console.log("🔧 [read_file] Read", content.length, "bytes");

    return {
        success: result.exitCode === 0,
        path,
        content,
        error: result.exitCode !== 0 ? content : undefined,
    };
  }