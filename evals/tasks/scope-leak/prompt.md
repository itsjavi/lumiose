This is a Lumiose app. Since `src/components/Notice.stsx` was added, every paragraph and every `<strong>` on the site turned red or uppercase, not just the ones inside notices.

Fix the `Notice` component so its styles apply only to the notice itself (the notice must still look exactly as before), using Lumiose's scoped styles rather than longer selectors. Do not change the home page.

When you are done, `lumiose check` and `lumiose build` must succeed.
