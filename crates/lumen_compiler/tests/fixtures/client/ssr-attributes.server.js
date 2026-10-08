// @scope Field=data-l-f1
// Server attribute order follows the client DOM: static and baked attributes, scope tokens, then
// dynamic ones. Properties: innerHTML/textContent/textarea value become content on the server.
import { signal } from "lumen";
import { ssr, attr, classAttr, styleAttr, spreadAttrs, escape, mergeProps } from "lumen/server";
const _s0 = [
	"<form method=post data-l-f1",
	"",
	"",
	"",
	"",
	"><input data-l-f1",
	"",
	"><input data-l-f1",
	"><p",
	"",
	" data-l-f1></p><div data-l-f1>",
	"</div><span data-l-f1>",
	"</span><textarea data-l-f1>",
	"</textarea><textarea data-l-f1>literal</textarea><b data-l-f1",
	"></b></form>"
];
export function Field(props) {
	const name = signal("Ada \"the\" <first>");
	const on = signal(true);
	return ssr(_s0, attr("title", name()), classAttr(props.class), spreadAttrs({ $$scope: props.$$scope }), attr("aria-busy", on()), attr("hidden", !on()), attr("value", name()), attr("disabled", on()), attr("value", name()), classAttr({
		base: true,
		on: on()
	}), styleAttr({
		color: "red",
		width: props.size + "px"
	}), "<i>" + props.size + "</i>", escape(name()), escape(name()), spreadAttrs(mergeProps(props.rest, {
		id: "last",
		onClick: () => {}
	})));
}
