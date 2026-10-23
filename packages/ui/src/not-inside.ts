// The error a compound component's part throws when the Root (or another part) it needs is not
// above it. The case that is hard to see is an island in between (TASK-550): a part passed to an
// island as a slot renders in the page, where the Root the island renders around the slot is not.

/** `subject must be inside container.`, with the island hint. */
export function notInside(subject: string, container: string): Error {
  return new Error(
    `${subject} must be inside ${container}. If this part looks inside, check for an island in between: ` +
      "a part passed to an island as a slot (children or a JSX prop) renders in the page, not inside " +
      "the components the island renders around it. Pass the data as props and render the parts " +
      "inside the island.",
  );
}
