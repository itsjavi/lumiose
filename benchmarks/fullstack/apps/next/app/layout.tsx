import "@bench/ui-css/tracker.css";
import { listProjects } from "@bench/data";
import { AppShell, BenchReady, LogoutButton } from "@bench/react-ui";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { logout } from "./actions";
import { AppLink } from "./lib/link";
import { currentUser } from "./lib/session";

export const metadata: Metadata = { title: "Tracker" };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const user = await currentUser();
  return (
    <html lang="en">
      <body>
        <AppShell
          Link={AppLink}
          projects={listProjects()}
          user={user}
          logout={
            <form action={logout} className="logout-form">
              <LogoutButton />
            </form>
          }
        >
          {children}
        </AppShell>
        <BenchReady />
      </body>
    </html>
  );
}
