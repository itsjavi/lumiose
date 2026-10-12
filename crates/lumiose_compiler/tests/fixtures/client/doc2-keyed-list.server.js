// Contract doc-2 §5.2: keyed list, selector, data-slot event.
import { signal } from "lumiose";
import { ssr, SSRHtml, insertText, classAttr, list, selector } from "lumiose/server";
import "/src/doc2-keyed-list.stsx?lumiose&type=style&lang.css";
const _s0 = [
	"<tr data-l-tavixavi",
	"><td data-l-tavixavi><a data-l-tavixavi>",
	"</a></td></tr>"
];
const _c0 = (h0, h1) => typeof h0 === "string" && typeof h1 === "string" ? new SSRHtml("<tr data-l-tavixavi" + h0 + "><td data-l-tavixavi><a data-l-tavixavi>" + h1 + "</a></td></tr>") : ssr(_s0, h0, h1);
const _s1 = ["<tbody data-l-tavixavi>", "</tbody>"];
const _c1 = (h0) => h0 instanceof SSRHtml ? new SSRHtml("<tbody data-l-tavixavi>" + h0.t + "</tbody>") : ssr(_s1, h0);
const rows = signal([]);
const selected = signal(0);
const select = (id) => selected.set(id);
export function Rows() {
	const _isSelected = selector(selected);
	return _c1(list(rows(), (row) => _c0(classAttr({ danger: _isSelected(row.id) }), insertText(row.label()))));
}
