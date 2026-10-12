// Row consts (TASK-65): `const`s of a `.map()` callback initialised from row data without calls
// count as row data, so selectors and data-slot handlers see through them.
import { signal } from "lumiose";
import { ssr, SSRHtml, insertText, classAttr, list, selector } from "lumiose/server";
const _s0 = [
	"<tr",
	"><td>",
	"</td><td>",
	"</td><td>",
	"</td><td>both: per-row closure</td><td>call: per-row closure</td></tr>"
];
const _c0 = (h0, h1, h2, h3) => typeof h0 === "string" && typeof h1 === "string" && typeof h2 === "string" && typeof h3 === "string" ? new SSRHtml("<tr" + h0 + "><td>" + h1 + "</td><td>" + h2 + "</td><td>" + h3 + "</td><td>both: per-row closure</td><td>call: per-row closure</td></tr>") : ssr(_s0, h0, h1, h2, h3);
const _s1 = ["<table><tbody>", "</tbody></table>"];
const _c1 = (h0) => h0 instanceof SSRHtml ? new SSRHtml("<table><tbody>" + h0.t + "</tbody></table>") : ssr(_s1, h0);
const rows = signal([]);
const selected = signal(0);
const select = (id) => selected.set(id);
const log = (...values) => console.log(...values);
export function RowData() {
	const prefix = "#";
	const _isSelected = selector(selected);
	return _c1(list(rows(), (row) => {
		const id = row.id;
		const key = id;
		const { name, label: text } = row;
		const upper = row.name.toUpperCase();
		return _c0(classAttr({ danger: _isSelected(key) }), insertText(id), insertText(name), insertText(text()));
	}));
}
