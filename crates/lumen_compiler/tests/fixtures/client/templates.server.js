import { ssr, insert } from "lumen/server";
const _s0 = ["<div id=main class=\"a b\" data-x=\"say &quot;hi&quot;\" title=\"<tag> &amp; co\" hidden tabindex=0 draggable=true><img src=/logo.png alt=\"\"><br><p>Multi-line text   with    spaces</p><span>  literal  42</span>a bc<textarea>keep</textarea><label for=x spellcheck>Label</label><em>Don't © `tick` ${x} \\back</em></div>"];
const _s1 = ["<div></div>"];
const _s2 = ["<table><caption>Implicit tbody</caption><tbody><tr><td>", "</td></tr><tr><td>static</td></tr></tbody></table>"];
const _s3 = ["<pre>\n\nkeeps the leading newline</pre>"];
const _s4 = ["<ul><li><a href=/a>A</a></li><li><a href=/b>B</a></li></ul>"];
// Templates: static attributes and their quoting, entities, void elements, trailing closing tags,
// raw-text elements and JSX whitespace rules.
export function Static() {
	return ssr(_s0);
}
export const Empty = () => ssr(_s1);
export function Table(props) {
	return ssr(_s2, insert(props.cell));
}
export const Pre = () => ssr(_s3);
export function Nested() {
	return ssr(_s4);
}
