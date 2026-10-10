import { expect, test } from 'claude-code/testing'

import { keyFor, litKeys, ROWS } from '../hooks/keyboard'

test('maps plain characters to their own key', async () => {
  expect(keyFor('q')).toEqual({ key: 'q', isShifted: false })
  expect(keyFor('7')).toEqual({ key: '7', isShifted: false })
  expect(keyFor(';')).toEqual({ key: ';', isShifted: false })
})

test('holds shift for capitals and shifted symbols', async () => {
  expect(keyFor('A')).toEqual({ key: 'a', isShifted: true })
  expect(keyFor('{')).toEqual({ key: '[', isShifted: true })
  expect(keyFor('"')).toEqual({ key: "'", isShifted: true })
  expect(keyFor('|')).toEqual({ key: '\\', isShifted: true })
})

test('maps whitespace to enter, tab and space, and skips the rest', async () => {
  expect(keyFor('\n')?.key).toBe('enter')
  expect(keyFor('\t')?.key).toBe('tab')
  expect(keyFor(' ')?.key).toBe('space')
  expect(keyFor('é')).toBeUndefined()
})

test('every character a key can type is on the keyboard', async () => {
  const ids = new Set(ROWS.flat().map(k => k.id))
  const sample = 'export const Hi = () => { return "x" + 1 * [2] | 3 }\n\t~`'
  for (const ch of sample) {
    const hit = keyFor(ch)
    expect(hit).toBeDefined()
    expect(ids.has(hit!.key)).toBe(true)
  }
})

test('lights the last characters typed, with shift', async () => {
  expect(litKeys('const X', 0, 7).sort()).toEqual(['shift', 'space', 'x'].sort())
  expect(litKeys('abc', 0, 3, 1)).toEqual(['c'])
  expect(litKeys('abc', 3, 3)).toEqual([])
})

test('auto-indentation lights nothing', async () => {
  // The editor put the spaces in: the last real key was enter.
  expect(litKeys('{\n    ', 1, 6)).toEqual(['enter'])
})
