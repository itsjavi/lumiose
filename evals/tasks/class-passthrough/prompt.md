This is a Lumiose app. On the home page, the "Sign up" button should be green: the page passes `class="cta"` to the `Button` component and styles `.cta` in its own `<style>` block. But `Button` does not accept a `class`, so the button stays white (and `lumiose check` complains).

Change `src/components/Button.stsx` so callers can pass an optional `class` that is added to the button's own `btn` class, and so that the caller's scoped styles for that class apply to it. Do not change the home page, and do not make any styles global.

When you are done, `lumiose check` and `lumiose build` must succeed.
