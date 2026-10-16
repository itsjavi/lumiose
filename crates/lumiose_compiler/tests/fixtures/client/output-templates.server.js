// Templates with an `<output>` are created with `outputTemplate` (TASK-425): a form reset
// replaces an output's children in Firefox and WebKit, and the helper keeps them. Other
// templates of the module stay plain `template` calls.
import { signal } from "lumiose";
import { ssr, SSRHtml, insert, insertText } from "lumiose/server";
const _s0 = ["<form><button type=button>Add</button><output>", " items</output></form>"];
const _c0 = (h0) => typeof h0 === "string" ? new SSRHtml("<form><button type=button>Add</button><output>" + h0 + " items</output></form>") : ssr(_s0, h0);
const _s1 = ["<p>", "</p>"];
const _c1 = (h0) => typeof h0 === "string" ? new SSRHtml("<p>" + h0 + "</p>") : ssr(_s1, h0);
export function Total() {
	const count = signal(0);
	return _c0(insert(count()));
}
export function Plain(props) {
	return _c1(insertText(props.label));
}
