import { ssr, insert, classAttr, spreadAttrs, createComponent } from "lumen/server";
import "/src/doc2-component-call.stsx?lumen&type=style&lang.css";
const _s0 = [
	"<article data-l-c2",
	"",
	"><h2 data-l-c2>",
	"</h2>",
	"</article>"
];
const _s1 = ["<main data-l-p1>", "</main>"];
export function Card(props) {
	return ssr(_s0, classAttr(props.class), spreadAttrs({ $$scope: props.$$scope }), insert(props.title), insert(props.children));
}
export function Page(props) {
	return ssr(_s1, insert(createComponent(Card, {
		get title() {
			return props.post().title;
		},
		class: "featured",
		$$scope: "data-l-p1",
		get children() {
			return props.post().body;
		}
	})));
}
