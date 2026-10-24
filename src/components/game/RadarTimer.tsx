/** Share of time left below which the timer turns red and the screen edge throbs. */
export const HOT_SHARE = 0.2;

/** Battle HP colours: green → yellow → red. */
export function hpColor(share: number): string {
  return share > 0.5 ? "var(--color-hp-high)" : share > HOT_SHARE ? "var(--color-hp-mid)" : "var(--color-hp-low)";
}

/** Round "Poké Radar" timer: sweeping scope, seconds in the middle, HP-coloured ring for the time left. */
export function RadarTimer({ remaining, total, label }: { remaining: number; total: number; label: string }) {
  const share = Math.min(1, Math.max(0, remaining / total));
  const hot = share <= HOT_SHARE;
  const color = hpColor(share);

  return (
    <div
      role="timer"
      aria-label={label}
      className="relative h-[58px] w-[58px] flex-none rounded-full p-[3px] shadow-[0_0_0_2px_var(--color-ink),0_0_18px_rgb(77_227_255/0.2)]"
      style={{ background: `conic-gradient(${color} ${share * 360}deg, #12233d 0)` }}
    >
      <div className="relative h-full w-full overflow-hidden rounded-full bg-[radial-gradient(circle,rgb(11_21_38/0.97)_40%,rgb(16_29_51/0.95)_100%)] shadow-[inset_0_0_14px_rgb(77_227_255/0.14)]">
        <div className="absolute inset-[7px] rounded-full border border-moonlight/20" />
        <div
          className={`absolute top-[calc(50%-1px)] left-1/2 h-0.5 w-1/2 origin-left bg-linear-to-r from-moonlight/90 to-transparent shadow-[0_0_8px_rgb(77_227_255/0.8)] ${
            hot ? "animate-sweep-hot" : "animate-sweep"
          }`}
        />
        <span
          className={`absolute inset-0 flex items-center justify-center text-[26px] tabular-nums ${
            hot ? "text-ball-red [text-shadow:0_0_16px_rgb(255_77_94/0.9)]" : "glow text-moonlight"
          }`}
        >
          {Math.ceil(remaining)}
        </span>
      </div>
    </div>
  );
}
