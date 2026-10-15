// The part of chai's `expect` the suites use: `to.exist`, `to.eql` (deep equality) and `to.be.true`.

function equal(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every((key) =>
      equal((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
    )
  );
}

function fail(message: string): never {
  throw new Error(message);
}

export function expect(actual: unknown) {
  return {
    to: {
      get exist(): void {
        if (actual == null) fail(`expected ${String(actual)} to exist`);
        return undefined;
      },
      eql(expected: unknown): void {
        if (!equal(actual, expected)) {
          fail(`expected ${JSON.stringify(actual)} to deeply equal ${JSON.stringify(expected)}`);
        }
      },
      be: {
        get true(): void {
          if (actual !== true) fail(`expected ${String(actual)} to be true`);
          return undefined;
        },
      },
    },
  };
}
