import { ssr, SSRHtml, rawText } from "lumiose/server";
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
