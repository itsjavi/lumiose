import { template, bind, setText, setAttr, insert, restProps, mergeProps, spread, delegateEvents } from "lumen/dom";
const _t0 = /* @__PURE__ */ template(`<section><h1></h1><p> </p><button>log`);
const _t1 = /* @__PURE__ */ template(`<span>`);
const _t2 = /* @__PURE__ */ template(`<p>`);
const _a0 = (el, v) => setAttr(el, "title", v);
// Reactive props destructuring: reads become props.x (defaults with undefined semantics),
// rest becomes restProps, shorthand properties expand.
export function Props(props) {
	const rest = restProps(props, [
		"title",
		"count",
		"class",
		"user"
	]);
	const payload = () => ({
		title: props.title,
		count: props.count === void 0 ? 1 : props.count
	});
	const _el = _t0(), _h1 = _el.firstChild, _p = _h1.nextSibling, _text = _p.firstChild, _button = _p.nextSibling;
	spread(_el, () => mergeProps({
		get class() {
			return props.class;
		},
		get "data-name"() {
			return (props.user === void 0 ? {} : props.user).name === void 0 ? "anon" : (props.user === void 0 ? {} : props.user).name;
		}
	}, rest));
	insert(_h1, () => props.title);
	bind(_text, () => (props.count === void 0 ? 1 : props.count) * 2, setText);
	_button.$$click = () => console.log(payload(), props.title);
	return _el;
}
export const Arrow = (props) => {
	const _el2 = _t1();
	insert(_el2, () => props.label);
	return _el2;
};
export function Conflict(_props) {
	const props = { value: 1 };
	const _el3 = _t2();
	bind(_el3, () => _props.value, _a0);
	insert(_el3, () => props.value);
	return _el3;
}
export function Reassigned({ value }) {
	value = value.trim();
	const _el4 = _t2();
	insert(_el4, value);
	return _el4;
}
export function Plain(attrs) {
	const _el5 = _t2();
	insert(_el5, () => attrs.value);
	return _el5;
}
delegateEvents(["click"]);
