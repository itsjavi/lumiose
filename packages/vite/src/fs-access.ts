// `server.fs.allow` for the files the plugin reads itself (TASK-498).
//
// Vite checks a dev request's file against `server.fs.allow` only when no plugin loads its id. A
// load hook that reads a file (a content module's `.md`/`.html`, a style module's source) checks
// it here, or a URL such as `/@fs/<outside>/notes.md.stsx?import` would serve any file on disk.
// As in Vite, only the dev server's client environment is checked: server environments and
// builds read any file.

import { isFileLoadingAllowed, type Environment } from "vite";

/**
 * Throws when the dev server's client environment loads `file` outside `server.fs.allow`. The
 * error is Vite's own `ERR_DENIED_ID`, which its transform middleware answers with a 403 naming
 * the file and the allow list; elsewhere it fails the load.
 */
export function assertLoadingAllowed(environment: Environment, file: string): void {
  if (environment.mode !== "dev" || environment.config.consumer !== "client") return;
  if (isFileLoadingAllowed(environment.getTopLevelConfig(), file)) return;
  throw Object.assign(new Error(`Denied ID ${file}: it is outside server.fs.allow`), {
    code: "ERR_DENIED_ID",
    id: file,
  });
}
