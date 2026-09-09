/**
 * `crypto.randomUUID()` only exists in "secure contexts" (HTTPS, or the
 * literal hostname `localhost`). This app is tested that way, but the K8s
 * bonus deployment is deliberately plain-HTTP and reached via node-IP:port —
 * not `localhost` — so `crypto.randomUUID` would be `undefined` there, and
 * both TransactionForm and TransactionGenerator would throw on submit.
 *
 * These are client-side reference ids for a simulated system, not
 * security-sensitive values, so a non-cryptographic fallback is fine.
 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}
