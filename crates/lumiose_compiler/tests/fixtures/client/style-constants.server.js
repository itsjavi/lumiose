import { unit } from "./tokens.ts";
import { signal } from "lumiose";
import { ssr } from "lumiose/server";
import "/src/style-constants.stsx?lumiose&type=style&lang.css";
const _s0 = ["<section class=panel data-lum-cghs6uw8><h2 data-lum-cghs6uw8>Title</h2></section>"];
const size = 3;
const sizes = {
	sm: `${size * unit}px`,
	lg: size * 8 + "px"
};
const { sm } = sizes;
let mutable = 1;
const runtime = signal(1);
export function Panel(props) {
	const pad = 2;
	const width = props.wide ? 10 : 5;
	return ssr(_s0);
}

// --- diagnostics ---
// LUM3018 warning 21:82 `$tokens.radius.sm` is a unitless number (`2`) where `border-radius` needs a length
// LUM3005 warning 24:9 `.bad` matches no element in component `Panel`
// LUM3008 error 24:23 `$width` cannot be inlined into CSS: only literals, template literals, arithmetic, `as const` objects and other constants can be inlined
// LUM3008 error 24:39 `$mutable` cannot be inlined into CSS: `mutable` is a `let` binding
// LUM3008 error 24:56 `$runtime` cannot be inlined into CSS: it is computed by a call at runtime
// LUM3005 warning 25:9 `.hyphen` matches no element in component `Panel`
// LUM3009 error 25:26 `$brand-primary` is not a valid reference: JavaScript identifiers cannot contain `-`
// LUM3005 warning 26:9 `.missing` matches no element in component `Panel`
// LUM3008 error 26:27 `$missing` cannot be inlined into CSS: the module `./nowhere.ts` could not be resolved
// LUM3008 error 26:42 `$undeclared` cannot be inlined into CSS: `undeclared` is not declared in scope
// LUM3008 error 26:61 `$tokens.nothing` cannot be inlined into CSS: `/src/tokens.ts` has no export `nothing`
// LUM3005 warning 27:9 `.unused` matches no element in component `Panel`
