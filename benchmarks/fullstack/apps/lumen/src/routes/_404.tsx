// Unknown URLs and notFound(): rendered inside the root layout with status 404.
import { Title } from "lumen";
import { NotFound, ReadyScript } from "../components/layout.tsx";

export default function NotFoundPage() {
  return (
    <>
      <Title>Not found · Tracker</Title>
      <NotFound />
      <ReadyScript />
    </>
  );
}
