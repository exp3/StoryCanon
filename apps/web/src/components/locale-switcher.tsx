import type { Dictionary, Locale } from "@/lib/i18n";

/**
 * Plain links, not a form: `/ja` and `/en` are real crawlable URLs and the
 * middleware persists the choice as a cookie on the way through. That keeps
 * the landing page free of client-side JavaScript entirely.
 */
export function LocaleSwitcher({ current, t }: { current: Locale; t: Dictionary["landing"]["switcher"] }) {
  const options = [
    { locale: "ja" as const, href: "/ja", label: t.ja },
    { locale: "en" as const, href: "/en", label: t.en },
  ];

  return (
    <nav aria-label="Language" className="flex items-center gap-2 text-xs text-[#5d5d57]">
      {options.map((option, i) => (
        <span key={option.locale} className="flex items-center gap-2">
          {i > 0 ? <span aria-hidden className="text-[#c9c6bc]">/</span> : null}
          <a
            aria-current={current === option.locale ? "true" : undefined}
            className={current === option.locale ? "font-bold text-[#1d1d1b]" : "hover:text-[#1d1d1b]"}
            hrefLang={option.locale}
            href={option.href}
          >
            {option.label}
          </a>
        </span>
      ))}
    </nav>
  );
}
