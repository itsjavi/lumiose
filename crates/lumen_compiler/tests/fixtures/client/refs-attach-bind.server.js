// ref, attach, two-way bindings and innerHTML.
import { signal, ref } from "lumen";
import { ssr, attr } from "lumen/server";
const _s0 = [
	"<form><input",
	"><input type=checkbox",
	"><div>",
	"</div><div><i>static</i></div></form>"
];
const focus = (el) => el.focus();
export function Form(props) {
	const name = signal("");
	const agree = signal(false);
	const input = ref();
	const html = signal("<b>x</b>");
	return ssr(_s0, attr("value", name()), attr("checked", agree()), html());
}
