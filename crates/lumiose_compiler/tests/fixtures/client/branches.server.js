// Conditionals: a reactive test with a JSX arm compiles to a memoised branch; static tests are
// evaluated once; a component returning a reactive conditional returns a tracked function.
import { signal } from "lumiose";
import { ssr, insert, insertText, branchArm } from "lumiose/server";
const _s0 = ["<p>Open</p>"];
const _s1 = ["<p>Closed</p>"];
const _s2 = ["<span>Visible</span>"];
const _s3 = ["<b>", "</b>"];
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
const _s10 = ["<p>On</p>"];
const _s11 = ["<p>Off</p>"];
export function Branches(props) {
	const open = signal(false);
	const loggedIn = true;
	return ssr(_s9, open() ? branchArm(true, ssr(_s0)) : branchArm(false, ssr(_s1)), open() ? branchArm(true, ssr(_s2)) : branchArm(false), props.user ? branchArm(true, ssr(_s3, insertText(props.user.name))) : branchArm(false), props.mode === "a" ? branchArm(true, ssr(_s4)) : branchArm(false, props.mode === "b" ? branchArm(true, ssr(_s5)) : branchArm(false, ssr(_s6))), insert(loggedIn ? ssr(_s7) : ssr(_s8)), insert(open() ? "yes" : "no"));
}
export function Switch(props) {
	return props.on ? branchArm(true, ssr(_s10)) : branchArm(false, ssr(_s11));
}
