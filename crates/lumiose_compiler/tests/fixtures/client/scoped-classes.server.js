import { ssr, SSRHtml, insert, insertText, classAttr, spreadAttrs, list, createComponent } from "lumiose/server";
import "/src/scoped-classes.stsx?lumiose&type=style&lang.css";
const _s0 = [
	"<span",
	">",
	"</span>"
];
const _c0 = (h0, h1) => typeof h0 === "string" && typeof h1 === "string" ? new SSRHtml("<span" + h0 + ">" + h1 + "</span>") : ssr(_s0, h0, h1);
const _s1 = ["<tr class=\"lum-x0zlxyw0 lum-plznucjw\"><td class=\"lum-x0zlxyw0 lum-plznucjw\">", "</td></tr>"];
const _c1 = (h0) => typeof h0 === "string" ? new SSRHtml("<tr class=\"lum-x0zlxyw0 lum-plznucjw\"><td class=\"lum-x0zlxyw0 lum-plznucjw\">" + h0 + "</td></tr>") : ssr(_s1, h0);
const _s2 = [
	"<article class=\"card lum-x0zlxyw0 lum-plznucjw\"><h2 class=\"lum-x0zlxyw0 lum-plznucjw\">",
	"</h2><p",
	">lead</p><p class=\"a b lum-x0zlxyw0 lum-plznucjw\">static array</p><p",
	">computed</p><p",
	">spread</p>",
	"<table class=\"lum-x0zlxyw0 lum-plznucjw\"><tbody class=\"lum-x0zlxyw0 lum-plznucjw\">",
	"</tbody></table></article>"
];
const _c2 = (h0, h1, h2, h3, h4, h5) => typeof h0 === "string" && typeof h1 === "string" && typeof h2 === "string" && typeof h3 === "string" && typeof h4 === "string" && h5 instanceof SSRHtml ? new SSRHtml("<article class=\"card lum-x0zlxyw0 lum-plznucjw\"><h2 class=\"lum-x0zlxyw0 lum-plznucjw\">" + h0 + "</h2><p" + h1 + ">lead</p><p class=\"a b lum-x0zlxyw0 lum-plznucjw\">static array</p><p" + h2 + ">computed</p><p" + h3 + ">spread</p>" + h4 + "<table class=\"lum-x0zlxyw0 lum-plznucjw\"><tbody class=\"lum-x0zlxyw0 lum-plznucjw\">" + h5.t + "</tbody></table></article>") : ssr(_s2, h0, h1, h2, h3, h4, h5);
function Inner(props) {
	return _c0(classAttr(props.class, ".lum-x0zlxyw0 " + (props.$$scope ?? "")), insertText(props.label));
}
export function Card(props) {
	return _c2(insertText(props.label), classAttr({
		lead: true,
		"lum-x0zlxyw0": true,
		"lum-plznucjw": true,
		on: props.on
	}), classAttr(props.on ? "x" : "y", ".lum-x0zlxyw0 .lum-plznucjw"), spreadAttrs(props, false, ".lum-x0zlxyw0 .lum-plznucjw"), insert(createComponent(Inner, {
		class: "cta",
		label: "passthrough",
		rows: [],
		on: true,
		$$scope: ".lum-x0zlxyw0 .lum-plznucjw"
	})), list(props.rows, (row) => _c1(insertText(row))));
}
