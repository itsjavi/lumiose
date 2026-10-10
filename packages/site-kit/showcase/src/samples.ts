// Code samples shown by the showcase.

export const counterSample = `import { signal } from "lumiose";
import { color, radius, space } from "@lumiose/site-kit/tokens";

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
  pnpm: "pnpm add lumiose\npnpm lumiose dev",
  npm: "npm install lumiose\nnpx lumiose dev",
  yarn: "yarn add lumiose\nyarn lumiose dev",
  bun: "bun add lumiose\nbunx lumiose dev",
} as const;
