// class: strings, arrays and objects (static keys become per-key toggleClass bindings);
// style: strings and objects (per-key setStyleProperty).
import { signal } from "lumen";
import { ssr, classAttr, styleAttr } from "lumen/server";
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
export function Styled(props) {
	const on = signal(false);
	const flag = true;
	return ssr(_s0, classAttr({
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
