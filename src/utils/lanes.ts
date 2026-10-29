/**
 * Rozkłada nachodzące na siebie przedziały na "tory" (kolumny obok siebie), jak w kalendarzu Google:
 * wizyty bez kolizji zajmują całą szerokość, a dwie równoczesne - po połowie.
 *
 * Zwraca dla każdego elementu: `lane` (numer toru od 0) i `lanes` (ile torów ma jego grupa kolizji).
 */
export function assignLanes<T extends { start: number; end: number }>(
  items: readonly T[],
): (T & { lane: number; lanes: number })[] {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end)
  const result: (T & { lane: number; lanes: number })[] = []

  let group: (T & { lane: number; lanes: number })[] = []
  let groupEnd = -Infinity
  let laneEnds: number[] = []

  const closeGroup = () => {
    for (const item of group) item.lanes = laneEnds.length
    result.push(...group)
    group = []
    laneEnds = []
  }

  for (const item of sorted) {
    if (item.start >= groupEnd) closeGroup()
    // Pierwszy tor, w którym poprzedni element już się skończył (stykające się nie kolidują).
    let lane = laneEnds.findIndex((end) => end <= item.start)
    if (lane === -1) lane = laneEnds.length
    laneEnds[lane] = item.end
    group.push({ ...item, lane, lanes: 0 })
    groupEnd = Math.max(groupEnd, item.end)
  }
  closeGroup()
  return result
}
