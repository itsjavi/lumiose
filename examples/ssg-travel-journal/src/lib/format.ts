// Formatting helpers. Dates are calendar days (`YYYY-MM-DD`), formatted in UTC so the output does
// not depend on the build machine's time zone.

const long = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "UTC" });
const short = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function utc(day: string): Date {
  return new Date(`${day}T00:00:00Z`);
}

/** `2026-09-18` → `18 September 2026`. */
export function formatDate(day: string): string {
  return long.format(utc(day));
}

/** `2026-09-18` → `18 Sept 2026`. */
export function formatShortDate(day: string): string {
  return short.format(utc(day));
}

/** RFC 822 date of RSS: `2026-09-18` → `Fri, 18 Sep 2026 00:00:00 GMT`. */
export function rssDate(day: string): string {
  return utc(day).toUTCString();
}

/** `slow-travel` → `Slow travel`. */
export function tagLabel(tag: string): string {
  const words = tag.replaceAll("-", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Escapes text for XML element content and attribute values. */
export function escapeXml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
