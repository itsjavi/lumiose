// Parentless branch and list values (TASK-50): reactive conditionals and .map() in component
// children, fragments, branch arms and returned rows compile to branchValue/listValue (the server's
// branch/list); other props and plain functions keep their values.
import { signal } from "lumiose";
import { Card } from "./Card.stsx";
import { template, insert, insertText, list, branch, branchValue, listValue, createComponent } from "lumiose/dom";
const _t0 = /* @__PURE__ */ template(`<p>Open`);
const _t1 = /* @__PURE__ */ template(`<p>Closed`);
const _t2 = /* @__PURE__ */ template(`<span>Visible`);
const _t3 = /* @__PURE__ */ template(`<li> `);
const _t4 = /* @__PURE__ */ template(`<h2>Title`);
const _t5 = /* @__PURE__ */ template(`<li>: `);
const _t6 = /* @__PURE__ */ template(`<b>T`);
const _t7 = /* @__PURE__ */ template(`<i> `);
const _t8 = /* @__PURE__ */ template(`<p>None`);
const _t9 = /* @__PURE__ */ template(`<div><!><!><!><!><!>`);
const _t10 = /* @__PURE__ */ template(`<span>end`);
const _t11 = /* @__PURE__ */ template(`<b> `);
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
			const _el = _t3(), _text = _el.firstChild;
			insertText(_text, () => item.name);
			return _el;
		});
	} }), _marker3);
	insert(_el5, createComponent(Card, { get children() {
		const _el2 = _t4();
		return [_el2, listValue(items, (item, i) => {
			const _el3 = _t5(), _text2 = _el3.firstChild;
			insert(_el3, () => i(), _text2);
			insert(_el3, () => item.v.name);
			return _el3;
		}, (item) => item.id)];
	} }), _marker4);
	insert(_el5, createComponent(Card, { get title() {
		return open() ? _t6() : null;
	} }), _marker5);
	branch(_el5, null, open, () => listValue(items, (item) => {
		const _el4 = _t7(), _text3 = _el4.firstChild;
		insertText(_text3, () => item.name);
		return _el4;
	}), () => _t8());
	return _el5;
}
export function Frag() {
	const open = signal(false);
	const items = signal([]);
	const _v = branchValue(open, () => _t0(), () => _t1());
	const _v2 = listValue(items, (name) => {
		const _el6 = _t3(), _text4 = _el6.firstChild;
		insertText(_text4, name);
		return _el6;
	});
	const _el7 = _t10();
	return [
		_v,
		_v2,
		_el7
	];
}
export function Rows() {
	const items = signal([]);
	const _el10 = _t12();
	list(_el10, null, items, (name) => branchValue(() => name.length > 3, () => {
		const _el8 = _t11(), _text5 = _el8.firstChild;
		insertText(_text5, name);
		return _el8;
	}, () => {
		const _el9 = _t7(), _text6 = _el9.firstChild;
		insertText(_text6, name);
		return _el9;
	}));
	return _el10;
}
export function Plain(props) {
	return props.list.map((name) => {
		const _el11 = _t3(), _text7 = _el11.firstChild;
		insertText(_text7, name);
		return _el11;
	});
}
