import { buildGeoPath } from './geoPath'
import { serverNow } from './serverTime'

/**
 * AIRBUS INDUSTRIE AIB35LR YMML -> LFBO (2026-07-27)
 * ---------------------------------------------------
 * Route is anchored to Melbourne/Toulouse and uses the filed Pacific
 * oceanic coordinate fixes from FlightAware through the FICKY segment.
 * Post-FICKY continuation is densely sampled from the plotted track so the
 * path better follows the mapped trans-US and trans-Atlantic arc.
 */

// Cruise altitude expressed in globe units (visually raised so the
// 2000x-scaled model rides clearly above the surface).
const CRUISE_ALT = 0.02

const RAW_ROUTE: { lat: number; lng: number }[] = [
  { lat: -37.6733, lng: 144.8433 }, // Melbourne (YMML)
  { lat: -31.633, lng: 159.367 },   // 3138S15922E
  { lat: -31.333, lng: 161.867 },   // 3120S16152E
  { lat: -31.267, lng: 163.0 },     // 3116S16300E
  { lat: -30.9, lng: 167.633 },     // 3054S16738E
  { lat: -30.267, lng: 174.083 },   // 3016S17405E
  { lat: -29.35, lng: 179.733 },    // 2921S17944E
  { lat: -27.767, lng: -174.35 },   // 2746S17421W
  { lat: -26.483, lng: -170.933 },  // 2629S17056W
  { lat: -24.567, lng: -166.883 },  // 2434S16653W
  { lat: -23.05, lng: -164.217 },   // 2303S16413W
  { lat: -20.45, lng: -160.25 },    // 2027S16015W
  { lat: -17.8, lng: -157.0 },      // 1748S15700W
  { lat: -17.333, lng: -156.433 },  // 1720S15626W
  { lat: -14.283, lng: -153.283 },  // 1417S15317W
  { lat: -11.767, lng: -150.967 },  // 1146S15058W
  { lat: -7.167, lng: -147.183 },   // 0710S14711W
  { lat: -5.067, lng: -145.633 },   // 0504S14538W
  { lat: -2.517, lng: -143.883 },   // 0231S14353W
  { lat: 0.733, lng: -141.533 },    // 0044N14132W
  { lat: 3.5, lng: -139.567 },      // 0330N13934W
  { lat: 4.867, lng: -138.6 },      // 0452N13836W
  { lat: 8.683, lng: -135.85 },     // 0841N13551W
  { lat: 12.583, lng: -132.75 },    // 1235N13245W
  { lat: 15.567, lng: -130.65 },    // 1534N13039W
  { lat: 19.467, lng: -128.167 },   // 1928N12810W
  { lat: 24.733, lng: -125.4 },     // 2444N12524W
  { lat: 26.367, lng: -124.533 },   // 2622N12432W
  { lat: 30.3, lng: -122.233 },     // 3018N12214W
  { lat: 33.3394, lng: -118.9647 }, // FICKY area (SoCal coast)
  { lat: 34.238, lng: -117.6633 },
  { lat: 35.0785, lng: -116.4338 },
  { lat: 36.0214, lng: -115.2352 }, // Las Vegas corridor
  { lat: 36.9483, lng: -114.1351 },
  { lat: 38.1667, lng: -113.1706 },
  { lat: 39.2337, lng: -111.985 },
  { lat: 40.0859, lng: -111.2798 }, // Salt Lake region
  { lat: 41.1308, lng: -110.3086 },
  { lat: 42.1507, lng: -108.8461 },
  { lat: 43.1499, lng: -107.3044 },
  { lat: 44.1033, lng: -105.7528 },
  { lat: 45.0528, lng: -104.1192 },
  { lat: 45.937, lng: -102.8551 },
  { lat: 47.0817, lng: -101.5234 },
  { lat: 48.2097, lng: -100.1342 },
  { lat: 49.1535, lng: -98.8545 },
  { lat: 50.0687, lng: -96.995 },
  { lat: 51.0846, lng: -95.3676 },
  { lat: 52.0648, lng: -93.6894 },
  { lat: 53.0074, lng: -91.9607 },
  { lat: 53.9329, lng: -90.1372 },
  { lat: 54.1923, lng: -88.6076 },
  { lat: 54.4869, lng: -86.1701 },
  { lat: 54.7922, lng: -83.7194 },
  { lat: 55.0819, lng: -81.0823 },
  { lat: 55.3435, lng: -78.0463 },
  { lat: 56.0167, lng: -74.8833 },
  { lat: 56.5185, lng: -72.875 },
  { lat: 57.2963, lng: -69.3213 },
  { lat: 57.975, lng: -66.1167 },
  { lat: 58.4963, lng: -63.675 },
  { lat: 58.9833, lng: -61.1333 },
  { lat: 60.0601, lng: -52.5846 },
  { lat: 60.3937, lng: -45.4513 }, // South of Greenland
  { lat: 60.2525, lng: -36.2767 },
  { lat: 59.2338, lng: -24.9639 },
  { lat: 57.305, lng: -14.5829 },
  { lat: 56.6767, lng: -11.0038 },
  { lat: 56.181, lng: -8.4654 },
  { lat: 55.6281, lng: -6.0482 },
  { lat: 55.1196, lng: -4.4995 },
  { lat: 54.0704, lng: -3.0154 },
  { lat: 53.0215, lng: -1.649 },
  { lat: 51.8061, lng: -0.7041 },
  { lat: 50.6944, lng: -0.4627 },
  { lat: 49.3314, lng: -0.4561 },
  { lat: 48.222, lng: 0.0086 },
  { lat: 46.969, lng: 0.5927 },
  { lat: 45.7116, lng: 1.151 },
  { lat: 44.4965, lng: 1.6658 },
  { lat: 44.0224, lng: 1.4557 },
  { lat: 43.7098, lng: 1.2775 },
  { lat: 43.5468, lng: 1.482 },
  { lat: 43.7938, lng: 1.3325 },
  { lat: 43.7763, lng: 1.2159 },
  { lat: 43.6402, lng: 1.3501 },
  { lat: 43.6293, lng: 1.3638 },    // Toulouse (LFBO)
]

const path = buildGeoPath(
  RAW_ROUTE.map((p) => ({ lat: p.lat, lng: p.lng, alt: CRUISE_ALT }))
)

// FlightAware (AIB35LR, 2026-07-27) reports YMML -> LFBO as 20h 33m.
const REAL_FLIGHT_DURATION_MS = (20 * 60 + 33) * 60 * 1000
const REAL_TURNAROUND_DURATION_MS = 12 * 60 * 1000

/**
 * TESTING speed multiplier. Ship and plane run at 200x while their paths
 * are being verified; set back to 1 for real-time once confirmed.
 */
export const PLANE_TEST_SPEED = 1

const CLIMB_FRACTION = 0.06
const DESCENT_FRACTION = 0.94
const LOOK_AHEAD = 0.004

function altitudeProfile(progress) {
  if (progress < CLIMB_FRACTION) {
    const t = progress / CLIMB_FRACTION
    return CRUISE_ALT * (t * t * (3 - 2 * t))
  }
  if (progress > DESCENT_FRACTION) {
    const t = (progress - DESCENT_FRACTION) / (1 - DESCENT_FRACTION)
    return CRUISE_ALT * (1 - t * t * (3 - 2 * t))
  }
  return CRUISE_ALT
}

export interface MovingModelState {
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
 * Position is a pure function of absolute server time, so all users see the
 * plane in the same place and it never restarts on reload. The plane flies
 * Melbourne -> Toulouse, pauses briefly on the ground, then returns and
 * pauses again before the cycle repeats.
 */
export function getPlanePosition(speedMultiplier = PLANE_TEST_SPEED) {
  const scaledDuration = REAL_FLIGHT_DURATION_MS / speedMultiplier
  const scaledTurnaround = REAL_TURNAROUND_DURATION_MS / speedMultiplier
  const cycleDuration = scaledDuration * 2 + scaledTurnaround * 2
  const timeInCycle = serverNow() % cycleDuration

  const outboundEnd = scaledDuration
  const destinationGroundEnd = outboundEnd + scaledTurnaround
  const inboundEnd = destinationGroundEnd + scaledDuration

  if (timeInCycle < outboundEnd) {
    const legProgress = timeInCycle / scaledDuration
    const routeP = legProgress
    const aheadRouteP = Math.min(1, routeP + LOOK_AHEAD)
    const here = path.sample(routeP)
    const ahead = path.sample(aheadRouteP)
    const altitude = altitudeProfile(legProgress)
    const aheadAltitude = altitudeProfile(Math.min(1, legProgress + LOOK_AHEAD))

    return {
      latitude: here.lat,
      longitude: here.lng,
      altitude,
      aheadLatitude: ahead.lat,
      aheadLongitude: ahead.lng,
      aheadAltitude,
      progress: legProgress,
    }
  }

  if (timeInCycle < destinationGroundEnd) {
    const atDestination = path.sample(1)
    return {
      latitude: atDestination.lat,
      longitude: atDestination.lng,
      altitude: 0,
      aheadLatitude: atDestination.lat,
      aheadLongitude: atDestination.lng,
      aheadAltitude: 0,
      progress: 1,
    }
  }

  if (timeInCycle < inboundEnd) {
    const legProgress = (timeInCycle - destinationGroundEnd) / scaledDuration
    const routeP = 1 - legProgress
    const aheadRouteP = Math.max(0, routeP - LOOK_AHEAD)
    const here = path.sample(routeP)
    const ahead = path.sample(aheadRouteP)
    const altitude = altitudeProfile(legProgress)
    const aheadAltitude = altitudeProfile(Math.min(1, legProgress + LOOK_AHEAD))

    return {
      latitude: here.lat,
      longitude: here.lng,
      altitude,
      aheadLatitude: ahead.lat,
      aheadLongitude: ahead.lng,
      aheadAltitude,
      progress: 1 + legProgress,
    }
  }

  const atOrigin = path.sample(0)

  return {
    latitude: atOrigin.lat,
    longitude: atOrigin.lng,
    altitude: 0,
    aheadLatitude: atOrigin.lat,
    aheadLongitude: atOrigin.lng,
    aheadAltitude: 0,
    progress: 2,
  }
}

export default {
  PLANE_TEST_SPEED,
  getPlanePosition,
}
