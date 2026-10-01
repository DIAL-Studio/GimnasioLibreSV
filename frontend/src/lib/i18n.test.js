import { describe, it, expect, afterEach } from 'vitest'
import { LANGS, detectLang } from './i18n.js'

// Node 21+ defines globalThis.navigator itself, as a getter with no setter — a plain
// assignment throws under ESM's strict mode. defineProperty works on both that and the
// older runtimes where the global simply doesn't exist.
const setNavigator = value =>
  Object.defineProperty(globalThis, 'navigator', { value, configurable: true, writable: true })

afterEach(() => { delete globalThis.navigator })

describe('detectLang', () => {
  it('maps a regional tag to its primary subtag (es-SV → es)', () => {
    setNavigator({ languages: ['es-SV'], language: 'es-SV' })
    expect(detectLang()).toBe('es')
  })

  it('accepts a bare language tag (es → es)', () => {
    setNavigator({ languages: ['es'], language: 'es' })
    expect(detectLang()).toBe('es')
  })

  it('keeps a supported browser language (en-US → en, de-DE → de)', () => {
    setNavigator({ languages: ['en-US'], language: 'en-US' })
    expect(detectLang()).toBe('en')
    setNavigator({ languages: ['de-DE'], language: 'de-DE' })
    expect(detectLang()).toBe('de')
  })

  it('falls back to Spanish — the launch market — for an unsupported language', () => {
    setNavigator({ languages: ['ja-JP'], language: 'ja-JP' })
    expect(detectLang()).toBe('es')
  })

  it('falls back to navigator.language when navigator.languages is missing or empty', () => {
    setNavigator({ language: 'fr-CA' })
    expect(detectLang()).toBe('fr')
    setNavigator({ languages: [], language: 'pt-BR' })
    expect(detectLang()).toBe('pt')
  })

  it('skips unsupported entries and takes the first supported match', () => {
    setNavigator({ languages: ['ja-JP', 'de-DE'], language: 'ja-JP' })
    expect(detectLang()).toBe('de')
  })

  it('is case-insensitive', () => {
    setNavigator({ languages: ['ES-sv'], language: 'ES-sv' })
    expect(detectLang()).toBe('es')
  })

  it('returns Spanish when there is no navigator at all (SSR/tests)', () => {
    delete globalThis.navigator
    expect(detectLang()).toBe('es')
  })

  it('resolves every supported language to itself', () => {
    for (const k of Object.keys(LANGS)) {
      setNavigator({ languages: [k + '-XX'], language: k + '-XX' })
      expect(detectLang()).toBe(k)
    }
  })
})
