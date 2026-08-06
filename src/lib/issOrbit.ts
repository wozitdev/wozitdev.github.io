import { serverDate } from './serverTime'

const DEG_TO_RAD = Math.PI / 180
const RAD_TO_DEG = 180 / Math.PI
const EARTH_RADIUS_KM = 6371
const MINUTES_PER_DAY = 1440

const ISS_TLE_EPOCH = new Date('2025-05-23T12:00:00Z').getTime()
const ISS_INCLINATION = 51.6407
const ISS_MEAN_MOTION = 15.49818871
const ISS_ECCENTRICITY = 0.0006891
const ISS_ARG_PERIGEE = 81.3829
const ISS_RAAN = 142.5384
const ISS_MEAN_ANOMALY_EPOCH = 278.6398
const ISS_SEMI_MAJOR_AXIS_KM = 6789.14

const J2 = 0.00108263
const EARTH_RADIUS_EQ_KM = 6378.137

export interface ISSPosition {
  latitude: number
  longitude: number
  altitude: number
}

function normalizeAngle(angle: number): number {
  let normalized = angle % 360
  if (normalized < 0) normalized += 360
  return normalized
}

function normalizeLongitude(lon: number): number {
  while (lon > 180) lon -= 360
  while (lon < -180) lon += 360
  return lon
}

function solveKepler(meanAnomaly: number, eccentricity: number): number {
  let E = meanAnomaly * DEG_TO_RAD
  const tolerance = 1e-8
  const maxIterations = 30
  
  for (let i = 0; i < maxIterations; i++) {
    const dE = (E - eccentricity * Math.sin(E) - meanAnomaly * DEG_TO_RAD) / 
               (1 - eccentricity * Math.cos(E))
    E -= dE
    if (Math.abs(dE) < tolerance) break
  }
  
  return E * RAD_TO_DEG
}

function getJulianDate(date: Date): number {
  const unixTime = date.getTime()
  return (unixTime / 86400000) + 2440587.5
}

function getGMST(date: Date): number {
  const jd = getJulianDate(date)
  const jd0 = Math.floor(jd - 0.5) + 0.5
  const ut = (jd - jd0) * 24
  const t = (jd0 - 2451545.0) / 36525.0
  
  let gmst = 6.697374558 + 0.06570982441908 * (jd - 2451545.0) + 
             1.00273790935 * ut + 0.000026 * t * t
  
  gmst = (gmst * 15) % 360
  if (gmst < 0) gmst += 360
  
  return gmst
}

let cachedAPIPosition: ISSPosition | null = null
let lastAPIFetch = 0
const API_CACHE_DURATION = 5000

async function fetchLiveISSPosition(): Promise<ISSPosition | null> {
  const now = Date.now()
  if (cachedAPIPosition && (now - lastAPIFetch) < API_CACHE_DURATION) {
    return cachedAPIPosition
  }
  
  try {
    const response = await fetch('https://api.wheretheiss.at/v1/satellites/25544')
    if (!response.ok) return null
    const data = await response.json()
    
    cachedAPIPosition = {
      latitude: data.latitude,
      longitude: data.longitude,
      altitude: data.altitude
    }
    lastAPIFetch = now
    return cachedAPIPosition
  } catch (error) {
    console.warn('Failed to fetch live ISS position:', error)
    return null
  }
}

let liveReferencePosition: ISSPosition | null = null
// Calibration nudges the analytic orbit toward the live API reading.
//  - targetOffset: refreshed periodically from the live API.
//  - appliedOffset: eased toward targetOffset ONCE PER FRAME by
//    updateISSCalibration(), never inside the position function.
// Keeping the position function PURE is critical: it is called several times
// per frame (current position + look-ahead), and mutating shared easing state
// inside it made the motion fight itself and appear to stall. Now motion is
// always the continuous analytic orbit plus a slowly-varying static offset.
let targetOffset = { lat: 0, lng: 0 }
let appliedOffset = { lat: 0, lng: 0 }
let lastCalibration = 0
let lastEaseTime = 0
const CALIBRATION_INTERVAL = 10000
// Fraction of the remaining offset error closed per second (time-based so it
// is frame-rate independent and can never freeze the underlying orbit).
const OFFSET_EASE_PER_SEC = 0.6

/** Shortest signed angular difference a->b in degrees, range (-180, 180]. */
function angleDelta(from: number, to: number): number {
  let d = (to - from) % 360
  if (d > 180) d -= 360
  if (d < -180) d += 360
  return d
}

/**
 * Pure analytic ISS ground position at a given time. Continuous everywhere;
 * used both for the live display (plus offset) and, once the ISS is
 * decommissioned and the API is gone, as the sole source of motion.
 */
function computeAnalyticISS(currentTime: Date): ISSPosition {
  const minutesSinceEpoch = (currentTime.getTime() - ISS_TLE_EPOCH) / (1000 * 60)
  const daysSinceEpoch = minutesSinceEpoch / MINUTES_PER_DAY

  const n = ISS_MEAN_MOTION * (2 * Math.PI / MINUTES_PER_DAY)
  const a = ISS_SEMI_MAJOR_AXIS_KM

  const incRad = ISS_INCLINATION * DEG_TO_RAD
  const cosInc = Math.cos(incRad)

  const p = a * (1 - ISS_ECCENTRICITY * ISS_ECCENTRICITY)
  const raanDot = -1.5 * n * J2 * Math.pow(EARTH_RADIUS_EQ_KM / p, 2) * cosInc
  const argPerDot = 0.75 * n * J2 * Math.pow(EARTH_RADIUS_EQ_KM / p, 2) * (4 - 5 * Math.sin(incRad) * Math.sin(incRad))

  const currentRaan = normalizeAngle(ISS_RAAN + raanDot * RAD_TO_DEG * minutesSinceEpoch * 60)
  const currentArgPer = normalizeAngle(ISS_ARG_PERIGEE + argPerDot * RAD_TO_DEG * minutesSinceEpoch * 60)

  const meanAnomaly = normalizeAngle(ISS_MEAN_ANOMALY_EPOCH + ISS_MEAN_MOTION * 360 * daysSinceEpoch)

  const eccentricAnomaly = solveKepler(meanAnomaly, ISS_ECCENTRICITY)
  const E_rad = eccentricAnomaly * DEG_TO_RAD

  const trueAnomalyRad = 2 * Math.atan2(
    Math.sqrt(1 + ISS_ECCENTRICITY) * Math.sin(E_rad / 2),
    Math.sqrt(1 - ISS_ECCENTRICITY) * Math.cos(E_rad / 2)
  )
  const trueAnomaly = trueAnomalyRad * RAD_TO_DEG

  const radius = a * (1 - ISS_ECCENTRICITY * Math.cos(E_rad))
  const altitude = radius - EARTH_RADIUS_KM

  const argLatitude = normalizeAngle(currentArgPer + trueAnomaly)
  const argLatRad = argLatitude * DEG_TO_RAD

  const xOrbital = radius * Math.cos(argLatRad)
  const yOrbital = radius * Math.sin(argLatRad)

  const raanRad = currentRaan * DEG_TO_RAD

  const xEci = (Math.cos(raanRad) * xOrbital - Math.sin(raanRad) * Math.cos(incRad) * yOrbital)
  const yEci = (Math.sin(raanRad) * xOrbital + Math.cos(raanRad) * Math.cos(incRad) * yOrbital)
  const zEci = Math.sin(incRad) * yOrbital

  const gmst = getGMST(currentTime)
  const gmstRad = gmst * DEG_TO_RAD

  const xEcef = Math.cos(gmstRad) * xEci + Math.sin(gmstRad) * yEci
  const yEcef = -Math.sin(gmstRad) * xEci + Math.cos(gmstRad) * yEci
  const zEcef = zEci

  const longitude = normalizeLongitude(Math.atan2(yEcef, xEcef) * RAD_TO_DEG)
  const latitude = Math.atan2(zEcef, Math.sqrt(xEcef * xEcef + yEcef * yEcef)) * RAD_TO_DEG

  return { latitude, longitude, altitude }
}

/**
 * Advance the live-API calibration. Call ONCE PER FRAME from the render loop.
 * Triggers periodic live fetches and eases the applied offset toward the
 * latest target with a time-based (frame-rate independent) factor. Safe to
 * call forever; when the API is gone the offset simply decays to zero and the
 * pure analytic orbit remains.
 */
export function updateISSCalibration(): void {
  const now = Date.now()

  if (now - lastCalibration > CALIBRATION_INTERVAL) {
    lastCalibration = now
    fetchLiveISSPosition().then(livePos => {
      if (livePos) {
        liveReferencePosition = livePos
        const analytic = computeAnalyticISS(serverDate())
        targetOffset = {
          lat: livePos.latitude - analytic.latitude,
          lng: angleDelta(analytic.longitude, livePos.longitude),
        }
      }
    })
  }

  const dt = lastEaseTime === 0 ? 0 : Math.min(0.1, (now - lastEaseTime) / 1000)
  lastEaseTime = now
  const k = 1 - Math.pow(1 - OFFSET_EASE_PER_SEC, dt)
  appliedOffset.lat += (targetOffset.lat - appliedOffset.lat) * k
  appliedOffset.lng += angleDelta(appliedOffset.lng, targetOffset.lng) * k
}

/**
 * Pure ISS position for display: continuous analytic orbit plus the current
 * (slowly-varying) calibration offset. No side effects.
 */
export function calculateISSPosition(currentTime: Date = serverDate()): ISSPosition {
  const analytic = computeAnalyticISS(currentTime)
  return {
    latitude: analytic.latitude + appliedOffset.lat,
    longitude: normalizeLongitude(analytic.longitude + appliedOffset.lng),
    altitude: analytic.altitude,
  }
}

export async function getISSPosition(): Promise<ISSPosition> {
  const livePosition = await fetchLiveISSPosition()
  if (livePosition) {
    return livePosition
  }
  return calculateISSPosition()
}
