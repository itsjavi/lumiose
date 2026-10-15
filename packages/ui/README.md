# @lumiose/ui

Accessible, unstyled UI primitives for [Lumiose](https://github.com/itsjavi/lumiose): native
elements first (`<dialog>`, popover, invoker commands, CSS anchor positioning), light-DOM custom
elements (`lu-*`) only where the platform falls short, server-rendered without hydration. Parts
follow [Base UI](https://base-ui.com)'s anatomy; the approach is [Timeless](https://timeless.build)'s.

**In development**: not on npm yet. It keeps its own 0.x versions, apart from the version the other
Lumiose packages share.

```tsx
import { Dialog } from "@lumiose/ui";
import "@lumiose/ui/styles.css"; // only the CSS the components need to work (`lu.core` layer)
import "@lumiose/ui/themes/default.css"; // optional look: `--lu-` custom properties, light and dark

<Dialog.Root role="alertdialog">
  <Dialog.Trigger class="lu-button">Delete project…</Dialog.Trigger>
  <Dialog.Popup class="lu-dialog">
    <Dialog.Title>Delete project?</Dialog.Title>
    <Dialog.Description>This removes the project and its deployments.</Dialog.Description>
    <footer>
      <Dialog.Close class="lu-button" value="cancel">
        Cancel
      </Dialog.Close>
      <Dialog.Close class="lu-button" data-variant="destructive" value="delete">
        Delete
      </Dialog.Close>
    </footer>
  </Dialog.Popup>
</Dialog.Root>;
```

The package ships its `.tsx` and `.css` sources, which the app's Lumiose compiler compiles for the
server and the browser. Docs: `lumiose docs ui` (`packages/lumiose/docs/ui/`).

- `pnpm --filter @lumiose/ui test`: unit tests (server rendering and the DOM, Vitest).
- `pnpm --filter @lumiose/ui size`: JavaScript and CSS per component.
- `pnpm --filter @lumiose-examples/ui-e2e test:e2e`: keyboard contracts, focus, axe and behaviour
  without JavaScript, in Chromium.
