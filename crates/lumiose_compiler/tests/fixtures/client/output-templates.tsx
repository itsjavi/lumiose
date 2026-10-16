// Templates with an `<output>` are created with `outputTemplate` (TASK-425): a form reset
// replaces an output's children in Firefox and WebKit, and the helper keeps them. Other
// templates of the module stay plain `template` calls.
import { signal } from "lumiose";

export function Total() {
  const count = signal(0);
  return (
    <form>
      <button type="button" onClick={() => count.set(count() + 1)}>
        Add
      </button>
      <output>{count()} items</output>
    </form>
  );
}

export function Plain(props: { label: string }) {
  return <p>{props.label}</p>;
}
