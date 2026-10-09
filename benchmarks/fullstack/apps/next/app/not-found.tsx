import { NotFound } from "@bench/react-ui";
import type { Metadata } from "next";
import { AppLink } from "./lib/link";

export const metadata: Metadata = { title: "Not found · Tracker" };

export default function NotFoundPage() {
  return <NotFound Link={AppLink} />;
}
