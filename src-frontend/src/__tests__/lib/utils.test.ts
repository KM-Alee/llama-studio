import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { formatBytes, formatDate, cn } from '@/lib/utils'

describe('formatBytes', () => {
  it('returns "0 B" for zero', () => {
    expect(formatBytes(0)).toBe('0 B')
  })

  it('formats bytes under 1 KB', () => {
    expect(formatBytes(512)).toBe('512 B')
  })

  it('formats kilobytes', () => {
    expect(formatBytes(1024)).toBe('1 KB')
    expect(formatBytes(1536)).toBe('1.5 KB')
  })

  it('formats megabytes', () => {
    expect(formatBytes(1024 * 1024)).toBe('1 MB')
    expect(formatBytes(1024 * 1024 * 2.5)).toBe('2.5 MB')
  })

  it('formats gigabytes', () => {
    expect(formatBytes(1024 ** 3)).toBe('1 GB')
  })

  it('formats terabytes', () => {
    expect(formatBytes(1024 ** 4)).toBe('1 TB')
  })
})

describe('cn', () => {
  it('joins class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('filters out falsy values', () => {
    expect(cn('foo', false, null, undefined, 'bar')).toBe('foo bar')
  })

  it('returns empty string when all falsy', () => {
    expect(cn(false, null, undefined)).toBe('')
  })

  it('handles a single class', () => {
    expect(cn('only')).toBe('only')
  })
})

describe('formatDate', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns "just now" within 60 seconds', () => {
    vi.setSystemTime(new Date('2024-01-01T12:00:30Z'))
    expect(formatDate('2024-01-01T12:00:00Z')).toBe('just now')
  })

  it('returns minutes ago within an hour', () => {
    vi.setSystemTime(new Date('2024-01-01T12:05:00Z'))
    expect(formatDate('2024-01-01T12:00:00Z')).toBe('5m ago')
  })

  it('returns hours ago within a day', () => {
    vi.setSystemTime(new Date('2024-01-01T15:00:00Z'))
    expect(formatDate('2024-01-01T12:00:00Z')).toBe('3h ago')
  })

  it('returns days ago within a week', () => {
    vi.setSystemTime(new Date('2024-01-04T12:00:00Z'))
    expect(formatDate('2024-01-01T12:00:00Z')).toBe('3d ago')
  })

  it('returns locale date string for old dates', () => {
    vi.setSystemTime(new Date('2024-02-01T12:00:00Z'))
    const result = formatDate('2024-01-01T12:00:00Z')
    expect(result).toMatch(/\d/)
    expect(result).not.toMatch(/ago/)
  })
})
