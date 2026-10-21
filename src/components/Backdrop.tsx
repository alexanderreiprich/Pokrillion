/**
 * Fixed scenery behind every page: moon rays, stars, a pixel moon and tall grass,
 * plus scanlines and a vignette on top. Pure CSS/SVG, no image assets.
 */

const TILE_STEP = 4;
const TILE_HEIGHT = 30;
const PIXEL_SCALE = 3;

/** One tile of pixel grass: stepped blades of the given heights on a thin ground strip. */
function grassTile(heights: number[], fill: string): string {
  let d = "";
  heights.forEach((h, i) => {
    const x = i * TILE_STEP;
    const lean = i % 2;
    const base = Math.round(h * 0.55);
    const mid = Math.round(h * 0.85);
    d += `M${x} ${TILE_HEIGHT - base}h3v${base}h-3z`;
    d += `M${x + lean} ${TILE_HEIGHT - mid}h2v${mid - base}h-2z`;
    d += `M${x + lean * 2} ${TILE_HEIGHT - h}h1v${h - mid}h-1z`;
  });
  const width = heights.length * TILE_STEP;
  d += `M0 ${TILE_HEIGHT - 2}h${width}v2H0z`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${TILE_HEIGHT}" shape-rendering="crispEdges"><path fill="${fill}" d="${d}"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

const BACK_GRASS = grassTile([14, 22, 17, 26, 12, 19, 24, 15, 21, 11, 25, 18, 13, 23, 16, 20], "#0f2a38");
const FRONT_GRASS = grassTile([9, 15, 11, 18, 7, 13, 16, 10, 14, 8, 17, 12], "#050f17");

/** Crescent moon on a 16×16 grid. */
const MOON_PATH = (() => {
  let d = "";
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const lit = Math.hypot(x - 7.5, y - 7.5) <= 7.4 && Math.hypot(x - 10.8, y - 5.2) > 6.6;
      if (lit) d += `M${x} ${y}h1v1h-1z`;
    }
  }
  return d;
})();

/** [left %, top %, size px, delay s] */
const STARS: [number, number, number, number][] = [
  [8, 12, 2, 0], [17, 31, 1, 1.2], [26, 8, 2, 2.1], [38, 22, 1, 0.6], [47, 6, 2, 1.7],
  [56, 27, 1, 2.6], [64, 14, 2, 0.3], [72, 36, 1, 1.4], [83, 24, 2, 2.3], [93, 9, 1, 0.9],
  [12, 44, 1, 2.8], [33, 52, 1, 1.1], [61, 47, 1, 0.2], [88, 50, 1, 1.9],
];

export function Backdrop() {
  return (
    <>
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="moon-rays absolute inset-y-0 -right-[6%] -left-[6%]" />
        {STARS.map(([left, top, size, delay]) => (
          <span
            key={`${left}-${top}`}
            className="animate-twinkle absolute bg-moon/70"
            style={{ left: `${left}%`, top: `${top}%`, width: size * 2, height: size * 2, animationDelay: `${delay}s` }}
          />
        ))}
        <svg
          viewBox="0 0 16 16"
          shapeRendering="crispEdges"
          className="absolute top-14 right-[6%] h-8 w-8 opacity-80 sm:top-24 sm:right-[8%] drop-shadow-[0_0_18px_rgb(77_227_255/0.45)] sm:h-20 sm:w-20"
        >
          <path fill="#e8f1ff" d={MOON_PATH} />
        </svg>
        <div
          className="animate-sway absolute inset-x-0 bottom-0"
          style={{
            height: TILE_HEIGHT * PIXEL_SCALE,
            backgroundImage: BACK_GRASS,
            backgroundSize: `${16 * TILE_STEP * PIXEL_SCALE}px ${TILE_HEIGHT * PIXEL_SCALE}px`,
            backgroundRepeat: "repeat-x",
          }}
        />
        <div
          className="animate-sway absolute inset-x-0 -bottom-2 [animation-delay:-3s]"
          style={{
            height: TILE_HEIGHT * PIXEL_SCALE,
            backgroundImage: FRONT_GRASS,
            backgroundSize: `${12 * TILE_STEP * PIXEL_SCALE}px ${TILE_HEIGHT * PIXEL_SCALE}px`,
            backgroundPosition: "37px 0",
            backgroundRepeat: "repeat-x",
          }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(at_50%_45%,transparent_55%,rgb(2_4_10/0.85)_100%)] opacity-40" />
      </div>
      <div aria-hidden className="scanlines pointer-events-none fixed inset-0 z-50 opacity-40" />
    </>
  );
}
