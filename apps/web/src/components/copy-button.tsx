"use client";

import { useState } from "react";

const defaultClassName = "rounded border border-[#dedbd2] px-3 py-1 text-xs text-[#1d1d1b]";
/** Fallback labels (Japanese) so existing call sites keep working without a `labels` prop. */
const defaultLabels: CopyLabels = { copy: "コピー", copied: "コピーしました" };

export type CopyLabels = { copy: string; copied: string };

/** Writes text to the clipboard. Returns whether anything was copied. */
async function writeClipboard(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

type CommonProps = {
  className?: string;
  /** Localized labels. Defaults to Japanese for backward compatibility. */
  labels?: CopyLabels;
};

export function CopyButton({ value, className, labels = defaultLabels }: CommonProps & { value: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className={className ?? defaultClassName}
      onClick={async () => {
        if (!(await writeClipboard(value))) return;
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? labels.copied : labels.copy}
    </button>
  );
}

/**
 * Copies the current value of a form field (input/textarea/select) identified by `targetId`.
 * Reads the live DOM value so edits made before saving are included.
 */
export function FieldCopyButton({ targetId, className, labels = defaultLabels }: CommonProps & { targetId: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className={className ?? defaultClassName}
      onClick={async () => {
        const el = document.getElementById(targetId) as
          | HTMLInputElement
          | HTMLTextAreaElement
          | HTMLSelectElement
          | null;
        if (!el) return;
        if (!(await writeClipboard(el.value))) return;
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? labels.copied : labels.copy}
    </button>
  );
}
