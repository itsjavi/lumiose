// TypeScript is stripped (types, interfaces, type-only imports, non-null, satisfies) and enums
// are lowered; unused imports are elided as TypeScript does.
import type { JSX } from "lumen/jsx-runtime";
import { signal, type Signal } from "lumen";
import { unused } from "./unused.ts";
import { Card, type CardProps } from "./Card.stsx";

interface Props {
  items: string[];
}

enum Mode {
  A,
  B,
}

const pick = <T,>(value: T): T => value;

export function Typed({ items }: Props): JSX.Element {
  const mode = signal<Mode>(Mode.A) satisfies Signal<Mode>;
  const first = items[0]!;
  const props: CardProps = { title: pick(first) };
  return <Card {...props} mode={mode() as number} />;
}
