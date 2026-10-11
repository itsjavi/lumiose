// Code shown on the landing page. The live demo (the Playground island) starts from
// `counterSource`; `counterOutput` and `counterCss` are what this version of the compiler produces
// for it as the playground compiles it (client target, `/src/App.stsx`), shown before the editor
// loads and without JavaScript. content.test.ts checks them.

export const counterSource = `import { signal } from "lumiose";

const gap = 8;
const radius = { pill: "999px" };

export default function Counter() {
  const count = signal(0);

  return (
    <div class="counter">
      <button class={{ pill: true, hot: count() > 9 }} onClick={() => count.update((n) => n + 1)}>
        Clicked {count()} times
      </button>
      <Reset onReset={() => count.set(0)} />
    </div>
  );
}

function Reset(props: { onReset(): void }) {
  return (
    <button class="pill ghost" onClick={props.onReset}>
      Reset
    </button>
  );
}

// One block at the end of the file styles both components.
<style>
  .counter {
    display: flex;
    gap: calc($gap * 1px);
  }
  .pill {
    padding: calc($gap * 1px) calc($gap * 2px);
    border: 2px solid #5546ff;
    border-radius: $radius.pill;
    background: #5546ff;
    color: white;
    font: inherit;
  }
  .ghost {
    background: transparent;
    color: inherit;
  }
  .hot {
    outline: 2px solid tomato;
  }
</style>
`;

export const counterOutput = `import { signal } from "lumiose";
import { template, bind, toggleClass, insert, createComponent, delegateEvents } from "lumiose/dom";
import "/src/App.stsx?lumiose&type=style&lang.css";
const _t0 = /* @__PURE__ */ template(\`<div class=counter data-l-rdjmzp3m><button class=pill data-l-rdjmzp3m>Clicked <!> times\`);
const _t1 = /* @__PURE__ */ template(\`<button class="pill ghost" data-l-rdjmzp3m>Reset\`);
const _a0 = (el, v) => toggleClass(el, "hot", v);
const gap = 8;
const radius = { pill: "999px" };
export default function Counter() {
\tconst count = signal(0);
\tconst _el = _t0(), _button = _el.firstChild, _marker = _button.firstChild.nextSibling;
\tbind(_button, () => count() > 9, _a0);
\t_button.$$click = () => count.update((n) => n + 1);
\tinsert(_button, count, _marker);
\tinsert(_el, createComponent(Reset, { onReset: () => count.set(0) }));
\treturn _el;
}
function Reset(props) {
\tconst _el2 = _t1();
\t_el2.$$click = props.onReset;
\treturn _el2;
}
delegateEvents(["click"]);
`;

export const counterCss = `.counter[data-l-rdjmzp3m] {
  gap: 8px;
  display: flex;
}

.pill[data-l-rdjmzp3m] {
  color: #fff;
  font: inherit;
  background: #5546ff;
  border: 2px solid #5546ff;
  border-radius: 999px;
  padding: 8px 16px;
}

.ghost[data-l-rdjmzp3m] {
  color: inherit;
  background: none;
}

.hot[data-l-rdjmzp3m] {
  outline: 2px solid tomato;
}
`;

export const createCommands = {
  pnpm: "pnpm create lumiose my-app\ncd my-app && pnpm dev",
  npm: "npm create lumiose@latest my-app\ncd my-app && npm run dev",
  yarn: "yarn create lumiose my-app\ncd my-app && yarn dev",
  bun: "bun create lumiose my-app\ncd my-app && bun run dev",
} as const;

export const checkSource = `import { signal } from "lumiose";

export function Counter() {
  const count = signal(1);
  const doubled = count() * 2;
  return <button onClick={() => count.update((n) => n + 1)}>{doubled}</button>;
}
`;

export const checkSample = `$ lumiose check --format json
{
  "command": "check",
  "ok": true,
  "diagnostics": [
    {
      "source": "lumiose",
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

$ lumiose explain LUM2001   # the long form: cause, example, fix`;
