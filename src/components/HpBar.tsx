/** The question timer, styled as a battle HP bar: green → yellow → red. */
export function HpBar({ value, label }: { value: number; label: string }) {
  const v = Math.min(1, Math.max(0, value));
  const color = v > 0.5 ? "var(--color-hp-high)" : v > 0.2 ? "var(--color-hp-mid)" : "var(--color-hp-low)";
  return (
    <div className="flex items-center gap-2" role="timer" aria-label={label}>
      <span className="rounded-sm bg-night-950 px-1 text-lg leading-none text-electric">{label}</span>
      <div className="h-3 flex-1 rounded-sm border-2 border-night-950 bg-night-800 p-px">
        <div
          className="h-full rounded-[1px] transition-[width,background-color] duration-300 ease-linear"
          style={{ width: `${v * 100}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
