abstract class Base<T> {
  protected abstract value: T;
  static count = 0;
  #secret = 1;
  get secret(): number {
    return this.#secret;
  }
  set secret(next: number) {
    this.#secret = next;
  }
  compare(other: Base<T>): boolean {
    return this.#secret < other.#secret;
  }
}

class Derived extends Base<string> implements Iterable<string> {
  protected value = "x";
  declare readonly tag?: string;
  constructor(private readonly items: string[] = []) {
    super();
  }
  *[Symbol.iterator](): Iterator<string> {
    yield* this.items;
  }
  render() {
    return <div class="derived">{this.value}</div>;
  }
}

const instance = new Derived(["a"]);
const optional = instance?.render?.();
const indexed = instance?.["value" as never];
const ternaryDot = instance ? .5 : 1;
let maybe: string | null = null;
maybe ??= "fallback";
maybe ||= "other";
maybe &&= maybe.trim();

export { instance, optional, indexed, ternaryDot, maybe };
