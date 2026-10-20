This is a Lumiose app. Create a reusable `Badge` component, exported from `src/components/Badge.stsx`.

- Props: `tone` (`"info" | "warning" | "danger"`) and `children` (the label).
- It renders a `<span>` with the classes `badge` and `badge-<tone>` (for example `class="badge badge-warning"`) around the children.
- Style it in the component's own scoped styles: rounded corners using `radius`, text color `colors.text`, and a background color per tone taken from `colors` in `src/lib/tokens.ts`. The styles must read those tokens from `tokens.ts` (Lumiose can inline TypeScript constants into CSS at build time); do not copy the color values into the component.

Then show three badges on the home page (`src/routes/page.stsx`): "Info" (info), "Careful" (warning) and "Broken" (danger).

When you are done, `lumiose check` and `lumiose build` must succeed.
