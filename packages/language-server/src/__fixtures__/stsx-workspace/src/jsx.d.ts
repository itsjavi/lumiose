// A minimal JSX namespace, standing in for a framework's types.
declare namespace JSX {
  interface IntrinsicElements {
    [name: string]: Record<string, unknown>;
  }
}
