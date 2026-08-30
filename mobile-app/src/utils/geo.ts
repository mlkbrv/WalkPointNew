/**
 * Geometry for recorded routes.
 *
 * Everything here works on `[longitude, latitude]` pairs — GeoJSON order, which
 * is what the server stores and what a map library expects. Latitude-first is
 * the classic source of routes drawn in the wrong hemisphere.
 */

const EARTH_RADIUS_M = 6_371_000;

export type Point = [number, number];

/** Great-circle distance in metres between two `[lng, lat]` points. */
export function haversineMetres([lng1, lat1]: Point, [lng2, lat2]: Point): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

/**
 * Thin a route with Douglas–Peucker, with the tolerance in **metres**.
 *
 * The projection matters. Run in raw degrees, a tolerance is 1.8x tighter along
 * longitude than latitude at 56°N, so the line is thinned unevenly and visibly
 * distorts. Projecting to local metres about the route's mean latitude first
 * makes the tolerance mean what it says.
 *
 * A one-hour walk sampled every five metres is roughly a thousand points — 30 KB
 * on the wire. This typically removes 70–90% of them without a visible change.
 */
export function simplify(points: Point[], toleranceMetres = 5): Point[] {
  if (points.length < 3) return points.slice();

  const meanLat = points.reduce((sum, p) => sum + p[1], 0) / points.length;
  const cosLat = Math.cos((meanLat * Math.PI) / 180);
  const metresPerDegree = (EARTH_RADIUS_M * Math.PI) / 180;

  // Equirectangular projection about the route's own latitude.
  const projected = points.map(([lng, lat]): Point => [
    lng * metresPerDegree * cosLat,
    lat * metresPerDegree,
  ]);

  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;

  const stack: [number, number][] = [[0, points.length - 1]];

  while (stack.length) {
    const [first, last] = stack.pop()!;
    let worst = 0;
    let worstIndex = -1;

    for (let i = first + 1; i < last; i++) {
      const d = perpendicularDistance(projected[i], projected[first], projected[last]);
      if (d > worst) {
        worst = d;
        worstIndex = i;
      }
    }

    if (worst > toleranceMetres && worstIndex !== -1) {
      keep[worstIndex] = true;
      stack.push([first, worstIndex], [worstIndex, last]);
    }
  }

  return points.filter((_, i) => keep[i]);
}

function perpendicularDistance(p: Point, a: Point, b: Point): number {
  const [px, py] = p;
  const [ax, ay] = a;
  const [bx, by] = b;

  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;

  // A degenerate segment: fall back to the distance from the endpoint.
  if (lengthSq === 0) return Math.hypot(px - ax, py - ay);

  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
