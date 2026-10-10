// Static booleans fold like the runtime's `setAttr`/`attr` (TASK-117): `aria-*` and enumerated
// attributes are written as "true"/"false"; boolean attributes are present or absent.
export function Toggle() {
  return (
    <div
      aria-pressed={false}
      aria-hidden
      aria-expanded={true}
      spellcheck={false}
      draggable={false}
      contenteditable={true}
      hidden={false}
      inert={true}
    >
      <input disabled={false} readonly />
      <svg>
        <feConvolveMatrix preserveAlpha={false} />
      </svg>
    </div>
  );
}
