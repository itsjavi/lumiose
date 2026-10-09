// Component calls: getter props for reactive reads and JSX, plain values for literals,
// identifiers and functions, a lazy children getter, spreads through mergeProps.
import { signal } from "lumen";
import { Card, ui } from "./ui.stsx";
import { ssr, insert, insertText, createComponent, mergeProps, island } from "lumen/server";
const _s0 = ["Hello <b>", "</b>"];
const _s1 = ["<p>Element only</p>"];
const _s2 = ["<i>row</i>"];
const _s3 = [
	"<div>",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"</div>"
];
export function App(props) {
	const user = signal({ name: "Ada" });
	const handler = () => user.set({ name: "Bob" });
	const size = 3;
	return ssr(_s3, insert(createComponent(Card, {
		title: "Static",
		count: 1,
		enabled: true,
		flag: false,
		onSelect: handler,
		size
	})), insert(island("/src/ui.stsx#Card", Card, ((_d, _v) => ({ get title() {
		return _d ? _v : (_v = user().name, _d = true, _v);
	} }))(), "load", void 0, { children: () => ssr(_s0, insertText(user().name)) })), insert(createComponent(Card, ((_d2, _v2) => ({ get children() {
		return _d2 ? _v2 : (_v2 = user().name, _d2 = true, _v2);
	} }))())), insert(createComponent(Card, { children: "Text only" })), insert(createComponent(Card, ((_d3, _v3) => ({ get children() {
		return _d3 ? _v3 : (_v3 = ssr(_s1), _d3 = true, _v3);
	} }))())), insert(createComponent(Card, ((_d4, _v4) => ({
		get icon() {
			return _d4 ? _v4 : (_v4 = createComponent(props.Icon, {}), _d4 = true, _v4);
		},
		render: () => ssr(_s2)
	}))())), insert(createComponent(Card, mergeProps(props.extra, { title: "after" }, { a: 1 }))), insert(createComponent(ui.Panel.Header, { level: 2 })), insert(createComponent(props.Icon, { size: 16 })));
}
export const Wrapper = (props) => createComponent(Card, ((_d5, _v5) => ({ get children() {
	return _d5 ? _v5 : (_v5 = props.children, _d5 = true, _v5);
} }))());
