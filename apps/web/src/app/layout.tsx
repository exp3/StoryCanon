import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

export const metadata: Metadata = {
  title: "StoryCanon",
  description: "Private story memory for ChatGPT-powered writing.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
