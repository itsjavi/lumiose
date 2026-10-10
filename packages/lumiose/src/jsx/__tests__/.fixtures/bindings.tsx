// `bind:value` / `bind:checked`: two-way binding to a writable signal (spec §4.5).
import { signal } from "./helpers.ts";

const name = signal("");
const quantity = signal(1);
const agreed = signal(false);

export const accepted = [
  <input bind:value={name} />,
  <input type="number" bind:value={quantity} />,
  <input type="checkbox" bind:checked={agreed} />,
  <textarea bind:value={name} />,
  <select bind:value={name}>
    <option value="a">A</option>
  </select>,
];

export const rejected = [
  // @ts-expect-error bind:value takes a writable signal, not a string.
  <input bind:value={name()} />,
  // @ts-expect-error bind:value takes a writable signal, not a string literal.
  <input bind:value="text" />,
  // @ts-expect-error a read-only getter is not writable.
  <input bind:value={() => "x"} />,
  // @ts-expect-error bind:checked needs a boolean signal.
  <input bind:checked={name} />,
  // @ts-expect-error bind:value needs a string (or number, on inputs) signal.
  <input bind:value={agreed} />,
  // @ts-expect-error bind:value is not available on a div.
  <div bind:value={name} />,
  // @ts-expect-error bind:checked only exists on input.
  <textarea bind:checked={agreed} />,
];
