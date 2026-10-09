// Root layout: every page renders on each request (doc-4 §1), inside the shared shell.
import "@bench/ui-css/tracker.css";
import { Title, locals } from "lumen";
import { AppShell } from "../components/layout.tsx";
import { listProjects } from "../server/data.ts";

export const mode = "server";

export default function Layout(props: { children?: JSX.Element }) {
  return (
    <AppShell projects={listProjects()} user={locals().user}>
      <Title>Tracker</Title>
      {props.children}
    </AppShell>
  );
}
