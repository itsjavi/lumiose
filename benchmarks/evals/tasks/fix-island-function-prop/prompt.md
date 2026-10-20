This is a Lumiose app. The price editor on the home page (`src/components/PriceEditor.stsx`, used as an interactive island in `src/routes/page.stsx`) does not work, and `lumiose check` reports an error about it.

Fix it so the island works: it starts at 9.5, and as you type a number into its input, the `<output>` next to it shows the price with two decimals and a euro sign (for example `12.00 €`). The `onChange` logging was only for debugging and can go. Keep `initial` as the island's starting-value prop.

When you are done, `lumiose check` must pass.
