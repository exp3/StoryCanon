import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
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
      <body>
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
