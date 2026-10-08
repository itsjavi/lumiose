const css = (strings: TemplateStringsArray, ...values: unknown[]) => strings.join(String(values.length));

export const sheet = css`
  <style>
    .a { color: red; }
  </style>
`;

const inner = `outer ${`inner ${`deepest <style>`} text`} done`;
const withJsx = `before ${(<div>in template</div>) ? "x" : "y"} after`;
const escaped = `a \` backtick and \${not an expression} <style>`;
const html = "<style>.a{}</style>";
const single = '<style global>';
const multiline = `line one
<style>
line three`;

export function Card() {
  const label = `${inner}:${withJsx}`;
  return <div title={`${label} <style>`}>{`text <style> ${escaped}`}</div>;
}

export const all = [sheet, inner, withJsx, escaped, html, single, multiline];
