/**
 * Generator liczb pseudolosowych z ziarnem (mulberry32): to samo ziarno -> ta sama sekwencja.
 * Dane demo wyglądają losowo, ale są powtarzalne - łatwiej o nich mówić i je testować.
 * NIE do kodów ani tokenów - do tego jest crypto.getRandomValues.
 */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function pick<T>(random: () => number, items: readonly T[]): T {
  return items[Math.floor(random() * items.length)]!
}
