// ref, attach, two-way bindings and innerHTML.
import { signal, ref } from "lumiose";
import { ssr, SSRHtml, attr } from "lumiose/server";
const _s0 = [
	"<form><input",
	"><input type=checkbox",
	"><div>",
	"</div><div><i>static</i></div></form>"
];
const _c0 = (h0, h1, h2) => typeof h0 === "string" && typeof h1 === "string" && typeof h2 === "string" ? new SSRHtml("<form><input" + h0 + "><input type=checkbox" + h1 + "><div>" + h2 + "</div><div><i>static</i></div></form>") : ssr(_s0, h0, h1, h2);
const focus = (el) => el.focus();
export function Form(props) {
	const name = signal("");
	const agree = signal(false);
	const input = ref();
	const html = signal("<b>x</b>");
	return _c0(attr("value", name()), attr("checked", agree()), html());
}
