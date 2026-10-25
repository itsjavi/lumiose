import { AboutCard } from "../components/AboutCard.stsx";
import type { Route } from "./+types/about";

export function loader() {
  return { message: "A .tsx route module rendering a .stsx view component." };
}

export default function About({ loaderData }: Route.ComponentProps) {
  return <AboutCard message={loaderData.message} />;
}
