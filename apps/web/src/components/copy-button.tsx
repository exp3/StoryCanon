"use client";

import { useState } from "react";

export function CopyButton({ value, className }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className={className ?? "rounded border border-[#dedbd2] px-3 py-1 text-xs text-[#1d1d1b]"}
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? "コピーしました" : "コピー"}
    </button>
  );
}
