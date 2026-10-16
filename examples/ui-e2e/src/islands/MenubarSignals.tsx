import { Menu, Menubar } from "@lumiose/ui";
import { signal } from "lumiose";

/**
 * A menubar in an island (TASK-379): the File menu's `open` and the Edit menu's checkbox item bound
 * to signals, an item that writes a status line, and arrows that stop at the ends (`loopFocus`).
 */
export function MenubarSignals() {
  const fileOpen = signal(false);
  const wrap = signal(false);
  const status = signal("Nothing run yet");
  return (
    <section>
      <button
        type="button"
        class="lu-button"
        data-testid="open-file"
        onClick={() => fileOpen.set(true)}
      >
        Open the File menu
      </button>
      <Menubar aria-label="Document" loopFocus={false} class="lu-menubar">
        <Menu.Root bind:open={fileOpen}>
          <Menu.Trigger>File</Menu.Trigger>
          <Menu.Popup class="lu-menu">
            <Menu.Item onClick={() => status.set("Saved")}>Save</Menu.Item>
            <Menu.Item onClick={() => status.set("Exported")}>Export</Menu.Item>
          </Menu.Popup>
        </Menu.Root>
        <Menu.Root>
          <Menu.Trigger>Edit</Menu.Trigger>
          <Menu.Popup class="lu-menu">
            <Menu.CheckboxItem bind:checked={wrap}>Word wrap</Menu.CheckboxItem>
          </Menu.Popup>
        </Menu.Root>
      </Menubar>
      <p data-testid="status">
        {status()}; the File menu is {fileOpen() ? "open" : "closed"}; word wrap is{" "}
        {wrap() ? "on" : "off"}
      </p>
    </section>
  );
}
