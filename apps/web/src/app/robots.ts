import type { MetadataRoute } from "next";
import { legalInfo } from "@/lib/legal-info";

/**
 * Served at /robots.txt.
 *
 * Everything behind authentication is disallowed to save crawl budget — those
 * routes only ever redirect a crawler to /login. /login itself is excluded for
 * the same reason: it is a thin page with nothing to rank.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/admin", "/dashboard", "/projects", "/settings", "/onboarding", "/login"],
    },
    sitemap: `${legalInfo.serviceUrl}/sitemap.xml`,
  };
}
