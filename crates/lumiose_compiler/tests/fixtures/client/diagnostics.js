// Reactivity diagnostics: LUM2001 stale derived value, LUM2002 write during render, LUM2003
// reactive early return, LUM2004 component called as a function, LUM2005 children inserted
// twice, LUM2006 reactive index read in row setup.
import { signal } from "lumiose";
import { Card } from "./Card.stsx";
import { template, bind, setAttr, insert, insertText, list } from "lumiose/dom";
const _t0 = /* @__PURE__ */ template(`<div><!><!><span> `);
const _t1 = /* @__PURE__ */ template(`<li>: `);
const _t2 = /* @__PURE__ */ template(`<ul>`);
const _a0 = (el, v) => setAttr(el, "data-once", v);
const _a1 = (el, v) => setAttr(el, "data-i", v);
const shared = signal(0);
export function Child(props) {
	const upper = props.name.toUpperCase();
	const { name } = props;
	const once = signal(props.name);
	shared.set(1);
	if (!props.name) {
		return null;
	}
	const _el = _t0(), _marker = _el.firstChild, _marker2 = _marker.nextSibling, _span = _marker2.nextSibling, _text = _span.firstChild;
	setAttr(_el, "title", upper);
	setAttr(_el, "data-name", name);
	bind(_el, once, _a0);
	insert(_el, () => props.children, _marker);
	insert(_el, () => props.children, _marker2);
	insert(_el, () => Card({ title: "x" }), _span);
	insertText(_text, () => shared.set(2));
	return _el;
}
export function Rows(props) {
	const _el3 = _t2();
	list(_el3, null, () => props.items, (item, i) => {
		const position = i();
		const _el2 = _t1(), _text2 = _el2.firstChild;
		bind(_el2, () => i(), _a1);
		insert(_el2, position, _text2);
		insert(_el2, item);
		return _el2;
	});
	return _el3;
}

// --- diagnostics ---
// LUM2001 warning 10:9 `upper` is computed once from a reactive value, so the JSX that uses it never updates
// LUM2001 warning 11:9 `name` is computed once from a reactive value, so the JSX that uses it never updates
// LUM2002 error 13:3 `shared` is written while the component renders
// LUM2003 error 14:7 this early return depends on a reactive value, but a component body runs once
// LUM2005 warning 20:7 `children` is inserted more than once; children are created lazily and can only be placed once
// LUM2004 error 21:8 the component `Card` is called as a function
// LUM2002 error 22:14 `shared` is written while the component renders
// LUM2006 warning 31:26 the list index `i` is read once here, so this value goes stale when rows move
