import { Accordion } from "@lumiose/ui";
import { signal } from "lumiose";

/** An Accordion bound to a signal with bind:value (decision-62, TASK-370). */
export function AccordionSignals() {
  const value = signal<string[]>(["one"]);
  return (
    <section>
      <Accordion.Root class="lu-accordion" bind:value={value}>
        <Accordion.Item value="one">
          <Accordion.Header>
            <Accordion.Trigger>One</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel>The first panel.</Accordion.Panel>
        </Accordion.Item>
        <Accordion.Item value="two">
          <Accordion.Header>
            <Accordion.Trigger>Two</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel>The second panel.</Accordion.Panel>
        </Accordion.Item>
      </Accordion.Root>
      <button
        type="button"
        class="lu-button"
        data-testid="open-two"
        onClick={() => value.set(["two"])}
      >
        Open two from the signal
      </button>
      <output data-testid="value-state">value: {value().join(",") || "none"}</output>
    </section>
  );
}
