import { ssr, SSRHtml, insertText, rawText } from "lumiose/server";
const _s0 = [
	"<div><script type=application/ld+json>",
	"<\/script><script type=application/ld+json>",
	"<\/script><script type=importmap>{\"imports\": {\"a\": \"./a.js?x=1&y=\\u003c2\"}}<\/script></div>"
];
const _c0 = (h0, h1) => typeof h0 === "string" && typeof h1 === "string" ? new SSRHtml("<div><script type=application/ld+json>" + h0 + "<\/script><script type=application/ld+json>" + h1 + "<\/script><script type=importmap>{\"imports\": {\"a\": \"./a.js?x=1&y=\\u003c2\"}}<\/script></div>") : ssr(_s0, h0, h1);
const _s1 = [
	"<div><script>if (1 < 2 && ok) document.title = '<\\/script>';<\/script><script>",
	"<\/script><style>",
	"</style><style>a > b::after { content: '<\\/style>' }</style><script>",
	"<\/script><svg><style>a &lt; b</style></svg></div>"
];
const _c1 = (h0, h1, h2) => typeof h0 === "string" && typeof h1 === "string" && typeof h2 === "string" ? new SSRHtml("<div><script>if (1 < 2 && ok) document.title = '<\\/script>';<\/script><script>" + h0 + "<\/script><style>" + h1 + "</style><style>a > b::after { content: '<\\/style>' }</style><script>" + h2 + "<\/script><svg><style>a &lt; b</style></svg></div>") : ssr(_s1, h0, h1, h2);
const _s2 = ["<g><style>", "</style></g>"];
const _c2 = (h0) => typeof h0 === "string" ? new SSRHtml("<g><style>" + h0 + "</style></g>") : ssr(_s2, h0);
const _s3 = ["<mi>x</mi><script>", "<\/script>"];
const _c3 = (h0) => typeof h0 === "string" ? new SSRHtml("<mi>x</mi><script>" + h0 + "<\/script>") : ssr(_s3, h0);
const _s4 = ["<style>", "</style><style>a::after { content: '<\\69 mg src=x>' }</style>"];
const _c4 = (h0) => typeof h0 === "string" ? new SSRHtml("<style>" + h0 + "</style><style>a::after { content: '<\\69 mg src=x>' }</style>") : ssr(_s4, h0);
// `<script>` and `<style>` content is raw text, which HTML does not decode (TASK-472 L7): static
// text is written as it is, with `<\/script`, `</style` and `<!--` neutralized; in a JSON script
// every `<` is `\u003c`. On the server, dynamic text, `innerHTML` and `textContent` go through
// `rawText()`; the client writes DOM text. Mixed text and values are one text. In SVG, `<style>`
// text is escaped as usual.
export function JsonLd(props) {
	return _c0(rawText(JSON.stringify(props.data), "script", true), rawText(JSON.stringify(props.data), "script", true));
}
export function Inline(props) {
	return _c1(rawText([
		"var name = ",
		JSON.stringify(props.name),
		";"
	].join(""), "script"), rawText(props.css, "style"), rawText(props.name, "script"));
}
// TASK-495: a `<style>` or `<script>` under a root such as `<g>` or `<mi>` is SVG or MathML, as on
// the client: its text is escaped (and the parser decodes it). A root `<style>` or `<script>` may
// still end up inside `<svg>`, where its text is parsed as markup: `rawText()` escapes the
// character after each `<` that could open a tag, as in the static text here.
export function Layer(props) {
	return _c2(insertText(props.css));
}
export function Formula(props) {
	return _c3(insertText(props.code));
}
export function Sheet(props) {
	return _c4(rawText(props.css, "style"));
}
