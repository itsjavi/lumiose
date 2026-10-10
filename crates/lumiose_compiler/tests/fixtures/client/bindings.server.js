// Attribute bindings: dynamic attributes and properties bind with hoisted apply functions,
// static expressions are written once, and `count()` of a stable binding is passed directly.
import { signal, untrack } from "lumiose";
import { ssr, text, insert, insertText, attr, escape } from "lumiose/server";
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
const title = "Hello";
let mutable = signal("a");
export function Bindings(props) {
	const count = signal(0);
	const label = () => `Count: ${count()}`;
	mutable = signal("b");
	return ssr(_s0, attr("title", title), attr("data-count", count()), attr("aria-label", label()), attr("data-m", mutable()), attr("href", props.href), attr("target", title + "x"), attr("value", count()), attr("checked", count() > 1), insertText(count()), text(`n=${count()}`), text(title), insertText(untrack(count)), insert(count() * 2), escape(label()));
}
