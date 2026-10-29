export function onRadioGroupKeydown(event: KeyboardEvent) {
  const group = event.currentTarget as HTMLElement
  const radios = Array.from(
    group.querySelectorAll<HTMLElement>('[role="radio"]:not([aria-disabled="true"])'),
  )
  if (radios.length === 0) return

  const current = radios.indexOf(document.activeElement as HTMLElement)
  let next: number
  switch (event.key) {
    case 'ArrowRight':
    case 'ArrowDown':
      next = current < 0 ? 0 : (current + 1) % radios.length
      break
    case 'ArrowLeft':
    case 'ArrowUp':
      next = current < 0 ? radios.length - 1 : (current - 1 + radios.length) % radios.length
      break
    case 'Home':
      next = 0
      break
    case 'End':
      next = radios.length - 1
      break
    default:
      return
  }

  event.preventDefault()
  radios[next]!.focus()
  radios[next]!.click()
}
