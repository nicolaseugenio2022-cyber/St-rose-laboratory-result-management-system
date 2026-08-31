import React from "react";
import Link from "next/link";

export interface SectionLinkProps {
  href: string;
  children: React.ReactNode;
}

/**
 * The "view all" control in a DashboardSection header.
 *
 * Extracted because all three compositions had retyped the same eight-class
 * string, and they had already drifted: a focus treatment that lives in three
 * places is a focus treatment that will be corrected in one of them.
 *
 * Padding rather than a bare text link: at text-[11px] the unpadded anchor was a
 * ~15px tall target. The negative margin keeps it optically flush with the
 * heading it sits beside, so the larger target costs no layout.
 */
export function SectionLink({ href, children }: SectionLinkProps) {
  return (
    <Link
      href={href}
      className="-mx-1 inline-flex items-center rounded px-1 py-1.5 text-[11px] font-semibold text-brand-primary transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
    >
      {children}
    </Link>
  );
}
