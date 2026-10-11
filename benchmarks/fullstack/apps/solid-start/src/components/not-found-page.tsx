import { Title } from "@solidjs/meta";
import { HttpStatusCode } from "@solidjs/start";
import { NotFound } from "./layout.tsx";

/** The 404 page inside the layout, with status 404 (unknown URLs, projects and issues). */
export function NotFoundPage() {
  return (
    <>
      <Title>Not found · Tracker</Title>
      <HttpStatusCode code={404} />
      <NotFound />
    </>
  );
}
