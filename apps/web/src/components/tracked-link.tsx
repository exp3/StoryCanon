"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { track } from "@/lib/analytics";

type TrackedLinkProps = ComponentProps<typeof Link> & {
  /** Which CTA this is, so the landing page's several "start free" buttons can be told apart. */
  event: string;
  location: string;
};

/**
 * A Link that reports its own clicks. The landing page has three separate
 * routes to /login (hero, pricing, closing CTA) and no way to tell which one
 * people actually use.
 */
export function TrackedLink({ event, location, onClick, ...props }: TrackedLinkProps) {
  return (
    <Link
      {...props}
      onClick={(e) => {
        track(event, { location });
        onClick?.(e);
      }}
    />
  );
}
