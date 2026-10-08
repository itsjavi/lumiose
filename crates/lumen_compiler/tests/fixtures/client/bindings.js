// Attribute bindings: dynamic attributes and properties bind with hoisted apply functions,
// static expressions are written once, and `count()` of a stable binding is passed directly.
import { signal, untrack } from "lumen";
import { template, bind, setText, setAttr, setProp, insert } from "lumen/dom";
const _t0 = /* @__PURE__ */ template(`<div><a>link</a><input><input value=static checked><span></span><span> </span><span></span><span></span><b> items</b><i>`);
const _a0 = (el, v) => setAttr(el, "data-count", v);
const _a1 = (el, v) => setAttr(el, "aria-label", v);
const _a2 = (el, v) => setAttr(el, "data-m", v);
const _a3 = (el, v) => setAttr(el, "href", v);
const _a4 = (el, v) => setProp(el, "value", v);
const _a5 = (el, v) => setProp(el, "checked", v);
const _a6 = (el, v) => setProp(el, "indeterminate", v);
const _a7 = (el, v) => setProp(el, "textContent", v);
const title = "Hello";
let mutable = signal("a");
export function Bindings(props) {
	const count = signal(0);
	const label = () => `Count: ${count()}`;
	mutable = signal("b");
	const _el = _t0(), _a = _el.firstChild, _input = _a.nextSibling, _span = _input.nextSibling.nextSibling, _span2 = _span.nextSibling, _text = _span2.firstChild, _span3 = _span2.nextSibling, _span4 = _span3.nextSibling, _b = _span4.nextSibling, _text2 = _b.firstChild, _i = _b.nextSibling;
	setAttr(_el, "title", title);
	bind(_el, count, _a0);
	bind(_el, label, _a1);
	bind(_el, () => mutable(), _a2);
	bind(_a, () => props.href, _a3);
	setAttr(_a, "target", title + "x");
	bind(_input, count, _a4);
	bind(_input, () => count() > 1, _a5);
	bind(_input, () => count() > 2, _a6);
	insert(_span, count);
	bind(_text, () => `n=${count()}`, setText);
	insert(_span3, title);
	insert(_span4, untrack(count));
	insert(_b, () => count() * 2, _text2);
	bind(_i, label, _a7);
	return _el;
}
