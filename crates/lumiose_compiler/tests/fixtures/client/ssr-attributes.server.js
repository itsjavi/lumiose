// Server attribute order follows the client DOM: static and baked attributes, scope tokens, then
// dynamic ones. Properties: innerHTML/textContent/textarea value become content on the server.
import { signal } from "lumiose";
import { ssr, attr, classAttr, styleAttr, spreadAttrs, escape, mergeProps } from "lumiose/server";
import "/src/ssr-attributes.stsx?lumiose&type=style&lang.css";
const _s0 = [
	"<form method=post data-l-0caa055f",
	"",
	"",
	"",
	"",
	"><input data-l-0caa055f",
	"",
	"><input data-l-0caa055f",
	"><p",
	"",
	" data-l-0caa055f></p><div data-l-0caa055f>",
	"</div><span data-l-0caa055f>",
	"</span><textarea data-l-0caa055f>",
	"</textarea><textarea data-l-0caa055f>literal</textarea><b data-l-0caa055f",
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
