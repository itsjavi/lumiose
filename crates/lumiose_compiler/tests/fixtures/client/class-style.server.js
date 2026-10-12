// class: strings, arrays and objects (static keys become per-key toggleClass bindings);
// style: strings and objects (per-key setStyleProperty).
import { signal } from "lumiose";
import { ssr, SSRHtml, classAttr, styleAttr } from "lumiose/server";
const _s0 = [
	"<div><p class=static style=\"color: red; margin: 0\"></p><p class=\"a b\"></p><p",
	"></p><p",
	"></p><p",
	"></p><p",
	"></p><p",
	"></p><p",
	"></p><p",
	"></p></div>"
];
const _c0 = (h0, h1, h2, h3, h4, h5, h6) => typeof h0 === "string" && typeof h1 === "string" && typeof h2 === "string" && typeof h3 === "string" && typeof h4 === "string" && typeof h5 === "string" && typeof h6 === "string" ? new SSRHtml("<div><p class=static style=\"color: red; margin: 0\"></p><p class=\"a b\"></p><p" + h0 + "></p><p" + h1 + "></p><p" + h2 + "></p><p" + h3 + "></p><p" + h4 + "></p><p" + h5 + "></p><p" + h6 + "></p></div>") : ssr(_s0, h0, h1, h2, h3, h4, h5, h6);
export function Styled(props) {
	const on = signal(false);
	const flag = true;
	return _c0(classAttr({
		base: true,
		off: false,
		on: on(),
		flag,
		"two words": on()
	}), classAttr({
		base: true,
		active: props.active,
		flag
	}), classAttr(props.cls), classAttr([props.cls, on() && "on"]), styleAttr({
		color: "red",
		"font-size": "12",
		"--accent": on() ? "blue" : null,
		width: flag
	}), styleAttr(props.style), styleAttr(`color: ${props.cls}`));
}
