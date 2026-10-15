// The route announcer of the client router (TASK-345; owner: Spark). Screen readers announce a
// document load on their own, not a client navigation: like Next.js, SvelteKit and Astro's
// ClientRouter, a visually hidden live region reads the new page's name after each navigation.
//
// - Assertive and atomic, as all three: a navigation replaces the page the user was reading, as a
//   document load does, so it interrupts instead of queueing behind other speech.
// - The name is `document.title` (set by `<Title>`), else the first `<h1>`, else the path.
// - The SPA root creates it once it is on screen, appended to `<body>`, outside the island it
//   hydrates; it is empty until the first navigation, and goes when the SPA is disposed.

/** Visually hidden but read by screen readers (the styles of SvelteKit's and Astro's announcers). */
const HIDDEN: Record<string, string> = {
  position: "absolute",
  top: "0",
  left: "0",
  width: "1px",
  height: "1px",
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  "clip-path": "inset(50%)",
  "white-space": "nowrap",
};

export interface Announcer {
  /**
   * A navigation to `url` is on screen: announces its page when the path changed, or when only the
   * query or hash changed but the title did too.
   */
  navigated(url: URL): void;
  remove(): void;
}

/** Adds the live region to the document; `url` is the page already on screen. */
export function createAnnouncer(url: URL): Announcer {
  const region = document.createElement("div");
  region.setAttribute("aria-live", "assertive");
  region.setAttribute("aria-atomic", "true");
  region.setAttribute("data-l-announcer", "");
  // One property at a time: a CSP without 'unsafe-inline' blocks a `style` attribute and `cssText`.
  for (const [name, value] of Object.entries(HIDDEN)) region.style.setProperty(name, value);
  document.body.append(region);
  let path = url.pathname;
  let title = document.title;
  return {
    navigated(next) {
      const changed = next.pathname !== path || document.title !== title;
      path = next.pathname;
      title = document.title;
      if (changed) region.textContent = pageName(next);
    },
    remove() {
      region.remove();
    },
  };
}

function pageName(url: URL): string {
  const heading = document.querySelector("h1")?.textContent?.replace(/\s+/g, " ").trim();
  return document.title || heading || url.pathname;
}
