enum Color {
  Red = "red",
  Blue = "blue",
}

namespace Shapes {
  export const sides = 4;
}

declare module "virtual:example" {
  const value: string;
  export default value;
}

function overload(a: string): string;
function overload(a: number): number;
function overload(a: unknown) {
  return a;
}

async function loops(items: AsyncIterable<number>) {
  outer: for await (const item of items) {
    for (let i = 0; i < item; i++) {
      if (i > 2) continue outer;
      while (i < 1) break;
    }
  }
  do {
    void 0;
  } while (false);
  switch (Color.Red as Color) {
    case Color.Red: {
      return <span>red</span>;
    }
    default:
      return null;
  }
}

try {
  overload(1);
} catch (error) {
  console.error(error);
} finally {
  void loops;
}

if (Shapes.sides) <div>statement-level JSX</div>;

const numbers = [1_000, 0xff, 0b1010, 0o17, 1e-5, 2.5e+3, 10n, .5];
const label = "a" in { a: 1 } ? `yes` : `no`;
const ok = numbers instanceof Array && label;

export { numbers, label, ok, overload };
