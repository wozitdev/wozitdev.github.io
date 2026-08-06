// Local replacement for the @github/spark runtime, for static GitHub Pages hosting.
// - useKV: persists to localStorage instead of the Spark KV service.
// - getUser: everyone visiting the static site gets write access to their own
//   local copy of the data (there is no server, so "owner" is the visitor).

import { useCallback, useState } from 'react'

export interface SparkUser {
  login: string
  isOwner: boolean
}

export async function getUser(): Promise<SparkUser> {
  return { login: 'visitor', isOwner: true }
}

const PREFIX = 'spark-kv:'

function readKV<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

export function useKV<T>(
  key: string,
  initialValue: T
): [T, (update: T | ((current: T) => T)) => void, () => void] {
  const [value, setValue] = useState<T>(() => readKV(key, initialValue))

  const set = useCallback(
    (update: T | ((current: T) => T)) => {
      setValue((current) => {
        const next =
          typeof update === 'function' ? (update as (c: T) => T)(current) : update
        try {
          localStorage.setItem(PREFIX + key, JSON.stringify(next))
        } catch {
          // storage full/unavailable — keep in-memory value
        }
        return next
      })
    },
    [key]
  )

  const remove = useCallback(() => {
    localStorage.removeItem(PREFIX + key)
    setValue(initialValue)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return [value, set, remove]
}
