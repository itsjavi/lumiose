import { template, bind, setAttr, setClass, insert, insertText, restProps, spread, applyScope } from "lumiose/dom";
const _t0 = /* @__PURE__ */ template(`<button type=button> `);
const _t1 = /* @__PURE__ */ template(`<label> `);
const _t2 = /* @__PURE__ */ template(`<p> `);
const _a0 = (el, v) => setAttr(el, "data-read", v);
// Destructuring the props object in a component body is rewritten like a destructured parameter
// (TASK-348): bindings read `props.<key>` where they are used, so `children` is created where it
// is inserted and a hydrating island claims it in order; `...rest` becomes `restProps`.
// Reassigned bindings, nested or computed reads, and destructuring in nested functions are left
// alone.
export function Trigger(props) {
	const rest = restProps(props, ["children"]);
	const _el = _t0(), _text = _el.firstChild;
	spread(_el, () => rest);
	insertText(_text, () => props.children);
	return _el;
}
export const Label = (props) => {
	const plain = "x";
	const _el2 = _t1(), _text2 = _el2.firstChild;
	bind(_el2, () => props.class, setClass);
	applyScope(_el2, props.$$scope);
	setAttr(_el2, "data-plain", plain);
	insert(_el2, () => props.text, _text2);
	insert(_el2, () => props.count === void 0 ? 1 : props.count);
	return _el2;
};
export function Kept(props) {
	let { value } = props;
	value = value.trim();
	const { name } = props.user;
	const read = () => {
		const { value: inner } = props;
		return inner;
	};
	const _el3 = _t2(), _text3 = _el3.firstChild;
	setAttr(_el3, "title", name);
	bind(_el3, read, _a0);
	insertText(_text3, value);
	return _el3;
}

// --- diagnostics ---
// LUM2001 warning 27:7 `value` is computed once from a reactive value, so the JSX that uses it never updates
// LUM2001 warning 29:9 `name` is computed once from a reactive value, so the JSX that uses it never updates
