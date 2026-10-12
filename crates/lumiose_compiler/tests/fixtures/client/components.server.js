// Component calls: getter props for reactive reads and JSX, plain values for literals,
// identifiers and functions, a lazy children getter, spreads through mergeProps.
import { signal } from "lumiose";
import { Card, ui } from "./ui.stsx";
import { ssr, SSRHtml, insert, insertText, createComponent, mergeProps, island } from "lumiose/server";
const _s0 = ["Hello <b>", "</b>"];
const _c0 = (h0) => typeof h0 === "string" ? new SSRHtml("Hello <b>" + h0 + "</b>") : ssr(_s0, h0);
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
const _c3 = (h0, h1, h2, h3, h4, h5, h6, h7, h8) => typeof h0 === "string" && typeof h1 === "string" && typeof h2 === "string" && typeof h3 === "string" && typeof h4 === "string" && typeof h5 === "string" && typeof h6 === "string" && typeof h7 === "string" && typeof h8 === "string" ? new SSRHtml("<div>" + h0 + h1 + h2 + h3 + h4 + h5 + h6 + h7 + h8 + "</div>") : ssr(_s3, h0, h1, h2, h3, h4, h5, h6, h7, h8);
export function App(props) {
	const user = signal({ name: "Ada" });
	const handler = () => user.set({ name: "Bob" });
	const size = 3;
	return _c3(insert(createComponent(Card, {
		title: "Static",
		count: 1,
		enabled: true,
		flag: false,
		onSelect: handler,
		size
	})), insert(island("/src/ui.stsx#Card", Card, ((_d, _v) => ({ get title() {
		return _d ? _v : (_v = user().name, _d = true, _v);
	} }))(), "load", void 0, { children: () => _c0(insertText(user().name)) })), insert(createComponent(Card, ((_d2, _v2) => ({ get children() {
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
