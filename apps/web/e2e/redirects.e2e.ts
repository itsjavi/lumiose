// The old /examples/… URLs (TASK-215), and the showcase URLs of the apps that moved to
// itsjavi/dotmatrix (decision-73), land on the apps' new homes with the same rest of the path, query
// and hash: the stubs at the old roots and the root 404 page, written by scripts/site.ts
// (`redirects`, see playwright.config.ts). The new homes themselves are not built here (and the
// moved apps' pages are answered by a stand-in, so the tests stay offline), so each test checks the
// URL the browser ends on.
import { expect, test } from "@playwright/test";

const POCKET = "https://itsjavi.com/dotmatrix/";
const ADVANCED = "https://itsjavi.com/dotmatrix/advanced/";

/** A real Dotmatrix Pocket share link (itsjavi/dotmatrix, apps/pocket/src/model/share.ts): "Maple Hollow". */
const SONG =
  "1.xVY7bxxHDP4rxtQ0MORwHrtdkHQpnS5wsbZW1tl32sPeyohh6L8HfDkJoMJx40Yr8jgkP37kcL6mz2lGSMfpOK9pTm8eln29e3W_b5dXf_zy5vfXhDVBWp6Oh21Pc_ptOy7LsZ_-SpDeXS9pxsyQ3i37Lc3YIJ237ZrmDOnT-iXNFdLt_aKOL8vHbU-Qjn15_-mW5j-_ptPj7Ujz13Td19t6pDnt63qXIN09HV80qc_b-emyphkR0vpoiX4-vduXY5Nzd-t5EcMB6W69Hg9pJkj7cqxp5mdIH86nu1VzWfZrmtN2f58g3R5Ol8u6p_l-Od9WSB_UPssPy1USvW33h-S5PYr-GdLjdqyScIYGnaABQZtgAEOrgCTfCbBBg9aByH4mhiHWRQ50hjKAROYMDD0Ds53jIS5ah8bmvmdzILbQO_Qm3wYj-5fFEcNo5nAMczSpPcHULABmPcAgBOkvmIe5QCQJ2jsg-Wks5NZFgMhPLEjEmtkgYM0WEisJuAzYcqCPGG1Y2tg9H-zqsAEOssxxeG1wcow4NY81DbOhnGFoHS3pDIRk0Qm9AoRN_EjNNfoERHq8A5VsDilwUfG6kDFAQEqB2PDw41WN21tIlyfpCm-R23bevgnX5THN6df0DC808Pr-YXupgav3L73Uv_lb--Zo3_I_2xe_q30JagHtTymBdlkzScomzZxNRG9irbTIYlY7oNoJO04FuezeqLnsza4sNJYhIKgDCluc0ozB4nFZ_WXQlhPZGebmstjxAG3AWqF63MouO4w6TG4et5HLbNib27XhM-Z4u8ftjrf7jPfh5cmGf3hcm0GyGRTZ_U0ed_JWndjlZvlPnp_Mpv6AmUITpc4tNF5sREeNSkstgN94QU8UcQRz2akkCo2Tg9RCo2lkwOK4sHgBUBlSjRoToHIkGg7PypJq2GjF4AnZx9euCtEoVXJVVA5NC5vouuatiS1ybpFzMIYtjIMz7NGkwRp2LzP2qPOIOo-o8wjjEXUeUecp6qz0SX2mqMYUACevBhmDBJQpNA6QcgvNsPoQejX8DmO_w1TTrD6EDpBsuBiIKDTe5kROit9z2e850RiDcvNxaMKzTRnpzaf1IfZqEHMMcAuNNxLFrFEMG_m0_fjtuG9Pj__sd_rXfo_7Mf_U-5GBUf7I_TRM0vVemtyADCzkyle2iMvDZF0z3EC3jHjJJuuOEXmYH90wBeXGUllv4oLQ3K65nW5PRtv-xbc_V7l5NJ5ufa629Tnb1pc8szu0ra-a4Rp0n4hhTDlQhrHiKcPfA6XoRWAahSQaw9R02u14dfRYHb49DPSf8NzCuEdJAxuOyHmE8YicFZ9EN4BFB88WhwEs_kKQBg6AZGw1nSXTGF9FJ8eOG2PFHwaiMYDNHwYF_WEgGqftx1v_OH14OF5q_fGTOv81_qf1ETowIMjDDkEaQQUUnVzMakBZlcRqQkOlktWkkJoIeaCvXDFhcymdAUVvZugyAqKsTU2a-ZRNA0WvYegyBehPTX87ijTUZFiyw7O1dCfzOVm6k6Urs6AgsiUsk6AyWsr6DBY7tABI2bGTf-Uc6-JEqDocCFlnQ-2LQUD2OGwgkA0Fsser7q96nDq8qgYFm2HB5rXv7r979bvjGR5nOJ7h_ifHMzmeyeJQNjyU2WXjgbIRQU4yoeGg4JcMB5HhIGeaiuEgJ1kWi9qx4SCnm9hwyAqxL2kdZYEgfOf-ePv8Nw";

/** [old URL, new home]: a path on this site, or the moved app's URL. */
const cases = [
  // The share links that went around: the song is in the query.
  [`/showcase/dotmatrix/?song=${SONG}`, `${POCKET}?song=${SONG}`],
  [`/showcase/dotmatrix?song=${SONG}#play`, `${POCKET}?song=${SONG}#play`],
  [`/examples/spa-dotmatrix/?song=${SONG}`, `${POCKET}?song=${SONG}`],
  [`/examples/spa-dotmatrix?song=${SONG}#play`, `${POCKET}?song=${SONG}#play`],
  ["/showcase/chiptune-tracker/", ADVANCED],
  // Deep links, served by the root 404 page.
  ["/showcase/dotmatrix/songs", `${POCKET}songs`],
  ["/showcase/dotmatrix/learn/notes?step=2#scales", `${POCKET}learn/notes?step=2#scales`],
  ["/examples/spa-dotmatrix/songs", `${POCKET}songs`],
  ["/showcase/chiptune-tracker/songs/3?view=mixer#row-4", `${ADVANCED}songs/3?view=mixer#row-4`],
  ["/examples/spa-chiptune/songs/3", `${ADVANCED}songs/3`],
  ["/examples/ssg-travel-journal/tags/trains/", "/demos/travel-journal/tags/trains/"],
  ["/examples/vite-counter/", "/demos/counter/"],
  // Below the site's base path, as on GitHub Pages.
  [`/lumiose/showcase/dotmatrix/?song=${SONG}#play`, `${POCKET}?song=${SONG}#play`],
  ["/lumiose/showcase/chiptune-tracker/songs/3", `${ADVANCED}songs/3`],
  [`/lumiose/examples/spa-dotmatrix/?song=${SONG}`, `${POCKET}?song=${SONG}`],
  ["/lumiose/examples/spa-chiptune/songs/3", `${ADVANCED}songs/3`],
  ["/lumiose/examples/vite-counter/", "/lumiose/demos/counter/"],
] as const;

for (const [from, to] of cases) {
  test(`${from.slice(0, 60)} redirects to its new home`, async ({ page, baseURL }) => {
    // A stand-in for the moved apps' pages: the test checks where the browser goes, offline.
    await page.route("https://itsjavi.com/dotmatrix/**", (route) =>
      route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Moved app</title>" }),
    );
    const target = to.startsWith("https://") ? to : `${baseURL}${to}`;
    await page.goto(from);
    await page.waitForURL(target);
    expect(page.url()).toBe(target);
  });
}

test("the examples index moved to the showcase", async ({ page, baseURL }) => {
  await page.goto("/examples");
  await page.waitForURL(`${baseURL}/showcase/`);
  await expect(page.getByRole("heading", { level: 1, name: "Made with Lumiose" })).toBeVisible();
});

test("without JavaScript, an old root still points at the new one", async ({ request }) => {
  for (const [from, to] of [
    ["/showcase/dotmatrix/", POCKET],
    ["/examples/spa-dotmatrix/", POCKET],
    ["/lumiose/showcase/chiptune-tracker/", ADVANCED],
    ["/examples/vite-counter/", "/demos/counter/"],
  ] as const) {
    const html = await (await request.get(from)).text();
    expect(html).toContain(`<meta http-equiv="refresh" content="0;url=${to}">`);
    expect(html).toContain(`<link rel="canonical" href="${to}">`);
    expect(html).toContain('<meta name="robots" content="noindex">');
  }
});
