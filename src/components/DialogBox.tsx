import type { ReactNode } from "react";

/** In-game style text box with the blinking ▼ "continue" arrow. */
export function DialogBox({ children, arrow = true }: { children: ReactNode; arrow?: boolean }) {
  return (
    <div className="dialog-box relative px-5 py-4 text-2xl leading-tight">
      {children}
      {arrow && (
        <span aria-hidden className="animate-blink absolute right-3 bottom-1 text-base text-ball-red">
          ▼
        </span>
      )}
    </div>
  );
}
