// class: strings, arrays and objects (static keys become per-key toggleClass bindings);
// style: strings and objects (per-key setStyleProperty).
import { signal } from "lumiose";
import { template, bind, setClass, toggleClass, setStyle, setStyleProperty } from "lumiose/dom";
const _t0 = /* @__PURE__ */ template(`<div><p class=static style="color: red; margin: 0"></p><p class="a b"></p><p></p><p class=base></p><p></p><p></p><p style=color:red;font-size:12></p><p></p><p>`);
const _a0 = (el, v) => toggleClass(el, "active", v);
const _a1 = (el, v) => setStyleProperty(el, "--accent", v);
export function Styled(props) {
	const on = signal(false);
	const flag = true;
	const _el = _t0(), _p = _el.firstChild.nextSibling.nextSibling, _p2 = _p.nextSibling, _p3 = _p2.nextSibling, _p4 = _p3.nextSibling, _p5 = _p4.nextSibling, _p6 = _p5.nextSibling, _p7 = _p6.nextSibling;
	bind(_p, () => ({
		base: true,
		off: false,
		on: on(),
		flag,
		"two words": on()
	}), setClass);
	bind(_p2, () => props.active, _a0);
	toggleClass(_p2, "flag", flag);
	bind(_p3, () => props.cls, setClass);
	bind(_p4, () => [props.cls, on() && "on"], setClass);
	bind(_p5, () => on() ? "blue" : null, _a1);
	setStyleProperty(_p5, "width", flag);
	bind(_p6, () => props.style, setStyle);
	bind(_p7, () => `color: ${props.cls}`, setStyle);
	return _el;
}
