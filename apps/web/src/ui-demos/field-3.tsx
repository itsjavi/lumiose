// Generated from packages/ui/docs/field.md by apps/web/scripts/ui-demos.ts: do not edit.
// Change the example there and run `pnpm --filter @lumiose/web ui:demos`.
import { Field } from "@lumiose/ui";
import { signal } from "lumiose";

const TAKEN = ["admin", "lumiose"];

/** A server check, here a delay and a list: a `fetch` in a real form. */
async function available(value: string | boolean) {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return TAKEN.includes(String(value)) ? "That handle is taken." : null;
}

export function HandleField() {
  const handle = signal("");
  return (
    <Field.Root
      name="handle"
      validationMode="onChange"
      validationDebounceTime={300}
      validate={available}
      class="lu-field"
    >
      <Field.Label>Handle</Field.Label>
      <Field.Control required bind:value={handle} class="lu-input" />
      <Field.Error />
      <p>
        <Field.Validity>
          {(state) =>
            state.validating ? "Checking…" : state.validity.valid ? `${handle()} is free.` : ""
          }
        </Field.Validity>
      </p>
    </Field.Root>
  );
}
