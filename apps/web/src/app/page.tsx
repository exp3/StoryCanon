import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AiSection } from "@/components/landing/ai-section";
import { AudienceSection } from "@/components/landing/audience-section";
import { CtaSection } from "@/components/landing/cta-section";
import { FlowSection } from "@/components/landing/flow-section";
import { FrameworkSection } from "@/components/landing/framework-section";
import { Hero } from "@/components/landing/hero";
import { PolicySection } from "@/components/landing/policy-section";
import { PricingSection } from "@/components/landing/pricing-section";
import { SoloSection } from "@/components/landing/solo-section";
import { getDictionary, localeTag, type Locale } from "@/lib/i18n";
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
      <Hero t={t} />
      <AudienceSection t={t.audience} />
      <FrameworkSection t={t.framework} />
      <AiSection t={t.ai} />
      <SoloSection t={t.solo} />
      <FlowSection t={t.flow} />
      <PricingSection t={t.pricing} settings={dictionary.settings} locale={locale} />
      <PolicySection t={t.policy} />
      <CtaSection t={t.cta} />
    </main>
  );
}
