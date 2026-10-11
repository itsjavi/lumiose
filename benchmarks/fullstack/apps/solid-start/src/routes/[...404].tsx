import { NotFoundPage } from "../components/not-found-page.tsx";

// Catch-all route: every unknown URL renders the 404 page inside the layout.
export default function NotFoundRoute() {
  return <NotFoundPage />;
}
