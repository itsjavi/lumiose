import { template, insert, restProps, mergeProps, spread } from "lumiose/dom";
const _t0 = /* @__PURE__ */ template(`<svg viewBox="0 0 24 24" fill=none focusable><path d="M1 1h22">`);
const _t1 = /* @__PURE__ */ template(`<input type=text>`);
const _t2 = /* @__PURE__ */ template(`<div>`);
// Constant attributes before a spread of the props object or its `...rest` stay in the template
// (TASK-97): those keys are fixed, so the spread only sets what the caller passed. `class`,
// `style`, properties, events and attributes after the spread keep going through the spread, and
// so does everything when a spread may change its keys (any other object).
export function Icon(props) {
	const rest = restProps(props, ["title"]);
	const _el = _t0();
	spread(_el, () => mergeProps({ get "aria-label"() {
		return props.title;
	} }, rest));
	return _el;
}
export function Field(props) {
	const _el2 = _t1();
	spread(_el2, () => mergeProps({
		class: "field",
		style: "margin: 0",
		value: "x"
	}, props, { "data-after": "1" }));
	return _el2;
}
export function Dynamic(props) {
	const attrs = props.attrs;
	const _el3 = _t2();
	spread(_el3, () => mergeProps({ role: "note" }, attrs()));
	"children" in attrs() && insert(_el3, () => attrs().children);
	return _el3;
}

// --- diagnostics ---
// LUM2001 warning 18:9 `attrs` is computed once from a reactive value, so the JSX that uses it never updates
