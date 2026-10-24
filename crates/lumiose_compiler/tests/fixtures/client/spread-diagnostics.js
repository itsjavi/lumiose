import { template, insert, insertText, createComponent, restProps, spread } from "lumiose/dom";
const _t0 = /* @__PURE__ */ template(`<h2> `);
const _t1 = /* @__PURE__ */ template(`<div>`);
const _t2 = /* @__PURE__ */ template(`<section><div></div> `);
const _t3 = /* @__PURE__ */ template(`<section><div>own</div><p>text</p><input> `);
// The reactivity diagnostics see spreads (TASK-466): a stale derived value that reaches JSX only
// through a spread reports LUM2001, on elements and components, and the `children` an element's
// props spread inserts (TASK-347) counts for LUM2005. A rest without `children`, written content
// and a later `children` attribute insert none.
function Card(props) {
	const _el = _t0(), _text = _el.firstChild;
	insertText(_text, () => props.title);
	return _el;
}
export function Stale(props) {
	const attrs = {
		title: props.label,
		style: `color: ${props.color}`
	};
	const extra = { title: props.label };
	const _el2 = _t1();
	spread(_el2, () => attrs);
	insert(_el2, createComponent(Card, extra));
	return _el2;
}
export function Live(props) {
	const attrs = () => ({ title: props.label });
	const _el3 = _t1();
	spread(_el3, () => attrs());
	"children" in (attrs() || {}) && insert(_el3, () => attrs().children);
	return _el3;
}
export function Twice(props) {
	const _el4 = _t2(), _div = _el4.firstChild, _text2 = _div.nextSibling;
	spread(_div, () => props);
	"children" in props && insert(_div, () => props.children);
	insertText(_text2, () => props.children);
	return _el4;
}
export function Once(props) {
	const rest = restProps(props, ["children"]);
	const _el5 = _t2(), _div2 = _el5.firstChild, _text3 = _div2.nextSibling;
	spread(_div2, () => rest);
	"children" in rest && insert(_div2, () => rest.children);
	insertText(_text3, () => props.children);
	return _el5;
}
export function Kept(props) {
	const _el6 = _t3(), _div3 = _el6.firstChild, _p = _div3.nextSibling, _input = _p.nextSibling, _text4 = _input.nextSibling;
	spread(_div3, () => props);
	spread(_p, () => props);
	spread(_input, () => props);
	insertText(_text4, () => props.children);
	return _el6;
}

// --- diagnostics ---
// LUM2001 warning 10:9 `attrs` is computed once from a reactive value, so the JSX that uses it never updates
// LUM2001 warning 11:9 `extra` is computed once from a reactive value, so the JSX that uses it never updates
// LUM2005 warning 28:7 `children` is inserted more than once; children are created lazily and can only be placed once
