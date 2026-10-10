import { template, bind, setClass, insertText, restProps, applyScope } from "lumiose/dom";
const _t0 = /* @__PURE__ */ template(`<button> `);
const _t1 = /* @__PURE__ */ template(`<div><button> </button><span> `);
const _t2 = /* @__PURE__ */ template(`<article> `);
const _t3 = /* @__PURE__ */ template(`<p> `);
const _t4 = /* @__PURE__ */ template(`<em> `);
const _t5 = /* @__PURE__ */ template(`<i> `);
function variantClass(props) {
	return [
		"btn",
		{ primary: props.variant === "primary" },
		props.class
	];
}
// `props` passed whole to a helper.
export function Helper(props) {
	const _el = _t0(), _text = _el.firstChild;
	bind(_el, () => variantClass(props), setClass);
	applyScope(_el, props.$$scope);
	insertText(_text, () => props.label);
	return _el;
}
// A local closure and an alias read `props.class`.
export function Closure(props) {
	const classes = () => ["btn", props.class];
	const extra = props.class;
	function wrap() {
		return ["wrap", extra];
	}
	const _el2 = _t1(), _button = _el2.firstChild, _text2 = _button.firstChild, _span = _button.nextSibling, _text3 = _span.firstChild;
	bind(_el2, wrap, setClass);
	applyScope(_el2, props.$$scope);
	bind(_button, classes, setClass);
	applyScope(_button, props.$$scope);
	insertText(_text2, () => props.label);
	bind(_span, () => props.variant, setClass);
	insertText(_text3, () => props.label);
	return _el2;
}
// Destructured: the `class` prop, and the rest of the props.
export function Destructured(props) {
	const list = () => ["card", props.class];
	const _el3 = _t2(), _text4 = _el3.firstChild;
	bind(_el3, () => list().join(" "), setClass);
	applyScope(_el3, props.$$scope);
	insertText(_text4, () => props.label);
	return _el3;
}
export function Rest(props) {
	const rest = restProps(props, ["label"]);
	const _el4 = _t3(), _text5 = _el4.firstChild;
	bind(_el4, () => ["note", rest.class], setClass);
	applyScope(_el4, props.$$scope);
	insertText(_text5, () => props.label);
	return _el4;
}
// A computed key on props may read `class`.
export function Computed(props) {
	const _el5 = _t4(), _text6 = _el5.firstChild;
	bind(_el5, () => props[props.key], setClass);
	applyScope(_el5, props.$$scope);
	insertText(_text6, () => props.label);
	return _el5;
}
// No flow: only other props reach the class.
export function Other(props) {
	const tone = () => props.variant ?? "ghost";
	const _el6 = _t5(), _text7 = _el6.firstChild;
	bind(_el6, () => `tone-${tone()}`, setClass);
	insertText(_text7, () => props.label);
	return _el6;
}
