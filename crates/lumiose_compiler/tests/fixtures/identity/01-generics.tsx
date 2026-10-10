import { signal, type Signal } from "lumiose";

type Fn = <T>(value: T) => T;
type Ctor = new <T>(value: T) => Box<T>;
type Pair<A, B> = [first: A, second: B];
type Nested = Map<string, Array<Set<number>>>;
type Callable = {
  <T>(value: T): T;
  (value: string): string;
  readonly name?: string;
};

interface Box<T> {
  value: T;
  map<U>(fn: (value: T) => U): Box<U>;
}

const identity = <T,>(value: T): T => value;
const constrained = <T extends object>(value: T) => value;
const withDefault = <T = string>(value: T) => value;
const constGeneric = <const T,>(value: T) => value;
const asyncGeneric = async <T,>(value: T): Promise<T> => value;

function wrap<T>(value: T): Box<T> {
  return { value, map: (fn) => wrap(fn(value)) };
}

const style = 3;
const a = 1;
const b = 2;
const comparison = a < style;
const chained = a <style> b;
const shifted = a << 2 >> 1 >>> 0;
const lessOrEqual = a <= b && b >= a;
const call = wrap<number>(1).map<string>((n) => `${n}`);
const generic: Fn = identity;
let cell: Signal<number> | undefined = signal<number>(0);
const casted = cell as unknown as Box<string>;
const checked = { a: 1 } satisfies Record<string, number>;
const nonNull = cell!;
const nonNullCompare = cell! < cell!;

export function Select<T extends { id: string }>(props: { items: T[]; pick?: (item: T) => void }) {
  return <ul>{props.items.map((item) => <li key={item.id}>{item.id}</li>)}</ul>;
}

export const Typed = () => <Select<{ id: string }> items={[{ id: "a" }]} />;

export { identity, constrained, withDefault, constGeneric, asyncGeneric, comparison, chained, shifted, lessOrEqual, call, generic, casted, checked, nonNull, nonNullCompare };
