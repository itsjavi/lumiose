import "@bench/ui-css/tracker.css";
import { MetaProvider } from "@solidjs/meta";
import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { Suspense } from "solid-js";
import { BenchReady } from "./components/bench-ready.tsx";
import { AppShell } from "./components/layout.tsx";

export default function App() {
  return (
    <Router
      root={(props) => (
        <MetaProvider>
          <Suspense>
            <AppShell>{props.children}</AppShell>
            {/* Inside the boundary, so it runs once the page (a lazy route) has hydrated. */}
            <BenchReady />
          </Suspense>
        </MetaProvider>
      )}
    >
      <FileRoutes />
    </Router>
  );
}
