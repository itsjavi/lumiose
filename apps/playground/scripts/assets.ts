// Builds the playground's generated assets into public/generated/ (git-ignored), before
// `lumiose dev` and `lumiose build`:
//
// - wasm/: the WebAssembly compiler, crates/lumiose_wasm built for wasm32-unknown-unknown and bound
//   with wasm-bindgen (`--target web`). Needs the Rust target and the wasm-bindgen CLI at the
//   version the workspace pins (see the error below).
// - runtime.js: `lumiose` and `lumiose/dom` bundled into one module (src/preview/runtime.ts) for the
//   preview iframe.
//
//   node scripts/assets.ts

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { writeLumioseTsconfig } from "lumiose/tooling";
import { build } from "vite";

const app = fileURLToPath(new URL("..", import.meta.url));
const repo = join(app, "../..");
const out = join(app, "public/generated");

function run(command: string, args: string[], cwd: string): void {
  try {
    execFileSync(command, args, { cwd, stdio: "inherit" });
  } catch (error) {
    const missing = (error as NodeJS.ErrnoException).code === "ENOENT";
    throw new Error(missing ? `${command} is not installed.\n${SETUP}` : `${command} failed.`, {
      cause: error,
    });
  }
}

/** The wasm-bindgen version of the workspace: the CLI must match it exactly. */
const bindgen = /^wasm-bindgen = "=([^"]+)"/m.exec(
  readFileSync(join(repo, "Cargo.toml"), "utf8"),
)?.[1];

const SETUP = `The playground's compiler is crates/lumiose_wasm, built for the browser. Install once:
  rustup target add wasm32-unknown-unknown
  cargo install wasm-bindgen-cli --version ${bindgen ?? "<the workspace's wasm-bindgen>"} --locked`;

run(
  "cargo",
  ["build", "-p", "lumiose_wasm", "--release", "--target", "wasm32-unknown-unknown"],
  repo,
);
run(
  "wasm-bindgen",
  [
    "--target",
    "web",
    "--no-typescript",
    "--out-dir",
    join(out, "wasm"),
    join(repo, "target/wasm32-unknown-unknown/release/lumiose_wasm.wasm"),
  ],
  repo,
);

// The bundle is transformed with the app's tsconfig, which extends the generated one: write it
// first, since a fresh checkout (CI) has no .lumiose/ yet.
await writeLumioseTsconfig(app);

await build({
  configFile: false,
  root: app,
  logLevel: "warn",
  build: {
    outDir: out,
    emptyOutDir: false,
    copyPublicDir: false,
    target: "es2022",
    lib: {
      entry: join(app, "src/preview/runtime.ts"),
      formats: ["es"],
      fileName: () => "runtime.js",
    },
  },
});
console.log("playground assets: public/generated/{wasm/,runtime.js}");
