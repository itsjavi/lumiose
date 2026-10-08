// Text children (TASK-65): a provably text value (literals, arithmetic, templates, `String()`,
// number/string methods, or a const initialised with one) that stands alone between nodes is a
// text node of the template: bound with setText when reactive, written once otherwise; the server
// emits a `text()` hole there. Next to JSX text or another dynamic child, or when the value may
// be a node, it stays an insert.
import { signal } from "lumen";
import { ssr, text, insert, list } from "lumen/server";
const _s0 = [
	"<div><h2>Total</h2>",
	"<b>static</b>",
	"<i></i>",
	"<hr>",
	"</div>"
];
const _s1 = [
	"<li><span>",
	"</span>",
	"<em>€</em></li>"
];
const _s2 = ["<ul>", "</ul>"];
const _s3 = [
	"<p>Clicked ",
	" times<br>",
	"<br>",
	"",
	"</p>"
];
const count = signal(0);
const items = signal([{
	id: 1,
	price: 2.5
}]);
export function Isolated(props) {
	const total = count() * 2;
	const label = String(props.name);
	return ssr(_s0, text(count() * 2), text(total), text(label), text(`#${count()}`));
}
export function Rows() {
	return ssr(_s2, list(items(), (item) => {
		const price = item.price.toFixed(2);
		return ssr(_s1, insert(item.id), text(price));
	}));
}
export function Inserts(props) {
	return ssr(_s3, insert(count()), insert(props.icon), insert(count()), insert(count() + 1));
}

// --- diagnostics ---
// LUM2001 warning 12:9 `total` is computed once from a reactive value, so the JSX that uses it never updates
