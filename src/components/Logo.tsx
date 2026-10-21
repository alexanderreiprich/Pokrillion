import { Pokeball } from "./Pokeball";

/** Wordmark "POKRILLION" with the O drawn as a Poké Ball. */
export function Logo({ tagline }: { tagline: string }) {
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <h1 className="font-display flex items-center text-5xl tracking-wide text-moon drop-shadow-[0_3px_0_var(--color-ball-red-dark)] sm:text-6xl">
        <span>P</span>
        <Pokeball size={40} className="mx-0.5 translate-y-0.5 sm:h-12 sm:w-12" />
        <span>KRILLION</span>
        <span className="sr-only">Pokrillion</span>
      </h1>
      <p className="text-xl text-drift">{tagline}</p>
    </div>
  );
}
