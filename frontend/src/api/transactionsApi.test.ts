import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Transaction } from '../types/transaction'
import { getTransactionsSnapshot, postTransaction, updateTransactionStatus } from './transactionsApi'

// Found missing in review: every consumer of this module mocks it away
// (`vi.mock('../api/transactionsApi')`), so the module's own behavior —
// URL construction, method/headers/body, and the shared error-on-!ok
// path — had zero direct coverage anywhere in the suite.
describe('transactionsApi', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    fetchMock.mockReset()
    vi.unstubAllGlobals()
  })

  const sample: Transaction = {
    transactionId: 'tx-1',
    amount: 10,
    currency: 'USD',
    status: 'Pending',
    timestamp: '2026-01-01T00:00:00Z',
  }

  function okResponse(body: unknown) {
    return { ok: true, status: 200, json: () => Promise.resolve(body) }
  }

  describe('postTransaction', () => {
    it('POSTs to /api/transactions with the transaction as JSON, and returns the parsed response', async () => {
      fetchMock.mockResolvedValue(okResponse(sample))

      const result = await postTransaction(sample)

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/transactions$/),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sample),
        }),
      )
      expect(result).toEqual(sample)
    })

    it('throws when the backend responds with a non-ok status', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 429 })

      await expect(postTransaction(sample)).rejects.toThrow('429')
    })
  })

  describe('getTransactionsSnapshot', () => {
    it('GETs /api/transactions with no body, and returns the parsed array', async () => {
      fetchMock.mockResolvedValue(okResponse([sample]))

      const result = await getTransactionsSnapshot()

      expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/api\/transactions$/), undefined)
      expect(result).toEqual([sample])
    })
  })

  describe('updateTransactionStatus', () => {
    it('PUTs to /api/transactions/{id}/status with { status } as the body', async () => {
      const updated = { ...sample, status: 'Completed' as const }
      fetchMock.mockResolvedValue(okResponse(updated))

      const result = await updateTransactionStatus('tx-1', 'Completed')

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/transactions\/tx-1\/status$/),
        expect.objectContaining({
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'Completed' }),
        }),
      )
      expect(result).toEqual(updated)
    })

    it('throws when the transaction id does not exist (404)', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 404 })

      await expect(updateTransactionStatus('unknown-id', 'Failed')).rejects.toThrow('404')
    })
  })
})
