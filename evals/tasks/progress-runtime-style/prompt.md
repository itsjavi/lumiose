This is a Lumen app. `src/components/ProgressBar.stsx` is meant to fill its green bar to `value` percent, but the fill never shows the value and `lumen check` reports a problem in it.

Fix `ProgressBar`:

- The fill's width follows the `value` prop (a number from 0 to 100; clamp anything outside that range) and updates when the prop changes.
- Keep the styling in the component's `<style>` block, driven by a CSS custom property named `--progress` (for example `--progress: 40%`) that the component sets from the value.
- Set `aria-valuenow` on the `role="progressbar"` element to the clamped value.

When you are done, `lumen check` and `lumen build` must succeed.
