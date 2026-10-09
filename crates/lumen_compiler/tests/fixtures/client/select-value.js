// <select value> marks the matching <option> selected in SSR output (static options, options
// from .map(), option text as value, optgroups, bind:value); the client sets the property.
import { signal } from "lumen";
import { template, bind, setProp, insertText, list, bindValue } from "lumen/dom";
const _t0 = /* @__PURE__ */ template(`<select><option value=a>A</option><option value=b>B</option><option> Plain   text </option><option value=c selected>C</option><optgroup label=More><option value=d>D`);
const _t1 = /* @__PURE__ */ template(`<option> `);
const _t2 = /* @__PURE__ */ template(`<select>`);
const _t3 = /* @__PURE__ */ template(`<form><select><option value=a>A</option><option value=b>B`);
const _a0 = (el, v) => setProp(el, "value", v);
const choice = signal("b");
const items = signal([{
	id: 1,
	label: "One"
}]);
export function Static() {
	const _el = _t0();
	bind(_el, choice, _a0);
	return _el;
}
export function Mapped(props) {
	const _el3 = _t2();
	list(_el3, null, items, (item) => {
		const _el2 = _t1(), _text = _el2.firstChild;
		bind(_el2, () => item.id, _a0);
		insertText(_text, () => item.label);
		return _el2;
	});
	bind(_el3, () => props.selected, _a0);
	return _el3;
}
export function Bound() {
	const _el4 = _t3(), _select = _el4.firstChild;
	bindValue(_select, choice);
	return _el4;
}
