// Site-wide settings, shared by pages, the RSS feed and the sitemap.

export const site = {
  title: "Long Way Round",
  tagline: "A slow travel journal",
  description:
    "Notes from night trains, mountain huts, foggy islands and morning markets: a travel journal that takes the long way round.",
  author: "Long Way Round",
  /** The deployed origin, for the absolute URLs of the feed, the sitemap and canonical links. */
  url: "https://long-way-round.example",
  /** Posts per page of the journal (`/`, `/page/2`, …). */
  pageSize: 4,
} as const;

/**
 * A file of `public/` (`/covers/x.svg`) below Vite's base, so the site also works below a path
 * (`LUMIOSE_BASE=/demos/travel-journal/ lumiose build`, as on the Lumiose website).
 */
export function asset(path: string): string {
  return import.meta.env.BASE_URL.replace(/\/$/, "") + path;
}

/** An absolute URL on the deployed site. */
export function absoluteUrl(path: string): string {
  return new URL(path, site.url).href;
}
