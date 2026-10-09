import type { LinkProps } from "@bench/react-ui";
import Link from "next/link";

/** The shared components' `Link` prop: Next.js's client-side `<Link>`. */
export function AppLink(props: LinkProps) {
  return <Link {...props} />;
}
