import { describe, expect, it } from 'vitest'
import { generatePdfToken, verifyPdfToken } from './pdf-signing'

describe('pdf-signing', () => {
  const APPOINTMENT_ID = '11111111-2222-3333-4444-555555555555'
  const ACCOUNT_ID = 'aaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

  it('generates and verifies a valid signed PDF token', () => {
    const expiresAt = Math.floor(Date.now() / 1000) + 3600
    const token = generatePdfToken({
      appointmentId: APPOINTMENT_ID,
      accountId: ACCOUNT_ID,
      expiresAt,
    })

    const result = verifyPdfToken(token, APPOINTMENT_ID)
    expect(result.valid).toBe(true)
    expect(result.accountId).toBe(ACCOUNT_ID)
  })

  it('rejects an expired token', () => {
    const expiresAt = Math.floor(Date.now() / 1000) - 100 // 100s in the past
    const token = generatePdfToken({
      appointmentId: APPOINTMENT_ID,
      accountId: ACCOUNT_ID,
      expiresAt,
    })

    const result = verifyPdfToken(token, APPOINTMENT_ID)
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/expired/i)
  })

  it('rejects a token for a different appointment ID', () => {
    const expiresAt = Math.floor(Date.now() / 1000) + 3600
    const token = generatePdfToken({
      appointmentId: APPOINTMENT_ID,
      accountId: ACCOUNT_ID,
      expiresAt,
    })

    const result = verifyPdfToken(token, '99999999-9999-9999-9999-999999999999')
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/mismatch/i)
  })

  it('rejects a tampered token signature', () => {
    const expiresAt = Math.floor(Date.now() / 1000) + 3600
    const validToken = generatePdfToken({
      appointmentId: APPOINTMENT_ID,
      accountId: ACCOUNT_ID,
      expiresAt,
    })

    // Modify a character in the base64url token
    const tamperedToken = validToken.slice(0, -4) + 'abcd'
    const result = verifyPdfToken(tamperedToken, APPOINTMENT_ID)
    expect(result.valid).toBe(false)
  })

  it('rejects missing or empty tokens', () => {
    expect(verifyPdfToken('', APPOINTMENT_ID).valid).toBe(false)
  })
})
