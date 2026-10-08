// `lumen dev` for the CLI (TASK-28): starts the dev server, prints its URLs and runs until
// SIGINT/SIGTERM.

import { createDevServer, type DevServerOptions } from "./server.ts";

export interface DevCommandOptions extends Pick<
  DevServerOptions,
  "root" | "port" | "host" | "mode"
> {
  writeError: (text: string) => void;
}

/** Runs the dev server until the process is interrupted; resolves to the exit code. */
export async function devCommand(options: DevCommandOptions): Promise<number> {
  const { writeError, ...serverOptions } = options;
  let server;
  try {
    server = await createDevServer(serverOptions);
  } catch (error) {
    writeError(`lumen dev: ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
  server.vite.printUrls();
  if (process.stdin.isTTY) server.vite.bindCLIShortcuts({ print: true });
  await new Promise<void>((resolve) => {
    process.once("SIGINT", resolve);
    process.once("SIGTERM", resolve);
  });
  await server.close();
  return 0;
}
