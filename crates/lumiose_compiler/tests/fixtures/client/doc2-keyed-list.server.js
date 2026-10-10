// Contract doc-2 §5.2: keyed list, selector, data-slot event.
import { signal } from "lumiose";
import { ssr, insertText, classAttr, list, selector } from "lumiose/server";
import "/src/doc2-keyed-list.stsx?lumiose&type=style&lang.css";
const _s0 = [
	"<tr data-l-tavixavi",
	"><td data-l-tavixavi><a data-l-tavixavi>",
	"</a></td></tr>"
];
const _s1 = ["<tbody data-l-tavixavi>", "</tbody>"];
const rows = signal([]);
const selected = signal(0);
const select = (id) => selected.set(id);
export function Rows() {
	const _isSelected = selector(selected);
	return ssr(_s1, list(rows(), (row) => ssr(_s0, classAttr({ danger: _isSelected(row.id) }), insertText(row.label()))));
}
