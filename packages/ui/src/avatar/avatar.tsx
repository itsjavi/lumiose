// Avatar (decision-62, TASK-374): an image with a fallback, after Base UI's Avatar with its
// `keepMounted` image. Root renders `<lu-avatar>` (./avatar.script.ts), which stacks the image over
// the fallback in one grid cell, so neither moves the other. Image renders a native `<img>` in the
// server HTML, loading at once (or lazily), hidden while it loads and after it fails; Fallback
// renders a `<span>` (initials, an icon), shown until the image has loaded, after an optional
// delay. Without JavaScript the image covers the fallback once it loads.
import { onMount, ref } from "lumiose";
import { withStyle } from "../placement/placement.ts";
import avatarScript from "./avatar.script.ts?client";
import type {
  AvatarElement,
  AvatarLoadingStatus,
  AvatarLoadingStatusChangeDetail,
} from "./avatar.script.ts";
import { batched } from "../batched.ts";

export type { AvatarLoadingStatus } from "./avatar.script.ts";

declare module "lumiose/jsx-runtime" {
  namespace JSX {
    interface IntrinsicElements {
      /** Avatar.Root's element: it follows its image's loading status. */
      "lu-avatar": JSX.HTMLProps<AvatarElement>;
    }
  }
}

/** `Avatar.Root` renders `<lu-avatar>`, an inline box around the image and the fallback. */
export type AvatarRootProps = JSX.IntrinsicElements["lu-avatar"];

/** `Avatar.Image` renders a native `<img>`, with every native prop. */
export type AvatarImageProps = JSX.IntrinsicElements["img"] & {
  /**
   * Called when the image's loading status changes: `"loading"`, `"loaded"`, or `"error"` (it
   * failed, or has no `src`). In an island it also reports the status the image had when the island
   * hydrated.
   */
  onLoadingStatusChange?: (status: AvatarLoadingStatus) => void;
};

/** `Avatar.Fallback` renders a `<span>`, shown until the image has loaded. */
export type AvatarFallbackProps = JSX.IntrinsicElements["span"] & {
  /**
   * How long to wait before showing the fallback, in milliseconds: an image that loads sooner never
   * shows it. Default `0`.
   */
  delay?: number;
};

/**
 * An inline box for the image and the fallback, stacked in one cell. Give it a size (the default
 * theme's `lu-avatar` does), so the image loading or failing never changes the layout.
 */
function Root({ children, ...rest }: AvatarRootProps) {
  // `<lu-avatar>` follows the image's loading status; the page loads it once (decision-63).
  avatarScript();
  return <lu-avatar {...rest}>{children}</lu-avatar>;
}

/**
 * The picture: a native `<img>`, with `alt` (the person's name, or `""` when the name is next to
 * it). Hidden while it loads and after it fails, as `[data-loading]` and `[data-error]`.
 */
function Image({ onLoadingStatusChange, ...rest }: AvatarImageProps) {
  const image = ref<HTMLImageElement>();
  let reported: AvatarLoadingStatus | undefined;
  const report = (status: AvatarLoadingStatus | undefined) => {
    if (status === undefined || status === reported) return;
    reported = status;
    onLoadingStatusChange?.(status);
  };
  // A hydrated island hears the status the image already had.
  onMount(() => report((image()?.parentElement as AvatarElement | null)?.status));
  return (
    <img
      {...rest}
      ref={image}
      data-loading
      on:loadingstatuschange={batched((event: CustomEvent<AvatarLoadingStatusChangeDetail>) =>
        report(event.detail.status),
      )}
    />
  );
}

/** What shows until the image has loaded: initials or an icon, in a `<span data-fallback>`. */
function Fallback({ delay, style, children, ...rest }: AvatarFallbackProps) {
  return (
    <span
      {...rest}
      data-fallback
      style={
        delay ? withStyle(style, { "--lu-avatar-delay": `${delay}ms` } as JSX.CSSProperties) : style
      }
    >
      {children}
    </span>
  );
}

/**
 * An image with a fallback, after Base UI's Avatar: Root, Image and Fallback. A 0.5 kB script
 * follows the image's loading status.
 *
 * @example
 * <Avatar.Root class="lu-avatar">
 *   <Avatar.Image src="/people/ada.jpg" alt="Ada Lovelace" />
 *   <Avatar.Fallback delay={600}>AL</Avatar.Fallback>
 * </Avatar.Root>
 */
export const Avatar = { Root, Image, Fallback };
