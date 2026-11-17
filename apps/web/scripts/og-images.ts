// Renders the website's Open Graph images (1200×630, TASK-597) into public/og/: the home page's,
// which every other page shares, and the /stsx and /ui landing pages'. Each is an HTML card in the
// site's dark look (decision-90: black and white, one grey, amber only in the beams and the logo),
// screenshotted with Playwright's Chromium. The fonts are the site's own stacks, so the result
// depends on the machine's fonts: render on macOS (Helvetica Neue, SF Mono). The PNGs are committed;
// rerun it after changing a card.
//
//   pnpm --filter @lumiose/web og:images
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const OUT = join(import.meta.dirname, "../public/og");

// The site-kit's dark palette and font stacks (packages/site-kit/src/tokens.ts).
const BG = "#000";
const TEXT = "#fff";
const GREY = "#a3a3a3";
const LINE = "#262626";
const SOFT = "#0d0d0d";
const ACCENT = "#ffd27a";
const SANS = '"Helvetica Neue", Helvetica, ui-sans-serif, system-ui, Arial, sans-serif';
const MONO = 'ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace';

const CSS = `
* { box-sizing: border-box; margin: 0; }
body {
  inline-size: 1200px; block-size: 630px; overflow: hidden;
  background: ${BG}; color: ${TEXT};
  font-family: ${SANS}; -webkit-font-smoothing: antialiased;
}
.card { position: relative; inline-size: 1200px; block-size: 630px; padding: 60px 72px; display: flex; flex-direction: column; }
.beams { position: absolute; inset: 0; inline-size: 1200px; block-size: 630px; }
.beams circle { fill: none; stroke: ${LINE}; }
.beams line { stroke: url(#fade); stroke-width: 1.5; }
.beams line.wide { stroke-width: 4; }
.content { position: relative; display: flex; flex-direction: column; block-size: 100%; }
.top { display: flex; align-items: center; justify-content: space-between; }
.logo { display: flex; align-items: center; gap: 18px; font: 600 26px ${MONO}; letter-spacing: 0.2em; text-transform: uppercase; }
.logo svg { inline-size: 42px; block-size: 42px; }
.logo small { font: inherit; color: ${GREY}; }
.url, .eyebrow { font: 400 20px ${MONO}; letter-spacing: 0.14em; text-transform: uppercase; color: ${GREY}; }
.eyebrow { margin-block-start: auto; }
h1 { margin-block-start: 22px; font-size: 92px; font-weight: 700; line-height: 0.98; letter-spacing: -0.05em; }
h1 span { display: block; }
.lead { margin-block-start: 28px; max-inline-size: 32ch; font-size: 30px; line-height: 1.4; color: ${GREY}; text-wrap: pretty; }
.lead b { color: ${TEXT}; font-weight: 500; }
.split { display: grid; grid-template-columns: 1fr 480px; gap: 48px; align-items: end; flex: 1; }
.split h1 { font-size: 66px; }
.split .lead { font-size: 26px; max-inline-size: 26ch; }
.panel { background: ${BG}; border: 1px solid ${LINE}; }
.bar { padding: 14px 24px; border-block-end: 1px solid ${LINE}; background: ${SOFT}; font: 400 15px ${MONO}; letter-spacing: 0.14em; text-transform: uppercase; color: ${GREY}; }
pre { padding: 22px 24px; font: 400 18px/1.6 ${MONO}; color: ${TEXT}; white-space: pre; }
pre .c { color: ${GREY}; }
.ui { display: grid; gap: 18px; }
.dialog { padding: 26px 28px; display: grid; gap: 12px; border-color: ${TEXT}; }
.dialog h2 { font-size: 26px; font-weight: 700; letter-spacing: -0.02em; }
.dialog p { font-size: 19px; line-height: 1.45; color: ${GREY}; }
.buttons { display: flex; justify-content: flex-end; gap: 12px; margin-block-start: 8px; }
.btn { padding: 11px 20px; font-size: 18px; font-weight: 500; border: 1px solid ${GREY}; color: ${TEXT}; }
.btn.primary { background: ${TEXT}; border-color: ${TEXT}; color: ${BG}; }
.row { display: flex; gap: 18px; }
.row > .panel { flex: 1; padding: 20px 22px; display: flex; align-items: center; gap: 14px; font-size: 19px; }
.switch { inline-size: 50px; block-size: 28px; background: ${TEXT}; position: relative; flex: none; }
.switch::after { content: ""; position: absolute; inset-block: 4px; inset-inline-end: 4px; inline-size: 20px; background: ${BG}; }
.tabs { display: flex; gap: 22px; font-size: 18px; color: ${GREY}; }
.tabs span:first-child { color: ${TEXT}; border-block-end: 2px solid ${TEXT}; }
`;

/** The site's beams (src/components/Beams.stsx), still and near the top of their pulse. */
const BEAMS = (() => {
  const lines = [6, 11, 15, 22, 26, 33, 37, 41, 48, 55, 59, 66, 73, 78].map((degrees, index) => {
    const angle = (degrees * Math.PI) / 180;
    const [x, y] = [Math.round(Math.cos(angle) * 1500), Math.round(Math.sin(angle) * 1500)];
    const opacity = [0.5, 0.2, 0.42, 0.28, 0.14][index % 5];
    return `<line${index % 4 === 2 ? ' class="wide"' : ""} x2="${x}" y2="${y}" opacity="${opacity}"/>`;
  });
  const stops = [
    [0, 1],
    [0.12, 0.6],
    [0.3, 0.3],
    [0.65, 0.12],
    [1, 0],
  ].map(
    ([offset, opacity]) =>
      `<stop offset="${offset}" stop-color="${ACCENT}" stop-opacity="${opacity}"/>`,
  );
  return (
    `<svg class="beams" viewBox="0 0 1200 630" aria-hidden="true"><defs>` +
    `<radialGradient id="fade" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1100">${stops.join("")}</radialGradient></defs>` +
    `<circle r="200"/><circle r="400"/><circle r="600"/>${lines.join("")}</svg>`
  );
})();

/** The "Corner L" mark (the site-kit's Logo). */
const MARK =
  `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 2h3v17h17v3H2z" fill="${TEXT}"/>` +
  `<path d="M7.5 16.5v-10a10 10 0 0 1 10 10z" fill="${ACCENT}"/></svg>`;

interface Card {
  file: string;
  body: string;
}

/** The header: the logo (with the section's name) and the page's address. */
const TOP = (section: string, path: string) =>
  `<div class="top"><div class="logo">${MARK}Lumiose${section && ` <small>${section}</small>`}</div>` +
  `<div class="url">lumiose.dev${path}</div></div>`;

const CARDS: Card[] = [
  {
    file: "home.png",
    body: `
      ${TOP("", "")}
      <p class="eyebrow">Static sites · SSR · Islands · SPAs</p>
      <h1><span>Feels like React.</span><span>Runs like vanilla JS.</span></h1>
      <p class="lead"><b>TSX with scoped CSS</b>, signals, and <b>0&nbsp;kB of JavaScript</b> until a page needs it.</p>`,
  },
  {
    file: "stsx.png",
    body: `
      ${TOP("STSX", "/stsx")}
      <div class="split">
        <div>
          <p class="eyebrow">Styled TSX · .stsx</p>
          <h1><span>Scoped CSS,</span><span>in your TSX.</span></h1>
          <p class="lead">Plain-CSS <b>&lt;style&gt;</b> blocks, scoped by placement, compiled at build time.</p>
        </div>
        <div class="panel">
          <div class="bar">Counter.stsx · React</div>
<pre><span class="c">// styles live with the markup</span>
export function Counter() {
  const [n, setN] = useState(0);
  return (
    &lt;button onClick={…}&gt;
      &lt;style&gt;
        button { color: var(--brand); }
      &lt;/style&gt;
      {n}
    &lt;/button&gt;
  );
}</pre>
        </div>
      </div>`,
  },
  {
    file: "ui.png",
    body: `
      ${TOP("UI", "/ui")}
      <div class="split">
        <div>
          <p class="eyebrow">@lumiose/ui</p>
          <h1><span>Accessible UI</span><span>on native HTML.</span></h1>
          <p class="lead">Dialogs, menus, comboboxes and more, <b>server-rendered without hydration</b>.</p>
        </div>
        <div class="ui">
          <div class="panel dialog">
            <h2>Publish this page?</h2>
            <p>A native &lt;dialog&gt; opened by invoker commands. It works before any script loads.</p>
            <div class="buttons"><span class="btn">Cancel</span><span class="btn primary">Publish</span></div>
          </div>
          <div class="row">
            <div class="panel"><span class="switch"></span>Notifications</div>
            <div class="panel"><div class="tabs"><span>Code</span><span>Preview</span></div></div>
          </div>
        </div>
      </div>`,
  },
];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  for (const card of CARDS) {
    await page.setContent(
      `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head>` +
        `<body><div class="card">${BEAMS}<div class="content">${card.body}</div></div></body></html>`,
    );
    await page.screenshot({ path: join(OUT, card.file) });
    console.log(`og: public/og/${card.file}`);
  }
} finally {
  await browser.close();
}
