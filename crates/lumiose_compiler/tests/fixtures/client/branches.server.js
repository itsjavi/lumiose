// Conditionals: a reactive test with a JSX arm compiles to a memoised branch; static tests are
// evaluated once; a component returning a reactive conditional returns a tracked function.
import { signal } from "lumiose";
import { ssr, SSRHtml, insert, insertText, branchArm } from "lumiose/server";
const _s0 = ["<p>Open</p>"];
const _s1 = ["<p>Closed</p>"];
const _s2 = ["<span>Visible</span>"];
const _s3 = ["<b>", "</b>"];
const _c3 = (h0) => typeof h0 === "string" ? new SSRHtml("<b>" + h0 + "</b>") : ssr(_s3, h0);
const _s4 = ["<i>A</i>"];
const _s5 = ["<i>B</i>"];
const _s6 = ["<i>C</i>"];
const _s7 = ["<em>Static</em>"];
const _s8 = ["<em>Never</em>"];
const _s9 = [
	"<div>",
	"",
	"",
	"",
	"",
	"",
	"</div>"
];
const _c9 = (h0, h1, h2, h3, h4, h5) => h0 instanceof SSRHtml && h1 instanceof SSRHtml && h2 instanceof SSRHtml && h3 instanceof SSRHtml && typeof h4 === "string" && typeof h5 === "string" ? new SSRHtml("<div>" + h0.t + h1.t + h2.t + h3.t + h4 + h5 + "</div>") : ssr(_s9, h0, h1, h2, h3, h4, h5);
const _s10 = ["<p>On</p>"];
const _s11 = ["<p>Off</p>"];
export function Branches(props) {
	const open = signal(false);
	const loggedIn = true;
	return _c9(open() ? branchArm(true, ssr(_s0)) : branchArm(false, ssr(_s1)), open() ? branchArm(true, ssr(_s2)) : branchArm(false), props.user ? branchArm(true, _c3(insertText(props.user.name))) : branchArm(false), props.mode === "a" ? branchArm(true, ssr(_s4)) : branchArm(false, props.mode === "b" ? branchArm(true, ssr(_s5)) : branchArm(false, ssr(_s6))), insert(loggedIn ? ssr(_s7) : ssr(_s8)), insert(open() ? "yes" : "no"));
}
export function Switch(props) {
	return props.on ? branchArm(true, ssr(_s10)) : branchArm(false, ssr(_s11));
}
