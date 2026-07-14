// import Link from "next/link";
import { legalInfo } from "@/lib/legal-info";

/* const links: { href: string; label: string }[] = [
  { href: "/legal/tokushoho", label: "特定商取引法に基づく表記" },
  { href: "/legal/terms", label: "利用規約" },
  { href: "/legal/privacy", label: "プライバシーポリシー" },
  { href: "/legal/refund", label: "返金・キャンセルポリシー" },
  { href: "/legal/cookies", label: "Cookieポリシー" },
  { href: "/legal/security", label: "セキュリティ" },
  { href: "/contact", label: "お問い合わせ" },
]; */

export function SiteFooter() {
  return (
    <footer className="border-t border-[#dedbd2] bg-[#f7f7f4]">
      <div className="mx-auto max-w-6xl px-6 py-8">
        {/* <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-[#4b4b45]">
          {links.map((link) => (
            <Link key={link.href} className="hover:underline" href={link.href}>
              {link.label}
            </Link>
          ))}
        </nav> */}
        <p className="mt-6 text-xs text-[#6b6b63]">
          © {new Date().getFullYear()} {legalInfo.serviceName}
        </p>
      </div>
    </footer>
  );
}
