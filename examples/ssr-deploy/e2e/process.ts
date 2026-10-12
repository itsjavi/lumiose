// Processes of the local e2e runs: the build, and the emulator serving it until the checks end.
// The emulator CLIs run pinned through `pnpm dlx`: they are not dependencies, so CI never
// installs them (decision-45).

import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";

/** The sample's directory. */
export const SAMPLE = fileURLToPath(new URL("..", import.meta.url));

/** Runs a command in the sample to completion; throws on a non-zero exit. */
export function run(
  command: string,
  args: string[],
  env: Record<string, string> = {},
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: SAMPLE,
      stdio: "inherit",
      env: { ...process.env, ...env },
    });
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`${command} ${args.join(" ")} exited with ${code}`)),
    );
  });
}

export interface Server {
  stop(): Promise<void>;
}

/**
 * Starts a long-running command (in its own process group, so that `pnpm dlx` and what it starts
 * stop together) and resolves once `url` answers.
 */
export async function start(
  command: string,
  args: string[],
  url: string,
  options: { env?: Record<string, string>; timeoutMs?: number } = {},
): Promise<Server> {
  const child: ChildProcess = spawn(command, args, {
    cwd: SAMPLE,
    stdio: ["ignore", "inherit", "inherit"],
    env: { ...process.env, ...options.env },
    detached: true,
  });
  const exited = new Promise<void>((resolve) => child.once("exit", () => resolve()));
  const stop = async () => {
    try {
      process.kill(-child.pid!, "SIGTERM");
    } catch {
      return;
    }
    await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 5000))]);
    try {
      process.kill(-child.pid!, "SIGKILL");
    } catch {
      // stopped
    }
  };
  const deadline = Date.now() + (options.timeoutMs ?? 180_000);
  for (;;) {
    if (child.exitCode !== null) throw new Error(`${command} ${args.join(" ")} exited early`);
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
      await res.arrayBuffer();
      return { stop };
    } catch {
      if (Date.now() > deadline) {
        await stop();
        throw new Error(`${url} did not answer in time`);
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
}
