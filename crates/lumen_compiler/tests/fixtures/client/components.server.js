// Component calls: getter props for reactive reads and JSX, plain values for literals,
// identifiers and functions, a lazy children getter, spreads through mergeProps.
import { signal } from "lumen";
import { Card, ui } from "./ui.stsx";
import { ssr, insert, createComponent, mergeProps } from "lumen/server";
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
	})), insert(createComponent(Card, {
		get title() {
			return user().name;
		},
		get children() {
			return ssr(_s0, insert(user().name));
		}
	})), insert(createComponent(Card, { get children() {
		return user().name;
	} })), insert(createComponent(Card, { get children() {
		return "Text only";
	} })), insert(createComponent(Card, { get children() {
		return ssr(_s1);
	} })), insert(createComponent(Card, {
		get icon() {
			return createComponent(props.Icon, {});
		},
		render: () => ssr(_s2)
	})), insert(createComponent(Card, mergeProps(props.extra, { title: "after" }, { a: 1 }))), insert(createComponent(ui.Panel.Header, { level: 2 })), insert(createComponent(props.Icon, { size: 16 })));
}
export const Wrapper = (props) => createComponent(Card, { get children() {
	return props.children;
} });
