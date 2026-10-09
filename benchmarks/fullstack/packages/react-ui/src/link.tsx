import type { ComponentType, ReactNode } from "react";

export interface LinkProps {
  href: string;
  className?: string;
  rel?: string;
  children?: ReactNode;
  "data-testid"?: string;
}

/**
 * Components that render links take the app's router link (`next/link`, or a
 * React Router `<Link to>` adapter), so navigation stays idiomatic per framework.
 */
export type LinkComponent = ComponentType<LinkProps>;

/** A plain anchor, for links that should do a full document navigation. */
export function Anchor(props: LinkProps) {
  return <a {...props} />;
}
