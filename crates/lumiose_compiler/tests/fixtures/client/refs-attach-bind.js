// ref, attach, two-way bindings and innerHTML.
import { signal, ref } from "lumiose";
import { template, bind, setProp, bindValue, bindChecked, attach, useRef } from "lumiose/dom";
const _t0 = /* @__PURE__ */ template(`<form><input><input type=checkbox><div></div><div>`);
const _a0 = (el, v) => setProp(el, "innerHTML", v);
const focus = (el) => el.focus();
export function Form(props) {
	const name = signal("");
	const agree = signal(false);
	const input = ref();
	const html = signal("<b>x</b>");
	const _el = _t0(), _input = _el.firstChild, _input2 = _input.nextSibling, _div = _input2.nextSibling, _div2 = _div.nextSibling;
	useRef(_input, input);
	bindValue(_input, name);
	attach(_input, () => [
		focus,
		props.tooltip,
		agree() && focus
	]);
	bindChecked(_input2, agree);
	attach(_input2, () => [focus]);
	bind(_div, html, _a0);
	_div2.innerHTML = "<i>static</i>";
	return _el;
}
