import type { LinkProps } from "@bench/react-ui";
import { Link } from "react-router";

/** The shared components' `Link` prop: React Router's client-side `<Link>`. */
export function AppLink({ href, ...props }: LinkProps) {
  return <Link to={href} {...props} />;
}
