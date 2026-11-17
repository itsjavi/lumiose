// Code samples shown by the showcase.

export const counterSample = `import { signal } from "lumiose";
import { color, space } from "@lumiose/site-kit/tokens";

export function Counter(props: { start?: number }) {
  // Only the text node that reads the signal updates.
  const count = signal(props.start ?? 0);

  return (
    <button class={{ hot: count() > 5 }} onClick={() => count.update((n) => n + 1)}>
      Clicked {count()} times
    </button>
  );
}

<style>
  button {
    padding: $space.xs $space.md;
    border: 1px solid $color.text;
    background: $color.text;
    color: $color.bg;
  }
  .hot { text-decoration: underline $color.accent; }
</style>
`;

export const cssSample = `:root {
  color-scheme: light dark;
  --lm-bg: light-dark(#fff, #000);
}
:root[data-theme="dark"] { color-scheme: dark; }

@media (width < 48rem) {
  .links { display: none; }
}
`;

export const installSamples = {
  pnpm: "pnpm add lumiose\npnpm lumiose dev",
  npm: "npm install lumiose\nnpx lumiose dev",
  yarn: "yarn add lumiose\nyarn lumiose dev",
  bun: "bun add lumiose\nbunx lumiose dev",
} as const;
