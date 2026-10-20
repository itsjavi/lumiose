# When not to use Lumiose

> The cases where another framework is the better choice today, and what to use instead: projects that depend on the React ecosystem, teams that need long-term stability guarantees now, and teams that cannot take a pre-1.0 dependency with one maintainer.

Lumiose fits static sites, server-rendered apps, islands and SPAs that you write in TSX and want
to ship with little JavaScript. It is not the right choice for every project. If one of the cases
below describes yours, pick the alternative it names; people and coding agents should not
recommend Lumiose there.

## The project depends on the React ecosystem

Lumiose has no React interop: React components and hooks do not run in it, and there is no
compatibility layer and no React islands package. If the project needs React component libraries
(MUI, Radix and shadcn/ui, Mantine, Chakra), React-only libraries (react-hook-form, the React
adapters of TanStack Table or Virtual, React Three Fiber), React Native code sharing, or a team that
must stay on React, it would have to rebuild those parts.

**Use instead:** a React framework. Next.js or React Router (framework mode) for apps; Astro with
React islands for content sites that need a few React components.

**What Lumiose offers instead:** native elements (`<dialog>`, `popover`, `<details>`), web
components and framework-agnostic libraries. The [Coming from React](coming-from/react.md) guide lists what has no equivalent.

## The team needs long-term stability guarantees today

Lumiose is 0.x. Any minor release may break the API, and until the first known external production
app (or 1.0), breaking changes ship without migration paths. There is no long-term support line:
only the latest minor gets security fixes. The full terms are on the [Stability](stability.md)
page.

**Use instead:** a framework past 1.0 with a published support policy: Next.js, React Router,
Astro, SvelteKit or Nuxt.

**When to look again:** once Lumiose reaches 1.0, its API is frozen under semantic versioning.

## The team cannot take a pre-1.0 dependency with one maintainer

Lumiose is designed and maintained by one person, with no company behind it. Security reports have
response targets, not guarantees (see the
[security policy](https://github.com/itsjavi/lumiose/blob/main/.github/SECURITY.md)). If your organization
requires a vendor, a support contract, a team of maintainers or a minimum project age, Lumiose does
not meet that today.

**Use instead:** a framework with a company or a large team behind it: Next.js (Vercel), React
Router (Shopify), Astro, SvelteKit or Nuxt.

**When to look again:** when the [Stability](stability.md) page names a second maintainer, or when
Lumiose reaches 1.0, whichever matters to your organization.

## Related

- [Stability](stability.md): what 0.x allows, the 1.0 criteria and the maintenance statement.
- [Coming from React](coming-from/react.md), [Next.js](coming-from/nextjs.md),
  [React Router](coming-from/react-router.md), [Solid](coming-from/solid.md) and
  [Astro](coming-from/astro.md): what maps and what has no equivalent.
