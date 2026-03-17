type Point = {
  x: number;
  y: number;
};

/**
 * Example: buildSmoothPath([{ x: 0, y: 10 }, { x: 10, y: 20 }]) -> "M 0 10 L 10 20"
 */
export function buildSmoothPath(points: readonly Point[], tension = 0.4): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[Math.max(0, index - 1)];
    const current = points[index];
    const next = points[index + 1];
    const afterNext = points[Math.min(points.length - 1, index + 2)];

    const cp1x = current.x + ((next.x - previous.x) * tension) / 2;
    const cp1y = current.y + ((next.y - previous.y) * tension) / 2;
    const cp2x = next.x - ((afterNext.x - current.x) * tension) / 2;
    const cp2y = next.y - ((afterNext.y - current.y) * tension) / 2;

    path += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${next.x} ${next.y}`;
  }

  return path;
}
