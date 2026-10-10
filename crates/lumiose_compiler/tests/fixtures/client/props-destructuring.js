import { template, bind, setText, setAttr, insertText, restProps, mergeProps, spread, delegateEvents } from "lumiose/dom";
const _t0 = /* @__PURE__ */ template(`<section><h1> </h1><p> </p><button>log`);
const _t1 = /* @__PURE__ */ template(`<span> `);
const _t2 = /* @__PURE__ */ template(`<p> `);
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
	const _el = _t0(), _h1 = _el.firstChild, _text = _h1.firstChild, _p = _h1.nextSibling, _text2 = _p.firstChild, _button = _p.nextSibling;
	spread(_el, () => mergeProps({
		get class() {
			return props.class;
		},
		get "data-name"() {
			return (props.user === void 0 ? {} : props.user).name === void 0 ? "anon" : (props.user === void 0 ? {} : props.user).name;
		}
	}, rest));
	insertText(_text, () => props.title);
	bind(_text2, () => (props.count === void 0 ? 1 : props.count) * 2, setText);
	_button.$$click = () => console.log(payload(), props.title);
	return _el;
}
export const Arrow = (props) => {
	const _el2 = _t1(), _text3 = _el2.firstChild;
	insertText(_text3, () => props.label);
	return _el2;
};
export function Conflict(_props) {
	const props = { value: 1 };
	const _el3 = _t2(), _text4 = _el3.firstChild;
	bind(_el3, () => _props.value, _a0);
	insertText(_text4, () => props.value);
	return _el3;
}
export function Reassigned({ value }) {
	value = value.trim();
	const _el4 = _t2(), _text5 = _el4.firstChild;
	insertText(_text5, value);
	return _el4;
}
export function Plain(attrs) {
	const _el5 = _t2(), _text6 = _el5.firstChild;
	insertText(_text6, () => attrs.value);
	return _el5;
}
delegateEvents(["click"]);
