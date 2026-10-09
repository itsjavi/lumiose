import { template } from "lumen/dom";
const _t0 = /* @__PURE__ */ template(`<div aria-pressed=false aria-hidden=true aria-expanded=true spellcheck=false draggable=false contenteditable=true inert><input readonly><svg><feConvolveMatrix preserveAlpha=false>`);
// Static booleans fold like the runtime's `setAttr`/`attr` (TASK-117): `aria-*` and enumerated
// attributes are written as "true"/"false"; boolean attributes are present or absent.
export function Toggle() {
	return _t0();
}
