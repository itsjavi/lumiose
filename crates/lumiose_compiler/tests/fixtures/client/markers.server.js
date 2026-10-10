// Insertion markers: <!> only between text and text or before another dynamic part; a following
// static node is used as the marker otherwise; the last dynamic part appends.
import { signal } from "lumiose";
import { Card } from "./Card.stsx";
import { ssr, insert, insertText, createComponent } from "lumiose/server";
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
export function Markers() {
	const a = signal("a");
	const b = signal("b");
	return ssr(_s0, insert(a()), insert(a()), insert(b()), insert(a()), insertText(a()), insert(a()), insert(createComponent(Card, {})), insert(b()), insert(createComponent(Card, {})), insertText(a()));
}
