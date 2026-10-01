import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// The interesting part of addPasskey() is the wire contract: the option payload comes back
// from /api/passkey/add/options, gets converted to the ArrayBuffer shapes WebAuthn wants, and
// the created credential goes back to /api/passkey/add/verify. A live server + real
// authenticator can't run here, so fetch and navigator.credentials are faked and the request
// shapes are asserted instead.
//
// api.js reads navigator.userAgent at import time, so the fake browser has to exist before
// the module is imported — each test gets a fresh module (same pattern as wakelock.test.js).
const setNavigator = value =>
  Object.defineProperty(globalThis, 'navigator', { value, configurable: true, writable: true })

// base64url → bytes, for asserting what came out of api.js's own converter
const b64uBytes = s => [...Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))]

// toCreationOptions() mutates the payload it is handed (it replaces the base64url strings with
// ArrayBuffers in place), so every test needs its own copy — like the JSON.parse() result the
// server response would really produce.
const optionsBody = () => ({
  rp: { id: 'localhost', name: 'openGym' },
  user: { id: 'dXNlci0x', name: 'Ana', displayName: 'Ana' },
  challenge: 'Y2hhbGxlbmdl',
  pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
  excludeCredentials: [{ id: 'Y3JlZC0x', type: 'public-key', transports: ['internal'] }],
})

// Minimal shape credToJSON() reads: id, rawId, type, response buffers, transports.
const fakeCredential = () => ({
  id: 'Y3JlZC0y',
  rawId: Uint8Array.from([3, 4, 5]).buffer,
  type: 'public-key',
  authenticatorAttachment: 'platform',
  getClientExtensionResults: () => ({}),
  response: {
    clientDataJSON: Uint8Array.from([1, 2, 3]).buffer,
    attestationObject: Uint8Array.from([7, 8, 9]).buffer,
    getTransports: () => ['internal'],
  },
})

const jsonResponse = (body, ok = true, status = ok ? 200 : 400) => ({ ok, status, json: async () => body })
const verifyBody = { ok: true, passkey: { id: 'Y3JlZC0y', addedAt: '2026-01-01T00:00:00.000Z' } }

let fetchMock, createMock, addPasskey

beforeEach(async () => {
  vi.resetModules()
  fetchMock = vi.fn()
    .mockResolvedValueOnce(jsonResponse({ cid: 'cid-1', options: optionsBody() }))
    .mockResolvedValueOnce(jsonResponse(verifyBody))
  createMock = vi.fn(async () => fakeCredential())
  setNavigator({ userAgent: 'node', credentials: { create: createMock } })
  vi.stubGlobal('fetch', fetchMock)
  ;({ addPasskey } = await import('./api.js'))
})

afterEach(() => {
  vi.unstubAllGlobals()
  delete globalThis.navigator
})

describe('addPasskey', () => {
  it('posts to the add routes and returns the verify response', async () => {
    const res = await addPasskey()
    expect(res).toEqual(verifyBody)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [url1, opts1] = fetchMock.mock.calls[0]
    expect(url1).toBe('/api/passkey/add/options')
    expect(opts1.method).toBe('POST')
    expect(opts1.headers['Content-Type']).toBe('application/json')
    expect(opts1.body).toBe('{}')

    const [url2, opts2] = fetchMock.mock.calls[1]
    expect(url2).toBe('/api/passkey/add/verify')
    expect(opts2.method).toBe('POST')
    expect(JSON.parse(opts2.body)).toEqual({
      cid: 'cid-1',
      credential: {
        id: 'Y3JlZC0y', rawId: 'AwQF', type: 'public-key',
        clientExtensionResults: {}, authenticatorAttachment: 'platform',
        response: { clientDataJSON: 'AQID', attestationObject: 'BwgJ', transports: ['internal'] },
      },
    })
  })

  it('converts challenge, user id and excluded credentials to ArrayBuffers before create()', async () => {
    await addPasskey()
    expect(createMock).toHaveBeenCalledTimes(1)
    const publicKey = createMock.mock.calls[0][0].publicKey
    expect(publicKey.challenge).toBeInstanceOf(ArrayBuffer)
    expect([...new Uint8Array(publicKey.challenge)]).toEqual(b64uBytes(optionsBody().challenge))
    expect([...new Uint8Array(publicKey.user.id)]).toEqual(b64uBytes(optionsBody().user.id))
    // excludeCredentials has to survive the same conversion, or the browser can't tell the
    // authenticator is already registered and offers it for a second passkey anyway.
    expect(publicKey.excludeCredentials).toHaveLength(1)
    expect([...new Uint8Array(publicKey.excludeCredentials[0].id)]).toEqual(b64uBytes('Y3JlZC0x'))
    expect(publicKey.excludeCredentials[0].transports).toEqual(['internal'])
  })

  it('surfaces the server error message when verify rejects', async () => {
    fetchMock.mockReset()
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ cid: 'cid-1', options: optionsBody() }))
      .mockResolvedValueOnce(jsonResponse({ error: 'credential already registered' }, false, 409))
    await expect(addPasskey()).rejects.toThrow('credential already registered')
  })

  it('propagates a cancelled prompt so Settings can stay silent', async () => {
    createMock.mockRejectedValueOnce(Object.assign(new Error('cancelled'), { name: 'NotAllowedError' }))
    await expect(addPasskey()).rejects.toMatchObject({ name: 'NotAllowedError' })
    expect(fetchMock).toHaveBeenCalledTimes(1)   // never reached the verify call
  })
})
