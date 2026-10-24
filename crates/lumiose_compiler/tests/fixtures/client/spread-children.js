import { template, insert, insertText, restProps, mergeProps, spread } from "lumiose/dom";
const _t0 = /* @__PURE__ */ template(`<button>`);
const _t1 = /* @__PURE__ */ template(`<div>`);
const _t2 = /* @__PURE__ */ template(`<span>`);
const _t3 = /* @__PURE__ */ template(`<section><p></p><p> </p><p> </p><p>text`);
const _t4 = /* @__PURE__ */ template(`<div><p></p><p>`);
const _t5 = /* @__PURE__ */ template(`<div><p>own</p><p>own</p><input><textarea></textarea>`);
// An element without content of its own renders the `children` of its spreads and `children`
// attribute, as in React and Solid (TASK-347): the last source that has `children` wins, written
// content wins over all of them. Spreads alone insert `children` only when their props object has
// the key, so content that scripts or the browser own stays when they have none. Void, raw-text
// and form-value elements never render them.
export function Button(props) {
	const _el = _t0();
	spread(_el, () => props);
	"children" in props && insert(_el, () => props.children);
	return _el;
}
export function Empty(props) {
	const _el2 = _t1();
	spread(_el2, () => props);
	"children" in props && insert(_el2, () => props.children);
	return _el2;
}
export function Rest(props) {
	const rest = restProps(props, ["title"]);
	const _el3 = _t2();
	spread(_el3, () => mergeProps({ get title() {
		return props.title;
	} }, rest));
	"children" in rest && insert(_el3, () => rest.children);
	return _el3;
}
export function Merged(props) {
	const _el4 = _t3(), _p = _el4.firstChild, _p2 = _p.nextSibling, _text = _p2.firstChild, _p3 = _p2.nextSibling, _text2 = _p3.firstChild;
	spread(_p, () => mergeProps(props.a, props.b));
	"children" in mergeProps(props.a, props.b) && insert(_p, () => mergeProps(props.a, props.b).children);
	spread(_p2, () => props.a);
	insertText(_text, () => props.label);
	spread(_p3, () => props.b);
	insertText(_text2, () => mergeProps({ get children() {
		return props.label;
	} }, props.b).children);
	return _el4;
}
// A spread may be nullish or `false`, which `in` throws on, so it is checked as `object || {}`
// (TASK-569). The component's props, its `...rest` and merged spreads are always objects.
export function Optional(props) {
	const _el5 = _t4(), _p4 = _el5.firstChild, _p5 = _p4.nextSibling;
	spread(_p4, () => props.extra);
	"children" in (props.extra || {}) && insert(_p4, () => props.extra.children);
	spread(_p5, () => props.open && props.attrs);
	"children" in (props.open && props.attrs || {}) && insert(_p5, () => (props.open && props.attrs).children);
	return _el5;
}
export function Written(props) {
	const _el6 = _t5(), _p6 = _el6.firstChild, _input = _p6.nextSibling.nextSibling, _textarea = _input.nextSibling;
	spread(_p6, () => props);
	spread(_input, () => props);
	spread(_textarea, () => props);
	return _el6;
}
