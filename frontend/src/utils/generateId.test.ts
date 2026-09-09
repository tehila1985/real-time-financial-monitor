import { afterEach, describe, expect, it, vi } from 'vitest'
import { generateId } from './generateId'

describe('generateId', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses crypto.randomUUID when available', () => {
    const id = generateId()
    // jsdom/Node's crypto has randomUUID unconditionally (no "secure context"
    // restriction outside a real browser), so this exercises the fast path.
    expect(id).toMatch(/^[0-9a-f-]{36}$/i)
  })

  it('falls back to a manual UUID when crypto.randomUUID is unavailable', () => {
    // Simulates the real failure mode this was written for: a non-secure
    // context (e.g. the K8s deployment reached via node-IP over plain HTTP,
    // not `localhost`), where crypto.randomUUID is undefined.
    vi.stubGlobal('crypto', {})

    const id = generateId()

    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
  })
})
