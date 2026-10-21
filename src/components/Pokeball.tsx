const GRID = 12;
const CENTER = (GRID - 1) / 2;

type Pixel = { x: number; y: number; fill: string };

/** Pixel-art ball, generated from a circle so every tier can reuse it with its own colour. */
function pixels(top: string, bottom: string, ink: string): Pixel[] {
  const inside = (x: number, y: number) => Math.hypot(x - CENTER, y - CENTER) <= GRID / 2 - 0.4;
  const out: Pixel[] = [];
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (!inside(x, y)) continue;
      const dx = Math.abs(x - CENTER);
      const dy = Math.abs(y - CENTER);
      const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
      let fill: string;
      if (edge) fill = ink;
      else if (dx <= 0.5 && dy <= 0.5) fill = bottom; // button
      else if (dx <= 1.5 && dy <= 1.5) fill = ink; // button rim
      else if (dy <= 0.5) fill = ink; // band
      else fill = y < CENTER ? top : bottom;
      out.push({ x, y, fill });
    }
  }
  // highlight
  out.push({ x: 3, y: 3, fill: "rgb(255 255 255 / 0.8)" });
  return out;
}

export function Pokeball({
  color = "var(--color-ball-red)",
  size = 24,
  className,
  title,
}: {
  color?: string;
  size?: number;
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox={`0 0 ${GRID} ${GRID}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}
      {pixels(color, "#f8f8f0", "#141824").map((p) => (
        <rect key={`${p.x}-${p.y}-${p.fill}`} x={p.x} y={p.y} width={1} height={1} fill={p.fill} />
      ))}
    </svg>
  );
}
