export function onRovingKeydown(event: KeyboardEvent, selector: string) {
  const group = event.currentTarget as HTMLElement
  const items = Array.from(group.querySelectorAll<HTMLElement>(selector))
  const current = items.indexOf(document.activeElement as HTMLElement)
  if (current < 0) return

  const next =
    event.key === 'ArrowRight' || event.key === 'ArrowDown'
      ? Math.min(current + 1, items.length - 1)
      : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
        ? Math.max(current - 1, 0)
        : event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? items.length - 1
            : null
  if (next === null) return

  event.preventDefault()
  items[current]!.tabIndex = -1
  items[next]!.tabIndex = 0
  items[next]!.focus()
}
