import type { MetadataRoute } from "next";
import { legalInfo } from "@/lib/legal-info";

const base = legalInfo.serviceUrl;

/** Matches the hreflang set emitted by the landing page's generateMetadata. */
const landingLanguages = {
  ja: `${base}/ja`,
  en: `${base}/en`,
  "x-default": base,
};

// Japanese-only pages, so no alternates. Their content changes when the legal
// facts do, which is what legalInfo.lastUpdated tracks.
const japaneseOnlyPaths = [
  "/legal/tokushoho",
  "/legal/terms",
  "/legal/privacy",
  "/legal/refund",
  "/legal/cookies",
  "/legal/security",
  "/contact",
];

/**
 * Served at /sitemap.xml.
 *
 * `/` is deliberately absent as an entry of its own: it renders in whichever
 * language the visitor's cookie or Accept-Language implies and canonicalises to
 * `/ja` or `/en`, so only those two belong here. `/` still appears as the
 * x-default alternate.
 *
 * changeFrequency and priority are omitted on purpose — Google ignores both,
 * and guessing at them would only add noise.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const legalLastModified = new Date(legalInfo.lastUpdated);

  return [
    { url: `${base}/ja`, alternates: { languages: landingLanguages } },
    { url: `${base}/en`, alternates: { languages: landingLanguages } },
    ...japaneseOnlyPaths.map((path) => ({
      url: `${base}${path}`,
      lastModified: legalLastModified,
    })),
  ];
}
