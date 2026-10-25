// Renders the website's Open Graph images (1200×630, TASK-597) into public/og/: the home page's,
// which every other page shares, and the /stsx and /ui landing pages'. Each is an HTML card in the
// home page's night-stage style, screenshotted with Playwright's Chromium. It loads Inter and
// JetBrains Mono from Google Fonts, so it needs the network. The PNGs are committed; rerun it after
// changing a card.
//
//   pnpm --filter @lumiose/web og:images
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const OUT = join(import.meta.dirname, "../public/og");

const FONTS =
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;800&family=JetBrains+Mono:wght@500;600&display=block";

// The site-kit's dark tokens (packages/site-kit/src/tokens.ts) and the hero's lit-text gradient.
const CSS = `
* { box-sizing: border-box; margin: 0; }
body {
  inline-size: 1200px; block-size: 630px; overflow: hidden;
  background: #07061a; color: #ededf6;
  font-family: Inter, system-ui, sans-serif; -webkit-font-smoothing: antialiased;
}
.card { position: relative; inline-size: 1200px; block-size: 630px; padding: 64px 72px; display: flex; flex-direction: column; }
.sky {
  position: absolute; inset: 0;
  background:
    radial-gradient(circle at var(--x) var(--y), rgb(255 248 236) 0 1.2%, rgb(255 222 168 / 0.75) 3.5%, rgb(255 191 107 / 0.32) 11%, rgb(143 132 255 / 0.2) 27%, transparent 52%),
    radial-gradient(ellipse 70% 60% at 8% 112%, rgb(124 108 255 / 0.28), transparent 70%),
    #07061a;
}
.rays {
  position: absolute; inset: 0;
  background: repeating-conic-gradient(from 4deg at var(--x) var(--y), rgb(255 226 180 / 0.07) 0 1.6deg, transparent 1.6deg 11deg);
  mask-image: radial-gradient(circle at var(--x) var(--y), #000 0, transparent 46%);
}
.content { position: relative; display: flex; flex-direction: column; block-size: 100%; }
.logo { display: flex; align-items: center; gap: 18px; font-size: 34px; font-weight: 800; letter-spacing: -0.02em; }
.logo small { font-size: 34px; font-weight: 500; color: #a99fff; }
.mark {
  position: relative; inline-size: 44px; block-size: 44px; border-radius: 50%;
  background: radial-gradient(circle at 34% 30%, #fff 0 14%, transparent 42%), linear-gradient(120deg, #8f84ff, #ffbf6b);
  box-shadow: 0 0 26px rgb(143 132 255 / 0.55), 0 0 60px rgb(255 191 107 / 0.35);
}
.mark::after { content: ""; position: absolute; inset: -12px; border-radius: 50%; border: 1.5px solid rgb(143 132 255 / 0.35); }
.eyebrow { margin-block-start: auto; font: 600 24px "JetBrains Mono", ui-monospace, monospace; color: #ffc36e; }
h1 { margin-block-start: 20px; font-size: 88px; font-weight: 800; line-height: 1; letter-spacing: -0.045em; }
h1 span { display: block; }
.lit {
  background: linear-gradient(90deg, #ffd9a3 0%, #ffbf6b 30%, #fff1dc 60%, #b8b0ff 100%);
  background-clip: text; -webkit-background-clip: text; color: transparent;
  padding-block-end: 0.08em;
}
.lead { margin-block-start: 26px; max-inline-size: 32ch; font-size: 30px; line-height: 1.4; color: #b4b2cc; text-wrap: pretty; }
.lead b { color: #ededf6; font-weight: 600; }
.top { display: flex; align-items: center; justify-content: space-between; }
.url { font: 500 24px "JetBrains Mono", ui-monospace, monospace; color: #8d8aa8; }
.split { display: grid; grid-template-columns: 1fr 480px; gap: 48px; align-items: end; flex: 1; }
.split h1 { font-size: 64px; }
.split .lead { font-size: 26px; max-inline-size: 26ch; }
.panel {
  border-radius: 20px; background: rgb(18 16 40 / 0.82); border: 1px solid rgb(169 159 255 / 0.22);
  box-shadow: 0 30px 80px rgb(0 0 0 / 0.45), 0 0 0 1px rgb(255 255 255 / 0.03) inset;
  backdrop-filter: blur(6px);
}
pre { padding: 24px 26px; font: 500 18px/1.6 "JetBrains Mono", ui-monospace, monospace; color: #d7d5ea; white-space: pre; }
.dots { display: flex; gap: 8px; padding: 18px 22px 0; }
.dots i { inline-size: 12px; block-size: 12px; border-radius: 50%; background: #34304f; }
.k { color: #b8b0ff; } .s { color: #ffc36e; } .t { color: #8fd3ff; } .c { color: #7d7a99; } .p { color: #ff9fb8; }
.ui { display: grid; gap: 18px; }
.dialog { padding: 26px 28px; display: grid; gap: 12px; }
.dialog h2 { font-size: 26px; font-weight: 700; letter-spacing: -0.02em; }
.dialog p { font-size: 19px; line-height: 1.45; color: #b4b2cc; }
.buttons { display: flex; justify-content: flex-end; gap: 12px; margin-block-start: 8px; }
.btn { padding: 11px 20px; border-radius: 10px; font-size: 18px; font-weight: 600; border: 1px solid rgb(169 159 255 / 0.3); color: #ededf6; }
.btn.primary { background: #8f84ff; border-color: #8f84ff; color: #0a0a12; }
.row { display: flex; gap: 18px; }
.row > .panel { flex: 1; padding: 20px 22px; display: flex; align-items: center; gap: 14px; font-size: 19px; color: #d7d5ea; }
.switch { inline-size: 50px; block-size: 28px; border-radius: 99px; background: #8f84ff; position: relative; flex: none; }
.switch::after { content: ""; position: absolute; inset-block: 4px; inset-inline-end: 4px; inline-size: 20px; border-radius: 50%; background: #0a0a12; }
.tabs { display: flex; gap: 6px; padding: 6px; border-radius: 12px; background: #1c1940; }
.tabs span { padding: 7px 14px; border-radius: 8px; font-size: 17px; color: #b4b2cc; }
.tabs span:first-child { background: #2a2560; color: #ededf6; }
`;

interface Card {
  file: string;
  /** The light's position: the stage's glow and rays center there. */
  light: [string, string];
  body: string;
}

/** The header: the logo (with the section's name) and the page's address. */
const TOP = (section: string, path: string) =>
  `<div class="top"><div class="logo"><span class="mark"></span>Lumiose${section && ` <small>${section}</small>`}</div>` +
  `<div class="url">lumiose.dev${path}</div></div>`;

const CARDS: Card[] = [
  {
    file: "home.png",
    light: ["82%", "34%"],
    body: `
      ${TOP("", "")}
      <p class="eyebrow">Static sites · SSR · Islands · SPAs</p>
      <h1><span>Feels like React.</span><span class="lit">Runs like vanilla JS.</span></h1>
      <p class="lead"><b>TSX with scoped CSS</b>, signals, and <b>0&nbsp;kB of JavaScript</b> until a page needs it.</p>`,
  },
  {
    file: "stsx.png",
    light: ["80%", "30%"],
    body: `
      ${TOP("STSX", "/stsx")}
      <div class="split">
        <div>
          <p class="eyebrow">Styled TSX · .stsx</p>
          <h1><span>Scoped CSS,</span><span class="lit">in your TSX.</span></h1>
          <p class="lead">Plain-CSS <b>&lt;style&gt;</b> blocks, scoped by placement, compiled at build time.</p>
        </div>
        <div class="panel">
          <div class="dots"><i></i><i></i><i></i></div>
<pre><span class="c">// Counter.stsx (React)</span>
<span class="k">export function</span> <span class="t">Counter</span>() {
  <span class="k">const</span> [n, setN] = <span class="t">useState</span>(<span class="s">0</span>);
  <span class="k">return</span> (
    &lt;<span class="p">button</span> onClick={…}&gt;
      &lt;<span class="p">style</span>&gt;
        button { <span class="t">color</span>: <span class="s">var(--brand)</span>; }
      &lt;/<span class="p">style</span>&gt;
      {n}
    &lt;/<span class="p">button</span>&gt;
  );
}</pre>
        </div>
      </div>`,
  },
  {
    file: "ui.png",
    light: ["78%", "26%"],
    body: `
      ${TOP("UI", "/ui")}
      <div class="split">
        <div>
          <p class="eyebrow">@lumiose/ui</p>
          <h1><span>Accessible UI</span><span class="lit">on native HTML.</span></h1>
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
    const [x, y] = card.light;
    await page.setContent(
      `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${FONTS}"><style>${CSS}</style></head>` +
        `<body><div class="card" style="--x: ${x}; --y: ${y}"><div class="sky"></div><div class="rays"></div>` +
        `<div class="content">${card.body}</div></div></body></html>`,
      { waitUntil: "networkidle" },
    );
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: join(OUT, card.file) });
    console.log(`og: public/og/${card.file}`);
  }
} finally {
  await browser.close();
}
