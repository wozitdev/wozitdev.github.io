import * as THREE from 'three'

/**
 * CENTRAL SCALING SYSTEM — TRUE RELATIONAL SCALE
 * ----------------------------------------------
 * Relational scaling is nothing more than REAL METERS. Every object is built
 * from its true real-world dimensions and converted to globe units with ONE
 * formula. That alone guarantees perfect relational scale between every pair
 * of objects:
 *
 *   Great Pyramid height 138.6 m vs a 4 m cross -> the cross IS 1/34.65 the
 *   pyramid's height on screen. No fit counts, no cube roots, no derived
 *   per-object ratios. Real math only.
 *
 * The final size of any object is the product of THREE stages:
 *
 *   1. BASE SCALE      - real meters -> globe units (globe radius 1 = 6371 km).
 *                        This stage IS the relational scaling. It is never
 *                        modified per object.
 *
 *   2. VISUAL MULTIPLIER - VISUAL_MULTIPLIER[key], a PER-OBJECT knob that
 *                        starts at 1x. The ONLY value meant to be hand-tuned
 *                        later for readability, without touching relational
 *                        truth.
 *
 *   3. GLOBAL SCALE    - one uniform multiplier applied to EVERY object, the
 *                        "zoom". Grows everything together while preserving
 *                        every relative size.
 *
 * Final size = (meters / 6,371,000) * GLOBE_RADIUS
 *            * VISUAL_MULTIPLIER[key]   (per-object hand knob, starts 1x)
 *            * globalScaleMultiplier    (uniform zoom)
 */

export const EARTH_RADIUS_KM = 6371
export const GLOBE_RADIUS = 1

const DEG2RAD = Math.PI / 180

/** Every scalable object in the scene. Used only to index VISUAL_MULTIPLIER. */
export type ObjectScaleKey =
  | 'giza'
  | 'aircraft'
  | 'ship'
  | 'iss'
  | 'cross'
  | 'colosseum'
  | 'tajMahal'
  | 'machuPicchu'
  | 'greatWall'
  | 'chichenItza'
  | 'petra'
  | 'christRedeemer'
  | 'whiteHouse'
  | 'kaaba'
  | 'hangingGardens'
  | 'templeArtemis'
  | 'mausoleum'
  | 'lighthouseAlexandria'
  | 'colossusRhodes'
  | 'statueZeus'

/**
 * PER-OBJECT VISUAL MULTIPLIER — starts at 1x for every object.
 *
 * The ONLY layer intended for later hand-tuning to make individual objects
 * readable on screen. Changing a value here does NOT disturb relational
 * scaling (which is pure real meters) or the global zoom.
 */
export const VISUAL_MULTIPLIER: Record<ObjectScaleKey, number> = {
  // 4 m at true scale is ~1.9e-6 globe units (sub-pixel at any usable zoom);
  // boosted so the cross reads on screen. Relational base is untouched.
  cross: 33,
  christRedeemer: 3,
  colossusRhodes: 3,
  statueZeus: 7,

  aircraft: 2,
  ship: 4,
  iss: 2,
  
  giza: .75,
  colosseum: .75,
  greatWall: 1,

  petra: 1.5,

  tajMahal: 1.5,
  whiteHouse: 1.5,
  kaaba: 1.5,
  mausoleum: 1.5, //Halicarnassus
  lighthouseAlexandria: 1.5,
  
  hangingGardens: 1.25,
  templeArtemis: 1.25,
  machuPicchu: 1.25,
  chichenItza: 1.25,
}

export function getVisualMultiplier(object: ObjectScaleKey): number {
  return VISUAL_MULTIPLIER[object]
}

export function setVisualMultiplier(object: ObjectScaleKey, value: number): void {
  VISUAL_MULTIPLIER[object] = Math.max(0.0001, value)
}

/**
 * GLOBAL uniform scale multiplier applied to every object — the "zoom".
 * Default 3x. Raising it grows everything together while preserving every
 * relative (fractal) size. A future UI interactable can drive this.
 */
let globalScaleMultiplier = 1000

export function getGlobalScaleMultiplier(): number {
  return globalScaleMultiplier
}

export function setGlobalScaleMultiplier(value: number): void {
  globalScaleMultiplier = Math.max(0.0001, value)
}

/**
 * Convert a real-world length in meters into globe units for a given object.
 * Base conversion (real meters, the relational truth) times the per-object
 * visual multiplier and the global zoom.
 */
export function metersToGlobeUnits(meters: number, object: ObjectScaleKey): number {
  const km = meters / 1000
  const baseUnits = (km / EARTH_RADIUS_KM) * GLOBE_RADIUS
  return baseUnits * VISUAL_MULTIPLIER[object] * globalScaleMultiplier
}

/** Convert a real-world altitude/height in km into globe units (no object multiplier). */
export function kmToGlobeUnits(km: number): number {
  return (km / EARTH_RADIUS_KM) * GLOBE_RADIUS
}

/**
 * Convert latitude/longitude (degrees) at a given globe-unit radius into a
 * THREE.Vector3 in the globe's local space. This is the single source of
 * truth for lat/lng -> position so every object sits on the surface the
 * same way (and rotates correctly with the globe mesh it is parented to).
 */
export function latLngToVector3(lat: number, lng: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * DEG2RAD
  const theta = (lng + 180) * DEG2RAD
  const x = -(radius * Math.sin(phi) * Math.cos(theta))
  const z = radius * Math.sin(phi) * Math.sin(theta)
  const y = radius * Math.cos(phi)
  return new THREE.Vector3(x, y, z)
}

/**
 * Orient an object that travels ALONG the globe surface.
 *
 * Model convention (all travelling models are built along local axes):
 *   +X = forward / nose / bow (direction of travel)
 *   +Y = up (away from Earth's center)
 *   +Z = right
 *
 * `position` is the current location and `lookAhead` is a point slightly
 * further along the path. The forward vector is projected onto the local
 * tangent plane so the model always sits flat against the sphere and its
 * nose points along the great-circle direction of travel. This is robust
 * across the antimeridian and the poles, unlike a flat atan2 heading.
 */
export function orientAlongPath(
  obj: THREE.Object3D,
  position: THREE.Vector3,
  lookAhead: THREE.Vector3
): void {
  const up = position.clone().normalize()

  let forward = lookAhead.clone().sub(position)
  // Remove any radial component so forward lies in the tangent plane.
  forward.sub(up.clone().multiplyScalar(forward.dot(up)))

  if (forward.lengthSq() < 1e-12) {
    // Degenerate (identical points) - fall back to an arbitrary tangent.
    forward = new THREE.Vector3(0, 1, 0).sub(up.clone().multiplyScalar(up.y))
  }
  forward.normalize()

  // Right-handed basis: X=forward, Y=up, Z=forward x up.
  const right = new THREE.Vector3().crossVectors(forward, up).normalize()
  const m = new THREE.Matrix4().makeBasis(forward, up, right)
  obj.quaternion.setFromRotationMatrix(m)
}
