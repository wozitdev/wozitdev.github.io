import * as THREE from 'three'
import { GLOBE_RADIUS, EARTH_RADIUS_KM, latLngToVector3 } from './scaling'

/**
 * CRUDE OIL RESOURCE LAYER — "starcraft/factorio" style deposit highlighting
 * --------------------------------------------------------------------------
 * Every major oil-bearing basin on Earth is rendered as a glowing surface
 * patch whose COLOR encodes strategic weight (how many days that basin alone
 * would fuel the entire world) and whose SIZE shrinks as the basin is depleted. A permanent dark
 * "watermark" disc marks the ORIGINAL extent of every basin, so years later
 * you can see the shadow of what was there on the baseline date and how much
 * remains inside it.
 *
 * THE MATH (all real, 2026 figures)
 * ---------------------------------
 * World proven crude reserves .......... ~1,700 Gbbl (sum of basins below)
 * Undiscovered / reserve growth ........ +15%  (incomplete discovery factor)
 *   -> effective recoverable ........... ~1,955 Gbbl
 * World crude production ............... ~82 Mbbl/day  = ~29.9 Gbbl/year
 * Demand decline (EV adoption etc.) .... -1.5% per year, floored at 35% of
 *                                        today's rate (aviation/petchem tail)
 *
 * Flat-rate exhaustion: 1,955 / 29.9 ≈ 65 years.
 * With the demand-decline curve the LAST basin runs dry ~2110s, but the bulk
 * (>90%) of all crude is gone within ~55-75 years — matching the hand math
 * of "50 years, could be 63, 100 at the max end".
 *
 * DEPLETION IS NOT EVEN — it follows PRODUCTION, not reserves. Each basin
 * drains at its real production rate, so hard-pumped, smaller basins (US
 * shale, North Sea, Mexico) vanish decades before slow giants (Orinoco,
 * Athabasca). When a basin runs dry its output is redistributed across the
 * surviving basins in proportion to their production capacity, keeping the
 * global rate on the demand curve — exactly how real supply shifts.
 *
 * Baseline date: August 1, 2026 (UTC). The simulation is a pure function of
 * elapsed time since then, times an adjustable SPEED MULTIPLIER, so every
 * viewer sees the identical depletion state.
 */

// ---------------------------------------------------------------------------
// Data: major oil basins. reservesGbbl = proven reserves (billion barrels),
// productionMbd = crude production (million barrels/day), radiusKm = rough
// geographic radius of the producing region.
// ---------------------------------------------------------------------------
export interface OilBasin {
  name: string
  lat: number
  lng: number
  radiusKm: number
  reservesGbbl: number
  productionMbd: number
}

export const OIL_BASINS: OilBasin[] = [
  { name: 'Orinoco Belt (Venezuela)',        lat: 8.5,   lng: -64.5,  radiusKm: 300, reservesGbbl: 303,  productionMbd: 0.8 },
  { name: 'Ghawar / Eastern Saudi Arabia',   lat: 25.5,  lng: 49.3,   radiusKm: 400, reservesGbbl: 267,  productionMbd: 9.7 },
  { name: 'Athabasca Oil Sands (Canada)',    lat: 57.0,  lng: -111.5, radiusKm: 300, reservesGbbl: 168,  productionMbd: 4.8 },
  { name: 'Khuzestan / Persian Gulf (Iran)', lat: 30.5,  lng: 49.8,   radiusKm: 300, reservesGbbl: 209,  productionMbd: 3.3 },
  { name: 'Rumaila / Basra (Iraq)',          lat: 30.5,  lng: 47.5,   radiusKm: 250, reservesGbbl: 145,  productionMbd: 4.3 },
  { name: 'Burgan (Kuwait)',                 lat: 29.0,  lng: 47.9,   radiusKm: 100, reservesGbbl: 101,  productionMbd: 2.6 },
  { name: 'Zakum / Abu Dhabi (UAE)',         lat: 24.5,  lng: 54.0,   radiusKm: 150, reservesGbbl: 113,  productionMbd: 3.4 },
  { name: 'West Siberia (Russia)',           lat: 61.0,  lng: 75.0,   radiusKm: 700, reservesGbbl: 48,   productionMbd: 6.0 },
  { name: 'Volga-Urals (Russia)',            lat: 55.0,  lng: 52.0,   radiusKm: 400, reservesGbbl: 20,   productionMbd: 2.5 },
  { name: 'East Siberia (Russia)',           lat: 58.0,  lng: 108.0,  radiusKm: 500, reservesGbbl: 12,   productionMbd: 1.5 },
  { name: 'Permian Basin (US)',              lat: 31.5,  lng: -103.0, radiusKm: 250, reservesGbbl: 30,   productionMbd: 6.3 },
  { name: 'Gulf of Mexico (US)',             lat: 27.0,  lng: -90.0,  radiusKm: 300, reservesGbbl: 5,    productionMbd: 1.8 },
  { name: 'Bakken (US)',                     lat: 47.8,  lng: -103.0, radiusKm: 200, reservesGbbl: 6,    productionMbd: 1.2 },
  { name: 'Eagle Ford (US)',                 lat: 28.8,  lng: -98.5,  radiusKm: 150, reservesGbbl: 5,    productionMbd: 1.1 },
  { name: 'Alaska North Slope (US)',         lat: 70.0,  lng: -149.0, radiusKm: 200, reservesGbbl: 3,    productionMbd: 0.4 },
  { name: 'Tengiz / Kashagan (Kazakhstan)',  lat: 46.0,  lng: 52.5,   radiusKm: 250, reservesGbbl: 30,   productionMbd: 1.9 },
  { name: 'Sirte Basin (Libya)',             lat: 29.0,  lng: 19.0,   radiusKm: 300, reservesGbbl: 48,   productionMbd: 1.2 },
  { name: 'Niger Delta (Nigeria)',           lat: 4.8,   lng: 6.5,    radiusKm: 200, reservesGbbl: 37,   productionMbd: 1.4 },
  { name: 'Offshore Angola',                 lat: -7.0,  lng: 11.5,   radiusKm: 200, reservesGbbl: 8,    productionMbd: 1.1 },
  { name: 'Hassi Messaoud (Algeria)',        lat: 31.7,  lng: 6.1,    radiusKm: 250, reservesGbbl: 12,   productionMbd: 1.0 },
  { name: 'Gulf of Suez (Egypt)',            lat: 28.5,  lng: 33.0,   radiusKm: 150, reservesGbbl: 3,    productionMbd: 0.6 },
  { name: 'Daqing / Bohai (China)',          lat: 46.6,  lng: 125.0,  radiusKm: 200, reservesGbbl: 15,   productionMbd: 2.0 },
  { name: 'Tarim / Xinjiang (China)',        lat: 41.0,  lng: 84.0,   radiusKm: 250, reservesGbbl: 11,   productionMbd: 2.0 },
  { name: 'Pre-salt Santos (Brazil)',        lat: -25.5, lng: -42.5,  radiusKm: 250, reservesGbbl: 14,   productionMbd: 3.6 },
  { name: 'Bay of Campeche (Mexico)',        lat: 19.5,  lng: -92.5,  radiusKm: 200, reservesGbbl: 6,    productionMbd: 1.6 },
  { name: 'North Sea (Norway)',              lat: 61.0,  lng: 2.5,    radiusKm: 250, reservesGbbl: 8,    productionMbd: 1.8 },
  { name: 'North Sea (UK)',                  lat: 58.0,  lng: 1.0,    radiusKm: 200, reservesGbbl: 2.5,  productionMbd: 0.7 },
  { name: 'Caspian (Azerbaijan)',            lat: 40.0,  lng: 51.0,   radiusKm: 150, reservesGbbl: 7,    productionMbd: 0.6 },
  { name: 'Qatar',                           lat: 25.5,  lng: 51.5,   radiusKm: 100, reservesGbbl: 25,   productionMbd: 1.3 },
  { name: 'Oman',                            lat: 21.0,  lng: 56.5,   radiusKm: 200, reservesGbbl: 5,    productionMbd: 1.0 },
  { name: 'Stabroek Block (Guyana)',         lat: 7.5,   lng: -57.0,  radiusKm: 150, reservesGbbl: 11,   productionMbd: 0.6 },
  { name: 'Sumatra (Indonesia)',             lat: 1.0,   lng: 101.5,  radiusKm: 200, reservesGbbl: 2.4,  productionMbd: 0.6 },
  { name: 'Mumbai High (India)',             lat: 19.5,  lng: 71.3,   radiusKm: 100, reservesGbbl: 4.6,  productionMbd: 0.6 },
  { name: 'Oriente (Ecuador)',               lat: -1.0,  lng: -76.5,  radiusKm: 150, reservesGbbl: 8,    productionMbd: 0.5 },
  { name: 'Llanos (Colombia)',               lat: 4.5,   lng: -72.0,  radiusKm: 150, reservesGbbl: 2,    productionMbd: 0.75 },
  { name: 'Vaca Muerta (Argentina)',         lat: -38.5, lng: -69.0,  radiusKm: 150, reservesGbbl: 2.2,  productionMbd: 0.7 },
  { name: 'Offshore Malaysia',               lat: 5.5,   lng: 112.0,  radiusKm: 150, reservesGbbl: 2.7,  productionMbd: 0.5 },
  { name: 'Caspian (Turkmenistan)',          lat: 39.5,  lng: 53.5,   radiusKm: 150, reservesGbbl: 0.6,  productionMbd: 0.25 },
  { name: 'Dorado (Australia)',              lat: -20.5, lng: 114.5,  radiusKm: 60,  reservesGbbl: 0.9,  productionMbd: 0.1 },
]

// ---------------------------------------------------------------------------
// Model constants
// ---------------------------------------------------------------------------
/** Baseline date: August 1, 2026 00:00 UTC. */
export const OIL_BASE_DATE_MS = Date.UTC(2026, 7, 1)

/** Incomplete-discovery / reserve-growth factor on proven reserves. */
export const DISCOVERY_GROWTH = 1.15

/** EV-adoption demand decline per year (fraction). */
export const DEMAND_DECLINE_PER_YEAR = 0.015

/** Demand never falls below this fraction of the 2026 rate (petchem/aviation). */
export const DEMAND_FLOOR_FRACTION = 0.35

const DAYS_PER_YEAR = 365.25
const MS_PER_YEAR = DAYS_PER_YEAR * 86400 * 1000
const SIM_STEP_YEARS = 1 / 12 // monthly steps
const MAX_SIM_YEARS = 200

/** Total effective (discovery-adjusted) initial reserves, Gbbl. */
export const TOTAL_INITIAL_GBBL =
  OIL_BASINS.reduce((s, b) => s + b.reservesGbbl, 0) * DISCOVERY_GROWTH

/**
 * True world crude production 2026, Mbbl/day. Used for color shading.
 * The basin list sums to ~76 Mbbl/day; the ~6 Mbbl/day gap comes from many
 * smaller unlisted fields. This constant anchors colors to the real world rate.
 */
export const WORLD_PRODUCTION_MBBD = 82

/** Global 2026 depletion rate, Gbbl/year — derived from the basin list so
 * the simulation is internally self-consistent (no phantom supply). */
export const GLOBAL_RATE_GBBL_PER_YEAR =
  OIL_BASINS.reduce((s, b) => s + b.productionMbd, 0) * DAYS_PER_YEAR / 1000

// ---------------------------------------------------------------------------
// Speed multiplier (test knob) — multiplies the global depletion rate.
// ---------------------------------------------------------------------------
let oilSpeedMultiplier = 1

export function getOilSpeedMultiplier(): number {
  return oilSpeedMultiplier
}

export function setOilSpeedMultiplier(value: number): void {
  oilSpeedMultiplier = Math.max(0, value)
}

// ---------------------------------------------------------------------------
// Depletion simulation — pure function of elapsed (sped-up) years.
// ---------------------------------------------------------------------------
/** Remaining Gbbl per basin (parallel to OIL_BASINS) after `years` elapsed. */
export function simulateDepletion(years: number): number[] {
  const remaining = OIL_BASINS.map((b) => b.reservesGbbl * DISCOVERY_GROWTH)
  const capacity = OIL_BASINS.map((b) => b.productionMbd)

  const clamped = Math.min(Math.max(years, 0), MAX_SIM_YEARS)
  let t = 0
  while (t < clamped) {
    const dt = Math.min(SIM_STEP_YEARS, clamped - t)

    // Global demand this step (Gbbl/yr) on the EV-decline curve.
    const declineFactor = Math.max(
      DEMAND_FLOOR_FRACTION,
      Math.pow(1 - DEMAND_DECLINE_PER_YEAR, t)
    )
    const demand = GLOBAL_RATE_GBBL_PER_YEAR * declineFactor

    // Live basins share the demand in proportion to production capacity —
    // dry basins' output is redistributed to the survivors.
    let liveCapacity = 0
    for (let i = 0; i < remaining.length; i++) {
      if (remaining[i] > 0) liveCapacity += capacity[i]
    }
    if (liveCapacity <= 0) break

    for (let i = 0; i < remaining.length; i++) {
      if (remaining[i] <= 0) continue
      const share = capacity[i] / liveCapacity
      remaining[i] = Math.max(0, remaining[i] - demand * share * dt)
    }
    t += dt
  }
  return remaining
}

/** Elapsed simulation years for an absolute wall-clock time. */
export function elapsedOilYears(nowMs: number): number {
  return ((nowMs - OIL_BASE_DATE_MS) / MS_PER_YEAR) * oilSpeedMultiplier
}

export interface OilStats {
  totalInitialGbbl: number
  totalRemainingGbbl: number
  remainingFraction: number
  elapsedYears: number
  basinsDepleted: number
  basinCount: number
}

export function getOilStats(nowMs: number): OilStats {
  const years = elapsedOilYears(nowMs)
  const remaining = getSimulated(years)
  const total = remaining.reduce((s, r) => s + r, 0)
  return {
    totalInitialGbbl: TOTAL_INITIAL_GBBL,
    totalRemainingGbbl: total,
    remainingFraction: total / TOTAL_INITIAL_GBBL,
    elapsedYears: years,
    basinsDepleted: remaining.filter((r) => r <= 0).length,
    basinCount: OIL_BASINS.length,
  }
}

// No frame cache — the simulation runs in well under 1ms (39 basins ×
// 2400 monthly steps) so caching only adds jank at high speed multipliers.
function getSimulated(years: number): number[] {
  return simulateDepletion(years)
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
interface BasinVisual {
  shadow: THREE.Mesh
  active: THREE.Mesh
  activeMat: THREE.MeshBasicMaterial
  initialGbbl: number
  radiusU: number
}

const visuals: BasinVisual[] = []
let layerGroup: THREE.Group | null = null

/**
 * "World-fuel days" — how many days would this basin supply the ENTIRE
 * world at today's 2026 consumption rate. This is the correct signal for
 * shading: it communicates strategic weight, not just how fast a basin pumps.
 *
 *   Dorado (0.9 Gbbl)  : ~13 days   -> pale yellow
 *   Permian (30 Gbbl)  : ~420 days  -> amber
 *   Ghawar (267 Gbbl)  : ~3 750 days -> orange
 *   Venezuela (303 Gbbl): ~4 250 days -> deep red-orange
 *   Athabasca (168 Gbbl): ~2 360 days -> red-orange
 */
function basinWorldFuelDays(basin: OilBasin): number {
  const globalDailyGbbl = WORLD_PRODUCTION_MBBD / 1000 // Gbbl/day
  return (basin.reservesGbbl * DISCOVERY_GROWTH) / globalDailyGbbl
}

function densityColor(basin: OilBasin): THREE.Color {
  const days = basinWorldFuelDays(basin)
  // Log scale: 1 day (t=0, pale yellow) -> 5 000 days / ~14 yr (t=1, deep red-orange)
  const tRaw = Math.log10(Math.max(days, 1)) / Math.log10(5000)
  const t = Math.min(Math.max(tRaw, 0), 1)
  // pale yellow (tiny) -> orange -> deep red-orange (giant)
  const c = new THREE.Color()
  c.setHSL(0.14 - 0.13 * t, 0.45 + 0.55 * t, 0.82 - 0.38 * t)
  return c
}

function makeDisc(
  radiusU: number,
  lat: number,
  lng: number,
  material: THREE.Material,
  lift: number
): THREE.Mesh {
  const geo = new THREE.CircleGeometry(radiusU, 48)
  const mesh = new THREE.Mesh(geo, material)
  // Sag of a flat disc against the sphere is ~r²/2 (globe radius 1); lift the
  // disc so its rim clears the surface, plus the layer offset.
  const surface = latLngToVector3(lat, lng, GLOBE_RADIUS)
  const normal = surface.clone().normalize()
  mesh.position.copy(
    surface.clone().add(normal.clone().multiplyScalar(radiusU * radiusU * 0.5 + lift))
  )
  // CircleGeometry faces +Z; rotate +Z onto the surface normal.
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal)
  return mesh
}

/**
 * Build the crude-oil layer and attach it to the globe. Call once. Returns
 * the group (already added to the globe, so it rotates with it).
 */
export function addCrudeOilLayer(globe: THREE.Object3D): THREE.Group {
  const group = new THREE.Group()
  group.name = 'crudeOilLayer'
  visuals.length = 0

  for (const basin of OIL_BASINS) {
    const radiusU = (basin.radiusKm / EARTH_RADIUS_KM) * GLOBE_RADIUS

    // Watermark "shadow" — the permanent original footprint (Aug 1 2026).
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x2b2118,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
    })
    const shadow = makeDisc(radiusU, basin.lat, basin.lng, shadowMat, 0.002)
    shadow.renderOrder = 10
    group.add(shadow)

    // Active deposit — density-colored, shrinks with depletion.
    const activeMat = new THREE.MeshBasicMaterial({
      color: densityColor(basin),
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
    })
    const active = makeDisc(radiusU, basin.lat, basin.lng, activeMat, 0.004)
    active.renderOrder = 11
    group.add(active)

    visuals.push({
      shadow,
      active,
      activeMat,
      initialGbbl: basin.reservesGbbl * DISCOVERY_GROWTH,
      radiusU,
    })
  }

  globe.add(group)
  layerGroup = group
  return group
}

/**
 * Per-frame update: shrink each active disc so its AREA tracks the basin's
 * remaining fraction (radius ∝ √fraction), exposing the watermark ring of
 * depleted ground around it. Adds a subtle RTS-style pulse on live deposits.
 */
export function updateCrudeOilLayer(nowMs: number, camera?: THREE.Camera): void {
  if (!layerGroup) return
  const remaining = getSimulated(elapsedOilYears(nowMs))

  // With depthTest off the discs would shine through the globe from the far
  // side, so cull any basin whose surface normal faces away from the camera.
  const camPos = camera ? camera.getWorldPosition(new THREE.Vector3()) : null
  const worldPos = new THREE.Vector3()

  const pulse = 0.85 + 0.1 * Math.sin(nowMs * 0.002)
  for (let i = 0; i < visuals.length; i++) {
    const v = visuals[i]

    let onNearSide = true
    if (camPos) {
      v.shadow.getWorldPosition(worldPos)
      onNearSide = worldPos.dot(camPos.clone().sub(worldPos)) > 0
    }
    v.shadow.visible = onNearSide

    const frac = Math.min(Math.max(remaining[i] / v.initialGbbl, 0), 1)
    if (frac <= 0 || !onNearSide) {
      v.active.visible = false
      continue
    }
    v.active.visible = true
    const s = Math.sqrt(frac)
    v.active.scale.setScalar(Math.max(s, 1e-4))
    v.activeMat.opacity = pulse
  }
}
