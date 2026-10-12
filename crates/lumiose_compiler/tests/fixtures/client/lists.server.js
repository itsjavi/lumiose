// .map() → keyed list: key from the root's key prop, index accessor only when used, selector
// hoisting for both operand orders and !==, block-bodied callbacks, nested lists.
import { signal } from "lumiose";
import { Row } from "./Row.stsx";
import { ssr, SSRHtml, text, insert, insertText, attr, classAttr, list, branchArm, selector, createComponent } from "lumiose/server";
const _s0 = [
	"<li",
	">",
	". ",
	"</li>"
];
const _c0 = (h0, h1, h2) => typeof h0 === "string" && typeof h1 === "string" && typeof h2 === "string" ? new SSRHtml("<li" + h0 + ">" + h1 + ". " + h2 + "</li>") : ssr(_s0, h0, h1, h2);
const _s1 = [
	"<li",
	">",
	"</li>"
];
const _c1 = (h0, h1) => typeof h0 === "string" && typeof h1 === "string" ? new SSRHtml("<li" + h0 + ">" + h1 + "</li>") : ssr(_s1, h0, h1);
const _s2 = ["<td>", "</td>"];
const _c2 = (h0) => typeof h0 === "string" ? new SSRHtml("<td>" + h0 + "</td>") : ssr(_s2, h0);
const _s3 = ["<tr>", "</tr>"];
const _c3 = (h0) => h0 instanceof SSRHtml ? new SSRHtml("<tr>" + h0.t + "</tr>") : ssr(_s3, h0);
const _s4 = ["<b>", "</b>"];
const _c4 = (h0) => typeof h0 === "string" ? new SSRHtml("<b>" + h0 + "</b>") : ssr(_s4, h0);
const _s5 = ["<i>-</i>"];
const _s6 = [
	"<dt>",
	"</dt><dd>",
	"</dd>"
];
const _c6 = (h0, h1) => typeof h0 === "string" && typeof h1 === "string" ? new SSRHtml("<dt>" + h0 + "</dt><dd>" + h1 + "</dd>") : ssr(_s6, h0, h1);
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
const _c7 = (h0, h1, h2, h3, h4, h5, h6, h7) => h0 instanceof SSRHtml && h1 instanceof SSRHtml && h2 instanceof SSRHtml && h3 instanceof SSRHtml && typeof h4 === "string" && h5 instanceof SSRHtml && h6 instanceof SSRHtml && h7 instanceof SSRHtml ? new SSRHtml("<div><ul>" + h0.t + "</ul><ol>" + h1.t + "</ol><ol>" + h2.t + "</ol><table><tbody>" + h3.t + "</tbody></table><p>" + h4 + "</p>" + h5.t + h6.t + h7.t + "</div>") : ssr(_s7, h0, h1, h2, h3, h4, h5, h6, h7);
export function Lists(props) {
	const items = signal([]);
	const active = signal(0);
	const _isSelected = selector(active);
	const _isSelected2 = selector(active);
	const _isSelected3 = selector(() => props.selectedId);
	return _c7(list(items(), (item, i) => _c0(classAttr({
		active: _isSelected(item.id),
		first: i() === 0
	}), insert(i() + 1), insert(item.name))), list(items(), (item) => _c1(classAttr(!_isSelected2(item.id) ? "off" : "on"), insertText(item.name))), list(props.items, function(item) {
		const label = item.name.toUpperCase();
		return _c1(attr("data-selected", _isSelected3(item.id)), text(label));
	}), list(items(), (row) => _c3(list(row.tags, (tag) => _c2(insertText(tag))))), text(items().map((item) => item.name).join(", ")), list(items(), (item) => createComponent(Row, { item })), list(items(), (item) => active() > 0 ? branchArm(true, _c4(insertText(item.name))) : branchArm(false, ssr(_s5))), list(items(), (item, i) => _c6(insertText(item.name), insertText(i()))));
}
