This is a Lumiose app. The home page crashes when it is rendered on the server (in `lumiose dev` and in `lumiose build`) because of `src/components/ThemeToggle.stsx`.

Fix `ThemeToggle` so that:

- the page renders on the server with the button reading `Theme: light`;
- in the browser, once the component is mounted, it shows the theme saved in `localStorage` under the key `theme` (if any);
- clicking it still toggles between `light` and `dark` and saves the new value in `localStorage`.

When you are done, `lumiose check` and `lumiose build` must succeed.
