// Loads lumen_wasm (bound with `wasm-bindgen --target nodejs`) and compiles a component.
//   node .github/scripts/smoke-wasm.mjs <dir with lumen_wasm.js>
import { createRequire } from "node:module";
import { resolve } from "node:path";

const dir = resolve(process.argv[2] ?? "dist/wasm-node");
const wasm = createRequire(import.meta.url)(resolve(dir, "lumen_wasm.js"));
const result = wasm.compile(
  `export const Hello = (props: { name: string }) => <p>Hello {props.name}</p>;\n`,
  "/src/Hello.tsx",
  { target: "server" },
);
if (!result.code.includes("lumen/server")) {
  console.error("smoke test failed:", result);
  process.exit(1);
}
console.log(`ok: lumen_wasm ${wasm.version()}`);
