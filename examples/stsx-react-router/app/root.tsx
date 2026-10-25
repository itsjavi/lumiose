import { Links, Meta, NavLink, Outlet, Scripts, ScrollRestoration } from "react-router";
import { Shell } from "./components/Shell.stsx";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>stsx + React Router</title>
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <Shell
      nav={
        <>
          <NavLink to="/">Home</NavLink>
          <NavLink to="/about">About</NavLink>
        </>
      }
    >
      <Outlet />
    </Shell>
  );
}
