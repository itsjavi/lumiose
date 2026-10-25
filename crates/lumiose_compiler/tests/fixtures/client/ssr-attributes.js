// Server attribute order follows the client DOM: static and baked attributes, scope tokens, then
// dynamic ones. Properties: innerHTML/textContent/textarea value become content on the server.
import { signal } from "lumiose";
import { template, bind, setAttr, setProp, setClass, toggleClass, setStyleProperty, insert, mergeProps, spread, applyScope, delegateEvents, bindValue, useRef } from "lumiose/dom";
import "/src/ssr-attributes.stsx?lumiose&type=style&lang.css";
const _t0 = /* @__PURE__ */ template(`<form method=post data-lum-0caa055f><input data-lum-0caa055f><input data-lum-0caa055f><p class=base style=color:red data-lum-0caa055f></p><div data-lum-0caa055f></div><span data-lum-0caa055f></span><textarea data-lum-0caa055f></textarea><textarea data-lum-0caa055f></textarea><b data-lum-0caa055f>`);
const _a0 = (el, v) => setAttr(el, "title", v);
const _a1 = (el, v) => setAttr(el, "aria-busy", v);
const _a2 = (el, v) => setAttr(el, "hidden", v);
const _a3 = (el, v) => setProp(el, "value", v);
const _a4 = (el, v) => setAttr(el, "disabled", v);
const _a5 = (el, v) => toggleClass(el, "on", v);
const _a6 = (el, v) => setStyleProperty(el, "width", v);
const _a7 = (el, v) => setProp(el, "innerHTML", v);
const _a8 = (el, v) => setProp(el, "textContent", v);
export function Field(props) {
	const name = signal("Ada \"the\" <first>");
	const on = signal(true);
	const _el = _t0(), _input = _el.firstChild, _input2 = _input.nextSibling, _p = _input2.nextSibling, _div = _p.nextSibling, _span = _div.nextSibling, _textarea = _span.nextSibling, _textarea2 = _textarea.nextSibling, _b = _textarea2.nextSibling;
	bind(_el, name, _a0);
	bind(_el, () => props.class, setClass);
	applyScope(_el, props.$$scope);
	bind(_el, on, _a1);
	bind(_el, () => !on(), _a2);
	bind(_input, name, _a3);
	bind(_input, on, _a4);
	_input.$$input = () => {};
	bindValue(_input2, name);
	useRef(_input2, () => {});
	bind(_p, on, _a5);
	bind(_p, () => props.size + "px", _a6);
	bind(_div, () => "<i>" + props.size + "</i>", _a7);
	bind(_span, name, _a8);
	bind(_textarea, name, _a3);
	_textarea2.value = "literal";
	spread(_b, () => mergeProps(props.rest, {
		id: "last",
		onClick: () => {}
	}));
	"children" in (props.rest || {}) && insert(_b, () => props.rest.children);
	return _el;
}
delegateEvents(["input"]);
