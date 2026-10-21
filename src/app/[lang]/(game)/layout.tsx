import type { ReactNode } from "react";

/** Player-facing pages: a narrow, phone-sized column. */
export default function GameLayout({ children }: { children: ReactNode }) {
  return <div className="mx-auto flex w-full max-w-md flex-1 flex-col">{children}</div>;
}
