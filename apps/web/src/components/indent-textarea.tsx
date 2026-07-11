"use client";

import { useRef, useState } from "react";

const INDENT = "　"; // full-width space (全角スペース)
// Lines opening with these characters are conventionally left un-indented in
// Japanese web novels (dialogue / parenthetical lines).
const NO_INDENT_HEADS = ["「", "『", "（", "(", "〈", "《", "【", "〔", "―", "─", INDENT];

function shouldIndent(line: string) {
  if (line.trim() === "") return false;
  return !NO_INDENT_HEADS.some((head) => line.startsWith(head));
}

function normalizeIndent(text: string) {
  return text
    .split("\n")
    .map((line) => (shouldIndent(line) ? INDENT + line : line))
    .join("\n");
}

type Props = {
  name: string;
  defaultValue?: string;
  required?: boolean;
  className?: string;
  formatLabel: string;
  hint?: string;
};

export function IndentTextarea({ name, defaultValue = "", required, className, formatLabel, hint }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState(defaultValue);

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.nativeEvent.isComposing || event.shiftKey) return;
    const el = event.currentTarget;
    const { selectionStart, selectionEnd, value: current } = el;
    // Determine the line the caret is on so we don't indent after a blank or
    // dialogue line (mirrors the format button behaviour).
    const lineStart = current.lastIndexOf("\n", selectionStart - 1) + 1;
    const currentLine = current.slice(lineStart, selectionStart);
    const insert = shouldIndent(currentLine) ? "\n" + INDENT : "\n";

    event.preventDefault();
    const next = current.slice(0, selectionStart) + insert + current.slice(selectionEnd);
    setValue(next);
    const caret = selectionStart + insert.length;
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = caret;
    });
  }

  function handleFormat() {
    const next = normalizeIndent(value);
    setValue(next);
    ref.current?.focus();
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3">
        {hint ? <span className="text-xs text-[#777]">{hint}</span> : <span />}
        <button
          type="button"
          onClick={handleFormat}
          className="rounded border px-2 py-1 text-xs text-[#4b4b45] hover:bg-[#f2efe6]"
        >
          {formatLabel}
        </button>
      </div>
      <textarea
        ref={ref}
        name={name}
        required={required}
        className={className}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
}
