// Text children (TASK-65): a provably text value (literals, arithmetic, templates, `String()`,
// number/string methods, or a const initialised with one) that stands alone between nodes is a
// text node of the template: bound with setText when reactive, written once otherwise; the server
// emits a `text()` hole there. Next to JSX text or another dynamic child, or when the value may
// be a node, it stays an insert.
import { signal } from "lumiose";
import { ssr, SSRHtml, text, insert, insertText, list } from "lumiose/server";
const _s0 = [
	"<div><h2>Total</h2>",
	"<b>static</b>",
	"<i></i>",
	"<hr>",
	"</div>"
];
const _c0 = (h0, h1, h2, h3) => typeof h0 === "string" && typeof h1 === "string" && typeof h2 === "string" && typeof h3 === "string" ? new SSRHtml("<div><h2>Total</h2>" + h0 + "<b>static</b>" + h1 + "<i></i>" + h2 + "<hr>" + h3 + "</div>") : ssr(_s0, h0, h1, h2, h3);
const _s1 = [
	"<li><span>",
	"</span>",
	"<em>€</em></li>"
];
const _c1 = (h0, h1) => typeof h0 === "string" && typeof h1 === "string" ? new SSRHtml("<li><span>" + h0 + "</span>" + h1 + "<em>€</em></li>") : ssr(_s1, h0, h1);
const _s2 = ["<ul>", "</ul>"];
const _c2 = (h0) => h0 instanceof SSRHtml ? new SSRHtml("<ul>" + h0.t + "</ul>") : ssr(_s2, h0);
const _s3 = [
	"<p>Clicked ",
	" times<br>",
	"<br>",
	"",
	"</p>"
];
const _c3 = (h0, h1, h2, h3) => typeof h0 === "string" && typeof h1 === "string" && typeof h2 === "string" && typeof h3 === "string" ? new SSRHtml("<p>Clicked " + h0 + " times<br>" + h1 + "<br>" + h2 + h3 + "</p>") : ssr(_s3, h0, h1, h2, h3);
const count = signal(0);
const items = signal([{
	id: 1,
	price: 2.5
}]);
export function Isolated(props) {
	const total = count() * 2;
	const label = String(props.name);
	return _c0(text(count() * 2), text(total), text(label), text(`#${count()}`));
}
export function Rows() {
	return _c2(list(items(), (item) => {
		const price = item.price.toFixed(2);
		return _c1(insertText(item.id), text(price));
	}));
}
export function Inserts(props) {
	return _c3(insert(count()), insertText(props.icon), insert(count()), insert(count() + 1));
}

// --- diagnostics ---
// LUM2001 warning 12:9 `total` is computed once from a reactive value, so the JSX that uses it never updates
