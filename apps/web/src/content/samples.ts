// Code shown on the landing page. `counterOutput` and `counterCss` are what this version of the
// compiler produces for `counterSource` (client target), checked by samples.test.ts.

export const COUNTER_FILE = "/app/src/Counter.stsx";

export const counterSource = `import { signal } from "lumen";

const gap = 8;
const radius = { pill: "999px" };

export function Counter() {
  const count = signal(0);

  return (
    <button class={{ hot: count() > 9 }} onClick={() => count.update((n) => n + 1)}>
      Clicked {count()} times
      <style>
        button {
          padding: calc($gap * 1px) calc($gap * 2px);
          border-radius: $radius.pill;
        }
        .hot { outline: 2px solid tomato; }
      </style>
    </button>
  );
}
`;

export const counterOutput = `import { signal } from "lumen";
import { template, bind, toggleClass, insert, delegateEvents } from "lumen/dom";
import "/app/src/Counter.stsx?lumen&type=style&lang.css";
const _t0 = /* @__PURE__ */ template(\`<button data-l-agorgvta>Clicked <!> times\`);
const _a0 = (el, v) => toggleClass(el, "hot", v);
const gap = 8;
const radius = { pill: "999px" };
export function Counter() {
\tconst count = signal(0);
\tconst _el = _t0(), _marker = _el.firstChild.nextSibling;
\tbind(_el, () => count() > 9, _a0);
\t_el.$$click = () => count.update((n) => n + 1);
\tinsert(_el, count, _marker);
\treturn _el;
}
delegateEvents(["click"]);
`;

export const counterCss = `button[data-l-agorgvta] {
  border-radius: 999px;
  padding: 8px 16px;
}

.hot[data-l-agorgvta] {
  outline: 2px solid tomato;
}
`;

export const createCommands = {
  pnpm: "pnpm create lumen my-app\ncd my-app && pnpm dev",
  npm: "npm create lumen@latest my-app\ncd my-app && npm run dev",
  yarn: "yarn create lumen my-app\ncd my-app && yarn dev",
  bun: "bun create lumen my-app\ncd my-app && bun run dev",
} as const;

export const checkSource = `import { signal } from "lumen";

export function Counter() {
  const count = signal(1);
  const doubled = count() * 2;
  return <button onClick={() => count.update((n) => n + 1)}>{doubled}</button>;
}
`;

export const checkSample = `$ lumen check --format json
{
  "command": "check",
  "ok": true,
  "diagnostics": [
    {
      "source": "lumen",
      "code": "LUM2001",
      "severity": "warning",
      "file": "src/Counter.stsx",
      "line": 5,
      "column": 9,
      "message": "\`doubled\` is computed once from a reactive value, so the JSX that uses it never updates",
      "help": "Derive it lazily: \`const x = () => …\` (called as \`x()\` in JSX) or \`computed(() => …)\`.",
      "docs": "diagnostics/LUM2001"
    }
  ],
  "summary": { "errors": 0, "warnings": 1, "hints": 0, "files": 1 }
}

$ lumen explain LUM2001   # the long form: cause, example, fix`;
