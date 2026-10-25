import { ssr, SSRHtml, insert, insertText } from "lumiose/server";
import "/src/misplaced-style.stsx?lumiose&type=style&lang.css";
const _s0 = ["<li data-lum-3y536f6d>", "</li>"];
const _c0 = (h0) => typeof h0 === "string" ? new SSRHtml("<li data-lum-3y536f6d>" + h0 + "</li>") : ssr(_s0, h0);
const _s1 = ["<footer data-lum-snjkckt6></footer>"];
const _s2 = [
	"<ul>",
	"",
	"</ul>"
];
const _c2 = (h0, h1) => typeof h0 === "string" && typeof h1 === "string" ? new SSRHtml("<ul>" + h0 + h1 + "</ul>") : ssr(_s2, h0, h1);
const _s3 = ["<p></p>"];
// LUM3010 found on the AST: blocks inside .map() callbacks and nested functions (the scanner
// cannot see these placements).
export function List(props) {
	const rows = props.items.map((item) => _c0(insertText(item)));
	const renderFooter = () => ssr(_s1);
	return _c2(insert(rows), insert(renderFooter()));
}
function helper() {
	return ssr(_s3);
}

// --- diagnostics ---
// LUM2001 warning 4:9 `rows` is computed once from a reactive value, so the JSX that uses it never updates
// LUM3010 error 7:7 a `<style>` block must be part of a component's static JSX; this one is inside a callback or nested function (such as a `.map()` callback)
// LUM3010 error 12:7 a `<style>` block must be part of a component's static JSX; this one is inside a callback or nested function (such as a `.map()` callback)
// LUM3010 error 21:7 a `<style>` block must be part of a component's static JSX; this one is inside a function that is not a component
