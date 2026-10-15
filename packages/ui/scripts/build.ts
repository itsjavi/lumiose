// `pnpm build` (and `prepack`) of @lumiose/ui: copies the sources to dist/, tests left out. The
// package ships its `.tsx` components and `.css` as they are, for the app's Lumiose compiler to
// compile for the server or the browser with the app's own options (targets, strict CSP, dev
// tools); precompiled output would tie it to one runtime version's compiled helpers (TASK-353).
//
//   node scripts/build.ts

import { cpSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const TEST = /\.test\.tsx?$/;

rmSync(`${root}dist`, { recursive: true, force: true });
cpSync(`${root}src`, `${root}dist`, { recursive: true, filter: (source) => !TEST.test(source) });
