// The HTML parser wraps rows of a <table> in an implicit <tbody>: both targets spell it out for
// static <tr>s, row-producing .map() calls and conditionals, so walks match the parsed DOM.
import { signal } from "lumen";
import { ssr, text, insertText, list, branchArm } from "lumen/server";
const _s0 = ["<tr><td>", "</td></tr>"];
const _s1 = ["<table><tbody>", "</tbody></table>"];
const _s2 = ["<tr><td>open</td></tr>"];
const _s3 = ["<tr><td>also</td></tr>"];
const _s4 = [
	"<table><caption>Rows</caption><thead><tr><th>Name</th></tr></thead><tbody><tr><td>first</td></tr>",
	"",
	"",
	"</tbody><tfoot><tr><td>total</td></tr></tfoot></table>"
];
const rows = signal([{
	id: 1,
	name: "a"
}]);
const open = signal(true);
export function Mapped() {
	return ssr(_s1, list(rows(), (row) => ssr(_s0, insertText(row.name))));
}
export function Mixed() {
	return ssr(_s4, list(rows(), (row) => {
		const label = row.name.toUpperCase();
		return ssr(_s0, text(label));
	}), open() ? branchArm(true, ssr(_s2)) : branchArm(false), open() ? branchArm(true, ssr(_s3)) : branchArm(false));
}
export function Explicit() {
	return ssr(_s1, list(rows(), (row) => ssr(_s0, insertText(row.name))));
}
