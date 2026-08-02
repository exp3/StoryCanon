import Link from "next/link";
import { getDictionary, type Dictionary } from "@/lib/i18n";
import { legalInfo } from "@/lib/legal-info";
import { resolveLocale } from "@/server/locale";

// The pages themselves are Japanese legal documents; only the labels are
// localized, and the English footer says so.
function linksFor(t: Dictionary["footer"]) {
  return [
    { href: "/legal/tokushoho", label: t.tokushoho },
    { href: "/legal/terms", label: t.terms },
    { href: "/legal/privacy", label: t.privacy },
    { href: "/legal/refund", label: t.refund },
    { href: "/legal/cookies", label: t.cookies },
    { href: "/legal/security", label: t.security },
    { href: "/contact", label: t.contact },
  ];
}

export async function SiteFooter() {
  const t = getDictionary(await resolveLocale()).footer;

  return (
    <footer className="border-t border-[#dedbd2] bg-[#f7f7f4]">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-[#4b4b45]">
          {linksFor(t).map((link) => (
            <Link key={link.href} className="hover:underline" href={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>
        {t.legalLanguageNote ? (
          <p className="mt-4 text-xs text-[#6b6b63]">{t.legalLanguageNote}</p>
        ) : null}
        <p className="mt-6 text-xs text-[#6b6b63]">
          © {new Date().getFullYear()} {legalInfo.serviceName}
        </p>
      </div>
    </footer>
  );
}
