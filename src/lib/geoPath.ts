/**
 * GREAT-CIRCLE PATH FOLLOWING
 * ---------------------------
 * Shared utilities for moving models along a series of lat/lng waypoints.
 *
 * Waypoints are interpolated using spherical linear interpolation (slerp)
 * of their unit vectors, so segments follow true great-circle arcs that
 * hug the globe surface instead of cutting flat chords or distorting near
 * the antimeridian / poles. Segment timing is derived from real angular
 * distance so speed is uniform along the whole route.
 */

const DEG2RAD = Math.PI / 180
const RAD2DEG = 180 / Math.PI

export interface GeoWaypoint {
  lat: number
  lng: number
  /** Optional altitude in globe units, interpolated linearly. */
  alt?: number
}

interface CompiledPoint {
  vec: [number, number, number]
  alt: number
  /** Cumulative normalized distance [0..1] from the route start. */
  t: number
}

export interface GeoPath {
  /** Sample the path at normalized progress p in [0..1]. */
  sample(p: number): { lat: number; lng: number; alt: number }
}

function latLngToUnit(lat: number, lng: number): [number, number, number] {
  const phi = lat * DEG2RAD
  const lambda = lng * DEG2RAD
  const cp = Math.cos(phi)
  return [cp * Math.cos(lambda), cp * Math.sin(lambda), Math.sin(phi)]
}

function unitToLatLng(v: [number, number, number]): { lat: number; lng: number } {
  const [x, y, z] = v
  const lat = Math.asin(Math.max(-1, Math.min(1, z))) * RAD2DEG
  const lng = Math.atan2(y, x) * RAD2DEG
  return { lat, lng }
}

function angleBetween(a: [number, number, number], b: [number, number, number]): number {
  const dot = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))
  return Math.acos(dot)
}

function slerp(
  a: [number, number, number],
  b: [number, number, number],
  t: number
): [number, number, number] {
  const omega = angleBetween(a, b)
  if (omega < 1e-6) return a
  const so = Math.sin(omega)
  const s0 = Math.sin((1 - t) * omega) / so
  const s1 = Math.sin(t * omega) / so
  return [
    a[0] * s0 + b[0] * s1,
    a[1] * s0 + b[1] * s1,
    a[2] * s0 + b[2] * s1,
  ]
}

/** Build a reusable great-circle path from ordered waypoints. */
export function buildGeoPath(waypoints: GeoWaypoint[]): GeoPath {
  const compiled: CompiledPoint[] = waypoints.map((w) => ({
    vec: latLngToUnit(w.lat, w.lng),
    alt: w.alt ?? 0,
    t: 0,
  }))

  // Cumulative great-circle distance for uniform-speed timing.
  const segAngles: number[] = []
  let total = 0
  for (let i = 0; i < compiled.length - 1; i++) {
    const a = angleBetween(compiled[i].vec, compiled[i + 1].vec)
    segAngles.push(a)
    total += a
  }
  let acc = 0
  compiled[0].t = 0
  for (let i = 0; i < segAngles.length; i++) {
    acc += segAngles[i]
    compiled[i + 1].t = total > 0 ? acc / total : (i + 1) / segAngles.length
  }

  return {
    sample(p: number) {
      const clamped = Math.max(0, Math.min(1, p))
      let idx = 0
      for (let i = 0; i < compiled.length - 1; i++) {
        if (clamped >= compiled[i].t && clamped <= compiled[i + 1].t) {
          idx = i
          break
        }
        if (i === compiled.length - 2) idx = i
      }
      const a = compiled[idx]
      const b = compiled[idx + 1]
      const span = b.t - a.t
      const local = span > 1e-9 ? (clamped - a.t) / span : 0
      const vec = slerp(a.vec, b.vec, local)
      const { lat, lng } = unitToLatLng(vec)
      const alt = a.alt + (b.alt - a.alt) * local
      return { lat, lng, alt }
    },
  }
}
