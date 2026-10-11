import { clientEntry, ref, type Handle } from "remix/component";

const ROWS = 'input[name="ids"]';

/**
 * Bulk select (doc-4 §2): the "N selected" count and "Close selected" of the bulk form. The row
 * checkboxes are server-rendered in the issue table; this client entry follows them through the
 * form's `change` events, and the form posts the checked `ids` as a frame navigation.
 */
export const BulkSelect = clientEntry(import.meta.url, function BulkSelect(handle: Handle) {
  let form: HTMLFormElement | null = null;
  let count = 0;
  let pending = false;

  const recount = () => {
    count = form?.querySelectorAll(`${ROWS}:checked`).length ?? 0;
    handle.update();
  };

  // The page reloads after the action: the closed rows are gone, and the selection starts over.
  handle.frame.addEventListener(
    "reloadComplete",
    () => {
      if (pending) {
        for (const box of form?.querySelectorAll<HTMLInputElement>(ROWS) ?? []) box.checked = false;
        pending = false;
      }
      recount();
    },
    { signal: handle.signal },
  );

  return () => (
    <div
      class="bulk-bar"
      mix={ref((node, signal) => {
        form = node.closest("form");
        form?.addEventListener(
          "change",
          (event) => {
            const target = event.target as HTMLInputElement;
            if (target.dataset.testid === "select-all") {
              for (const box of form!.querySelectorAll<HTMLInputElement>(ROWS)) {
                box.checked = target.checked;
              }
            }
            recount();
          },
          { signal },
        );
        form?.addEventListener(
          "submit",
          () => {
            pending = true;
            handle.update();
          },
          { signal },
        );
        recount();
      })}
    >
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
});
