// <style> in a line comment
/* <style>
   .a { color: red }
</style> in a block comment */

/**
 * JSDoc with an example:
 * ```tsx
 * <div><style>.a {}</style></div>
 * ```
 */
export function Commented(/* inline <style> */ props: { a: number }) {
  // const x = <style>
  return (
    <div /* attribute comment */ data-a={props.a /* trailing */}>
      {/* <style>.a {}</style> */}
      text
    </div>
  );
}

const value = 1 /* comment */ < 2; // comparison after a comment
const divided = 10 /* c */ / 2 / 1;

export { value, divided };
