// The root README's numbers (TASK-269): the landing's headline figures and stack comparison table,
// from the same committed results, written between `<!-- generated:<name> -->` and
// `<!-- /generated:<name> -->` markers. They are HTML, not Markdown tables, so oxfmt leaves them as
// generated. `pnpm readme:gen` writes them (scripts/readme.ts); content.test.ts fails when stale.
import { evidence, type Evidence } from "./evidence.ts";
import {
  type Cell,
  COLUMNS,
  SERVER_SPEED,
  type StackRow,
  headlines,
  stacks,
  tableNote,
} from "./stacks.ts";

/** The published website, for the README's links. */
const WEBSITE = "https://itsjavi.com/lumiose/";

function escape(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

/** A cell as HTML; a measurement keeps its number and unit on one line (`619 renders/s`). */
function cellHtml(cell: Cell): string {
  if (cell.kind === "measuring") return "measuring";
  const text = escape(cell.text);
  return cell.kind === "measured" ? text.replaceAll(" ", "&nbsp;") : text;
}

function proof(results: Evidence): string {
  const cells = headlines(results).map(
    ({ value, label }) =>
      `    <td align="center"><strong>${escape(value)}</strong><br><sub>${escape(label)}</sub></td>`,
  );
  return ['<table align="center">', "  <tr>", ...cells, "  </tr>", "</table>"].join("\n");
}

function compare(results: Evidence, rows: StackRow[]): string {
  const header = [
    ...Object.values(COLUMNS).map((label) => `<th>${escape(label)}</th>`),
    `<th colspan="2">${escape(SERVER_SPEED)}</th>`,
  ].join("");
  const body = rows.map((row) => {
    const td = (cell: Cell, number = false) => {
      const text = cellHtml(cell);
      return `<td${number ? ' align="right"' : ""}>${row.self ? `<strong>${text}</strong>` : text}</td>`;
    };
    const stack = escape(row.stack);
    return [
      "    <tr>",
      `<td>${row.self ? `<strong>${stack}</strong>` : stack}</td>`,
      td(row.fullStack),
      td(row.styles),
      td(row.serverJs, true),
      td(row.clientSpeed, true),
      td(row.rendering, true),
      td(row.requests, true),
      "</tr>",
    ].join("");
  });
  const note = `${escape(tableNote(results, rows))} Astro's interactive islands need a second UI framework. Method and every run: <a href="${WEBSITE}benchmarks">benchmarks</a>.`;
  return [
    "<table>",
    `  <thead><tr>${header}</tr></thead>`,
    "  <tbody>",
    ...body,
    "  </tbody>",
    "</table>",
    `<p><sub>${note}</sub></p>`,
  ].join("\n");
}

/** The content of each generated region, by name. */
export function readmeRegions(results: Evidence, rows: StackRow[]): Record<string, string> {
  return { proof: proof(results), compare: compare(results, rows) };
}

/** `readme` with each region's content replaced; throws when a region's markers are missing. */
export function fillReadme(readme: string, regions: Record<string, string>): string {
  let text = readme;
  for (const [name, content] of Object.entries(regions)) {
    const start = `<!-- generated:${name} -->`;
    const end = `<!-- /generated:${name} -->`;
    const from = text.indexOf(start);
    const to = text.indexOf(end, from);
    if (from === -1 || to === -1) throw new Error(`README.md has no ${start} … ${end} region.`);
    text = `${text.slice(0, from + start.length)}\n${content}\n${text.slice(to)}`;
  }
  return text;
}

/** README.md with its generated regions brought up to date with the committed results. */
export function generateReadme(readme: string): string {
  return fillReadme(readme, readmeRegions(evidence(), stacks()));
}
