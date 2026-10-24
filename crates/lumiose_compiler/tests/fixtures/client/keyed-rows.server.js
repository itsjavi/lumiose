// Keyed rows (TASK-554, decision-83): the client's row callback gets the row, whose `v` reads its
// current item, so reads of the item (`item.v`) and of a destructured item's bindings
// (`_item.v.name`) are live, like props. Data-slot handlers get the row; a component prop becomes
// a getter. Setup reads that the JSX uses are LUM2001, an early return on the item is LUM2003 (a
// warning), and copies of the key itself are neither. A pattern with a rest element is read once
// (LUM2001). A render that reads no item takes no parameter. Unkeyed lists are unchanged.
import { signal } from "lumiose";
import { Card } from "./Card.tsx";
import { ssr, SSRHtml, insert, insertText, classAttr, list, selector, createComponent } from "lumiose/server";
const _s0 = ["<b>", "</b>"];
const _c0 = (h0) => typeof h0 === "string" ? new SSRHtml("<b>" + h0 + "</b>") : ssr(_s0, h0);
const _s1 = [
	"<li",
	">",
	"",
	"",
	"",
	"</li>"
];
const _c1 = (h0, h1, h2, h3, h4) => typeof h0 === "string" && typeof h1 === "string" && typeof h2 === "string" && typeof h3 === "string" && h4 instanceof SSRHtml ? new SSRHtml("<li" + h0 + ">" + h1 + h2 + h3 + h4.t + "</li>") : ssr(_s1, h0, h1, h2, h3, h4);
const _s2 = [
	"<li>",
	"",
	"",
	"</li>"
];
const _c2 = (h0, h1, h2) => typeof h0 === "string" && typeof h1 === "string" && typeof h2 === "string" ? new SSRHtml("<li>" + h0 + h1 + h2 + "</li>") : ssr(_s2, h0, h1, h2);
const _s3 = ["<s>", "</s>"];
const _c3 = (h0) => typeof h0 === "string" ? new SSRHtml("<s>" + h0 + "</s>") : ssr(_s3, h0);
const _s4 = [
	"<i>",
	"",
	"",
	"",
	"</i>"
];
const _c4 = (h0, h1, h2, h3) => typeof h0 === "string" && typeof h1 === "string" && typeof h2 === "string" && typeof h3 === "string" ? new SSRHtml("<i>" + h0 + h1 + h2 + h3 + "</i>") : ssr(_s4, h0, h1, h2, h3);
const _s5 = ["<a>static</a>"];
const _s6 = ["<a>", "</a>"];
const _c6 = (h0) => typeof h0 === "string" ? new SSRHtml("<a>" + h0 + "</a>") : ssr(_s6, h0);
const _s7 = [
	"<div><ul>",
	"</ul><ol>",
	"</ol><p>",
	"</p><section>",
	"</section><nav>",
	"</nav><aside>",
	"</aside></div>"
];
const _c7 = (h0, h1, h2, h3, h4, h5) => h0 instanceof SSRHtml && h1 instanceof SSRHtml && h2 instanceof SSRHtml && h3 instanceof SSRHtml && h4 instanceof SSRHtml && h5 instanceof SSRHtml ? new SSRHtml("<div><ul>" + h0.t + "</ul><ol>" + h1.t + "</ol><p>" + h2.t + "</p><section>" + h3.t + "</section><nav>" + h4.t + "</nav><aside>" + h5.t + "</aside></div>") : ssr(_s7, h0, h1, h2, h3, h4, h5);
const format = (s) => s.toUpperCase();
const selected = signal(0);
const select = (id) => selected.set(id);
export function KeyedRows() {
	const items = signal([]);
	const _isSelected = selector(selected);
	return _c7(list(items(), (item) => _c1(classAttr({
		on: _isSelected(item.id),
		done: item.done
	}), insert(item.name), insert(item.label()), insert(createComponent(Card, { item })), list(item.tags, (tag) => _c0(insertText(tag))))), list(items(), ({ id, name, tags: [first = "none"] }, i) => _c2(insert(name), insert(first), insert(i()))), list(items(), (item) => {
		const id = item.id;
		const name = item.name;
		const upper = format(item.name);
		const local = signal(item.done);
		if (item.done) return _c3(insertText(id));
		return _c4(insert(id), insert(name), insert(upper), insert(local()));
	}), list(items(), ({ id, ...rest }) => createComponent(Card, rest)), list(items(), (item) => ssr(_s5)), list(items(), (item) => _c6(insertText(item.name))));
}

// --- diagnostics ---
// LUM2001 warning 47:17 `name` is read once from the row's item, so the JSX that uses it keeps the first value when the item changes in place
// LUM2001 warning 48:17 `upper` is read once from the row's item, so the JSX that uses it keeps the first value when the item changes in place
// LUM2003 warning 50:15 this early return depends on the row's item, but a keyed row renders once: it does not re-run when the item changes in place
// LUM2001 warning 62:23 the item of this keyed row is destructured with a rest element, so its bindings are read once and keep the first value when the item changes in place
