# React Router

> In React Router's framework mode, components can be `.stsx` files: their CSS is linked per route in server-rendered HTML, in dev and production. Route modules stay `.tsx` files that render those components.

```ts
// vite.config.ts
import { reactRouter } from "@react-router/dev/vite";
import stsx from "@lumiose/stsx";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [stsx({ classAttribute: "className" }), reactRouter()],
});
```

## Route modules are `.tsx`

React Router finds a route module by the file path in `routes.ts`, and strips its server-only
exports (`loader`, `action`) from the client build. It does that only for files it compiles
itself, so a route module cannot be a `.stsx` file. The plugin stops the build, and dev server
rendering, with an error that says so. It spots a route module in two ways: a `.stsx` file that
exports a route-only name (`loader`, `action`, `clientLoader`, `clientAction`, `middleware`,
`clientMiddleware` or `HydrateFallback`), and one that React Router imports as a route. Keep the
route in `.tsx`, and put the markup and its styles in a `.stsx` component:

```tsx
// app/routes/about.tsx
import { AboutCard } from "../components/AboutCard.stsx";
import type { Route } from "./+types/about";

export function loader() {
  return { message: "Hello from the loader" };
}

export default function About({ loaderData }: Route.ComponentProps) {
  return <AboutCard message={loaderData.message} />;
}
```

```tsx
// app/components/AboutCard.stsx
export function AboutCard({ message }: { message: string }) {
  return (
    <section className="about">
      <h1>About</h1>
      <p className="message">{message}</p>
    </section>
  );
}

<style>
  .about { padding: 20px; border-radius: 14px; background: #d1fae5; }
  .message { font-style: italic; }
</style>
```

`root.tsx` can render `.stsx` components too: a layout shell, a navigation bar.

## CSS per route

- **Production.** Each route's stylesheet holds the CSS of the `.stsx` components it imports.
  React Router links it in the route's server-rendered `<head>`, and client navigations load it
  before the route renders.
- **Dev.** React Router's critical CSS includes the `.stsx` styles, so pages do not flash
  unstyled. An edit inside a `<style>` block hot-replaces the stylesheet alone, once per save.
- **Styling a `NavLink` or `Link`.** It renders its `<a>` in your component's markup, but as
  another component's element: reach it with `:deep()`, as in `nav :deep(a.active)`, or use the
  class strategy so the scope travels with its `className`.

## Types

React Router's route types and the `.stsx` shadows share `rootDirs`:

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "rootDirs": [".", "./.react-router/types", ".lumiose/stsx"],
  },
  "include": ["app", ".react-router/types", ".lumiose/stsx"],
}
```

```sh
stsx typegen && react-router typegen && tsc
```
