// Loads @lumiose/compiler's native binding through its loader and compiles a component: the binary
// for this platform must be the one that loads (not the WASI fallback) and must work.
//   node .github/scripts/smoke-napi.mjs
import { compile, __napiBindingTarget } from "../../packages/compiler/index.js";

const result = compile(
  `export function Hello(props: { name: string }) {\n  return <p class="hi">Hello {props.name}<style>.hi { color: teal; }</style></p>;\n}\n`,
  "/src/Hello.stsx",
  { target: "client" },
);
const problems = [];
if (__napiBindingTarget !== "native")
  problems.push(`loaded ${__napiBindingTarget}, not the native binary`);
if (!result.code.includes("template(")) problems.push("no template in the compiled code");
if (!result.css?.includes("color: teal")) problems.push("no CSS");
if (result.diagnostics.length > 0) problems.push(JSON.stringify(result.diagnostics));
if (problems.length > 0) {
  console.error(
    `smoke test failed on ${process.platform}-${process.arch}:\n${problems.join("\n")}`,
  );
  process.exit(1);
}
console.log(
  `ok: ${process.platform}-${process.arch} (${process.report?.getReport?.().header?.glibcVersionRuntime ?? "no glibc"})`,
);
