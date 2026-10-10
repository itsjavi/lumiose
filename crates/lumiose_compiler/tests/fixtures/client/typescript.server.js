import { signal } from "lumiose";
import { Card } from "./Card.stsx";
import { createComponent, mergeProps } from "lumiose/server";
var Mode = /* @__PURE__ */ function(Mode) {
	Mode[Mode["A"] = 0] = "A";
	Mode[Mode["B"] = 1] = "B";
	return Mode;
}(Mode || {});
const pick = (value) => value;
export function Typed(_props) {
	const mode = signal(Mode.A);
	const first = _props.items[0];
	const props = { title: pick(first) };
	return createComponent(Card, mergeProps(props, ((_d, _v) => ({ get mode() {
		return _d ? _v : (_v = mode(), _d = true, _v);
	} }))()));
}
