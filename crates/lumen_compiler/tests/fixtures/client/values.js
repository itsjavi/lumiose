// Parentless branch and list values (TASK-50): reactive conditionals and .map() in component
// children, fragments, branch arms and returned rows compile to branchValue/listValue (the server's
// branch/list); other props and plain functions keep their values.
import { signal } from "lumen";
import { Card } from "./Card.stsx";
import { template, insert, list, branch, branchValue, listValue, createComponent } from "lumen/dom";
const _t0 = /* @__PURE__ */ template(`<p>Open`);
const _t1 = /* @__PURE__ */ template(`<p>Closed`);
const _t2 = /* @__PURE__ */ template(`<span>Visible`);
const _t3 = /* @__PURE__ */ template(`<li>`);
const _t4 = /* @__PURE__ */ template(`<li>: `);
const _t5 = /* @__PURE__ */ template(`<h2>Title`);
const _t6 = /* @__PURE__ */ template(`<b>T`);
const _t7 = /* @__PURE__ */ template(`<i>`);
const _t8 = /* @__PURE__ */ template(`<p>None`);
const _t9 = /* @__PURE__ */ template(`<div><!><!><!><!><!>`);
const _t10 = /* @__PURE__ */ template(`<span>end`);
const _t11 = /* @__PURE__ */ template(`<b>`);
const _t12 = /* @__PURE__ */ template(`<ul>`);
export function Values(props) {
	const open = signal(false);
	const items = signal([]);
	const _el5 = _t9(), _marker = _el5.firstChild, _marker2 = _marker.nextSibling, _marker3 = _marker2.nextSibling, _marker4 = _marker3.nextSibling, _marker5 = _marker4.nextSibling;
	insert(_el5, createComponent(Card, { get children() {
		return branchValue(open, () => _t0(), () => _t1());
	} }), _marker);
	insert(_el5, createComponent(Card, { get children() {
		return branchValue(open, () => _t2());
	} }), _marker2);
	insert(_el5, createComponent(Card, { get children() {
		return listValue(items, (item) => {
			const _el = _t3();
			insert(_el, () => item.name);
			return _el;
		});
	} }), _marker3);
	insert(_el5, createComponent(Card, { get children() {
		const _el3 = _t5();
		return [_el3, listValue(items, (item, i) => {
			const _el2 = _t4(), _text = _el2.firstChild;
			insert(_el2, () => i(), _text);
			insert(_el2, () => item.name);
			return _el2;
		}, (item) => item.id)];
	} }), _marker4);
	insert(_el5, createComponent(Card, { get title() {
		return open() ? _t6() : null;
	} }), _marker5);
	branch(_el5, null, open, () => listValue(items, (item) => {
		const _el4 = _t7();
		insert(_el4, () => item.name);
		return _el4;
	}), () => _t8());
	return _el5;
}
export function Frag() {
	const open = signal(false);
	const items = signal([]);
	const _el7 = _t10();
	return [
		branchValue(open, () => _t0(), () => _t1()),
		listValue(items, (name) => {
			const _el6 = _t3();
			insert(_el6, name);
			return _el6;
		}),
		_el7
	];
}
export function Rows() {
	const items = signal([]);
	const _el10 = _t12();
	list(_el10, null, items, (name) => branchValue(() => name.length > 3, () => {
		const _el8 = _t11();
		insert(_el8, name);
		return _el8;
	}, () => {
		const _el9 = _t7();
		insert(_el9, name);
		return _el9;
	}));
	return _el10;
}
export function Plain(props) {
	return props.list.map((name) => {
		const _el11 = _t3();
		insert(_el11, name);
		return _el11;
	});
}
