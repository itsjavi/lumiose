// Hovers on JSX expressions (TASK-137): how the compiled client code runs the expression under
// the cursor, from the compiler's opt-in execution contract (`compile(…, { contract: true })`,
// spec §5.1). Agents and people see whether an expression is reactive without reading the output.

import { compile, type ContractEntry } from "@lumen/compiler";

/** The contract entries of a source, or none when it does not compile. */
export function contractEntries(text: string, file: string): readonly ContractEntry[] {
  try {
    const result = compile(text, file, {
      target: "client",
      sourceMap: false,
      emitCss: false,
      contract: true,
    });
    return result.meta.contract ?? [];
  } catch {
    return [];
  }
}

/** The innermost entry around `offset` (entries are sorted outer first and nest). */
export function contractAt(
  entries: readonly ContractEntry[],
  offset: number,
): ContractEntry | undefined {
  let found: ContractEntry | undefined;
  for (const entry of entries) {
    if (entry.span.start > offset) break;
    if (offset < entry.span.end) found = entry;
  }
  return found;
}

const KIND: Record<ContractEntry["kind"], string> = {
  tracked: "**tracked**: re-runs when a signal it reads changes",
  untracked: "**untracked**: runs once, inside `untrack()`, so changes do not re-run it",
  once: "**once**: reads no signal, so it runs once",
  deferred:
    "**deferred**: runs later (on the event, or once the element exists), not during render",
};

const SITE: Record<ContractEntry["site"], string> = {
  child: "a child",
  attribute: "an attribute",
  property: "a DOM property",
  class: "`class`",
  style: "`style`",
  prop: "a component prop",
  event: "an event handler",
  ref: "a ref",
  spread: "a spread",
  await: "an `await`",
};

/** The hover text for an entry of `text`. */
export function contractMarkdown(entry: ContractEntry, text: string): string {
  const where = entry.component === undefined ? "" : ` in \`${entry.component}\``;
  const via = entry.via === undefined ? "" : `, through \`${entry.via}\``;
  const lines = [`**Lumen**: ${SITE[entry.site]}${where}${via}. ${KIND[entry.kind]}.`];
  if (entry.reads.length > 0) {
    const reads = [...new Set(entry.reads.map((read) => text.slice(read.start, read.end)))];
    lines.push(`Reactive reads: ${reads.map((read) => `\`${read}\``).join(", ")}.`);
  }
  return lines.join("\n\n");
}
