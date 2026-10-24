// Row keys (TASK-553): a key may read the item's destructured bindings, the index (passed to the
// key function only when read), a nested arrow's parameters and row consts (inlined), and a
// callback with several returns keeps the key its returned elements share.
import { signal } from "lumiose";
import { ssr, SSRHtml, text, insertText, list } from "lumiose/server";
const _s0 = ["<div>", "</div>"];
const _c0 = (h0) => typeof h0 === "string" ? new SSRHtml("<div>" + h0 + "</div>") : ssr(_s0, h0);
const _s1 = ["<p>", "</p>"];
const _c1 = (h0) => typeof h0 === "string" ? new SSRHtml("<p>" + h0 + "</p>") : ssr(_s1, h0);
const _s2 = ["<b>", "</b>"];
const _c2 = (h0) => typeof h0 === "string" ? new SSRHtml("<b>" + h0 + "</b>") : ssr(_s2, h0);
const _s3 = ["<s>hidden</s>"];
const _s4 = ["<u>", "</u>"];
const _c4 = (h0) => typeof h0 === "string" ? new SSRHtml("<u>" + h0 + "</u>") : ssr(_s4, h0);
const _s5 = [
	"<div>",
	"",
	"",
	"",
	"",
	"</div>"
];
const _c5 = (h0, h1, h2, h3, h4) => h0 instanceof SSRHtml && h1 instanceof SSRHtml && h2 instanceof SSRHtml && h3 instanceof SSRHtml && h4 instanceof SSRHtml ? new SSRHtml("<div>" + h0.t + h1.t + h2.t + h3.t + h4.t + "</div>") : ssr(_s5, h0, h1, h2, h3, h4);
export function RowKeys() {
	const entries = signal([]);
	return _c5(list(entries(), ({ row, index }) => _c0(text(row.length))), list(entries(), (entry) => _c1(insertText(entry.key))), list(entries(), (entry, i) => _c1(insertText(i()))), list(entries(), (entry) => {
		const id = entry.key;
		const same = id;
		const { index: at } = entry;
		return _c2(insertText(id));
	}), list(entries(), (entry) => {
		if (entry.index < 0) return ssr(_s3);
		return _c4(insertText(entry.index));
	}));
}
