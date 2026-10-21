import type { ReactNode } from "react";
import { Pokeball } from "@/components/Pokeball";

/** Full-height loading screen: a bobbing ball and a pulsing caption. */
export function Boot({ label }: { label: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
      <span className="animate-boot drop-shadow-[0_0_12px_rgb(255_77_94/0.45)]">
        <Pokeball size={64} />
      </span>
      <p className="animate-pulse-soft text-base tracking-[0.3em] text-drift uppercase">{label}</p>
    </div>
  );
}

/** Full-height error screen with an action below the message. */
export function BootError({ message, children }: { message: string; children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 py-16 text-center">
      <span className="opacity-60 grayscale">
        <Pokeball size={64} />
      </span>
      <p className="max-w-[40ch] text-lg tracking-[0.04em] text-drift">{message}</p>
      {children}
    </div>
  );
}
