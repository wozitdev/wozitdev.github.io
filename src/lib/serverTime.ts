/**
 * SERVER-SYNCHRONIZED TIME
 * ------------------------
 * Every moving model's position is a PURE FUNCTION of absolute time, so all
 * viewers see the same thing and nothing restarts on reload. For that to work
 * across different users, everyone must agree on "now" even if their device
 * clock is wrong.
 *
 * IMPORTANT: The HTTP `Date` response header is NOT exposed to JavaScript on
 * cross-origin `fetch` responses (it is not a CORS-safelisted response
 * header), so reading it always failed and every user silently fell back to
 * their own local clock -> positions diverged. This version instead reads the
 * time from the JSON BODY of public time APIs, which IS accessible, and
 * corrects for network latency using the request round-trip midpoint.
 */

let serverOffsetMs = 0
let synced = false
let syncing: Promise<void> | null = null

interface TimeSource {
  url: string
  /** Extract epoch milliseconds from the parsed JSON body. */
  parse: (data: any) => number
}

// Ordered by preference. Each returns UTC time in its JSON body.
const TIME_SOURCES: TimeSource[] = [
  {
    url: 'https://worldtimeapi.org/api/timezone/Etc/UTC',
    parse: (d) => (typeof d.unixtime === 'number' ? d.unixtime * 1000 : NaN),
  },
  {
    url: 'https://timeapi.io/api/time/current/zone?timeZone=UTC',
    parse: (d) => (d && d.dateTime ? new Date(d.dateTime + 'Z').getTime() : NaN),
  },
  {
    url: 'https://worldclockapi.com/api/json/utc/now',
    parse: (d) => (d && d.currentDateTime ? new Date(d.currentDateTime).getTime() : NaN),
  },
]

async function fetchOffset(source: TimeSource): Promise<number | null> {
  try {
    const before = Date.now()
    const res = await fetch(source.url, { cache: 'no-store' })
    const after = Date.now()
    if (!res.ok) return null
    const data = await res.json()
    const serverMs = source.parse(data)
    if (!Number.isFinite(serverMs)) return null
    // Assume the server timestamp corresponds to the midpoint of the round
    // trip, which halves the systematic latency error.
    const localMidpoint = (before + after) / 2
    return serverMs - localMidpoint
  } catch {
    return null
  }
}

/**
 * Sync to an authoritative time source. Safe to call multiple times; only the
 * first successful sync takes effect. Resolves once finished (success or not).
 */
export function syncServerTime(): Promise<void> {
  if (synced) return Promise.resolve()
  if (syncing) return syncing

  syncing = (async () => {
    for (const source of TIME_SOURCES) {
      const offset = await fetchOffset(source)
      if (offset !== null) {
        serverOffsetMs = offset
        synced = true
        return
      }
    }
    // Every source failed: fall back to the local clock (offset 0).
    serverOffsetMs = 0
  })()

  return syncing
}

/** Current server-synchronized epoch time in milliseconds. */
export function serverNow(): number {
  return Date.now() + serverOffsetMs
}

/** Current server-synchronized Date. */
export function serverDate(): Date {
  return new Date(serverNow())
}

export function isTimeSynced(): boolean {
  return synced
}
