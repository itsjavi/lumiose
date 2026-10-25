import { ssr, SSRHtml, insert, insertText, classAttr, spreadAttrs, createComponent } from "lumiose/server";
import "/src/doc2-component-call.stsx?lumiose&type=style&lang.css";
const _s0 = [
	"<article data-lum-ar7z1gx1",
	"",
	"><h2 data-lum-ar7z1gx1>",
	"</h2>",
	"</article>"
];
const _c0 = (h0, h1, h2, h3) => typeof h0 === "string" && typeof h1 === "string" && typeof h2 === "string" && typeof h3 === "string" ? new SSRHtml("<article data-lum-ar7z1gx1" + h0 + h1 + "><h2 data-lum-ar7z1gx1>" + h2 + "</h2>" + h3 + "</article>") : ssr(_s0, h0, h1, h2, h3);
const _s1 = ["<main data-lum-qlayfokw>", "</main>"];
const _c1 = (h0) => typeof h0 === "string" ? new SSRHtml("<main data-lum-qlayfokw>" + h0 + "</main>") : ssr(_s1, h0);
export function Card(props) {
	return _c0(classAttr(props.class), spreadAttrs({ $$scope: props.$$scope }), insertText(props.title), insertText(props.children));
}
export function Page(props) {
	return _c1(insert(createComponent(Card, ((_d, _v, _d2, _v2) => ({
		get title() {
			return _d ? _v : (_v = props.post().title, _d = true, _v);
		},
		class: "featured",
		$$scope: "data-lum-qlayfokw",
		get children() {
			return _d2 ? _v2 : (_v2 = props.post().body, _d2 = true, _v2);
		}
	}))())));
}
