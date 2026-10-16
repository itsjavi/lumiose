// `lumiose`'s APIs that make a value or return a constant are not signal reads (TASK-349): an
// object literal that calls them is not a stale derived value (no LUM2001), spread or passed in
// JSX. A prop read in the same object still is.
import { createContext, signal, useId } from "lumiose";
import { template, insertText, createComponent, mergeProps, spread } from "lumiose/dom";
const _t0 = /* @__PURE__ */ template(`<div> `);
const Ctx = createContext();
export function Root(props) {
	const context = {
		id: useId(),
		open: signal()
	};
	return createComponent(Ctx, {
		value: context,
		get children() {
			return props.children;
		}
	});
}
export function Item(props) {
	const attrs = {
		id: useId(),
		role: "option"
	};
	const stale = {
		id: useId(),
		label: props.label
	};
	const _el = _t0(), _text = _el.firstChild;
	spread(_el, () => mergeProps(attrs, { get title() {
		return stale.label;
	} }));
	insertText(_text, () => props.children);
	return _el;
}

// --- diagnostics ---
// LUM2001 warning 15:9 `stale` is computed once from a reactive value, so the JSX that uses it never updates
