"use client";

import { SearchBox as SharedSearchBox } from "@bench/react-ui";
import { AppLink } from "../lib/link";

/** The shared search box with Next.js links for its suggestions. */
export function SearchBox({ defaultValue }: { defaultValue: string }) {
  return <SharedSearchBox defaultValue={defaultValue} Link={AppLink} />;
}
