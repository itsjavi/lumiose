// Style blocks: masked ranges are deleted before whitespace normalisation, $ref placeholders
// are dropped, imports used only by $refs are removed, every element of a scope carries its
// token, and the CSS has the file scope first, then component blocks in source order.
import { used } from "./tokens.ts";
import { ssr, SSRHtml, insertText, list } from "lumiose/server";
import "/src/styles.stsx?lumiose&type=style&lang.css";
const _s0 = ["<span class=item data-l-ecz843t9 data-l-wjsvhj1q>", "</span>"];
const _c0 = (h0) => typeof h0 === "string" ? new SSRHtml("<span class=item data-l-ecz843t9 data-l-wjsvhj1q>" + h0 + "</span>") : ssr(_s0, h0);
const _s1 = [
	"<div class=card data-l-ecz843t9 data-l-wjsvhj1q><b data-l-ecz843t9 data-l-wjsvhj1q>",
	"</b><i data-l-ecz843t9 data-l-wjsvhj1q>",
	"</i>",
	"</div>"
];
const _c1 = (h0, h1, h2) => typeof h0 === "string" && typeof h1 === "string" && h2 instanceof SSRHtml ? new SSRHtml("<div class=card data-l-ecz843t9 data-l-wjsvhj1q><b data-l-ecz843t9 data-l-wjsvhj1q>" + h0 + "</b><i data-l-ecz843t9 data-l-wjsvhj1q>" + h1 + "</i>" + h2.t + "</div>") : ssr(_s1, h0, h1, h2);
const _s2 = ["<footer data-l-ecz843t9>Footer</footer>"];
const gap = 4;
export function Card(props) {
	return _c1(insertText(props.title), insertText(used), list([1, 2], (n) => _c0(insertText(n))));
}
export const Footer = () => ssr(_s2);

// --- diagnostics ---
// LUM3018 warning 10:57 `$radius.lg` is a unitless number (`8`) where `border-radius` needs a length
