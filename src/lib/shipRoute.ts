import { buildGeoPath } from './geoPath'
import { serverNow } from './serverTime'

type MovingModelState = {
  latitude: number
  longitude: number
  altitude: number
  aheadLatitude: number
  aheadLongitude: number
  aheadAltitude: number
  progress: number
  isDocked?: boolean
  portLatitude?: number
  portLongitude?: number
}

/**
 * HISTORIC TRIANGULAR SLAVE-TRADE VOYAGE (18th century pattern)
 * -------------------------------------------------------------
 * This model uses a representative grand Atlantic circuit:
 * Liverpool -> Ouidah (Bight of Benin) -> Cape Town (via the mid-Atlantic
 * volta do mar, riding the westerlies east) -> Salvador da Bahia (riding the
 * Benguela current and SE trades northwest) -> Kingston (up the Brazilian
 * coast and across with the trades) -> Charleston (Windward Passage and
 * Gulf Stream) -> Liverpool (Gulf Stream / North Atlantic westerlies).
 * Every leg follows the prevailing winds and currents square-rigged ships
 * actually depended on.
 *
 * Dock windows are intentionally long where ships historically waited while
 * buying captives and assembling cargoes on the coast, and shorter at market
 * ports where sale/unloading and reprovisioning occurred.
 */

const DAY_MS = 24 * 60 * 60 * 1000

type Waypoint = { lat: number; lng: number }
type SailLeg = {
  kind: 'sail'
  durationDays: number
  path: ReturnType<typeof buildGeoPath>
}
type DockStop = {
  kind: 'dock'
  durationDays: number
  at: Waypoint
  port: Waypoint
}

function makePath(points: Waypoint[]) {
  return buildGeoPath(points.map((p) => ({ lat: p.lat, lng: p.lng, alt: 0 })))
}

const LIVERPOOL_ANCHORAGE: Waypoint = { lat: 53.39, lng: -3.07 }
const LIVERPOOL_PORT: Waypoint = { lat: 53.405, lng: -2.995 }

const OUIDAH_ROADSTEAD: Waypoint = { lat: 6.23, lng: 2.24 }
const OUIDAH_PORT: Waypoint = { lat: 6.36, lng: 2.09 }

const KINGSTON_ANCHORAGE: Waypoint = { lat: 17.92, lng: -76.84 }
const KINGSTON_PORT: Waypoint = { lat: 17.97, lng: -76.79 }

const CAPE_TOWN_ANCHORAGE: Waypoint = { lat: -33.85, lng: 18.4 }
const CAPE_TOWN_PORT: Waypoint = { lat: -33.905, lng: 18.435 }

const SALVADOR_ANCHORAGE: Waypoint = { lat: -12.98, lng: -38.48 }
const SALVADOR_PORT: Waypoint = { lat: -12.965, lng: -38.515 }

const CHARLESTON_ANCHORAGE: Waypoint = { lat: 32.7, lng: -79.82 }
const CHARLESTON_PORT: Waypoint = { lat: 32.78, lng: -79.93 }

const LIVERPOOL_TO_OUIDAH = makePath([
  LIVERPOOL_ANCHORAGE,
  { lat: 47.0, lng: -8.0 },
  { lat: 39.5, lng: -14.0 },
  { lat: 31.0, lng: -17.0 },
  { lat: 22.0, lng: -18.5 },
  { lat: 14.0, lng: -17.8 },
  { lat: 9.0, lng: -15.5 },
  { lat: 6.0, lng: -12.5 },
  { lat: 4.2, lng: -8.0 },
  { lat: 3.6, lng: -4.0 },
  { lat: 3.8, lng: -1.0 },
  { lat: 5.0, lng: 1.0 },
  { lat: 5.9, lng: 2.0 },
  OUIDAH_ROADSTEAD,
])

// Ouidah -> Cape Town: stand offshore into the mid-South Atlantic (the
// volta do mar) to clear the doldrums and the north-setting Benguela
// current, then run east on the Roaring-Forties westerlies to the Cape.
const OUIDAH_TO_CAPE_TOWN = makePath([
  OUIDAH_ROADSTEAD,
  { lat: 4.0, lng: 0.5 },
  { lat: 0.0, lng: -4.0 },
  { lat: -6.0, lng: -10.0 },
  { lat: -13.0, lng: -15.0 },
  { lat: -21.0, lng: -18.0 },
  { lat: -28.0, lng: -16.0 },
  { lat: -33.0, lng: -9.0 },
  { lat: -35.5, lng: 0.0 },
  { lat: -35.5, lng: 9.0 },
  { lat: -34.5, lng: 15.5 },
  { lat: -33.9, lng: 17.8 },
  CAPE_TOWN_ANCHORAGE,
])

// Cape Town -> Salvador: ride the Benguela current and SE trade winds
// northwest across the South Atlantic to the Bahian coast.
const CAPE_TOWN_TO_SALVADOR = makePath([
  CAPE_TOWN_ANCHORAGE,
  { lat: -33.0, lng: 14.0 },
  { lat: -29.0, lng: 6.0 },
  { lat: -24.0, lng: -3.0 },
  { lat: -19.0, lng: -12.0 },
  { lat: -15.0, lng: -21.0 },
  { lat: -13.0, lng: -29.0 },
  { lat: -12.6, lng: -35.5 },
  SALVADOR_ANCHORAGE,
])

// Salvador -> Kingston: north-east along the Brazilian coast, round Cabo
// de Sao Roque, then run downwind with the trades and the Guiana current
// through the Lesser Antilles to Jamaica.
const SALVADOR_TO_KINGSTON = makePath([
  SALVADOR_ANCHORAGE,
  { lat: -10.5, lng: -35.3 },
  { lat: -7.0, lng: -33.8 },
  { lat: -4.0, lng: -34.5 },
  { lat: -1.0, lng: -38.0 },
  { lat: 2.5, lng: -43.0 },
  { lat: 6.0, lng: -48.5 },
  { lat: 9.0, lng: -54.0 },
  { lat: 11.0, lng: -59.0 },
  { lat: 12.5, lng: -63.5 },
  { lat: 13.8, lng: -68.0 },
  { lat: 15.0, lng: -72.0 },
  { lat: 16.5, lng: -76.0 },
  KINGSTON_ANCHORAGE,
])

// Kingston -> Charleston: east along Jamaica, north through the Windward
// Passage, up past the Bahamas and into the Gulf Stream off Florida.
const KINGSTON_TO_CHARLESTON = makePath([
  KINGSTON_ANCHORAGE,
  { lat: 18.2, lng: -75.5 },
  { lat: 19.4, lng: -74.2 },
  { lat: 20.6, lng: -73.7 },
  { lat: 22.5, lng: -74.3 },
  { lat: 24.5, lng: -76.5 },
  { lat: 26.5, lng: -79.3 },
  { lat: 29.0, lng: -80.2 },
  { lat: 31.3, lng: -80.2 },
  CHARLESTON_ANCHORAGE,
])

// Charleston -> Liverpool: follow the Gulf Stream north-east off the
// American seaboard, then the North Atlantic westerlies home.
const CHARLESTON_TO_LIVERPOOL = makePath([
  CHARLESTON_ANCHORAGE,
  { lat: 33.5, lng: -77.5 },
  { lat: 35.5, lng: -73.0 },
  { lat: 38.0, lng: -66.0 },
  { lat: 41.0, lng: -56.0 },
  { lat: 44.5, lng: -44.0 },
  { lat: 47.5, lng: -32.0 },
  { lat: 50.0, lng: -20.0 },
  { lat: 52.0, lng: -10.0 },
  { lat: 53.2, lng: -5.2 },
  LIVERPOOL_ANCHORAGE,
])

const ROUTE: Array<SailLeg | DockStop> = [
  {
    kind: 'dock',
    durationDays: 21,
    at: LIVERPOOL_ANCHORAGE,
    port: LIVERPOOL_PORT,
  },
  {
    kind: 'sail',
    durationDays: 36,
    path: LIVERPOOL_TO_OUIDAH,
  },
  {
    kind: 'dock',
    durationDays: 45,
    at: OUIDAH_ROADSTEAD,
    port: OUIDAH_PORT,
  },
  {
    kind: 'sail',
    durationDays: 44,
    path: OUIDAH_TO_CAPE_TOWN,
  },
  {
    kind: 'dock',
    durationDays: 12,
    at: CAPE_TOWN_ANCHORAGE,
    port: CAPE_TOWN_PORT,
  },
  {
    kind: 'sail',
    durationDays: 32,
    path: CAPE_TOWN_TO_SALVADOR,
  },
  {
    kind: 'dock',
    durationDays: 18,
    at: SALVADOR_ANCHORAGE,
    port: SALVADOR_PORT,
  },
  {
    kind: 'sail',
    durationDays: 28,
    path: SALVADOR_TO_KINGSTON,
  },
  {
    kind: 'dock',
    durationDays: 14,
    at: KINGSTON_ANCHORAGE,
    port: KINGSTON_PORT,
  },
  {
    kind: 'sail',
    durationDays: 10,
    path: KINGSTON_TO_CHARLESTON,
  },
  {
    kind: 'dock',
    durationDays: 12,
    at: CHARLESTON_ANCHORAGE,
    port: CHARLESTON_PORT,
  },
  {
    kind: 'sail',
    durationDays: 30,
    path: CHARLESTON_TO_LIVERPOOL,
  },
]

const SEGMENTS = ROUTE.map((segment) => ({
  ...segment,
  durationMs: segment.durationDays * DAY_MS,
}))

const CYCLE_DURATION_MS = SEGMENTS.reduce((sum, seg) => sum + seg.durationMs, 0)

/**
 * TESTING speed multiplier. Ship and plane run at 200x while their paths
 * are being verified; set back to 1 for real-time once confirmed.
 */
export const SHIP_TEST_SPEED = 1

const LOOK_AHEAD = 0.004

function findNextSailPath(startIndex: number): ReturnType<typeof buildGeoPath> | null {
  for (let i = 1; i <= SEGMENTS.length; i++) {
    const seg = SEGMENTS[(startIndex + i) % SEGMENTS.length]
    if (seg.kind === 'sail') {
      return seg.path
    }
  }
  return null
}

/**
 * Position is a pure function of absolute server time, so every user sees
 * the ship at the same place and it never restarts on reload.
 *
 * Cycle: Liverpool -> Ouidah -> Cape Town -> Salvador -> Kingston ->
 * Charleston -> Liverpool, docking at each port.
 */
export function getShipPosition(speedMultiplier: number = SHIP_TEST_SPEED): MovingModelState {
  const scaledCycleDuration = CYCLE_DURATION_MS / speedMultiplier
  const nowMs = serverNow()
  const cycleProgress = (nowMs % scaledCycleDuration) / scaledCycleDuration
  let timeInCycle = nowMs % scaledCycleDuration

  for (let i = 0; i < SEGMENTS.length; i++) {
    const segment = SEGMENTS[i]
    const scaledSegmentDuration = segment.durationMs / speedMultiplier

    if (timeInCycle < scaledSegmentDuration) {
      const segmentProgress = scaledSegmentDuration > 0
        ? timeInCycle / scaledSegmentDuration
        : 0

      if (segment.kind === 'sail') {
        const routeP = segmentProgress
        const aheadRouteP = Math.min(1, routeP + LOOK_AHEAD)
        const here = segment.path.sample(routeP)
        const ahead = segment.path.sample(aheadRouteP)

        return {
          latitude: here.lat,
          longitude: here.lng,
          altitude: 0,
          aheadLatitude: ahead.lat,
          aheadLongitude: ahead.lng,
          aheadAltitude: 0,
          progress: cycleProgress,
          isDocked: false,
        }
      }

      const here = segment.at
      const nextPath = findNextSailPath(i)
      const ahead = nextPath ? nextPath.sample(LOOK_AHEAD) : here

      return {
        latitude: here.lat,
        longitude: here.lng,
        altitude: 0,
        aheadLatitude: ahead.lat,
        aheadLongitude: ahead.lng,
        aheadAltitude: 0,
        progress: cycleProgress,
        isDocked: true,
        portLatitude: segment.port.lat,
        portLongitude: segment.port.lng,
      }
    }

    timeInCycle -= scaledSegmentDuration
  }

  const fallback = LIVERPOOL_ANCHORAGE

  return {
    latitude: fallback.lat,
    longitude: fallback.lng,
    altitude: 0,
    aheadLatitude: fallback.lat,
    aheadLongitude: fallback.lng,
    aheadAltitude: 0,
    progress: 0,
    isDocked: false,
  }
}
