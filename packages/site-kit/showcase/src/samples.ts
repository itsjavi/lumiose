// Code samples shown by the showcase.

export const counterSample = `import { signal } from "lumen";
import { color, radius, space } from "@lumen/site-kit/tokens";

export function Counter(props: { start?: number }) {
  const count = signal(props.start ?? 0);

  return (
    <button class={{ hot: count() > 5 }} onClick={() => count.update((n) => n + 1)}>
      Clicked {count()} times

      <style>
        button {
          padding: $space.xs $space.md;
          border-radius: $radius.pill;
          background: $color.accent;
        }
        .hot { box-shadow: 0 0 24px $color.glowA; }
      </style>
    </button>
  );
}
`;

export const cssSample = `:root {
  color-scheme: light dark;
  --lm-bg: light-dark(#fcfcfe, #0a0a12);
}
:root[data-theme="dark"] { color-scheme: dark; }

@media (width < 48rem) {
  .links { display: none; }
}
`;

export const installSamples = {
  pnpm: "pnpm add lumen\npnpm lumen dev",
  npm: "npm install lumen\nnpx lumen dev",
  yarn: "yarn add lumen\nyarn lumen dev",
  bun: "bun add lumen\nbunx lumen dev",
} as const;
