// The HTML parser wraps rows of a <table> in an implicit <tbody>: both targets spell it out for
// static <tr>s, row-producing .map() calls and conditionals, so walks match the parsed DOM.
import { signal } from "lumiose";
import { ssr, SSRHtml, text, insertText, list, branchArm } from "lumiose/server";
const _s0 = ["<tr><td>", "</td></tr>"];
const _c0 = (h0) => typeof h0 === "string" ? new SSRHtml("<tr><td>" + h0 + "</td></tr>") : ssr(_s0, h0);
const _s1 = ["<table><tbody>", "</tbody></table>"];
const _c1 = (h0) => h0 instanceof SSRHtml ? new SSRHtml("<table><tbody>" + h0.t + "</tbody></table>") : ssr(_s1, h0);
const _s2 = ["<tr><td>open</td></tr>"];
const _s3 = ["<tr><td>also</td></tr>"];
const _s4 = [
	"<table><caption>Rows</caption><thead><tr><th>Name</th></tr></thead><tbody><tr><td>first</td></tr>",
	"",
	"",
	"</tbody><tfoot><tr><td>total</td></tr></tfoot></table>"
];
const _c4 = (h0, h1, h2) => h0 instanceof SSRHtml && h1 instanceof SSRHtml && h2 instanceof SSRHtml ? new SSRHtml("<table><caption>Rows</caption><thead><tr><th>Name</th></tr></thead><tbody><tr><td>first</td></tr>" + h0.t + h1.t + h2.t + "</tbody><tfoot><tr><td>total</td></tr></tfoot></table>") : ssr(_s4, h0, h1, h2);
const rows = signal([{
	id: 1,
	name: "a"
}]);
const open = signal(true);
export function Mapped() {
	return _c1(list(rows(), (row) => _c0(insertText(row.name))));
}
export function Mixed() {
	return _c4(list(rows(), (row) => {
		const label = row.name.toUpperCase();
		return _c0(text(label));
	}), open() ? branchArm(true, ssr(_s2)) : branchArm(false), open() ? branchArm(true, ssr(_s3)) : branchArm(false));
}
export function Explicit() {
	return _c1(list(rows(), (row) => _c0(insertText(row.name))));
}
