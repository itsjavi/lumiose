// mocha's globals as the suites use them (defined by ./mocha.ts).
declare function describe(name: string, fn: () => void): void;
declare function it(description: string, fn: (this: { weight?: number }) => unknown): void;
declare function afterEach(fn: () => void): void;
