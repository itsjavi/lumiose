// Row consts (TASK-65): `const`s of a `.map()` callback initialised from row data without calls
// count as row data, so selectors and data-slot handlers see through them.
import { signal } from "lumen";
import { ssr, insert, classAttr, list, selector } from "lumen/server";
const _s0 = [
	"<tr",
	"><td>",
	"</td><td>",
	"</td><td>",
	"</td><td>both: per-row closure</td><td>call: per-row closure</td></tr>"
];
const _s1 = ["<table><tbody>", "</tbody></table>"];
const rows = signal([]);
const selected = signal(0);
const select = (id) => selected.set(id);
const log = (...values) => console.log(...values);
export function RowData() {
	const prefix = "#";
	const _isSelected = selector(selected);
	return ssr(_s1, list(rows(), (row) => {
		const id = row.id;
		const key = id;
		const { name, label: text } = row;
		const upper = row.name.toUpperCase();
		return ssr(_s0, classAttr({ danger: _isSelected(key) }), insert(id), insert(name), insert(text()));
	}));
}
