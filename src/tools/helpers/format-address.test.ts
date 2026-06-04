import { describe, expect, it } from 'vitest'
import { formatAddress } from './imap-client.js'

describe('formatAddress', () => {
  it('returns empty string for null/undefined', () => {
    expect(formatAddress(null)).toBe('')
    expect(formatAddress(undefined)).toBe('')
  })

  it('returns string as is', () => {
    expect(formatAddress('test@example.com')).toBe('test@example.com')
  })

  it('returns addr.text if available', () => {
    expect(formatAddress({ text: 'User <test@example.com>' })).toBe('User <test@example.com>')
  })

  it('formats addr.value array correctly', () => {
    const addr = {
      value: [
        { name: 'User', address: 'test@example.com' },
        { name: '', address: 'no-name@example.com' }
      ]
    }
    expect(formatAddress(addr)).toBe('User <test@example.com>, no-name@example.com')
  })

  it('handles empty value array', () => {
    expect(formatAddress({ value: [] })).toBe('')
  })

  it('handles array of AddressObjects', () => {
    const validAddrs = [{ text: 'User 1 <user1@test.com>' }, { value: [{ name: 'User 2', address: 'user2@test.com' }] }]
    expect(formatAddress(validAddrs)).toBe('User 1 <user1@test.com>, User 2 <user2@test.com>')
  })

  it('returns empty string for unknown objects', () => {
    expect(formatAddress({} as any)).toBe('')
  })
})
