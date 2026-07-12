import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { AnalyticsConsent } from "@/components/analytics-consent";
import { legalInfo } from "@/lib/legal-info";
import { getSessionUser } from "@/server/session";
import "./globals.css";

export const metadata: Metadata = {
  title: "StoryCanon",
  description: "Private story memory for ChatGPT-powered writing.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  const locale = user?.locale ?? "en";

  return (
    <html lang={locale}>
      <body className="flex min-h-screen flex-col">
        <SiteHeader />
        <div className="flex-1">{children}</div>
        <SiteFooter />
        <AnalyticsConsent gaId={legalInfo.gaMeasurementId} />
      </body>
    </html>
  );
}
