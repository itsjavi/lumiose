// .map() → keyed list: key from the root's key prop, index accessor only when used, selector
// hoisting for both operand orders and !==, block-bodied callbacks, nested lists.
import { signal } from "lumen";
import { Row } from "./Row.stsx";
import { ssr, text, insert, attr, classAttr, list, selector, createComponent } from "lumen/server";
const _s0 = [
	"<li",
	">",
	". ",
	"</li>"
];
const _s1 = [
	"<li",
	">",
	"</li>"
];
const _s2 = ["<td>", "</td>"];
const _s3 = ["<tr>", "</tr>"];
const _s4 = ["<b>", "</b>"];
const _s5 = ["<i>-</i>"];
const _s6 = [
	"<dt>",
	"</dt><dd>",
	"</dd>"
];
const _s7 = [
	"<div><ul>",
	"</ul><ol>",
	"</ol><ol>",
	"</ol><table><tbody>",
	"</tbody></table><p>",
	"</p>",
	"",
	"",
	"</div>"
];
export function Lists(props) {
	const items = signal([]);
	const active = signal(0);
	const _isSelected = selector(active);
	const _isSelected2 = selector(active);
	const _isSelected3 = selector(() => props.selectedId);
	return ssr(_s7, list(items(), (item, i) => ssr(_s0, classAttr({
		active: _isSelected(item.id),
		first: i() === 0
	}), insert(i() + 1), insert(item.name))), list(items(), (item) => ssr(_s1, classAttr(!_isSelected2(item.id) ? "off" : "on"), insert(item.name))), list(props.items, function(item) {
		const label = item.name.toUpperCase();
		return ssr(_s1, attr("data-selected", _isSelected3(item.id)), insert(label));
	}), list(items(), (row) => ssr(_s3, list(row.tags, (tag) => ssr(_s2, insert(tag))))), text(items().map((item) => item.name).join(", ")), list(items(), (item) => createComponent(Row, { item })), list(items(), (item) => active() > 0 ? ssr(_s4, insert(item.name)) : ssr(_s5)), list(items(), (item, i) => ssr(_s6, insert(item.name), insert(i()))));
}
