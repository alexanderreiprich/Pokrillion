import { Pokeball } from "./Pokeball";

const LETTERS = ["P", null, "K", "R", "I", "L", "L", "I", "O", "N"] as const;

/** Big wordmark "POKRILLION" (the first O is a Poké Ball) with bobbing letters, like Krillion's title. */
export function Logo({ tagline }: { tagline: string }) {
  return (
    <div className="flex flex-col items-center text-center">
      <h1 className="animate-flicker chroma flex items-center text-[clamp(52px,15vw,112px)] leading-[0.9] tracking-[0.04em]">
        {LETTERS.map((letter, i) => (
          <span
            key={i}
            aria-hidden
            className="animate-bob inline-block"
            style={{ animationDelay: `${-i * 0.22}s` }}
          >
            {letter ?? (
              <Pokeball
                size="0.62em"
                className="mx-[0.04em] [filter:drop-shadow(-3px_2px_0_var(--color-ball-red))_drop-shadow(3px_-2px_0_rgb(77_227_255/0.85))]"
              />
            )}
          </span>
        ))}
        <span className="sr-only">Pokrillion</span>
      </h1>
      <p className="glow mt-2 text-[clamp(17px,5vw,26px)] tracking-[0.3em] text-moonlight uppercase">{tagline}</p>
    </div>
  );
}
