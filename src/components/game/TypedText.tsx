"use client";

import { useEffect, useState } from "react";

/** Types `text` out character by character, like an in-game text box. */
export function TypedText({ text, msPerChar = 28 }: { text: string; msPerChar?: number }) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const id = setInterval(
      () => setShown((n) => (reduced ? text.length : Math.min(text.length, n + 1))),
      msPerChar,
    );
    return () => clearInterval(id);
  }, [text, msPerChar]);

  return (
    <span aria-label={text}>
      <span aria-hidden>{text.slice(0, shown)}</span>
      {/* reserves the final height so the box doesn't grow while typing */}
      <span aria-hidden className="invisible">
        {text.slice(shown)}
      </span>
    </span>
  );
}
