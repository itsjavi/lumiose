// `lumiose`'s APIs that make a value or return a constant are not signal reads (TASK-349): an
// object literal that calls them is not a stale derived value (no LUM2001), spread or passed in
// JSX. A prop read in the same object still is.
import { createContext, signal, useId } from "lumiose";
import { ssr, SSRHtml, insertText, spreadAttrs, createComponent, mergeProps } from "lumiose/server";
const _s0 = [
	"<div",
	">",
	"</div>"
];
const _c0 = (h0, h1) => typeof h0 === "string" && typeof h1 === "string" ? new SSRHtml("<div" + h0 + ">" + h1 + "</div>") : ssr(_s0, h0, h1);
const Ctx = createContext();
export function Root(props) {
	const context = {
		id: useId(),
		open: signal()
	};
	return createComponent(Ctx, ((_d, _v) => ({
		value: context,
		get children() {
			return _d ? _v : (_v = props.children, _d = true, _v);
		}
	}))());
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
	return _c0(spreadAttrs(mergeProps(attrs, { get title() {
		return stale.label;
	} })), insertText(props.children));
}

// --- diagnostics ---
// LUM2001 warning 15:9 `stale` is computed once from a reactive value, so the JSX that uses it never updates
