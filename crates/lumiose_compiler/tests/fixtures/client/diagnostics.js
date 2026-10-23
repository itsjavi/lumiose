// Reactivity diagnostics: LUM2001 stale derived value, LUM2002 write during render, LUM2003
// reactive early return, LUM2004 component called as a function, LUM2005 children inserted
// twice, LUM2006 reactive index read in row setup.
import { signal } from "lumiose";
import { params, url } from "lumiose/router";
import { Card } from "./Card.stsx";
import { template, bind, setAttr, insert, insertText, list, delegateEvents } from "lumiose/dom";
const _t0 = /* @__PURE__ */ template(`<div><!><!><span> `);
const _t1 = /* @__PURE__ */ template(`<li>: `);
const _t2 = /* @__PURE__ */ template(`<ul>`);
const _t3 = /* @__PURE__ */ template(`<p>Sign in`);
const _t4 = /* @__PURE__ */ template(`<p> `);
const _t5 = /* @__PURE__ */ template(`<button> from `);
const _t6 = /* @__PURE__ */ template(`<p> in <!> of `);
const _a0 = (el, v) => setAttr(el, "data-name", v);
const _a1 = (el, v) => setAttr(el, "data-once", v);
const _a2 = (el, v) => setAttr(el, "data-i", v);
const shared = signal(0);
export function Child(props) {
	const upper = props.name.toUpperCase();
	const once = signal(props.name);
	shared.set(1);
	if (!props.name) {
		return null;
	}
	const _el = _t0(), _marker = _el.firstChild, _marker2 = _marker.nextSibling, _span = _marker2.nextSibling, _text = _span.firstChild;
	setAttr(_el, "title", upper);
	bind(_el, () => props.name, _a0);
	bind(_el, once, _a1);
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
		bind(_el2, () => i(), _a2);
		insert(_el2, position, _text2);
		insert(_el2, item);
		return _el2;
	});
	return _el3;
}
// LUM2003 is an error on a signal or accessor read and a warning on a prop read (decision-77),
// also through a derived local and in a `switch`.
export function Account(props) {
	const kind = props.kind;
	switch (kind) {
		case "guest": return null;
	}
	if (!props.user()) return _t3();
	const _el4 = _t4(), _text3 = _el4.firstChild;
	insertText(_text3, () => props.user());
	return _el4;
}
// LUM2001 also reports a signal's value copied into a local (TASK-529); `peek()` reads it once
// on purpose.
export function Counter() {
	const count = signal(0);
	const n = count();
	const start = count.peek();
	const _el5 = _t5(), _text4 = _el5.firstChild;
	_el5.$$click = () => count.update((c) => c + 1);
	insert(_el5, n, _text4);
	insert(_el5, start);
	return _el5;
}
// And a destructured accessor prop or the router's URL copied into a local (TASK-536). A page
// with other params is a new page, so a copy of `params()` is left alone.
export function Results(props) {
	const q = props.query();
	const u = url();
	const p = params();
	const _el6 = _t6(), _text5 = _el6.firstChild, _marker3 = _text5.nextSibling;
	insert(_el6, q, _text5);
	insert(_el6, () => u.search, _marker3);
	insert(_el6, () => p.id);
	return _el6;
}
delegateEvents(["click"]);

// --- diagnostics ---
// LUM2001 warning 11:9 `upper` is computed once from a reactive value, so the JSX that uses it never updates
// LUM2002 error 14:3 `shared` is written while the component renders
// LUM2003 warning 15:7 this early return depends on a prop, but a component body runs once: it never updates if a parent passes a changing value
// LUM2005 warning 21:7 `children` is inserted more than once; children are created lazily and can only be placed once
// LUM2004 error 22:8 the component `Card` is called as a function
// LUM2002 error 23:14 `shared` is written while the component renders
// LUM2006 warning 32:26 the list index `i` is read once here, so this value goes stale when rows move
// LUM2003 warning 43:11 this early return depends on a prop, but a component body runs once: it never updates if a parent passes a changing value
// LUM2003 error 47:7 this early return depends on a reactive value, but a component body runs once
// LUM2001 warning 55:9 `n` is computed once from a reactive value, so the JSX that uses it never updates
// LUM2001 warning 67:9 `q` is computed once from a reactive value, so the JSX that uses it never updates
// LUM2001 warning 68:9 `u` is computed once from a reactive value, so the JSX that uses it never updates
