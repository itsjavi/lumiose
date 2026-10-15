import { signal } from "lumiose";
import type * as OptionA from "./option-a/ui.tsx";

/** What both prototypes export: the same parts, rendered by different elements. */
export type UI = Pick<typeof OptionA, "Dialog" | "Menu" | "Combobox">;

export const cities = [
  { value: "amsterdam", label: "Amsterdam" },
  { value: "barcelona", label: "Barcelona" },
  { value: "berlin", label: "Berlin" },
  { value: "lisbon", label: "Lisbon" },
  { value: "london", label: "London" },
  { value: "madrid", label: "Madrid" },
  { value: "paris", label: "Paris" },
  { value: "rome", label: "Rome", disabled: true },
];

/** The three widgets as a server component: no island, no hydration. */
export function Showcase(props: { ui: UI }) {
  const { Dialog, Menu, Combobox } = props.ui;
  return (
    <div class="grid">
      <section aria-labelledby="dialog-heading">
        <h2 id="dialog-heading">Dialog</h2>
        <Dialog.Root role="alertdialog">
          <Dialog.Trigger>Delete project…</Dialog.Trigger>
          <Dialog.Popup>
            <Dialog.Title>Delete project?</Dialog.Title>
            <Dialog.Description>
              This removes the project and its 12 deployments.
            </Dialog.Description>
            <footer>
              <Dialog.Close value="cancel">Cancel</Dialog.Close>
              <Dialog.Close value="delete" data-variant="danger">
                Delete
              </Dialog.Close>
            </footer>
          </Dialog.Popup>
        </Dialog.Root>
      </section>

      <section aria-labelledby="menu-heading">
        <h2 id="menu-heading">Menu</h2>
        <Menu.Root>
          <Menu.Trigger>Actions</Menu.Trigger>
          <Menu.Popup aria-label="Actions">
            <Menu.Item>Rename</Menu.Item>
            <Menu.Item>Duplicate</Menu.Item>
            <Menu.Separator />
            <Menu.CheckboxItem checked>Show archived</Menu.CheckboxItem>
            <Menu.Item disabled>Delete</Menu.Item>
          </Menu.Popup>
        </Menu.Root>
      </section>

      <section aria-labelledby="combobox-heading">
        <h2 id="combobox-heading">Combobox</h2>
        <Combobox.Root name="city">
          <Combobox.Label>City</Combobox.Label>
          <Combobox.Input placeholder="Search cities" />
          <Combobox.List>
            {cities.map((city) => (
              <Combobox.Item value={city.value} disabled={city.disabled}>
                {city.label}
              </Combobox.Item>
            ))}
          </Combobox.List>
        </Combobox.Root>
      </section>
    </div>
  );
}

/** The same widgets driven by signals, for an island. */
export function SignalsShowcase(props: { ui: UI }) {
  const { Dialog, Menu, Combobox } = props.ui;
  const dialogOpen = signal(false);
  const lastAction = signal("none");
  const archived = signal(false);
  const city = signal("berlin");
  const extra = signal<{ value: string; label: string }[]>([]);

  return (
    <div class="grid">
      <section aria-labelledby="signals-dialog-heading">
        <h2 id="signals-dialog-heading">Dialog</h2>
        <Dialog.Root open={dialogOpen()} onOpenChange={(open) => dialogOpen.set(open)}>
          <Dialog.Trigger>Edit profile</Dialog.Trigger>
          <Dialog.Popup>
            <Dialog.Title>Edit profile</Dialog.Title>
            <Dialog.Description>Opened from the trigger or from a signal.</Dialog.Description>
            <footer>
              <Dialog.Close>Done</Dialog.Close>
            </footer>
          </Dialog.Popup>
        </Dialog.Root>
        <button type="button" data-testid="open-by-signal" onClick={() => dialogOpen.set(true)}>
          Open with a signal
        </button>
        <output data-testid="dialog-state">open: {String(dialogOpen())}</output>
      </section>

      <section aria-labelledby="signals-menu-heading">
        <h2 id="signals-menu-heading">Menu</h2>
        <Menu.Root>
          <Menu.Trigger>Actions</Menu.Trigger>
          <Menu.Popup aria-label="Actions">
            <Menu.Item onClick={() => lastAction.set("rename")}>Rename</Menu.Item>
            <Menu.Item onClick={() => lastAction.set("duplicate")}>Duplicate</Menu.Item>
            <Menu.Separator />
            <Menu.CheckboxItem
              checked={archived()}
              onCheckedChange={(checked) => archived.set(checked)}
            >
              Show archived
            </Menu.CheckboxItem>
          </Menu.Popup>
        </Menu.Root>
        <output data-testid="menu-state">
          last: {lastAction()}, archived: {String(archived())}
        </output>
      </section>

      <section aria-labelledby="signals-combobox-heading">
        <h2 id="signals-combobox-heading">Combobox</h2>
        <Combobox.Root value={city()} onValueChange={(value) => city.set(value)}>
          <Combobox.Label>City</Combobox.Label>
          <Combobox.Input placeholder="Search cities" />
          <Combobox.List>
            {cities.map((item) => (
              <Combobox.Item value={item.value} disabled={item.disabled}>
                {item.label}
              </Combobox.Item>
            ))}
            {extra().map((item) => (
              <Combobox.Item value={item.value}>{item.label}</Combobox.Item>
            ))}
          </Combobox.List>
        </Combobox.Root>
        <button type="button" data-testid="pick-lisbon" onClick={() => city.set("lisbon")}>
          Pick Lisbon with a signal
        </button>
        <button
          type="button"
          data-testid="add-zurich"
          onClick={() => extra.set([{ value: "zurich", label: "Zurich" }])}
        >
          Add Zurich
        </button>
        <output data-testid="combobox-state">city: {city()}</output>
      </section>
    </div>
  );
}
