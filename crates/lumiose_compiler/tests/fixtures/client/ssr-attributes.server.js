// Server attribute order follows the client DOM: static and baked attributes, scope tokens, then
// dynamic ones. Properties: innerHTML/textContent/textarea value become content on the server.
import { signal } from "lumiose";
import { ssr, SSRHtml, insert, attr, classAttr, styleAttr, spreadAttrs, escape, mergeProps } from "lumiose/server";
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
	">",
	"</b></form>"
];
const _c0 = (h0, h1, h2, h3, h4, h5, h6, h7, h8, h9, h10, h11, h12, h13, h14) => typeof h0 === "string" && typeof h1 === "string" && typeof h2 === "string" && typeof h3 === "string" && typeof h4 === "string" && typeof h5 === "string" && typeof h6 === "string" && typeof h7 === "string" && typeof h8 === "string" && typeof h9 === "string" && typeof h10 === "string" && typeof h11 === "string" && typeof h12 === "string" && typeof h13 === "string" && typeof h14 === "string" ? new SSRHtml("<form method=post data-l-0caa055f" + h0 + h1 + h2 + h3 + h4 + "><input data-l-0caa055f" + h5 + h6 + "><input data-l-0caa055f" + h7 + "><p" + h8 + h9 + " data-l-0caa055f></p><div data-l-0caa055f>" + h10 + "</div><span data-l-0caa055f>" + h11 + "</span><textarea data-l-0caa055f>" + h12 + "</textarea><textarea data-l-0caa055f>literal</textarea><b data-l-0caa055f" + h13 + ">" + h14 + "</b></form>") : ssr(_s0, h0, h1, h2, h3, h4, h5, h6, h7, h8, h9, h10, h11, h12, h13, h14);
export function Field(props) {
	const name = signal("Ada \"the\" <first>");
	const on = signal(true);
	return _c0(attr("title", name()), classAttr(props.class), spreadAttrs({ $$scope: props.$$scope }), attr("aria-busy", on()), attr("hidden", !on()), attr("value", name()), attr("disabled", on()), attr("value", name()), classAttr({
		base: true,
		on: on()
	}), styleAttr({
		color: "red",
		width: props.size + "px"
	}), "<i>" + props.size + "</i>", escape(name()), escape(name()), spreadAttrs(mergeProps(props.rest, {
		id: "last",
		onClick: () => {}
	})), "children" in (props.rest || {}) ? insert(props.rest.children) : "");
}
