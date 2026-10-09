import "@bench/ui-css/tracker.css";
import { listProjects } from "@bench/data";
import { AppShell, BenchReady, LogoutButton, NotFound, PageTitle } from "@bench/react-ui";
import type { ReactNode } from "react";
import {
  Form,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
  useRouteLoaderData,
} from "react-router";
import type { Route } from "./+types/root";
import { AppLink } from "./lib/link";
import { getUser } from "./lib/session.server";

export function loader({ request }: Route.LoaderArgs) {
  return { projects: listProjects(), user: getUser(request) };
}

export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <BenchReady />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const data = useRouteLoaderData<typeof loader>("root");
  return (
    <AppShell
      Link={AppLink}
      projects={data?.projects ?? []}
      user={data?.user}
      logout={
        <Form method="post" action="/logout" className="logout-form">
          <LogoutButton />
        </Form>
      }
    >
      {children}
    </AppShell>
  );
}

export default function App() {
  return (
    <Shell>
      <Outlet />
    </Shell>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  if (isRouteErrorResponse(error) && error.status === 404) {
    return (
      <Shell>
        <title>Not found · Tracker</title>
        <NotFound Link={AppLink} />
      </Shell>
    );
  }
  console.error(error);
  return (
    <Shell>
      <PageTitle>Something went wrong</PageTitle>
      <p className="muted">
        {isRouteErrorResponse(error) ? `${error.status} ${error.statusText}` : "Unexpected error"}
      </p>
    </Shell>
  );
}
