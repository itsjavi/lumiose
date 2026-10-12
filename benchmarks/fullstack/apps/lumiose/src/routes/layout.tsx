// Root layout: every page renders on each request (doc-4 §1), inside the shared shell.
import "@bench/ui-css/tracker.css";
import { Title, locals, type LayoutProps } from "lumiose";
import { AppShell } from "../components/layout.tsx";
import { listProjects } from "../server/data.ts";

export const mode = "server";

export default function Layout(props: LayoutProps<"/">) {
  return (
    <AppShell projects={listProjects()} user={locals().user}>
      <Title>Tracker</Title>
      {props.children}
    </AppShell>
  );
}
