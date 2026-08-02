import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { AnalyticsConsent } from "@/components/analytics-consent";
import { getDictionary } from "@/lib/i18n";
import { legalInfo } from "@/lib/legal-info";
import { resolveLocale } from "@/server/locale";
import "./globals.css";

export const metadata: Metadata = {
  // Required for openGraph and opengraph-image to emit absolute URLs.
  metadataBase: new URL(legalInfo.serviceUrl),
  title: { default: "StoryCanon", template: "%s | StoryCanon" },
  description: "Private story memory for ChatGPT-powered writing.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await resolveLocale();

  return (
    <html lang={locale}>
      <body className="flex min-h-screen flex-col">
        <SiteHeader />
        <div className="flex-1">{children}</div>
        <SiteFooter />
        <AnalyticsConsent gaId={legalInfo.gaMeasurementId} t={getDictionary(locale).consent} />
      </body>
    </html>
  );
}
