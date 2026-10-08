// Text children (TASK-65): a provably text value (literals, arithmetic, templates, `String()`,
// number/string methods, or a const initialised with one) that stands alone between nodes is a
// text node of the template: bound with setText when reactive, written once otherwise; the server
// emits a `text()` hole there. Next to JSX text or another dynamic child, or when the value may
// be a node, it stays an insert.
import { signal } from "lumen";
import { template, bind, setText, insert, list } from "lumen/dom";
const _t0 = /* @__PURE__ */ template(`<div><h2>Total</h2> <b>static</b> <i></i> <hr> `);
const _t1 = /* @__PURE__ */ template(`<li><span></span> <em>€`);
const _t2 = /* @__PURE__ */ template(`<ul>`);
const _t3 = /* @__PURE__ */ template(`<p>Clicked <!> times<br><br><!>`);
const count = signal(0);
const items = signal([{
	id: 1,
	price: 2.5
}]);
export function Isolated(props) {
	const total = count() * 2;
	const label = String(props.name);
	const _el = _t0(), _text = _el.firstChild.nextSibling, _text2 = _text.nextSibling.nextSibling, _text3 = _text2.nextSibling.nextSibling, _text4 = _text3.nextSibling.nextSibling;
	bind(_text, () => count() * 2, setText);
	_text2.data = total;
	_text3.data = label;
	bind(_text4, () => `#${count()}`, setText);
	return _el;
}
export function Rows() {
	const _el3 = _t2();
	list(_el3, null, items, (item) => {
		const price = item.price.toFixed(2);
		const _el2 = _t1(), _span = _el2.firstChild, _text5 = _span.nextSibling;
		insert(_span, () => item.id);
		_text5.data = price;
		return _el2;
	});
	return _el3;
}
export function Inserts(props) {
	const _el4 = _t3(), _marker = _el4.firstChild.nextSibling, _br = _marker.nextSibling.nextSibling.nextSibling, _marker2 = _br.nextSibling;
	insert(_el4, count, _marker);
	insert(_el4, () => props.icon, _br);
	insert(_el4, count, _marker2);
	insert(_el4, () => count() + 1);
	return _el4;
}

// --- diagnostics ---
// LUM2001 warning 12:9 `total` is computed once from a reactive value, so the JSX that uses it never updates
