import { describe, it, expect } from 'vitest'
import { assignLanes } from '../lanes'

const lanesOf = (items: { id: string; start: number; end: number }[]) =>
  Object.fromEntries(assignLanes(items).map((i) => [i.id, `${i.lane}/${i.lanes}`]))

describe('assignLanes', () => {
  it('bez kolizji każdy element ma całą szerokość', () => {
    expect(
      lanesOf([
        { id: 'a', start: 0, end: 30 },
        { id: 'b', start: 30, end: 60 }, // styka się z a - to nie kolizja
      ]),
    ).toEqual({ a: '0/1', b: '0/1' })
  })

  it('dwa równoczesne - po połowie', () => {
    expect(
      lanesOf([
        { id: 'a', start: 0, end: 60 },
        { id: 'b', start: 30, end: 90 },
      ]),
    ).toEqual({ a: '0/2', b: '1/2' })
  })

  it('zwolniony tor jest używany ponownie, a grupa ma tyle torów, ile max równoczesnych', () => {
    expect(
      lanesOf([
        { id: 'a', start: 0, end: 60 },
        { id: 'b', start: 10, end: 30 },
        { id: 'c', start: 40, end: 70 }, // b już się skończył -> tor 1
        { id: 'd', start: 120, end: 150 }, // osobna grupa
      ]),
    ).toEqual({ a: '0/2', b: '1/2', c: '1/2', d: '0/1' })
  })

  it('trzy naraz - trzy tory', () => {
    expect(
      lanesOf([
        { id: 'a', start: 0, end: 60 },
        { id: 'b', start: 0, end: 60 },
        { id: 'c', start: 15, end: 45 },
      ]),
    ).toEqual({ a: '0/3', b: '1/3', c: '2/3' })
  })
})
