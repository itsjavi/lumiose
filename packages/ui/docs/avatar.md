# Avatar

> A person's picture with a fallback, such as their initials, after Base UI's Avatar: the image loads in the server HTML and shows once it has loaded, the fallback shows until then, after an optional delay, and when the image fails. Both sit in one cell, so neither moves the other. A 0.5 kB script follows the image's loading status; without JavaScript an avatar with an image shows the image alone.

```ts
import { Avatar } from "@lumiose/ui"; // or "@lumiose/ui/avatar"
import "@lumiose/ui/avatar.css"; // stacks the image over the fallback; hides each in turn
import "@lumiose/ui/themes/default.css"; // optional: the default theme
```

## Anatomy

```tsx
<Avatar.Root>
  <Avatar.Image />
  <Avatar.Fallback />
</Avatar.Root>
```

| Part       | Renders                                                                                        |
| ---------- | ---------------------------------------------------------------------------------------------- |
| `Root`     | `<lu-avatar>`, an inline grid with one cell, `data-loaded` once the image has loaded.          |
| `Image`    | `<img data-loading>`: `data-loading` while it loads, `data-error` when it failed, both hidden. |
| `Fallback` | `<span data-fallback>`, hidden once the image has loaded.                                      |

The image is the root's `<img>` child; anything else inside, such as a status badge, is yours to
place.

## API

### Avatar.Image

| Prop                    | Type                                                 | Default |                                                                                                                                           |
| ----------------------- | ---------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `onLoadingStatusChange` | `(status: "loading" \| "loaded" \| "error") => void` |         | Called when the loading status changes; `"error"` also when there is no `src`. An island hears the status the image had when it hydrated. |

Every native `<img>` prop passes through: `src`, `srcset`, `sizes`, `alt`, `width`, `height`,
`loading`, `decoding`, `fetchpriority`. A new `src` or `srcset` starts over at `"loading"`.

### Avatar.Fallback

| Prop    | Type     | Default |                                                                                                           |
| ------- | -------- | ------- | --------------------------------------------------------------------------------------------------------- |
| `delay` | `number` | `0`     | How long to wait before showing the fallback, in milliseconds: an image that loads sooner never shows it. |

### The other parts

`Root` and `Fallback` take the props of the element they render (`class`, `style`, `aria-*`,
`data-*`, event handlers) and pass them through. The root element has a `status` property
(`"loading"`, `"loaded"`, `"error"`, or `undefined` without an image), and the image dispatches
`loadingstatuschange` (`event.detail.status`) for `on:loadingstatuschange`.

**Differences from Base UI's Avatar.** The image is always in the page, as with Base UI's
`keepMounted`: it starts loading with the server HTML, supports `loading="lazy"`, and shows without
JavaScript. A missing `src` is `"error"`, not `"idle"`. No `render`.

## Example

Two people in a server-rendered page, with no island: an image that loads, and one that fails and
leaves the initials. The default theme draws the circles.

```tsx check
import { Avatar } from "@lumiose/ui";

// A portrait drawn inline, so the example runs anywhere.
const portrait = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
    <rect width="80" height="80" fill="#c7d2fe"/>
    <circle cx="40" cy="31" r="14" fill="#4338ca"/>
    <path d="M12 80a28 28 0 0 1 56 0z" fill="#4338ca"/>
  </svg>`,
)}`;

export function Reviewers() {
  return (
    <ul aria-label="Reviewers" style={{ display: "flex", gap: "0.5rem", "list-style": "none" }}>
      <li>
        <Avatar.Root class="lu-avatar">
          <Avatar.Image src={portrait} alt="Ada Lovelace" />
          <Avatar.Fallback role="img" aria-label="Ada Lovelace" delay={600}>
            AL
          </Avatar.Fallback>
        </Avatar.Root>
      </li>
      <li>
        <Avatar.Root class="lu-avatar">
          <Avatar.Image src="/avatars/missing.jpg" alt="Grace Hopper" />
          <Avatar.Fallback role="img" aria-label="Grace Hopper">
            GH
          </Avatar.Fallback>
        </Avatar.Root>
      </li>
    </ul>
  );
}
```

In an island, the loading status in a signal, as the picture breaks and comes back:

```tsx check
import { Avatar, type AvatarLoadingStatus } from "@lumiose/ui";
import { signal } from "lumiose";

const portrait = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
    <rect width="80" height="80" fill="#fde68a"/>
    <circle cx="40" cy="31" r="14" fill="#b45309"/>
    <path d="M12 80a28 28 0 0 1 56 0z" fill="#b45309"/>
  </svg>`,
)}`;

export function ProfilePicture() {
  const broken = signal(false);
  const status = signal<AvatarLoadingStatus>("loading");
  return (
    <>
      <Avatar.Root class="lu-avatar">
        <Avatar.Image
          src={broken() ? "/avatars/missing.jpg" : portrait}
          alt=""
          onLoadingStatusChange={(next) => status.set(next)}
        />
        <Avatar.Fallback aria-hidden="true">AL</Avatar.Fallback>
      </Avatar.Root>
      <p>Ada Lovelace (picture: {status()})</p>
      <button type="button" class="lu-button" onClick={() => broken.set(!broken())}>
        {broken() ? "Fix the picture" : "Break the picture"}
      </button>
    </>
  );
}
```

## Styling

**With the default theme**, put `lu-avatar` on `Root`: a 40px circle on a muted surface, the image
covering it, the fallback's initials centred.

**With your own CSS**, give the root a size, so the image loading or failing never changes the
layout, and style the parts through `class`, `[data-loaded]`, `[data-loading]`, `[data-error]` and
`[data-fallback]`:

```css
.avatar {
  place-items: center;
  inline-size: 3rem;
  block-size: 3rem;
  overflow: hidden;
  border-radius: 50%;
  background: #f4f4f5;
}
.avatar > img {
  inline-size: 100%;
  block-size: 100%;
  object-fit: cover;
}
```

`@lumiose/ui/avatar.css`, in the `lu.core` layer, puts the parts in one grid cell, the image above
the fallback, and hides them in turn with `visibility` (so a `loading="lazy"` image still loads):
the image while it loads, where scripting is enabled, and when it failed; the fallback once the
image has loaded. The fallback's `delay` is a zero-length `lu-avatar-delay` animation: an animation
of your own on the fallback replaces it, so list both (`animation: lu-avatar-delay 0s
var(--lu-avatar-delay, 0s) backwards, my-fade 200ms`).

## Keyboard and focus

An avatar takes no focus and has no keys. Name it once:

- **Next to the person's name**, it repeats it: `alt=""` on the image and `aria-hidden="true"` on
  the fallback.
- **Alone**, name both parts, since only one shows at a time: the image's `alt`, and on the
  fallback `role="img"` with an `aria-label`, so the initials are not read letter by letter.

## Without JavaScript, and the client script

The image and the fallback are in the server HTML. Without JavaScript nothing tells a failed image
from a loaded one, so an avatar with an image shows the image alone (the browser's broken-image box
when it fails) and hides its fallback, from sight and from assistive technology, which would name
the avatar twice; an avatar without an image shows its fallback.
`onLoadingStatusChange` needs the component to run in an island.

A page that renders an `Avatar` loads a 0.5 kB (brotli) script, without the Lumiose runtime; an
island loads the same module. `<lu-avatar>` reads the image's state when it connects (a cached image shows
at once), then follows its `load` and `error` events and changes to its `src` and `srcset`. An
image that is complete without a size (an SVG without intrinsic dimensions, or a broken image) is
told apart with `decode()`.

## Browser support

- **The `scripting` media query**, which keeps a loading image hidden only where scripts run:
  Chrome and Edge 120, Firefox 113, Safari 17. Elsewhere a loading image shows as it arrives.
- **CSS grid and `visibility`**: every browser.

## Related

- [UI components](README.md): the approach, styling and the other components.
- [Theming](theming.md): the default theme's classes and custom properties.
