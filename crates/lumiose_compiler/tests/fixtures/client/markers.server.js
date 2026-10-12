// Insertion markers: <!> only between text and text or before another dynamic part; a following
// static node is used as the marker otherwise; the last dynamic part appends.
import { signal } from "lumiose";
import { Card } from "./Card.stsx";
import { ssr, SSRHtml, insert, insertText, createComponent } from "lumiose/server";
const _s0 = [
	"<div><p>before ",
	" after</p><p>",
	"",
	"</p><p>",
	" trailing text</p><p><br>",
	"<br></p><p>leading ",
	"</p><p>",
	"",
	"",
	"</p><p>",
	"</p></div>"
];
const _c0 = (h0, h1, h2, h3, h4, h5, h6, h7, h8, h9) => typeof h0 === "string" && typeof h1 === "string" && typeof h2 === "string" && typeof h3 === "string" && typeof h4 === "string" && typeof h5 === "string" && typeof h6 === "string" && typeof h7 === "string" && typeof h8 === "string" && typeof h9 === "string" ? new SSRHtml("<div><p>before " + h0 + " after</p><p>" + h1 + h2 + "</p><p>" + h3 + " trailing text</p><p><br>" + h4 + "<br></p><p>leading " + h5 + "</p><p>" + h6 + h7 + h8 + "</p><p>" + h9 + "</p></div>") : ssr(_s0, h0, h1, h2, h3, h4, h5, h6, h7, h8, h9);
export function Markers() {
	const a = signal("a");
	const b = signal("b");
	return _c0(insert(a()), insert(a()), insert(b()), insert(a()), insertText(a()), insert(a()), insert(createComponent(Card, {})), insert(b()), insert(createComponent(Card, {})), insertText(a()));
}
