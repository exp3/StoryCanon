import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AiSection } from "@/components/landing/ai-section";
import { AudienceSection } from "@/components/landing/audience-section";
import { CtaSection } from "@/components/landing/cta-section";
import { FaqSection } from "@/components/landing/faq-section";
import { FrameworkSection } from "@/components/landing/framework-section";
import { Hero } from "@/components/landing/hero";
import { PolicySection } from "@/components/landing/policy-section";
import { PricingSection } from "@/components/landing/pricing-section";
import { SoloSection } from "@/components/landing/solo-section";
import { getDictionary, localeTag, type Locale } from "@/lib/i18n";
import { legalInfo } from "@/lib/legal-info";
import { PLAN_LIMITS } from "@/lib/plan-limits";
import { resolveLocale } from "@/server/locale";
import { getSessionUser } from "@/server/session";

/** `/`, `/ja` and `/en` all render this page; the locale decides the canonical. */
function canonicalFor(locale: Locale) {
  return locale === "ja" ? "/ja" : "/en";
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveLocale();
  const t = getDictionary(locale).landing.meta;

  return {
    title: t.title,
    description: t.description,
    alternates: {
      canonical: canonicalFor(locale),
      // The cookie-switched `/` is the x-default; `/ja` and `/en` are the
      // crawlable per-language URLs the middleware rewrites onto it.
      languages: { ja: "/ja", en: "/en", "x-default": "/" },
    },
    openGraph: {
      type: "website",
      siteName: "StoryCanon",
      url: canonicalFor(locale),
      title: t.title,
      description: t.description,
      // Open Graph wants en_US / ja_JP; localeTag returns the BCP 47 hyphen
      // form because it also feeds toLocaleString.
      locale: localeTag(locale).replace("-", "_"),
    },
    twitter: { card: "summary_large_image", title: t.title, description: t.description },
  };
}

export default async function HomePage() {
  const user = await getSessionUser();
  if (user) {
    redirect("/dashboard");
  }

  const locale = await resolveLocale();
  const dictionary = getDictionary(locale);
  const t = dictionary.landing;

  return (
    <main className="bg-[#f7f7f4] text-[#1d1d1b]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData(locale)) }} />
      <Hero t={t} />
      <AudienceSection t={t.audience} />
      <FrameworkSection t={t.framework} />
      <AiSection t={t.ai} />
      <SoloSection t={t.solo} />
      <PricingSection t={t.pricing} settings={dictionary.settings} locale={locale} />
      <FaqSection t={t.faq} />
      <PolicySection t={t.policy} />
      <CtaSection t={t.cta} />
    </main>
  );
}

/**
 * SoftwareApplication + FAQPage, emitted as one @graph.
 *
 * The FAQ entries are read from the same dictionary the section renders, so the
 * markup cannot drift from the visible answers — which is the thing search
 * engines penalise.
 */
function structuredData(locale: Locale) {
  const t = getDictionary(locale).landing;
  const url = `${legalInfo.serviceUrl}${canonicalFor(locale)}`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        name: "StoryCanon",
        url,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        inLanguage: localeTag(locale),
        description: t.meta.description,
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
          description: `Free plan: ${PLAN_LIMITS.FREE.projects} works`,
        },
      },
      {
        "@type": "FAQPage",
        inLanguage: localeTag(locale),
        mainEntity: t.faq.items.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: { "@type": "Answer", text: item.a },
        })),
      },
    ],
  };
}
