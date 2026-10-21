import type { ReactNode } from "react";

/** Dark card with an uppercase eyebrow and the in-game blinking ▼ "continue" arrow. */
export function DialogBox({
  children,
  label,
  arrow = true,
  className = "",
}: {
  children: ReactNode;
  label?: ReactNode;
  arrow?: boolean;
  className?: string;
}) {
  return (
    <div className={`panel animate-card-in px-[18px] pt-4 pb-3.5 ${className}`}>
      {label && <p className="mb-1.5 text-sm tracking-[0.32em] text-ball-red uppercase">{label}</p>}
      {children}
      {arrow && (
        <span aria-hidden className="animate-blink absolute right-3 bottom-1.5 text-base text-ball-red">
          ▼
        </span>
      )}
    </div>
  );
}
