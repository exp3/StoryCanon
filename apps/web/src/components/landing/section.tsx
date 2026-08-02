/**
 * Shared shell for the landing page sections: the hairline top rule, the page
 * gutter, and the heading/lead intro block. Ported from the `.wrap`,
 * `.section`, `.section-intro` and `.quiet` rules of the original static LP.
 */
export function LandingSection({
  id,
  heading,
  lead,
  tone = "paper",
  children,
}: {
  id?: string;
  heading: string;
  lead?: string;
  tone?: "paper" | "warm";
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={`scroll-mt-4 border-t border-[#dedbd2] ${tone === "warm" ? "bg-[#f0eee7]" : ""}`}>
      <div className="mx-auto w-full max-w-6xl px-6 py-16 md:py-24">
        <div className="mb-10 max-w-2xl md:mb-14">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight md:text-[2.5rem]">{heading}</h2>
          {lead ? <p className="mt-4 leading-8 text-[#5d5d57]">{lead}</p> : null}
        </div>
        {children}
      </div>
    </section>
  );
}

/** Small caps label used above the sub-groups inside a section. */
export function LandingSubheading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-4 text-xs font-bold uppercase tracking-[0.1em] text-[#46605a]">{children}</h3>
  );
}

/** Bordered off-white card, the repeating unit of most sections. */
export function LandingCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <article className={`border border-[#dedbd2] bg-white/60 p-6 ${className}`}>{children}</article>
  );
}
