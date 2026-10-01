// Rest-timer survival across refresh (upstream #46). `timer` is UI state and a reload wipes
// it; the persisted mirror — restStartedAt/restDuration in the app state — is what brings the
// countdown back. These tests pin the mirror, the rehydrate path, the unload guard and the
// guarded persist() write.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// --- browser stubs, installed before the stores are imported --------------------------------
// The stores touch localStorage/navigator/document at module scope (loadState, api.js's UA
// sniffing, the visibilitychange/beforeunload listeners), none of which node provides.
const storeMap = new Map()
const winListeners = {}
Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'vitest', vibrate() {} }, configurable: true })
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: k => (storeMap.has(k) ? storeMap.get(k) : null),
    setItem: (k, v) => { storeMap.set(k, String(v)) },
    removeItem: k => { storeMap.delete(k) }
  }
})
globalThis.document = {
  visibilityState: 'visible',
  addEventListener: (type, fn) => { (winListeners[type] ||= []).push(fn) },
  removeEventListener: (type, fn) => { winListeners[type] = (winListeners[type] || []).filter(f => f !== fn) }
}

const { useStore, DEF } = await import('./useStore.js')
const { useUI, restTimerFrom } = await import('./useUI.js')

const cleanState = () => JSON.parse(JSON.stringify(DEF))
const savedState = () => JSON.parse(localStorage.getItem('gym_state_v1'))

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-05-01T10:00:00Z'))
  useUI.getState().stopRest()                 // kill any interval left by the previous test
  useUI.setState({ timer: null })
  useStore.setState({ S: cleanState(), user: null })
  storeMap.clear()
})

afterEach(() => {
  useUI.getState().stopRest()
  vi.useRealTimers()
})

describe('restTimerFrom', () => {
  const now = 1_000_000

  it('rebuilds a running rest from the persisted fields', () => {
    expect(restTimerFrom({ restStartedAt: now - 60000, restDuration: 90 }, now))
      .toEqual({ left: 30, total: 90, endsAt: now + 30000 })
  })

  it('is null when there is nothing to resume', () => {
    expect(restTimerFrom({ restStartedAt: null, restDuration: null }, now)).toBe(null)
    expect(restTimerFrom({ restStartedAt: now - 1000, restDuration: null }, now)).toBe(null)
    expect(restTimerFrom({ restStartedAt: null, restDuration: 90 }, now)).toBe(null)
    expect(restTimerFrom({ restStartedAt: now - 90000, restDuration: 90 }, now)).toBe(null)
  })
})

describe('rest timer persistence', () => {
  it('mirrors a started rest into the persisted state and clears it on stop', () => {
    const t0 = Date.now()
    useUI.getState().startRest(90)
    expect(useUI.getState().timer).toEqual({ left: 90, total: 90, endsAt: t0 + 90000 })
    expect(savedState().restStartedAt).toBe(t0)
    expect(savedState().restDuration).toBe(90)

    useUI.getState().addRest(15)
    expect(useUI.getState().timer).toEqual({ left: 105, total: 105, endsAt: t0 + 105000 })
    expect(savedState().restDuration).toBe(105)

    useUI.getState().stopRest()
    expect(useUI.getState().timer).toBe(null)
    expect(savedState().restStartedAt).toBe(null)
    expect(savedState().restDuration).toBe(null)
  })

  it('rebuilds a still-running rest after a reload and keeps ticking', () => {
    const t0 = Date.now()
    useStore.setState({ S: { ...cleanState(), restStartedAt: t0, restDuration: 90 } })
    vi.setSystemTime(t0 + 10000)                        // 10s of the 90s already elapsed

    useUI.getState().rehydrateRest()
    expect(useUI.getState().timer).toEqual({ left: 80, total: 90, endsAt: t0 + 90000 })

    vi.advanceTimersByTime(5000)
    expect(useUI.getState().timer.left).toBe(75)
    useUI.getState().stopRest()
  })

  it('drops a rest that ended while the app was closed', () => {
    const t0 = Date.now()
    useStore.setState({ S: { ...cleanState(), restStartedAt: t0 - 200000, restDuration: 90 } })
    useUI.getState().rehydrateRest()
    expect(useUI.getState().timer).toBe(null)
    expect(useStore.getState().S.restStartedAt).toBe(null)
    expect(useStore.getState().S.restDuration).toBe(null)
    expect(savedState().restStartedAt).toBe(null)
  })
})

describe('unload guard', () => {
  const fire = () => {
    const e = { preventDefault: vi.fn() }
    ;(winListeners.beforeunload || []).forEach(fn => fn(e))
    return e
  }

  it('warns only while a recent workout is active', () => {
    useStore.setState({ S: { ...cleanState(), active: { start: Date.now() } } })
    expect(fire().preventDefault).toHaveBeenCalled()

    useStore.setState({ S: { ...cleanState(), active: { start: Date.now() - 13 * 60 * 60 * 1000 } } })
    expect(fire().preventDefault).not.toHaveBeenCalled()

    useStore.setState({ S: { ...cleanState(), active: {} } })
    expect(fire().preventDefault).not.toHaveBeenCalled()

    useStore.setState({ S: cleanState() })
    expect(fire().preventDefault).not.toHaveBeenCalled()
  })
})

describe('persist', () => {
  it('keeps the mutation in memory when localStorage refuses the write', () => {
    const setItem = localStorage.setItem
    localStorage.setItem = () => { throw new Error('QuotaExceededError') }
    try { useStore.getState().update(s => { s.unit = 'lb' }, false) }
    finally { localStorage.setItem = setItem }
    expect(useStore.getState().S.unit).toBe('lb')
  })
})
