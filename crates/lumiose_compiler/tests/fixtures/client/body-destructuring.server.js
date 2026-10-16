import { ssr, SSRHtml, insert, insertText, attr, classAttr, spreadAttrs, restProps, mergeProps } from "lumiose/server";
const _s0 = [
	"<button",
	">",
	"</button>"
];
const _c0 = (h0, h1) => typeof h0 === "string" && typeof h1 === "string" ? new SSRHtml("<button" + h0 + ">" + h1 + "</button>") : ssr(_s0, h0, h1);
const _s1 = [
	"<label",
	"",
	"",
	">",
	" ",
	"</label>"
];
const _c1 = (h0, h1, h2, h3, h4) => typeof h0 === "string" && typeof h1 === "string" && typeof h2 === "string" && typeof h3 === "string" && typeof h4 === "string" ? new SSRHtml("<label" + h0 + h1 + h2 + ">" + h3 + " " + h4 + "</label>") : ssr(_s1, h0, h1, h2, h3, h4);
const _s2 = [
	"<p",
	"",
	">",
	"</p>"
];
const _c2 = (h0, h1, h2) => typeof h0 === "string" && typeof h1 === "string" && typeof h2 === "string" ? new SSRHtml("<p" + h0 + h1 + ">" + h2 + "</p>") : ssr(_s2, h0, h1, h2);
// Destructuring the props object in a component body is rewritten like a destructured parameter
// (TASK-348): bindings read `props.<key>` where they are used, so `children` is created where it
// is inserted and a hydrating island claims it in order; `...rest` becomes `restProps`.
// Reassigned bindings, nested or computed reads, and destructuring in nested functions are left
// alone.
export function Trigger(props) {
	const rest = restProps(props, ["children"]);
	return _c0(spreadAttrs(mergeProps({ type: "button" }, rest)), insertText(props.children));
}
export const Label = (props) => {
	const plain = "x";
	return _c1(classAttr(props.class), spreadAttrs({ $$scope: props.$$scope }), attr("data-plain", plain), insert(props.text), insert(props.count === void 0 ? 1 : props.count));
};
export function Kept(props) {
	let { value } = props;
	value = value.trim();
	const { name } = props.user;
	const read = () => {
		const { value: inner } = props;
		return inner;
	};
	return _c2(attr("title", name), attr("data-read", read()), insertText(value));
}

// --- diagnostics ---
// LUM2001 warning 27:7 `value` is computed once from a reactive value, so the JSX that uses it never updates
// LUM2001 warning 29:9 `name` is computed once from a reactive value, so the JSX that uses it never updates
