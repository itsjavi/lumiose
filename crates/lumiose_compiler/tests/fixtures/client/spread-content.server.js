import { ssr, SSRHtml, spreadAttrs, escape, restProps } from "lumiose/server";
const _s0 = [
	"<div",
	">",
	"</div>"
];
const _c0 = (h0, h1) => typeof h0 === "string" && typeof h1 === "string" ? new SSRHtml("<div" + h0 + ">" + h1 + "</div>") : ssr(_s0, h0, h1);
const _s1 = [
	"<section><p",
	">",
	"</p><p",
	">static</p><article",
	"><b>static</b></article></section>"
];
const _c1 = (h0, h1, h2, h3) => typeof h0 === "string" && typeof h1 === "string" && typeof h2 === "string" && typeof h3 === "string" ? new SSRHtml("<section><p" + h0 + ">" + h1 + "</p><p" + h2 + ">static</p><article" + h3 + "><b>static</b></article></section>") : ssr(_s1, h0, h1, h2, h3);
// A written `innerHTML` or `textContent` next to a spread applies as written, after the spread,
// on both targets (TASK-478): a spread never writes content (TASK-470), so it cannot go through
// it. It replaces the spread's `children` (TASK-347), as it replaces written children.
export function Html(props) {
	const rest = restProps(props, ["html"]);
	return _c0(spreadAttrs(rest), props.html);
}
export function Text(props) {
	return _c1(spreadAttrs(props.attrs), escape(props.text), spreadAttrs(props.attrs), spreadAttrs(props.attrs));
}
