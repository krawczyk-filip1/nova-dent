import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import DayPicker from '../DayPicker.vue'

const days = [
  { date: '2026-11-02', count: 4 },
  { date: '2026-11-03', count: 0 },
  { date: '2026-11-04', count: 2 },
  { date: '2026-11-05', count: 1 },
]

function mountPicker(modelValue: string | null = '2026-11-02') {
  const wrapper = mount(DayPicker, {
    props: {
      days,
      today: '2026-11-02',
      modelValue,
      'onUpdate:modelValue': (v: string | null) => void wrapper.setProps({ modelValue: v }),
    },
    attachTo: document.body, // fokus działa tylko w elementach podpiętych do dokumentu
  })
  return wrapper
}

describe('DayPicker', () => {
  it('opisuje dni dla czytników ekranu i oznacza dni bez terminów', () => {
    const wrapper = mountPicker()
    const radios = wrapper.findAll('[role="radio"]')
    expect(radios[0]!.attributes('aria-label')).toBe('poniedziałek, 2 listopada, 4 wolne terminy')
    expect(radios[1]!.attributes('aria-disabled')).toBe('true')
    expect(radios[1]!.attributes('aria-label')).toContain('brak wolnych terminów')
    expect(radios[3]!.attributes('aria-label')).toContain('1 wolny termin')
    expect(radios[0]!.text()).toContain('dziś')
    wrapper.unmount()
  })

  it('tylko zaznaczony dzień jest w kolejności Tab', () => {
    const wrapper = mountPicker('2026-11-04')
    const tabbable = wrapper.findAll('[role="radio"][tabindex="0"]')
    expect(tabbable).toHaveLength(1)
    expect(tabbable[0]!.attributes('aria-checked')).toBe('true')
    wrapper.unmount()
  })

  it('strzałka w prawo zaznacza następny dostępny dzień, pomijając dzień bez terminów', async () => {
    const wrapper = mountPicker()
    const group = wrapper.get('[role="radiogroup"]')
    ;(wrapper.findAll('[role="radio"]')[0]!.element as HTMLElement).focus()

    await group.trigger('keydown', { key: 'ArrowRight' })

    expect(wrapper.emitted('update:modelValue')!.at(-1)).toEqual(['2026-11-04'])
    expect(document.activeElement?.getAttribute('aria-label')).toContain('4 listopada')
    wrapper.unmount()
  })

  it('End i Home skaczą na ostatni i pierwszy dostępny dzień', async () => {
    const wrapper = mountPicker()
    const group = wrapper.get('[role="radiogroup"]')
    ;(wrapper.findAll('[role="radio"]')[0]!.element as HTMLElement).focus()

    await group.trigger('keydown', { key: 'End' })
    expect(wrapper.emitted('update:modelValue')!.at(-1)).toEqual(['2026-11-05'])

    await group.trigger('keydown', { key: 'Home' })
    expect(wrapper.emitted('update:modelValue')!.at(-1)).toEqual(['2026-11-02'])
    wrapper.unmount()
  })

  it('kliknięcie dnia bez terminów niczego nie zmienia', async () => {
    const wrapper = mountPicker()
    await wrapper.findAll('[role="radio"]')[1]!.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    wrapper.unmount()
  })
})
