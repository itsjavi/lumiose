// Island: bulk selection of the project page. The issue table is a server-rendered slot (its 50
// rows ship no JS and no data); the island owns the surrounding form, counts the checked rows,
// handles "select all" and posts the `close` action with `submit`; the action redirects back to
// the list, filters included, so it shows the change.
import { onMount, ref, signal, submit, submitting } from "lumen";
import { markReady } from "../lib/ready.ts";

/** `action`: the list URL with its filters plus the `/close` action key (`?status=open&/close`). */
export function BulkSelect(props: { action: string; children?: JSX.Element }) {
  const form = ref<HTMLFormElement>();
  const count = signal(0);

  const boxes = () => [...(form()?.querySelectorAll<HTMLInputElement>('input[name="ids"]') ?? [])];
  const selectAll = () => form()?.querySelector<HTMLInputElement>('[data-testid="select-all"]');

  function sync() {
    const all = boxes();
    const checked = all.filter((box) => box.checked).length;
    count.set(checked);
    const toggle = selectAll();
    if (toggle) toggle.checked = all.length > 0 && checked === all.length;
  }

  function onChange(event: Event) {
    const target = event.target as HTMLInputElement;
    if (target === selectAll()) for (const box of boxes()) box.checked = target.checked;
    sync();
  }

  onMount(() => {
    sync();
    markReady();
  });

  return (
    <form
      method="post"
      action={props.action}
      class="bulk-form"
      ref={form}
      onChange={onChange}
      onSubmit={submit}
    >
      {props.children}
      <div class="bulk-bar">
        <span data-testid="selected-count">{count()} selected</span>
        <button
          type="submit"
          class="btn btn-danger"
          data-testid="close-selected"
          disabled={count() === 0 || submitting("close")}
        >
          {submitting("close") ? "Closing…" : "Close selected"}
        </button>
      </div>
    </form>
  );
}
