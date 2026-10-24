import { signal } from "lumiose";
import { template, insert, mergeProps, spread, bindValue, attach } from "lumiose/dom";
const _t0 = /* @__PURE__ */ template(`<li>`);
const _t1 = /* @__PURE__ */ template(`<input>`);
// Directives next to a spread (TASK-568). `attach` and `bind:` are not props: they apply after the
// spread as they do without one, in either order, and never reach it (where `attach` became an
// attribute holding the function's source); the server drops `attach`. `key` is compile-time
// only. `ref`, handlers and `on:` listeners are props the spread applies, in order with the other
// attributes.
const observe = (el) => el.toggleAttribute("data-seen", true);
export function Row(props) {
	const _el = _t0();
	spread(_el, () => mergeProps(props.itemProps?.(props.item), { get "data-row"() {
		return props.i;
	} }));
	attach(_el, () => [(el) => observe(el)]);
	"children" in (props.itemProps?.(props.item) || {}) && insert(_el, () => (props.itemProps?.(props.item)).children);
	return _el;
}
export function Before(props) {
	const _el2 = _t0();
	spread(_el2, () => mergeProps({ id: "before" }, props.attrs));
	attach(_el2, () => [observe]);
	"children" in (props.attrs || {}) && insert(_el2, () => props.attrs.children);
	return _el2;
}
export function Single(props) {
	const _el3 = _t0();
	spread(_el3, () => props.attrs);
	attach(_el3, () => [observe]);
	"children" in (props.attrs || {}) && insert(_el3, () => props.attrs.children);
	return _el3;
}
export function Props(props) {
	const value = signal("");
	const _el4 = _t1();
	spread(_el4, () => mergeProps(props.attrs, {
		ref: (el) => observe(el),
		get onClick() {
			return props.onPick;
		},
		get "on:custom-event"() {
			return props.onPick;
		}
	}));
	bindValue(_el4, value);
	attach(_el4, () => [observe]);
	return _el4;
}
