import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StoryCanon",
  description: "Private story memory for ChatGPT-powered writing.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
