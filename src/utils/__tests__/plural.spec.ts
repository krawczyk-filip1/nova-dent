import { describe, it, expect } from 'vitest'
import { countLabel, plural } from '../plural'

const forms = ['termin', 'terminy', 'terminów'] as const

describe('plural', () => {
  it.each([
    [0, 'terminów'],
    [1, 'termin'],
    [2, 'terminy'],
    [4, 'terminy'],
    [5, 'terminów'],
    [11, 'terminów'],
    [12, 'terminów'],
    [14, 'terminów'],
    [21, 'terminów'],
    [22, 'terminy'],
    [112, 'terminów'],
    [124, 'terminy'],
  ])('%i -> %s', (n, expected) => {
    expect(plural(n, forms)).toBe(expected)
  })

  it('countLabel dokleja liczbę', () => {
    expect(countLabel(3, forms)).toBe('3 terminy')
  })
})
