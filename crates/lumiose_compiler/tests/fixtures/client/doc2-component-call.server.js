import { ssr, insert, insertText, classAttr, spreadAttrs, createComponent } from "lumiose/server";
import "/src/doc2-component-call.stsx?lumiose&type=style&lang.css";
const _s0 = [
	"<article data-l-ar7z1gx1",
	"",
	"><h2 data-l-ar7z1gx1>",
	"</h2>",
	"</article>"
];
const _s1 = ["<main data-l-qlayfokw>", "</main>"];
export function Card(props) {
	return ssr(_s0, classAttr(props.class), spreadAttrs({ $$scope: props.$$scope }), insertText(props.title), insertText(props.children));
}
export function Page(props) {
	return ssr(_s1, insert(createComponent(Card, ((_d, _v, _d2, _v2) => ({
		get title() {
			return _d ? _v : (_v = props.post().title, _d = true, _v);
		},
		class: "featured",
		$$scope: "data-l-qlayfokw",
		get children() {
			return _d2 ? _v2 : (_v2 = props.post().body, _d2 = true, _v2);
		}
	}))())));
}
