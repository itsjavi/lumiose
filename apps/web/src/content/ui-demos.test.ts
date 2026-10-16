// The live demos of the /ui pages (TASK-387): which examples become demos, and src/ui-demos kept
// current with packages/ui/docs (`pnpm --filter @lumiose/web ui:demos` regenerates it).
import { describe, expect, it } from "vitest";
import { staleDemoFiles } from "../../scripts/ui-demos.ts";
import { GENERATE, uiDemoFiles, uiDemos } from "./ui-demos.ts";

const page = (...blocks: string[]) =>
  `# Page\n\n${blocks.map((code) => `\`\`\`tsx check\n${code}\n\`\`\``).join("\n\nText.\n\n")}\n`;

/** Whether the single example `code` becomes an island demo. */
const isIsland = (code: string) => uiDemos("field", page(code))[0]!.island;
/** A Field example that passes `check`, declared by `validate`, as its `validate` prop. */
const field = (validate: string) =>
  `import { Field } from "@lumiose/ui";\n\n${validate}\nexport function Demo() {\n  return <Field.Root validate={check} />;\n}`;

describe("UI demos", () => {
  it("are the tsx check examples that export one component without props", () => {
    const demos = uiDemos(
      "tabs",
      page(
        'import { Tabs } from "@lumiose/ui";\n\nexport function Static() {\n  return <Tabs.Root />;\n}',
        "export function Needs(props: { onPick: () => void }) {\n  return <p />;\n}",
        'import { signal } from "lumiose";\n\nexport function Bound() {\n  const tab = signal("a");\n  return <Tabs.Root bind:value={tab} />;\n}',
        "export function Clicks() {\n  return <button onClick={() => {}} />;\n}",
      ) + "\n```tsx\nexport function Unchecked() {}\n```\n",
    );
    // The example with props is skipped, but keeps its place in the count.
    expect(demos.map(({ id, name, island }) => ({ id, name, island }))).toEqual([
      { id: "tabs-1", name: "Static", island: false },
      { id: "tabs-3", name: "Bound", island: true },
      { id: "tabs-4", name: "Clicks", island: true },
    ]);
  });

  it("hydrate an example whose only client need is a function prop (TASK-423)", () => {
    expect(
      isIsland(
        field('async function check(value: string) {\n  return value ? null : "Required";\n}'),
      ),
    ).toBe(true);
    expect(isIsland(field("const check = (value: string) => (value ? null : 'Required');"))).toBe(
      true,
    );
    expect(
      isIsland(
        "export function Inline() {\n  return <Field.Root validate={(value) => null} />;\n}",
      ),
    ).toBe(true);
    // A formatter also runs on the server, and a component renders there.
    expect(
      isIsland(
        "export function Meter() {\n  return <M getAriaValueText={(_, v) => `${v} GB`} />;\n}",
      ),
    ).toBe(false);
    expect(
      isIsland(
        "function Row() {\n  return <li />;\n}\nexport function List() {\n  return <L render={Row} />;\n}",
      ),
    ).toBe(false);
  });

  it("renders islands with client:visible and refuses two demos with one name", () => {
    const index = uiDemoFiles({
      a: page("export function One() {\n  return <p on:click={() => {}} />;\n}"),
    }).get("index.tsx")!;
    expect(index).toContain('import { One } from "./a-1.tsx";');
    expect(index).toContain("return <One client:visible />;");
    expect(() =>
      uiDemoFiles({
        a: page("export function Same() {\n  return <p />;\n}"),
        b: page("export function Same() {\n  return <p />;\n}"),
      }),
    ).toThrow("The UI examples a-1 and b-1 both export Same: rename one of them.");
  });

  it("src/ui-demos matches the examples of packages/ui/docs", () => {
    expect(staleDemoFiles(), `Run ${GENERATE}.`).toEqual([]);
  });
});
