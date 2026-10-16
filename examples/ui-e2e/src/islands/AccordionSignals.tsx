import { Accordion } from "@lumiose/ui";
import { signal } from "lumiose";

/**
 * An Accordion bound to a signal with bind:value (decision-62, TASK-370), and one the island
 * renders with an item open later, which reports no change on mount (TASK-441 M40).
 */
export function AccordionSignals() {
  const value = signal<string[]>(["one"]);
  const mounted = signal(false);
  const reports = signal(0);
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
      <button type="button" class="lu-button" data-testid="mount" onClick={() => mounted.set(true)}>
        Render one with an item open
      </button>
      {mounted() ? (
        <Accordion.Root class="lu-accordion" defaultValue={["first"]} data-testid="mounted">
          <Accordion.Item value="first" onOpenChange={() => reports.set(reports() + 1)}>
            <Accordion.Header>
              <Accordion.Trigger>Rendered open</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel>Rendered by the island, open.</Accordion.Panel>
          </Accordion.Item>
        </Accordion.Root>
      ) : null}
      <output data-testid="reports">reports: {reports()}</output>
    </section>
  );
}
