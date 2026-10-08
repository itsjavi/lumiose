// @scope file=data-l-f1 Card=data-l-c1
// Style blocks: masked ranges are deleted before whitespace normalisation, $ref placeholders
// are dropped, imports used only by $refs are removed, and every element of a scope carries its
// token.
import { used } from "./tokens.ts";
import { ssr, insert, list } from "lumen/server";
import "/src/styles.stsx?lumen&type=style&lang.css";
const _s0 = ["<span data-l-f1 data-l-c1>", "</span>"];
const _s1 = [
	"<div class=card data-l-f1 data-l-c1><b data-l-f1 data-l-c1>",
	"</b><i data-l-f1 data-l-c1>",
	"</i>",
	"</div>"
];
const _s2 = ["<footer data-l-f1>Footer</footer>"];
const gap = 4;
export function Card(props) {
	return ssr(_s1, insert(props.title), insert(used), list([1, 2], (n) => ssr(_s0, insert(n))));
}
export const Footer = () => ssr(_s2);
