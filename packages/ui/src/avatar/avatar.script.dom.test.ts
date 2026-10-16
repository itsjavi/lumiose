// @vitest-environment happy-dom
// Avatar's script (TASK-374): `<lu-avatar>` follows its image's loading status, with Base UI's
// `data-loading` and `data-error` on the image, `data-loaded` on the root, and a
// `loadingstatuschange` event on the image for each change. happy-dom loads no images: the tests
// set `complete` and `naturalWidth` and dispatch `load` and `error` themselves.
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import type { AvatarElement, AvatarLoadingStatusChangeDetail } from "./avatar.script.ts";

beforeAll(async () => {
  await import("./avatar.script.ts");
});

afterEach(() => {
  document.body.innerHTML = "";
});

/** Renders an avatar with an image in the given state; returns the root, the image and its events. */
function avatar(src: string | null, state: { complete: boolean; naturalWidth?: number }) {
  const root = document.createElement("lu-avatar") as AvatarElement;
  const image = document.createElement("img");
  if (src !== null) image.setAttribute("src", src);
  image.toggleAttribute("data-loading", true);
  Object.defineProperty(image, "complete", { configurable: true, value: state.complete });
  Object.defineProperty(image, "naturalWidth", {
    configurable: true,
    value: state.naturalWidth ?? 0,
  });
  const statuses: string[] = [];
  image.addEventListener("loadingstatuschange", (event) =>
    statuses.push((event as CustomEvent<AvatarLoadingStatusChangeDetail>).detail.status),
  );
  const fallback = document.createElement("span");
  fallback.toggleAttribute("data-fallback", true);
  root.append(image, fallback);
  document.body.append(root);
  return { root, image, statuses };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

it("keeps a loading image marked until it loads, then marks the root", () => {
  const { root, image, statuses } = avatar("/ada.jpg", { complete: false });
  expect(image.hasAttribute("data-loading")).toBe(true);
  expect(root.hasAttribute("data-loaded")).toBe(false);
  expect(root.status).toBe("loading");
  image.dispatchEvent(new Event("load"));
  expect(image.hasAttribute("data-loading")).toBe(false);
  expect(root.hasAttribute("data-loaded")).toBe(true);
  expect(root.status).toBe("loaded");
  expect(statuses).toEqual(["loading", "loaded"]);
});

it("marks a failed image, and an image without a source, as an error", () => {
  const failed = avatar("/missing.jpg", { complete: false });
  failed.image.dispatchEvent(new Event("error"));
  expect(failed.image.hasAttribute("data-error")).toBe(true);
  expect(failed.image.hasAttribute("data-loading")).toBe(false);
  expect(failed.root.hasAttribute("data-loaded")).toBe(false);
  expect(failed.statuses).toEqual(["loading", "error"]);
  const none = avatar(null, { complete: true });
  expect(none.image.hasAttribute("data-error")).toBe(true);
  expect(none.statuses).toEqual(["error"]);
});

it("shows a cached image at once", () => {
  const { root, statuses } = avatar("/ada.jpg", { complete: true, naturalWidth: 80 });
  expect(root.hasAttribute("data-loaded")).toBe(true);
  expect(statuses).toEqual(["loaded"]);
});

it("decodes a complete image without a size: an SVG loads, a broken image fails", async () => {
  const decode = vi.spyOn(HTMLImageElement.prototype, "decode");
  decode.mockResolvedValueOnce(undefined);
  const svg = avatar("/ada.svg", { complete: true });
  decode.mockRejectedValueOnce(new Error("EncodingError"));
  const broken = avatar("/broken.jpg", { complete: true });
  await tick();
  expect(svg.statuses).toEqual(["loading", "loaded"]);
  expect(broken.statuses).toEqual(["loading", "error"]);
  decode.mockRestore();
});

it("starts over when the source changes or the image goes", async () => {
  const { root, image, statuses } = avatar("/ada.jpg", { complete: false });
  image.dispatchEvent(new Event("load"));
  image.setAttribute("src", "/grace.jpg");
  await tick();
  expect(root.hasAttribute("data-loaded")).toBe(false);
  expect(image.hasAttribute("data-loading")).toBe(true);
  image.dispatchEvent(new Event("load"));
  expect(statuses).toEqual(["loading", "loaded", "loading", "loaded"]);
  image.remove();
  await tick();
  expect(root.hasAttribute("data-loaded")).toBe(false);
  expect(root.status).toBeUndefined();
});

it("ignores the load and error events of other images inside", () => {
  const { root, statuses } = avatar("/ada.jpg", { complete: false });
  const badge = document.createElement("img");
  root.querySelector("span")!.append(badge);
  badge.dispatchEvent(new Event("load"));
  expect(root.status).toBe("loading");
  expect(statuses).toEqual(["loading"]);
});
