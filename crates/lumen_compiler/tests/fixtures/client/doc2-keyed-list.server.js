// @scope file=data-l-x
// Contract doc-2 §5.2: keyed list, selector, data-slot event.
import { signal } from "lumen";
import { ssr, insert, classAttr, list, selector } from "lumen/server";
const _s0 = [
	"<tr data-l-x",
	"><td data-l-x><a data-l-x>",
	"</a></td></tr>"
];
const _s1 = ["<tbody data-l-x>", "</tbody>"];
const rows = signal([]);
const selected = signal(0);
const select = (id) => selected.set(id);
export function Rows() {
	const _isSelected = selector(selected);
	return ssr(_s1, list(rows(), (row) => ssr(_s0, classAttr({ danger: _isSelected(row.id) }), insert(row.label()))));
}
