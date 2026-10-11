import { useEffect, useRef, useState } from "preact/hooks";

const ROWS = 'input[name="ids"]';

/**
 * Bulk select (a Preact island): the "N selected" count and "Close selected" of the bulk form. The
 * row checkboxes are server-rendered in the issue table; the island follows them through the
 * form's `change` events, and the form posts the checked `ids`.
 */
export default function BulkBar() {
  const bar = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(0);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const form = bar.current?.closest("form");
    if (!form) return;
    const rows = () => form.querySelectorAll<HTMLInputElement>(ROWS);
    const recount = () => setCount(form.querySelectorAll(`${ROWS}:checked`).length);
    const changed = (event: Event) => {
      const target = event.target as HTMLInputElement;
      if (target.dataset.testid === "select-all") {
        for (const box of rows()) box.checked = target.checked;
      }
      recount();
    };
    const submitted = () => setPending(true);
    form.addEventListener("change", changed);
    form.addEventListener("submit", submitted);
    recount(); // boxes the browser restored, or checked before hydration
    return () => {
      form.removeEventListener("change", changed);
      form.removeEventListener("submit", submitted);
    };
  }, []);

  return (
    <div class="bulk-bar" ref={bar}>
      <span data-testid="selected-count">{count} selected</span>
      <button
        type="submit"
        class="btn btn-danger"
        data-testid="close-selected"
        disabled={count === 0 || pending}
      >
        {pending ? "Closing…" : "Close selected"}
      </button>
    </div>
  );
}
