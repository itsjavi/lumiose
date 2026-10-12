// Attribute bindings: dynamic attributes and properties bind with hoisted apply functions,
// static expressions are written once, and `count()` of a stable binding is passed directly.
import { signal, untrack } from "lumiose";
import { ssr, SSRHtml, text, insert, insertText, attr, escape } from "lumiose/server";
const _s0 = [
	"<div",
	"",
	"",
	"",
	"><a",
	"",
	">link</a><input",
	"",
	"><input value=static checked><span>",
	"</span><span>",
	"</span><span>",
	"</span><span>",
	"</span><b>",
	" items</b><i>",
	"</i></div>"
];
const _c0 = (h0, h1, h2, h3, h4, h5, h6, h7, h8, h9, h10, h11, h12, h13) => typeof h0 === "string" && typeof h1 === "string" && typeof h2 === "string" && typeof h3 === "string" && typeof h4 === "string" && typeof h5 === "string" && typeof h6 === "string" && typeof h7 === "string" && typeof h8 === "string" && typeof h9 === "string" && typeof h10 === "string" && typeof h11 === "string" && typeof h12 === "string" && typeof h13 === "string" ? new SSRHtml("<div" + h0 + h1 + h2 + h3 + "><a" + h4 + h5 + ">link</a><input" + h6 + h7 + "><input value=static checked><span>" + h8 + "</span><span>" + h9 + "</span><span>" + h10 + "</span><span>" + h11 + "</span><b>" + h12 + " items</b><i>" + h13 + "</i></div>") : ssr(_s0, h0, h1, h2, h3, h4, h5, h6, h7, h8, h9, h10, h11, h12, h13);
const title = "Hello";
let mutable = signal("a");
export function Bindings(props) {
	const count = signal(0);
	const label = () => `Count: ${count()}`;
	mutable = signal("b");
	return _c0(attr("title", title), attr("data-count", count()), attr("aria-label", label()), attr("data-m", mutable()), attr("href", props.href), attr("target", title + "x"), attr("value", count()), attr("checked", count() > 1), insertText(count()), text(`n=${count()}`), text(title), insertText(untrack(count)), insert(count() * 2), escape(label()));
}
