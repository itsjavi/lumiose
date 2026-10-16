// Server HTML of Tabs (TASK-359): the markup holds the whole APG state before `<lu-tabs>`' script
// runs. Behaviour in a browser is checked by examples/ui-e2e.
import { renderToString } from "lumiose";
import { describe, expect, it } from "vitest";
import { attrs } from "../test/html.ts";
import { Tabs } from "./tabs.tsx";

function Settings(props: { value?: string; disabled?: boolean }) {
  return (
    <Tabs.Root value={props.value} class="tabs">
      <Tabs.List aria-label="Settings">
        <Tabs.Tab value="account" disabled={props.disabled}>
          Account
        </Tabs.Tab>
        <Tabs.Tab value="two words">Password</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="account">Account panel</Tabs.Panel>
      <Tabs.Panel value="two words">Password panel</Tabs.Panel>
    </Tabs.Root>
  );
}

const tab = (html: string, value: string) => attrs(html, "button", (a) => a.value === value);
const panel = (html: string, id: string) => attrs(html, "div", (a) => a.id === id);

describe("Tabs on the server", () => {
  it("selects the first enabled tab and wires tabs and panels by id", async () => {
    const html = await renderToString(() => <Settings />);
    expect(attrs(html, "lu-tabs").class).toBe("tabs");
    const list = attrs(html, "div");
    expect(list).toMatchObject({ role: "tablist", "aria-label": "Settings" });
    expect(list).not.toHaveProperty("aria-orientation");
    const account = tab(html, "account");
    const password = tab(html, "two words");
    expect(account).toMatchObject({
      type: "button",
      role: "tab",
      "aria-selected": "true",
      tabindex: "0",
    });
    expect(password).toMatchObject({ "aria-selected": "false", tabindex: "-1" });
    // Ids hold no spaces.
    expect(password.id).not.toMatch(/\s/);
    const accountPanel = panel(html, account["aria-controls"]!);
    expect(accountPanel).toMatchObject({
      role: "tabpanel",
      tabindex: "0",
      "aria-labelledby": account.id,
    });
    expect(accountPanel).not.toHaveProperty("hidden");
    expect(panel(html, password["aria-controls"]!)).toHaveProperty("hidden");
  });

  it("selects the value, and the first enabled tab when the first is disabled", async () => {
    let html = await renderToString(() => <Settings value="two words" />);
    expect(tab(html, "two words")["aria-selected"]).toBe("true");
    expect(tab(html, "account")["aria-selected"]).toBe("false");

    html = await renderToString(() => <Settings disabled />);
    expect(tab(html, "account")).toMatchObject({
      "aria-disabled": "true",
      "aria-selected": "false",
    });
    expect(tab(html, "two words")).toMatchObject({ "aria-selected": "true", tabindex: "0" });
  });

  it("writes the orientation and the List's options", async () => {
    const html = await renderToString(() => (
      <Tabs.Root orientation="vertical">
        <Tabs.List activateOnFocus loopFocus={false}>
          <Tabs.Tab value="a">A</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="a">A</Tabs.Panel>
      </Tabs.Root>
    ));
    expect(attrs(html, "div")).toMatchObject({
      "aria-orientation": "vertical",
      "data-activate-on-focus": "",
      "data-loop-focus": "false",
    });
  });

  it("renders an Indicator in the list and the anchor the selected tab carries", async () => {
    const html = await renderToString(() => (
      <Tabs.Root class="tabs" style={{ color: "red" }}>
        <Tabs.List>
          <Tabs.Tab value="a">A</Tabs.Tab>
          <Tabs.Indicator class="bar" />
        </Tabs.List>
        <Tabs.Panel value="a">A</Tabs.Panel>
      </Tabs.Root>
    ));
    expect(attrs(html, "span")).toMatchObject({
      class: "bar",
      "aria-hidden": "true",
      "data-indicator": "",
    });
    expect(attrs(html, "span")).not.toHaveProperty("hidden");
    expect(html).toMatch(/<div role="?tablist"?[^>]*>.*<span[^>]*data-indicator/);
    const style = attrs(html, "lu-tabs").style!;
    expect(style).toMatch(/--lu-tabs-anchor: ?--lu-tabs-[\w-]+/);
    expect(style).toMatch(/color: ?red/);
  });

  it("hides the Indicator while no tab can be selected", async () => {
    const html = await renderToString(() => (
      <Tabs.Root>
        <Tabs.List>
          <Tabs.Tab value="a" disabled>
            A
          </Tabs.Tab>
          <Tabs.Indicator />
        </Tabs.List>
      </Tabs.Root>
    ));
    expect(attrs(html, "span")).toHaveProperty("hidden");
  });

  it("throws when a part is outside Tabs.Root", async () => {
    await expect(renderToString(() => <Tabs.Tab value="a">A</Tabs.Tab>)).rejects.toThrow(
      "Tabs parts must be inside <Tabs.Root>.",
    );
  });
});
