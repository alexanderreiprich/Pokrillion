"use client";

import { useState } from "react";

export function CopyButton({ text, label, copiedLabel }: { text: string; label: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // clipboard blocked – the text is selectable anyway
        }
      }}
      className="rounded-sm border-2 border-line px-2 text-base text-moonlight hover:border-moonlight"
    >
      {copied ? copiedLabel : label}
    </button>
  );
}
