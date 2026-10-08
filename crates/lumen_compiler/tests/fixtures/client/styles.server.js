// Style blocks: masked ranges are deleted before whitespace normalisation, $ref placeholders
// are dropped, imports used only by $refs are removed, every element of a scope carries its
// token, and the CSS has the file scope first, then component blocks in source order.
import { used } from "./tokens.ts";
import { ssr, insert, list } from "lumen/server";
import "/src/styles.stsx?lumen&type=style&lang.css";
const _s0 = ["<span class=item data-l-ecz843t9 data-l-wjsvhj1q>", "</span>"];
const _s1 = [
	"<div class=card data-l-ecz843t9 data-l-wjsvhj1q><b data-l-ecz843t9 data-l-wjsvhj1q>",
	"</b><i data-l-ecz843t9 data-l-wjsvhj1q>",
	"</i>",
	"</div>"
];
const _s2 = ["<footer data-l-ecz843t9>Footer</footer>"];
const gap = 4;
export function Card(props) {
	return ssr(_s1, insert(props.title), insert(used), list([1, 2], (n) => ssr(_s0, insert(n))));
}
export const Footer = () => ssr(_s2);

// --- diagnostics ---
// LUM3018 warning 10:57 `$radius.lg` is a unitless number (`8`) where `border-radius` needs a length
